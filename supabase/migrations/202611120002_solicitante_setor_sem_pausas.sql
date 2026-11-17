-- Rode no Supabase > SQL Editor > Run (projeto iyrlbfrsrolwhybumler).
-- Depois de 202611120001_exclusao_com_auditoria.sql.
-- Não altera nenhum dado existente. Pode rodar mais de uma vez.
--
-- Regras do Plantão TI (controle interno da TI):
--   * Solicitante e setor passam a ser obrigatórios.
--   * Pausas deixam de existir: o atendimento conta do contato até a solução.
--
-- Levantamento antes de escrever este script (12/11/2026):
--   * atendimentos: 12 linhas (QA, 02 a 08/11), TODAS reservadas no relatório
--     25147b80 (relatorio_id preenchido). Todas com solicitante e setor vazios.
--   * select count(*) from public.atendimentos where pausa_minutos <> 0;  -> 0
--
-- Sobre o NOT VALID: as constraints valem para todo INSERT e UPDATE novo, mas o
-- Postgres não confere as linhas que já existem. Um UPDATE numa linha antiga com
-- solicitante/setor vazio vai falhar até a pessoa preencher os dois campos.
-- Aceitável porque: (a) o front obriga o preenchimento ao editar; (b) hoje as 12
-- linhas antigas estão reservadas para o RH e o gatilho validar_atendimento já
-- bloqueia qualquer UPDATE nelas, então na prática nada muda para elas.

begin;

-- 1) Solicitante e setor obrigatórios (1 a 120 caracteres, sem contar espaços nas pontas)
alter table public.atendimentos drop constraint if exists atendimentos_solicitante_obrigatorio;
alter table public.atendimentos add  constraint atendimentos_solicitante_obrigatorio
  check (length(trim(solicitante)) between 1 and 120) not valid;

alter table public.atendimentos drop constraint if exists atendimentos_setor_obrigatorio;
alter table public.atendimentos add  constraint atendimentos_setor_obrigatorio
  check (length(trim(setor)) between 1 and 120) not valid;

-- Grants: authenticated já tem update(solicitante, setor). O gerente é o mesmo
-- papel (authenticated) com a policy "gerente edita atendimentos", então também
-- grava esses campos ao editar o registro de outro colaborador. Nada a mudar.
-- preparar_relatorio_horas usa to_jsonb(a): o snapshot já leva solicitante e
-- setor (e todas as outras colunas). Nada a mudar.

-- 2) Sem pausas. A coluna pausa_minutos FICA: a coluna gerada "minutos" e as
--    checks atendimentos_check1/check3 dependem dela, e os snapshots em
--    relatorios_horas.itens a contêm.
do $$
begin
  if exists (select 1 from public.atendimentos where pausa_minutos <> 0) then
    raise exception 'Há atendimentos com pausa_minutos <> 0. Nada foi aplicado; avise o DBA.';
  end if;
end $$;

alter table public.atendimentos drop constraint if exists atendimentos_sem_pausa;
alter table public.atendimentos add  constraint atendimentos_sem_pausa
  check (pausa_minutos = 0) not valid;
-- todas as linhas atuais têm 0 (conferido acima), então já dá para validar
alter table public.atendimentos validate constraint atendimentos_sem_pausa;

-- Ninguém mais altera pausa_minutos pela API. Re-grant das demais colunas.
-- ATENÇÃO FRONT: o UPDATE não pode mais enviar a chave pausa_minutos no payload
-- (o PostgREST recusa com "permission denied"). No INSERT ela pode ir como 0
-- ou ser omitida (default 0).
revoke update on public.atendimentos from authenticated;
revoke update (pausa_minutos) on public.atendimentos from authenticated;
grant  update (titulo, solicitante, setor, descricao, solucao, inicio, fim)
  on public.atendimentos to authenticated;

-- 3) Término no dia seguinte / totais por dia: nenhuma mudança de banco.
--    * validar_atendimento só exige fim > inicio e nada no futuro: um
--      atendimento das 23h às 01h do dia seguinte é aceito.
--    * Não existe view, função ou relatório no banco que agrupe por dia
--      (v_chamados é do legado e não agrupa). O agrupamento por dia é feito no
--      front (relatorios.js) e na Edge Function enviar-relatorio-rh, ambos com
--      timeZone 'America/Sao_Paulo'.

commit;

-- =====================================================================
-- VERIFICAÇÃO (rode depois, um bloco por vez)
-- =====================================================================

-- a) Constraints criadas (convalidated = false -> NOT VALID; sem_pausa deve ser true)
-- select conname, convalidated, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.atendimentos'::regclass
--    and conname in ('atendimentos_solicitante_obrigatorio','atendimentos_setor_obrigatorio','atendimentos_sem_pausa');

-- b) Grants atuais de atendimentos para authenticated
--    (esperado: select, insert, delete; update só em titulo, solicitante, setor,
--     descricao, solucao, inicio, fim — SEM pausa_minutos)
-- select privilege_type,
--        has_table_privilege('authenticated','public.atendimentos',privilege_type) as tem
--   from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) privilege_type;
-- select a.attname as coluna_editavel
--   from pg_attribute a
--  where a.attrelid = 'public.atendimentos'::regclass and a.attnum > 0 and not a.attisdropped
--    and has_column_privilege('authenticated', a.attrelid, a.attname, 'UPDATE')
--  order by 1;

-- c) Insert inválido (solicitante vazio) TEM que falhar. Não grava nada:
--    se a regra funcionar aparece NOTICE "OK"; se não, dá erro "FALHOU".
-- do $$
-- begin
--   insert into public.atendimentos (usuario_id, titulo, solicitante, setor, solucao, inicio, fim)
--   values ((select id from public.perfis limit 1), 'teste DBA', '', 'TI', 'teste',
--           '2020-01-01 10:00-03', '2020-01-01 11:00-03');
--   raise exception 'FALHOU: insert com solicitante vazio foi aceito';
-- exception when check_violation then
--   raise notice 'OK: insert inválido recusado (%)', sqlerrm;
-- end $$;

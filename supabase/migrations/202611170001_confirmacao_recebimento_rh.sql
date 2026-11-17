-- Rode no Supabase > SQL Editor > Run (projeto iyrlbfrsrolwhybumler).
-- Depois de 202611120002_solicitante_setor_sem_pausas.sql.
-- Não altera dados existentes. Pode rodar mais de uma vez.
--
-- Confirmação de recebimento pelo RH:
--   * Envio novo: a Edge Function marca pede_confirmacao = true.
--   * O RH abre o link do e-mail (página pública, sem login), digita o nome e
--     confirma. A Edge Function valida o link (HMAC) e chama
--     confirmar_recebimento() com service_role.
--   * 7 dias corridos sem confirmação -> alerta; colaborador ou gerente pode
--     reenviar lembrete (no máximo 1 a cada 24h) via registrar_lembrete().
--   * A confirmação é só prova de entrega: a trava dos atendimentos
--     (relatorio_id + validar_atendimento) continua igual.
--
-- Estado atual (17/11/2026): 4 relatórios de teste (a2b10357, 25147b80,
-- f4571c68, d5804784), todos 'aceito'. Com os defaults abaixo ficam
-- pede_confirmacao = false, sem recebimento e lembretes = 0 -> aparecem como
-- "Enviado", sem alerta. Nenhum UPDATE é feito neles.

begin;

-- 1) Colunas novas
alter table public.relatorios_horas
  add column if not exists pede_confirmacao   boolean     not null default false,
  add column if not exists recebido_em        timestamptz,
  add column if not exists recebido_por       text,
  add column if not exists lembretes          integer     not null default 0,
  add column if not exists ultimo_lembrete_em timestamptz;

-- Checks (as linhas atuais já cumprem todas, então ficam validadas)
alter table public.relatorios_horas drop constraint if exists relatorios_horas_recebido_junto;
alter table public.relatorios_horas add  constraint relatorios_horas_recebido_junto
  check ((recebido_em is null) = (recebido_por is null));

alter table public.relatorios_horas drop constraint if exists relatorios_horas_recebido_elegivel;
alter table public.relatorios_horas add  constraint relatorios_horas_recebido_elegivel
  check (recebido_em is null or (estado = 'aceito' and pede_confirmacao));

alter table public.relatorios_horas drop constraint if exists relatorios_horas_recebido_por_tamanho;
alter table public.relatorios_horas add  constraint relatorios_horas_recebido_por_tamanho
  check (recebido_por is null or length(trim(recebido_por)) between 2 and 80);

alter table public.relatorios_horas drop constraint if exists relatorios_horas_lembretes_positivo;
alter table public.relatorios_horas add  constraint relatorios_horas_lembretes_positivo
  check (lembretes >= 0);

-- 2) Confirmação de recebimento (só service_role)
create or replace function public.confirmar_recebimento(p_relatorio uuid, p_nome text)
returns public.relatorios_horas
language plpgsql security definer set search_path = '' as $$
declare
  r public.relatorios_horas;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  select * into r from public.relatorios_horas where id = p_relatorio for update;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;

  -- Já confirmado: não sobrescreve, devolve como está.
  if r.recebido_em is not null then
    return r;
  end if;

  if r.estado <> 'aceito' then
    raise exception 'Este relatório ainda não foi enviado ao RH.';
  end if;
  if not r.pede_confirmacao then
    raise exception 'Este relatório não pede confirmação de recebimento.';
  end if;
  if length(v_nome) not between 2 and 80 then
    raise exception 'Informe o nome de quem confirmou (2 a 80 caracteres).';
  end if;

  update public.relatorios_horas
     set recebido_em = now(), recebido_por = v_nome
   where id = p_relatorio
  returning * into r;
  return r;
end $$;
revoke all     on function public.confirmar_recebimento(uuid, text) from public, anon, authenticated;
grant  execute on function public.confirmar_recebimento(uuid, text) to service_role;

-- 3) Lembrete ao RH (só service_role)
create or replace function public.registrar_lembrete(p_relatorio uuid)
returns public.relatorios_horas
language plpgsql security definer set search_path = '' as $$
declare
  r public.relatorios_horas;
begin
  select * into r from public.relatorios_horas where id = p_relatorio for update;
  if not found then
    raise exception 'Relatório não encontrado.';
  end if;
  if r.estado <> 'aceito' then
    raise exception 'Este relatório ainda não foi enviado ao RH.';
  end if;
  if not r.pede_confirmacao then
    raise exception 'Este relatório não pede confirmação de recebimento.';
  end if;
  if r.recebido_em is not null then
    raise exception 'O RH já confirmou o recebimento.';
  end if;
  if r.aceito_em > now() - interval '7 days' then
    raise exception 'Ainda não fez 7 dias do envio: o lembrete só pode ser enviado a partir de %.',
      to_char((r.aceito_em + interval '7 days') at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  end if;
  if r.ultimo_lembrete_em is not null and r.ultimo_lembrete_em > now() - interval '24 hours' then
    raise exception 'Já foi enviado um lembrete há menos de 24 horas: o próximo pode ser enviado a partir de %.',
      to_char((r.ultimo_lembrete_em + interval '24 hours') at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  end if;

  update public.relatorios_horas
     set lembretes = lembretes + 1, ultimo_lembrete_em = now()
   where id = p_relatorio
  returning * into r;
  return r;
end $$;
revoke all     on function public.registrar_lembrete(uuid) from public, anon, authenticated;
grant  execute on function public.registrar_lembrete(uuid) to service_role;

-- 4) Leitura: authenticated continua só com SELECT (sem grant novo).
--    As policies "meus relatorios" e "gerente ve relatorios" são por linha,
--    então já enxergam as colunas novas. Garantia extra de que não há escrita:
revoke insert, update, delete, truncate on public.relatorios_horas from anon, authenticated;

commit;

-- =====================================================================
-- VERIFICAÇÃO (rode depois, um bloco por vez)
-- =====================================================================

-- a) Colunas criadas
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'relatorios_horas'
--    and column_name in ('pede_confirmacao','recebido_em','recebido_por','lembretes','ultimo_lembrete_em');

-- b) Checks
-- select conname, convalidated, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.relatorios_horas'::regclass and contype = 'c'
--  order by conname;

-- c) Grants das funções (esperado: só service_role = true)
-- select f, r, has_function_privilege(r, f, 'EXECUTE') as executa
--   from unnest(array['public.confirmar_recebimento(uuid,text)','public.registrar_lembrete(uuid)']) f,
--        unnest(array['anon','authenticated','service_role']) r
--  order by f, r;

-- d) Leitura e escrita de authenticated na tabela (esperado: só SELECT)
-- select p, has_table_privilege('authenticated','public.relatorios_horas',p)
--   from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p;

-- e) Os 4 relatórios de teste continuam sem confirmação
-- select left(id::text,8) id, estado, pede_confirmacao, recebido_em, recebido_por, lembretes
--   from public.relatorios_horas order by criado_em;

-- f) confirmar_recebimento em relatório com pede_confirmacao = false TEM que falhar.
--    Roda em transação com rollback: não grava nada.
-- begin;
-- select public.confirmar_recebimento('a2b10357-92cb-41a9-9b0e-e8c90451f207', 'Teste DBA');
-- -- esperado: ERROR: Este relatório não pede confirmação de recebimento.
-- rollback;

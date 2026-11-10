-- Plantão TI — banco do sistema novo (relatórios de horas).
-- Junta, em UMA transação, as migrações de supabase/migrations/:
--   202610210001_atendimentos, 202610210002_revisao_ia,
--   202610210003_excluir_atendimentos, 202611090001_lista_permitidos_atendimentos
-- Se qualquer parte falhar, nada é aplicado. Rode uma única vez.
-- Pré-requisitos já aplicados: schema.sql, login-microsoft.sql,
-- ajustes-seguranca.sql e schema-privado.sql (private.eh_permitido).
-- NÃO rodar o nomes-perfis.sql (vai ser refeito junto com a tela de perfil).

begin;

-- trava de segurança: aborta se o pré-requisito não existir ou se já foi aplicado
do $$
begin
  if to_regprocedure('private.eh_permitido()') is null then
    raise exception 'Falta private.eh_permitido(): rode schema-privado.sql antes.';
  end if;
  if to_regclass('public.atendimentos') is not null then
    raise exception 'public.atendimentos já existe: este script já foi aplicado.';
  end if;
end $$;

-- ===================== 202610210001_atendimentos.sql =====================
-- Execute depois de schema.sql. Não altera os chamados existentes.

create table public.relatorios_horas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id),
  nome text not null,
  destinatarios text[] not null,
  remetente text not null,
  itens jsonb not null,
  estado text not null default 'pendente' check (estado in ('pendente','aceito')),
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  provedor_id text,
  ultimo_erro text
);

create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  solicitante text not null default '',
  setor text not null default '',
  descricao text not null default '',
  solucao text not null default '',
  inicio timestamptz not null,
  fim timestamptz,
  pausa_minutos integer not null default 0 check (pausa_minutos >= 0),
  minutos numeric generated always as (
    case when fim is not null then extract(epoch from (fim-inicio))/60 - pausa_minutos end
  ) stored,
  relatorio_id uuid references public.relatorios_horas(id),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim > inicio),
  check (fim is null or extract(epoch from (fim-inicio))/60 > pausa_minutos),
  check (fim is null or length(trim(solucao)) > 0),
  check (fim is not null or pausa_minutos = 0)
);
create index atendimentos_usuario_inicio on public.atendimentos(usuario_id,inicio desc);
create unique index atendimentos_um_em_andamento on public.atendimentos(usuario_id) where fim is null;

create function public.validar_atendimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.usuario_id::text, 0));
  if tg_op = 'UPDATE' then
    if old.relatorio_id is not null then
      raise exception 'Este atendimento já faz parte de um relatório e não pode ser alterado.';
    end if;
    if new.usuario_id <> old.usuario_id or new.id <> old.id then
      raise exception 'Não é possível trocar o responsável ou a identificação.';
    end if;
  end if;
  if new.inicio > now() or new.fim > now() then
    raise exception 'Os horários não podem estar no futuro.';
  end if;
  if exists (
    select 1 from public.atendimentos a where a.usuario_id = new.usuario_id and a.id <> new.id
    and tstzrange(a.inicio,a.fim,'[)') && tstzrange(new.inicio,new.fim,'[)')
  ) then
    raise exception 'Já existe atendimento nesse intervalo. Ajuste os horários para não contar horas duas vezes.';
  end if;
  new.atualizado_em := clock_timestamp();
  return new;
end $$;
create trigger validar_atendimento before insert or update on public.atendimentos
for each row execute function public.validar_atendimento();

alter table public.atendimentos enable row level security;
alter table public.relatorios_horas enable row level security;
create policy "meus atendimentos" on public.atendimentos for select to authenticated using (usuario_id = auth.uid());
create policy "registrar meus atendimentos" on public.atendimentos for insert to authenticated
with check (usuario_id = auth.uid() and relatorio_id is null);
create policy "editar meus atendimentos" on public.atendimentos for update to authenticated
using (usuario_id = auth.uid() and relatorio_id is null) with check (usuario_id = auth.uid() and relatorio_id is null);
create policy "meus relatorios" on public.relatorios_horas for select to authenticated using (usuario_id = auth.uid());
grant select,insert on public.atendimentos to authenticated;
grant update(titulo,solicitante,setor,descricao,solucao,inicio,fim,pausa_minutos) on public.atendimentos to authenticated;
revoke update on public.atendimentos from authenticated;
grant update(titulo,solicitante,setor,descricao,solucao,inicio,fim,pausa_minutos) on public.atendimentos to authenticated;
grant select on public.relatorios_horas to authenticated;
revoke insert,update,delete on public.relatorios_horas from authenticated,anon;

-- Só a função de servidor pode reservar registros e marcar um relatório.
create function public.preparar_relatorio_horas(p_usuario uuid,p_ids uuid[],p_versoes jsonb,p_destinatarios text[],p_remetente text)
returns public.relatorios_horas language plpgsql security definer set search_path = '' as $$
declare r public.relatorios_horas; snapshot jsonb; quantidade integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
  if coalesce(cardinality(p_ids),0) not between 1 and 200 then
    raise exception 'Selecione de 1 a 200 atendimentos.';
  end if;
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Seleção repetida.';
  end if;
  perform 1 from public.atendimentos where usuario_id=p_usuario and id=any(p_ids) for update;
  select count(*),jsonb_agg(to_jsonb(a) order by a.inicio,a.id) into quantidade,snapshot
  from public.atendimentos a where a.usuario_id=p_usuario and a.id=any(p_ids)
  and a.fim is not null and a.relatorio_id is null
  and a.atualizado_em = (p_versoes->>a.id::text)::timestamptz;
  if quantidade <> cardinality(p_ids) then
    raise exception 'A seleção mudou ou já está em um relatório. Atualize a lista e confira novamente.';
  end if;
  insert into public.relatorios_horas(usuario_id,nome,destinatarios,remetente,itens)
  select p_usuario,p.nome,p_destinatarios,p_remetente,snapshot from public.perfis p where p.id=p_usuario returning * into r;
  if r.id is null then raise exception 'Perfil não encontrado.'; end if;
  update public.atendimentos set relatorio_id=r.id where id=any(p_ids) and usuario_id=p_usuario;
  return r;
end $$;
revoke all on function public.preparar_relatorio_horas(uuid,uuid[],jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.preparar_relatorio_horas(uuid,uuid[],jsonb,text[],text) to service_role;

-- ===================== 202610210002_revisao_ia.sql =====================
-- Aplicar somente para ativar a revisão com IA. Não modifica relatos nem horas.
create table public.uso_revisao_ia (
  usuario_id uuid primary key references public.perfis(id),
  janela timestamptz not null,
  requisicoes integer not null check (requisicoes between 1 and 10)
);
alter table public.uso_revisao_ia enable row level security;
revoke all on public.uso_revisao_ia from public,anon,authenticated;
grant select,insert,update on public.uso_revisao_ia to service_role;
create function public.reservar_revisao_ia(p_usuario uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare permitido boolean;
begin
  insert into public.uso_revisao_ia(usuario_id,janela,requisicoes)
  values(p_usuario,date_trunc('hour',now()),1)
  on conflict(usuario_id) do update
  set janela=excluded.janela,
      requisicoes=case when uso_revisao_ia.janela=excluded.janela then uso_revisao_ia.requisicoes+1 else 1 end
  where uso_revisao_ia.janela<>excluded.janela or uso_revisao_ia.requisicoes<10
  returning true into permitido;
  return coalesce(permitido,false);
end $$;
revoke all on function public.reservar_revisao_ia(uuid) from public,anon,authenticated;
grant execute on function public.reservar_revisao_ia(uuid) to service_role;

-- ===================== 202610210003_excluir_atendimentos.sql =====================
-- Permite a cada colaborador excluir apenas seus próprios registros ainda não reservados para o RH.

create policy "excluir meus atendimentos" on public.atendimentos
for delete to authenticated
using (usuario_id = auth.uid() and relatorio_id is null);

revoke delete on public.atendimentos from anon;
grant delete on public.atendimentos to authenticated;

create function public.proteger_exclusao_atendimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.relatorio_id is not null then
    raise exception 'Este atendimento já faz parte de um relatório para o RH e não pode ser excluído.';
  end if;
  return old;
end $$;

create trigger proteger_exclusao_atendimento
before delete on public.atendimentos
for each row execute function public.proteger_exclusao_atendimento();


-- ===================== 202611090001_lista_permitidos_atendimentos.sql =====================
-- Rode DEPOIS das migrações 001, 002 e 003 do Pedro (Supabase > SQL Editor > Run).
-- Projeto iyrlbfrsrolwhybumler (login Microsoft).
-- As regras do Pedro só checam "é dono do registro". Aqui somamos a lista de
-- e-mails liberados (private.eh_permitido), igual já fazemos em perfis/chamados:
-- tirar alguém de emails_permitidos corta o acesso aos atendimentos na hora.


drop policy if exists "meus atendimentos"           on public.atendimentos;
drop policy if exists "registrar meus atendimentos" on public.atendimentos;
drop policy if exists "editar meus atendimentos"    on public.atendimentos;
drop policy if exists "excluir meus atendimentos"   on public.atendimentos;
drop policy if exists "meus relatorios"             on public.relatorios_horas;

create policy "meus atendimentos" on public.atendimentos for select to authenticated
  using (usuario_id = auth.uid() and private.eh_permitido());
create policy "registrar meus atendimentos" on public.atendimentos for insert to authenticated
  with check (usuario_id = auth.uid() and relatorio_id is null and private.eh_permitido());
create policy "editar meus atendimentos" on public.atendimentos for update to authenticated
  using (usuario_id = auth.uid() and relatorio_id is null and private.eh_permitido())
  with check (usuario_id = auth.uid() and relatorio_id is null and private.eh_permitido());
create policy "excluir meus atendimentos" on public.atendimentos for delete to authenticated
  using (usuario_id = auth.uid() and relatorio_id is null and private.eh_permitido());
create policy "meus relatorios" on public.relatorios_horas for select to authenticated
  using (usuario_id = auth.uid() and private.eh_permitido());

-- Funções de gatilho SECURITY DEFINER: ninguém chama pela API (aviso do Security Advisor).
revoke execute on function public.validar_atendimento()            from public, anon, authenticated;
revoke execute on function public.proteger_exclusao_atendimento()  from public, anon, authenticated;


commit;

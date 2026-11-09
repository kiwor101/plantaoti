-- Execute depois de schema.sql. Não altera os chamados existentes.
begin;

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
commit;

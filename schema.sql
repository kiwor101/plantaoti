-- Cole este script em Supabase > SQL Editor > Run

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cargo text
);

create table public.chamados (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text not null,
  solicitante text,
  categoria text not null default 'Outros',
  prioridade text not null default 'Média' check (prioridade in ('Baixa','Média','Alta','Crítica')),
  status text not null default 'Aberto' check (status in ('Aberto','Fechado')),
  solucao text,
  plantao_data date not null default current_date, -- sábado do plantão
  aberto_por uuid not null references public.perfis(id) default auth.uid(),
  fechado_por uuid references public.perfis(id),
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz,
  check (status = 'Aberto' or solucao is not null)
);

create index on public.chamados (status, aberto_em desc);
create index on public.chamados (plantao_data);

-- cria o perfil automaticamente quando um usuário é criado
create function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.novo_perfil();

-- segurança: só usuários logados acessam
alter table public.perfis enable row level security;
alter table public.chamados enable row level security;

create policy "ver perfis" on public.perfis for select to authenticated using (true);
create policy "editar meu perfil" on public.perfis for update to authenticated using (id = auth.uid());

create policy "ver chamados" on public.chamados for select to authenticated using (true);
create policy "abrir chamado" on public.chamados for insert to authenticated with check (aberto_por = auth.uid());
create policy "atualizar chamado" on public.chamados for update to authenticated using (true);
-- sem policy de delete: ninguém apaga registros (histórico preservado)

-- view pronta para o futuro dashboard
create view public.v_chamados as
select c.*, a.nome as aberto_por_nome, f.nome as fechado_por_nome,
       extract(epoch from (c.fechado_em - c.aberto_em))/60 as minutos_ate_fechar
from public.chamados c
join public.perfis a on a.id = c.aberto_por
left join public.perfis f on f.id = c.fechado_por;
alter view public.v_chamados set (security_invoker = true);

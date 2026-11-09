-- Rode DEPOIS do schema.sql (Supabase > SQL Editor > Run).
-- Login com Microsoft: só entram os e-mails desta lista.

-- 1) Lista de quem pode usar o app
create table if not exists public.emails_permitidos (
  email text primary key check (email = lower(email))
);
alter table public.emails_permitidos enable row level security;
-- sem policies: só o painel do Supabase (SQL Editor / Table Editor) mexe nela

-- o nome de cada um vem da conta Microsoft no primeiro login
insert into public.emails_permitidos (email) values
  ('suporteti.luiz@santacasaandradina.org'),
  ('suporteti.rafael@santacasaandradina.org'),
  ('gerencia.ti@santacasaandradina.org')
  -- para adicionar mais alguém depois, rode só:
  -- insert into public.emails_permitidos (email) values ('fulano@santacasaandradina.org');
on conflict (email) do nothing;

-- 2) O usuário logado está na lista?
create or replace function public.eh_permitido() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from emails_permitidos
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 3) No primeiro login: bloqueia quem não está na lista e cria o perfil
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from emails_permitidos where email = lower(new.email)) then
    raise exception 'E-mail % não liberado para o Plantões TI', new.email;
  end if;
  insert into perfis (id, nome)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name',
                   new.raw_user_meta_data ->> 'name',
                   split_part(new.email, '@', 1)));
  return new;
end $$;

-- 4) Regras de acesso: além de logado, precisa estar na lista
--    (tirar alguém da lista corta o acesso na hora)
drop policy if exists "ver perfis"         on public.perfis;
drop policy if exists "editar meu perfil"  on public.perfis;
drop policy if exists "ver chamados"       on public.chamados;
drop policy if exists "abrir chamado"      on public.chamados;
drop policy if exists "atualizar chamado"  on public.chamados;

create policy "ver perfis" on public.perfis for select to authenticated
  using (public.eh_permitido());
create policy "editar meu perfil" on public.perfis for update to authenticated
  using (id = auth.uid() and public.eh_permitido());
create policy "ver chamados" on public.chamados for select to authenticated
  using (public.eh_permitido());
create policy "abrir chamado" on public.chamados for insert to authenticated
  with check (aberto_por = auth.uid() and public.eh_permitido());
create policy "atualizar chamado" on public.chamados for update to authenticated
  using (public.eh_permitido());

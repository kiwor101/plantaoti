-- Rode DEPOIS do schema-privado.sql (Supabase > SQL Editor > Run).
-- O provider Azure do Supabase não repassa o nome da conta Microsoft
-- (só e-mail e tenant), mesmo com o escopo "profile". Então o nome
-- passa a ser cadastrado junto com o e-mail na lista de liberados.

begin;

-- 1) Coluna de nome na lista de liberados
alter table public.emails_permitidos add column if not exists nome text;

-- >>> AJUSTE OS NOMES ABAIXO ANTES DE RODAR <<<
update public.emails_permitidos set nome = 'Luiz'        where email = 'suporteti.luiz@santacasaandradina.org';
update public.emails_permitidos set nome = 'Rafael'      where email = 'suporteti.rafael@santacasaandradina.org';
update public.emails_permitidos set nome = 'Gerência TI' where email = 'gerencia.ti@santacasaandradina.org';

-- 2) Primeiro login: usa o nome da lista; se não tiver, cai no padrão antigo
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
begin
  select nome into v_nome from emails_permitidos where email = lower(new.email);
  if not found then
    raise exception 'E-mail % não liberado para o Plantões TI', new.email;
  end if;
  insert into perfis (id, nome)
  values (new.id,
          coalesce(nullif(trim(v_nome), ''),
                   new.raw_user_meta_data ->> 'full_name',
                   new.raw_user_meta_data ->> 'name',
                   split_part(new.email, '@', 1)));
  return new;
end $$;
revoke execute on function public.novo_perfil() from anon, authenticated, public;

-- 3) Mudou o nome na lista -> atualiza o perfil de quem já entrou
create or replace function private.sincroniza_nome_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(new.nome), '') is not null then
    update perfis p set nome = trim(new.nome)
      from auth.users u
     where u.id = p.id and lower(u.email) = new.email;
  end if;
  return new;
end $$;
revoke execute on function private.sincroniza_nome_perfil() from public, anon, authenticated;

drop trigger if exists sincroniza_nome on public.emails_permitidos;
create trigger sincroniza_nome after insert or update of nome on public.emails_permitidos
for each row execute function private.sincroniza_nome_perfil();

-- 4) Corrige quem já tem perfil
update perfis p set nome = trim(e.nome)
  from auth.users u
  join public.emails_permitidos e on e.email = lower(u.email)
 where u.id = p.id and nullif(trim(e.nome), '') is not null;

commit;

-- Daqui pra frente, para liberar alguém novo:
-- insert into public.emails_permitidos (email, nome) values ('fulano@santacasaandradina.org', 'Fulano');
-- Para trocar um nome: update public.emails_permitidos set nome = 'Novo Nome' where email = '...';

-- Rode DEPOIS do permissoes-tabelas.sql (Supabase > SQL Editor > Run).
-- O provider Azure do Supabase não repassa o nome da conta Microsoft
-- (só e-mail e tenant), mesmo com o escopo "profile". Então o nome
-- inicial de cada pessoa é cadastrado junto com o e-mail na lista de liberados.
--
-- O nome da lista vale só como VALOR INICIAL: depois disso quem manda é o
-- perfil (a futura tela "Meu perfil" edita perfis.nome). Por isso não há
-- trigger sincronizando a lista com o perfil.

begin;

-- 1) Coluna de nome na lista de liberados
alter table public.emails_permitidos add column if not exists nome text;

-- >>> CONFIRA OS NOMES ABAIXO ANTES DE RODAR (é o que aparece no topo da tela) <<<
update public.emails_permitidos set nome = 'Luiz'        where email = 'suporteti.luiz@santacasaandradina.org';
update public.emails_permitidos set nome = 'Rafael'      where email = 'suporteti.rafael@santacasaandradina.org';
update public.emails_permitidos set nome = 'Gerência TI' where email = 'gerencia.ti@santacasaandradina.org';

-- 2) Primeiro login: usa o nome da lista; se não tiver, cai no início do e-mail
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
revoke execute on function public.novo_perfil() from public, anon, authenticated;

-- 3) Corrige quem já entrou e ainda está com o nome automático (início do e-mail).
--    Quem já tiver trocado o próprio nome não é mexido.
update public.perfis p set nome = trim(e.nome)
  from auth.users u
  join public.emails_permitidos e on e.email = lower(u.email)
 where u.id = p.id
   and nullif(trim(e.nome), '') is not null
   and p.nome = split_part(u.email, '@', 1);

-- limpeza: remove o trigger de sincronização caso uma versão antiga deste script tenha rodado
drop trigger if exists sincroniza_nome on public.emails_permitidos;
drop function if exists private.sincroniza_nome_perfil();

commit;

-- Para liberar alguém novo:
-- insert into public.emails_permitidos (email, nome) values ('fulano@santacasaandradina.org', 'Fulano de Tal');

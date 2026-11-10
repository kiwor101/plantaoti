-- Rode DEPOIS do login-microsoft.sql (Supabase > SQL Editor > Run).
-- Ajustes apontados pelo Security Advisor do Supabase.

-- 1) Funções SECURITY DEFINER não devem ser chamáveis por quem não está logado.
--    eh_permitido: só usuários logados (as policies de RLS dependem dela).
revoke execute on function public.eh_permitido() from anon, public;
grant  execute on function public.eh_permitido() to authenticated;

--    novo_perfil: só o trigger em auth.users usa; ninguém chama pela API.
revoke execute on function public.novo_perfil() from anon, authenticated, public;

-- 2) Perfis criados antes do escopo "profile" ficaram com o nome tirado do e-mail.
--    Ajuste à mão quem precisar (troque o nome abaixo):
-- update public.perfis set nome = 'Nome Completo'
--  where id = (select id from auth.users where email = 'suporteti.luiz@santacasaandradina.org');

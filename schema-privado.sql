-- Rode DEPOIS do ajustes-seguranca.sql (Supabase > SQL Editor > Run).
-- Move eh_permitido() para um schema que a API (PostgREST) não expõe.
-- Assim ela some de /rest/v1/rpc e o aviso do Security Advisor desaparece.
-- As 5 policies guardam a função pelo OID, então continuam funcionando sem recriar.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;   -- o RLS precisa enxergar a função

alter function public.eh_permitido() set schema private;

-- garante as permissões depois da mudança
revoke execute on function private.eh_permitido() from public, anon;
grant  execute on function private.eh_permitido() to authenticated;

commit;

-- Rode DEPOIS do nomes-perfis.sql (Supabase > SQL Editor > Run).
-- Cria o papel de GERENTE: vê, edita e exclui atendimentos de todos e vê todos
-- os relatórios. As regras do dono continuam iguais; as do gerente são SOMADAS
-- (policies permissivas se combinam com OU).
-- Registros já reservados para o RH seguem travados para todos, inclusive o
-- gerente (gatilhos validar_atendimento e proteger_exclusao_atendimento).

begin;

-- 1) Fecha a brecha: ninguém altera o próprio cargo pela API.
--    Cargo passa a ser definido só pelo painel / SQL Editor.
revoke update on public.perfis from authenticated;
revoke update (cargo) on public.perfis from authenticated;
grant  update (nome)  on public.perfis to authenticated;

-- 2) private.eh_gerente(): mesmo padrão da eh_permitido()
create or replace function private.eh_gerente() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.eh_permitido()
     and exists (
       select 1 from public.perfis
        where id = auth.uid() and cargo = 'Gerente'
     );
$$;
revoke execute on function private.eh_gerente() from public, anon;
grant  execute on function private.eh_gerente() to authenticated;

-- 3) Define o gerente
update public.perfis p set cargo = 'Gerente'
  from auth.users u
 where u.id = p.id and lower(u.email) = 'gerencia.ti@santacasaandradina.org';

do $$
begin
  if not exists (select 1 from public.perfis where cargo = 'Gerente') then
    raise exception 'Perfil de gerencia.ti não encontrado: nada foi aplicado.';
  end if;
end $$;

-- 4) Policies do gerente (as do dono não mudam)
drop policy if exists "gerente ve atendimentos"      on public.atendimentos;
drop policy if exists "gerente edita atendimentos"   on public.atendimentos;
drop policy if exists "gerente exclui atendimentos"  on public.atendimentos;
drop policy if exists "gerente ve relatorios"        on public.relatorios_horas;

create policy "gerente ve atendimentos" on public.atendimentos
  for select to authenticated
  using (private.eh_gerente());

create policy "gerente edita atendimentos" on public.atendimentos
  for update to authenticated
  using      (relatorio_id is null and private.eh_gerente())
  with check (relatorio_id is null and private.eh_gerente());

create policy "gerente exclui atendimentos" on public.atendimentos
  for delete to authenticated
  using (relatorio_id is null and private.eh_gerente());

create policy "gerente ve relatorios" on public.relatorios_horas
  for select to authenticated
  using (private.eh_gerente());

-- INSERT: sem policy nova; "registrar meus atendimentos" continua exigindo
-- usuario_id = auth.uid(), então o gerente não cria registro em nome de outro.
-- Colunas editáveis: as mesmas do grant de update já existente (não muda).

commit;

-- Trocar/adicionar gerente depois (pelo SQL Editor):
-- update public.perfis set cargo = 'Gerente' where id = (select id from auth.users where email = 'fulano@santacasaandradina.org');
-- Tirar: update public.perfis set cargo = null where id = (...);

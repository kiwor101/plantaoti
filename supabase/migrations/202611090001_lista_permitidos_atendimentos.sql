-- Rode DEPOIS das migrações 001, 002 e 003 do Pedro (Supabase > SQL Editor > Run).
-- Projeto iyrlbfrsrolwhybumler (login Microsoft).
-- As regras do Pedro só checam "é dono do registro". Aqui somamos a lista de
-- e-mails liberados (private.eh_permitido), igual já fazemos em perfis/chamados:
-- tirar alguém de emails_permitidos corta o acesso aos atendimentos na hora.

begin;

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

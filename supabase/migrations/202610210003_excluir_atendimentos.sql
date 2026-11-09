-- Permite a cada colaborador excluir apenas seus próprios registros ainda não reservados para o RH.
begin;

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

commit;

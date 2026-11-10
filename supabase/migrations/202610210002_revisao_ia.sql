-- Aplicar somente para ativar a revisão com IA. Não modifica relatos nem horas.
begin;
create table public.uso_revisao_ia (
  usuario_id uuid primary key references public.perfis(id),
  janela timestamptz not null,
  requisicoes integer not null check (requisicoes between 1 and 10)
);
alter table public.uso_revisao_ia enable row level security;
revoke all on public.uso_revisao_ia from public,anon,authenticated;
grant select,insert,update on public.uso_revisao_ia to service_role;
create function public.reservar_revisao_ia(p_usuario uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare permitido boolean;
begin
  insert into public.uso_revisao_ia(usuario_id,janela,requisicoes)
  values(p_usuario,date_trunc('hour',now()),1)
  on conflict(usuario_id) do update
  set janela=excluded.janela,
      requisicoes=case when uso_revisao_ia.janela=excluded.janela then uso_revisao_ia.requisicoes+1 else 1 end
  where uso_revisao_ia.janela<>excluded.janela or uso_revisao_ia.requisicoes<10
  returning true into permitido;
  return coalesce(permitido,false);
end $$;
revoke all on function public.reservar_revisao_ia(uuid) from public,anon,authenticated;
grant execute on function public.reservar_revisao_ia(uuid) to service_role;
commit;

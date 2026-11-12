-- Rode no Supabase > SQL Editor > Run (projeto iyrlbfrsrolwhybumler).
-- Exclusão de atendimentos com auditoria:
--   * Cada colaborador exclui os PRÓPRIOS atendimentos, enviados ao RH ou não.
--   * O gerente exclui os de todos (enviados ou não).
--   * Antes de apagar, o registro inteiro é copiado para
--     private.atendimentos_excluidos, com quem excluiu e quando. Essa tabela fica
--     no schema private: não aparece no site nem na API, só no SQL Editor.
--   * O e-mail já enviado ao RH não muda, e o histórico de envios
--     (relatorios_horas.itens) continua com a cópia do que foi enviado.

begin;

-- 1) Tabela de auditoria (fora da API).
create table if not exists private.atendimentos_excluidos (
  id             bigint generated always as identity primary key,
  atendimento_id uuid        not null,
  usuario_id     uuid        not null,              -- dono do atendimento
  relatorio_id   uuid,                              -- envio ao RH em que estava (se estava)
  excluido_por   uuid,                              -- quem excluiu (null = SQL Editor/serviço)
  excluido_em    timestamptz not null default now(),
  dados          jsonb       not null               -- cópia completa da linha excluída
);
alter table private.atendimentos_excluidos enable row level security;  -- sem policies: ninguém lê pela API
revoke all on private.atendimentos_excluidos from public, anon, authenticated;
create index if not exists atendimentos_excluidos_usuario_idx on private.atendimentos_excluidos (usuario_id, excluido_em desc);

-- 2) Gatilho: guarda a cópia antes de apagar. Substitui o bloqueio antigo
--    (proteger_exclusao_atendimento), que impedia excluir o que já foi enviado.
create or replace function private.arquivar_atendimento_excluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.atendimentos_excluidos (atendimento_id, usuario_id, relatorio_id, excluido_por, dados)
  values (old.id, old.usuario_id, old.relatorio_id, auth.uid(), to_jsonb(old));
  return old;
end $$;
revoke execute on function private.arquivar_atendimento_excluido() from public, anon, authenticated;

drop trigger if exists proteger_exclusao_atendimento on public.atendimentos;
drop trigger if exists arquivar_exclusao_atendimento on public.atendimentos;
create trigger arquivar_exclusao_atendimento
  before delete on public.atendimentos
  for each row execute function private.arquivar_atendimento_excluido();

-- 3) Regras de exclusão: sem a trava "relatorio_id is null".
drop policy if exists "excluir meus atendimentos"   on public.atendimentos;
drop policy if exists "gerente exclui atendimentos" on public.atendimentos;
create policy "excluir meus atendimentos" on public.atendimentos for delete to authenticated
  using (usuario_id = auth.uid() and private.eh_permitido());
create policy "gerente exclui atendimentos" on public.atendimentos for delete to authenticated
  using (private.eh_gerente());

commit;

-- Para consultar a auditoria (SQL Editor):
--   select e.excluido_em, quem.nome as excluido_por, dono.nome as dono,
--          e.dados->>'titulo' as titulo, e.dados->>'inicio' as inicio,
--          e.dados->>'minutos' as minutos, e.relatorio_id is not null as ja_enviado
--     from private.atendimentos_excluidos e
--     left join public.perfis quem on quem.id = e.excluido_por
--     left join public.perfis dono on dono.id = e.usuario_id
--    order by e.excluido_em desc;

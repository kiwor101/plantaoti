-- Rode DEPOIS do banco-sistema-novo.sql (Supabase > SQL Editor > Run).
-- O Supabase dá, por padrão, todos os privilégios (até TRUNCATE) para anon e
-- authenticated em toda tabela nova do schema public. O RLS bloqueia as linhas,
-- mas o certo é cada papel ter só o que o app usa (defesa em profundidade).
-- O app não tem nada público: só usuários logados (authenticated) acessam dados.

begin;

-- 1) Zera tudo de anon e authenticated nas tabelas e views do public
revoke all on all tables in schema public from anon, authenticated;

-- 2) Devolve só o que o app usa (o RLS continua filtrando as linhas)
-- perfis: ler e editar o próprio nome (cargo só pelo painel: define quem é Gerente)
grant select on public.perfis to authenticated;
grant update (nome) on public.perfis to authenticated;

-- atendimentos: CRUD dos próprios registros (colunas editáveis = migração 001)
grant select, insert, delete on public.atendimentos to authenticated;
grant update (titulo, solicitante, setor, descricao, solucao, inicio, fim, pausa_minutos)
  on public.atendimentos to authenticated;

-- relatorios_horas: só leitura (quem grava é a Edge Function com service_role)
grant select on public.relatorios_horas to authenticated;

-- chamados (legado, não aparece mais na tela): só leitura
grant select on public.chamados to authenticated;
grant select on public.v_chamados to authenticated;

-- rotina anti-pausa do GitHub consulta /rest/v1/chamados com a chave pública.
-- Sem policy para anon, ela recebe 200 com lista vazia (nenhum dado sai).
grant select on public.chamados to anon;

-- emails_permitidos e uso_revisao_ia: nada para anon/authenticated
-- (lista é mantida pelo painel; uso_revisao_ia só pela Edge Function)

-- 3) Tabelas e funções criadas no futuro (pelo SQL Editor) nascem fechadas
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- o EXECUTE para PUBLIC é padrão global do Postgres (não dá para tirar "in schema")
alter default privileges for role postgres
  revoke execute on functions from public;
-- => tabela ou função nova precisa de GRANT explícito para o app usar.

commit;

-- Observação: a policy "atualizar chamado" continua existindo, mas sem o GRANT
-- de UPDATE ninguém consegue alterar chamados antigos pela API.

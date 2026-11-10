# Plantões TI

Registro individual de serviços de TI fora do expediente, com login e banco Supabase. Site estático: `index.html`, `relatorios.html`, `app-auth.js`, `login.css` e `relatorios.js`.

## Integração Santa Casa (fork kiwor101)

Este fork usa o front do Pedro com a **nossa conexão**:

- **Supabase `iyrlbfrsrolwhybumler`** (configurado em `app-auth.js`), não o `vidwjeyguypqhcuhgmar` citado abaixo.
- **Login com Microsoft** (`signInWithOAuth` provider `azure`, sempre com escolha de conta). Não há e-mail/senha.
- **Lista de e-mails liberados** (`emails_permitidos` + `private.eh_permitido()`), criada por `login-microsoft.sql`.
- Domínio `plantaoti.santacasaandradina.org` (`CNAME`) e rotina anti-pausa em `.github/workflows/manter-supabase-ativo.yml`.

Banco deste projeto, em ordem (só o que ainda não foi aplicado):

1. `supabase/migrations/202610210001_atendimentos.sql`
2. `supabase/migrations/202610210002_revisao_ia.sql`
3. `supabase/migrations/202610210003_excluir_atendimentos.sql`
4. `supabase/migrations/202611090001_lista_permitidos_atendimentos.sql` (soma a lista de liberados às regras dos atendimentos)

Em Authentication → URL Configuration, as Redirect URLs precisam aceitar `index.html` e `relatorios.html` do site (ex.: `https://plantaoti.santacasaandradina.org/**`).

## Uso atual

O layout branco e azul organiza a tela em navegação lateral, formulário central com progresso animado e resumo acumulado à direita. **Novo relatório** (`index.html`) mostra o formulário; **Meus relatórios** (`relatorios.html`) é uma página separada para conferir a lista completa e os detalhes, com Editar e Excluir. Filtros, exportação e histórico de envio ao RH não aparecem nessa página de conferência. O formulário permanece único: assunto, início e término (data/hora) e relato são obrigatórios. O relato é gravado em `solucao`. Solicitante, setor e pausas não aparecem no formulário; novos registros ficam sem solicitante/setor e com pausa zero. Valores desses campos em relatórios antigos permanecem preservados ao editar. Salvar grava o registro completo diretamente em `atendimentos`. O resumo conta todos os registros concluídos do colaborador, sem zerar por dia, e soma as horas atendidas de todos os períodos. Como não existe registro de folgas ou compensações, ele mostra horas acumuladas, não saldo líquido do banco de horas. Não há abrir/fechar chamado nem iniciar cronômetro.

- O tempo atendido é o intervalo menos as pausas, deve ser positivo e não pode sobrepor outro intervalo do usuário. Pode atravessar meia-noite.
- **Editar relatório** permite alterações até a reserva para o RH. Registros legados sem fim podem ser completados nessa edição; a UI não cria novos atendimentos sem término.
- **Excluir** aparece ao lado de **Editar** em cada registro ainda não reservado para o RH. Qualquer colaborador autenticado pode excluir os próprios registros, com confirmação na tabela. O banco bloqueia a exclusão de registros de outros usuários e dos já reservados para envio. A exclusão é definitiva e retira as horas dos totais.
- Filtros e relatórios usam `America/Sao_Paulo`; o formulário usa o fuso do dispositivo. O filtro considera a data inicial e inclui a duração completa do registro.
- A implementação antiga de CSV e resumo RH foi preservada no código, mas está oculta na página de conferência enquanto o fluxo de envio ao RH não for definido. Não há botão de envio visível. Totais são calculados antes do arredondamento de exibição.

A interface usa IBM Plex Sans, tema claro e tokens `--bg`, `--card`, `--ink`, `--mute`, `--line` e `--brand`. No celular, o resumo passa para baixo do formulário e a tabela pode ser rolada horizontalmente. A página de conferência mostra todos os registros; o assunto abre os detalhes. A pequena barra do relato insere marcações simples de texto (Markdown/HTML) no campo, portanto elas também aparecem no relatório salvo.

O login tem painel ilustrativo azul no desktop e formulário branco, com versão compacta no celular. O botão **Mostrar/Ocultar** alterna a visibilidade da senha. **Manter conectado neste dispositivo** guarda apenas a sessão de autenticação entre visitas; quando desmarcado, ela fica limitada à aba atual. A senha não é salva pelo aplicativo: o usuário pode aceitar o gerenciador de senhas do navegador. A lógica compartilhada em `app-auth.js` aproveita sessões locais anteriores e não adiciona cadastro ou recuperação de senha inexistentes.

## Banco e legado

A modelagem não foi renomeada. Chamados legados permanecem no banco, mas não são exibidos. O módulo antigo `atendimentos.js` foi removido; o site usa `relatorios.js`. Atendimentos são privados por usuário; o banco valida intervalos e bloqueia edição após reserva para relatório.

## Instalação e publicação

**Projeto novo:** crie um projeto Supabase; no SQL Editor, execute `schema.sql` uma única vez e depois, nesta ordem:

1. `supabase/migrations/202610210001_atendimentos.sql`.
2. `supabase/migrations/202610210002_revisao_ia.sql`.
3. `supabase/migrations/202610210003_excluir_atendimentos.sql`.

Crie usuários em Authentication com metadado `nome`, confira seus perfis/cargos em `perfis` e desative o cadastro público para uso interno. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `index.html` com URL e chave pública do projeto. Nunca exponha `service_role` no navegador.

Publique **`index.html` e `relatorios.js` juntos**, no mesmo diretório, em hospedagem estática como GitHub Pages. Configure a URL do site e redirecionamentos em Authentication → URL Configuration. Não há build nem pacote pnpm neste projeto.

**Projeto atual `vidwjeyguypqhcuhgmar`, em 21/10/2026:** as três migrações já estão aplicadas; não repita `schema.sql` nem as migrações. A 001 de horas foi aplicada e testada no turno anterior, preservando perfis e chamados. Passaram testes transacionais de cálculo, pausas, virada de dia, sobreposição, isolamento por usuário, reserva e bloqueio de edição. A 002 foi aplicada pelo SQL Editor; passaram 10 revisões permitidas, 11ª bloqueada, renovação da janela e permissões. O teste terminou com rollback sem deixar contadores de teste. A 003 foi aplicada pelo SQL Editor sem excluir registros; a política de exclusão, a permissão para `authenticated` e o gatilho de proteção foram confirmados em consulta somente leitura.

## Revisão opcional com IA

**Melhorar texto** chama a Edge Function `revisar-relatorio` somente com o texto do campo de relato. A função usa OpenAI Responses API, JSON Schema strict e `store: false`. O prompt orienta preservar fatos, grau de certeza e números; é orientação, não garantia de fidelidade. Há checagem de números. Revise a sugestão antes de aplicá-la.

A sugestão é editável e só substitui o relato ao clicar em **Usar sugestão**. Se o original mudou desde o pedido, a aplicação rejeita a substituição. Descartar ou encontrar erro de IA não impede salvar.

O limite é de 10 solicitações por usuário por hora, com tabela `uso_revisao_ia` e RPC `reservar_revisao_ia` executável somente por `service_role`. A função exige JWT válido, valida a sessão com `auth.getUser` e verifica o perfil.

### Configurar pelo Dashboard ou CLI

1. Confirme a migração 002 aplicada.
2. Em Edge Functions → Secrets, cadastre `OPENAI_API_KEY` exclusivamente no servidor. `OPENAI_MODEL` é opcional; padrão `gpt-4o-mini`. Nunca envie a chave no chat ou grave no repo/frontend. Pelo CLI autenticado, use `supabase secrets set --env-file <arquivo-local-protegido> --project-ref <projeto>`; mantenha esse arquivo de segredos fora do repositório.
3. No Dashboard, publique `supabase/functions/revisar-relatorio/index.ts` como `revisar-relatorio`, com **Verify JWT ligado**. Alternativa CLI: `supabase functions deploy revisar-relatorio --project-ref <projeto>`, mantendo a verificação JWT habilitada (sem `--no-verify-jwt`).
4. Teste pela aplicação autenticada com texto sintético. Sem chave, a integração não chama a OpenAI. Custos de uso não foram cotados.

No projeto atual, `revisar-relatorio` foi publicada hoje pelo Dashboard, com Verify JWT ligado. O teste live na aplicação retornou **“A revisão com IA ainda não foi ativada”**. Não há `OPENAI_API_KEY` nos Secrets: foram vistos apenas os nomes `RESEND_API_KEY` e `REPORT_FROM`, sem abrir valores. O texto sintético foi limpo sem salvar. Frontend e autenticação real foram verificados; conteúdo gerado por modelo real ainda **não foi testado**.

Referência: [Structured Outputs na Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## RH durante a validação

`ENVIO_RH_ATIVO = false` no `app-auth.js`: envio oculto; a prévia funciona sem chamar função de e-mail. A fonte local `supabase/functions/enviar-relatorio-rh/index.ts` foi preservada, sem nova publicação ou configuração. A função remota preexistente **`relatorio-rh`** é distinta e não foi tocada. Secrets de e-mail existentes não comprovam configuração da função local. Ativação e validação do envio permanecem pendentes.

## Verificação

Resultados registrados em 21/10/2026:

- `tests/interface.cjs`: **PASS** em Chrome com mocks; progresso das etapas, cálculo, navegação entre as duas páginas, edição, exclusão, IA aceita/descartada/original alterado/falha e visualização em desktop/mobile.
- `tests/revisao-ia.cjs`: **PASS** em Node com mocks; autenticação, perfil, chave, limite, JSON, números, recusa e timeout.

Esses testes não comprovam conteúdo real do modelo nem entrega de e-mail. Para executar na raiz, use Node recente com `stripTypeScriptTypes`; o teste de UI exige Chrome instalado e `NODE_DEPS` apontando para o `node_modules` que contém Playwright:

```powershell
$env:NODE_DEPS = 'C:/caminho/para/node_modules'
node tests/interface.cjs
node tests/revisao-ia.cjs
```

Foi usado o runtime bundled no Windows. O teste de UI grava capturas em `.impeccable/review/`. A prévia `http://localhost:4173` foi reiniciada e aberta para o usuário já autenticado durante a validação; depende do processo local em execução.

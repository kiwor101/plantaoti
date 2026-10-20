# Plantões TI

Registro de chamados e plantões de fim de semana. Login individual , banco no Supabase, hospedagem via GitHub.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. **SQL Editor** → cole `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: desative "Allow new users to sign up" (só vocês entram).
4. **Authentication → Users → Add user**: crie os 3 usuários (e-mail + senha, marque *Auto Confirm*). Em *User Metadata* coloque `{"nome": "Pedro"}` (e `Eduardo`, `Rafael`).
5. No SQL Editor, defina os cargos:
   ```sql
   update perfis set cargo = 'Gerente' where nome = 'Pedro';
   update perfis set cargo = 'Analista' where nome = 'Eduardo';
   update perfis set cargo = 'Técnico em Redes' where nome = 'Rafael';
   ```
6. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para o topo do `index.html` (`SUPABASE_URL` e `SUPABASE_ANON_KEY`). Nunca use a chave `service_role` aqui.

## 2. GitHub + publicação
```bash
git init && git add . && git commit -m "Plantões TI"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/plantoes-ti.git
git push -u origin main
```
Para colocar online, escolha um:
- **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.
- **Vercel ou Netlify**: "Import Git Repository" e escolha o repo (sem build, publica o `index.html`). Cada `git push` atualiza o site.

Depois de publicar, em Supabase → **Authentication → URL Configuration**, informe a URL do site.

## Dashboard (próxima etapa)
A view `v_chamados` já traz quem abriu, quem fechou e `minutos_ate_fechar`. Exemplos de consultas:
```sql
select plantao_data, count(*) from chamados group by 1 order by 1 desc;      -- chamados por plantão
select categoria, count(*) from chamados group by 1;                          -- por categoria
select aberto_por_nome, count(*), avg(minutos_ate_fechar) from v_chamados group by 1;
```

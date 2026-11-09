// Teste local com dados sintéticos: não conecta ao Supabase nem envia e-mail.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NODE_DEPS + '/playwright');

async function main() {
  const root=path.resolve(__dirname,'..');
  const mock=`
    const fixture = [
      {id:'10000000-0000-0000-0000-000000000001',usuario_id:'teste',titulo:'Acesso ao sistema',solicitante:'Pessoa de teste',setor:'Financeiro',descricao:'Dados sintéticos para teste',solucao:'Acesso restabelecido',inicio:'2026-10-18T01:30:00Z',fim:'2026-10-18T03:00:00Z',pausa_minutos:15,minutos:75,relatorio_id:null,atualizado_em:'2026-10-18T03:00:00Z'},
      {id:'10000000-0000-0000-0000-000000000002',usuario_id:'teste',titulo:'Rede & telefonia',solicitante:'Pessoa de teste',setor:'Operações',descricao:'Dados sintéticos para teste',solucao:'Conexão restabelecida',inicio:'2026-10-18T13:00:00Z',fim:'2026-10-18T13:45:00Z',pausa_minutos:0,minutos:45,relatorio_id:null,atualizado_em:'2026-10-18T13:45:00Z'}
    ];
    window.testState=JSON.parse(sessionStorage.getItem('plantao-test-state')||'null')||{rows:fixture,reports:[],mailCalls:0,aiCalls:0};
    const persist=()=>sessionStorage.setItem('plantao-test-state',JSON.stringify(testState));
    window.supabase={createClient(url,key,options){return {
      auth:{getSession:async()=>({data:{session:location.search.includes('preview-login')?null:{user:{id:'teste',email:'teste@example.invalid'}}}}),signInWithPassword:async()=>{options.auth.storage.setItem('sb-vidwjeyguypqhcuhgmar-auth-token','synthetic-session');return {data:{user:{id:'teste',email:'teste@example.invalid'}}}},signOut:async()=>{options.auth.storage.removeItem('sb-vidwjeyguypqhcuhgmar-auth-token');return {}}},
      from(table){
        let op='select',payload,filters=[];
        const q={select(){return q},eq(k,v){filters.push(a=>a[k]===v);return q},is(k,v){filters.push(a=>a[k]===v);return q},order(){return q},range(){return q},limit(){return q},single:async()=>({data:{id:'teste',nome:'Funcionário de teste'}}),insert(v){op='insert';payload=v;return q},update(v){op='update';payload=v;return q},delete(){op='delete';return q},then(resolve,reject){
          try{
            let rows=table==='atendimentos'?testState.rows:table==='relatorios_horas'?testState.reports:[];
            if(op==='insert'){const a={...payload,id:crypto.randomUUID(),usuario_id:'teste',relatorio_id:null,atualizado_em:new Date().toISOString()};a.minutos=a.fim?(new Date(a.fim)-new Date(a.inicio))/60000-a.pausa_minutos:null;rows.push(a);persist();return Promise.resolve({data:[a]}).then(resolve,reject)}
            rows=rows.filter(a=>filters.every(f=>f(a)));
            if(op==='update')for(const a of rows){Object.assign(a,payload);a.minutos=a.fim?(new Date(a.fim)-new Date(a.inicio))/60000-a.pausa_minutos:null;a.atualizado_em=new Date().toISOString()}
            if(op==='delete')for(const a of rows){const index=testState.rows.findIndex(item=>item.id===a.id);if(index>=0)testState.rows.splice(index,1)}
            if(op==='update'||op==='delete')persist();
            return Promise.resolve({data:structuredClone(rows)}).then(resolve,reject);
          }catch(e){return Promise.reject(e).then(resolve,reject)}
        }};return q;
      },
      functions:{invoke:async(name,{body})=>{
        if(name==='revisar-relatorio'){testState.aiCalls++;if(window.failAI)return {error:new Error('IA indisponível')};if(window.deferAI)await new Promise(resolve=>window.finishAI=resolve);return {data:{texto:'Foi realizado o ajuste de rede, com restabelecimento da conexão.'}};}
        if(body.acao==='config')return {data:{destinatarios:['rh@example.invalid']}};
        testState.mailCalls++;
        if(body.relatorio_id){const r=testState.reports.find(r=>r.id===body.relatorio_id);r.estado='aceito';r.aceito_em=new Date().toISOString();return {data:{id:r.id}}}
        const r={id:crypto.randomUUID(),usuario_id:'teste',nome:'Funcionário de teste',destinatarios:['rh@example.invalid'],itens:structuredClone(testState.rows.filter(a=>body.ids.includes(a.id))),estado:window.failSend?'pendente':'aceito',criado_em:new Date().toISOString(),aceito_em:new Date().toISOString()};testState.reports.push(r);for(const a of testState.rows)if(body.ids.includes(a.id))a.relatorio_id=r.id;
        return window.failSend?{error:new Error('Falha simulada')}:{data:{id:r.id}};
      }}
    }}};
  `;
  let html=await fs.readFile(path.join(root,'index.html'),'utf8');
  let reportsHtml=await fs.readFile(path.join(root,'relatorios.html'),'utf8');
  const moduleSource=await fs.readFile(path.join(root,'relatorios.js'),'utf8');
  const authSource=await fs.readFile(path.join(root,'app-auth.js'),'utf8');
  const loginStyles=await fs.readFile(path.join(root,'login.css'),'utf8');
  const prepare=source=>source.replace(/<script src="https:\/\/cdn[^>]+><\/script>/,()=>`<script>${mock}</script>`)
    .replace('<script src="app-auth.js"></script>',()=>`<script>${authSource}</script>`)
    .replace('<script src="relatorios.js"></script>',()=>`<script>${moduleSource}</script>`)
    .replace('<link rel="stylesheet" href="login.css">',()=>`<style>${loginStyles}</style>`)
    .replace(/<link[^>]+>/g,'');
  html=prepare(html);reportsHtml=prepare(reportsHtml);
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const serve=route=>route.request().url()==='https://teste.invalid/'?route.fulfill({contentType:'text/html',body:html}):route.request().url().startsWith('https://teste.invalid/index.html')?route.fulfill({contentType:'text/html',body:html}):route.request().url().startsWith('https://teste.invalid/relatorios.html')?route.fulfill({contentType:'text/html',body:reportsHtml}):route.abort();
    await page.route('**/*',serve);
    await page.goto('https://teste.invalid/');
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('2h 00min'));
    assert.equal(await page.locator('#hHojeQtd').innerText(),'2','Atendimentos de dias anteriores entram no total');
    assert.equal(await page.locator('#hHojeHoras').innerText(),'2h 00min','Horas de dias anteriores não zeram');
    assert.match(await page.locator('.horas-ajuda').innerText(),/não descontam folgas ou compensações/);
    assert.equal(await page.locator('#horasForm').isVisible(),true);
    assert.equal(await page.locator('#telaLogin').isVisible(),false);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()),'#1769df');
    assert.equal(await page.locator('#hSolicitante').count(),0,'Solicitante não aparece no formulário');
    assert.equal(await page.locator('#hOpcionais').count(),0,'Setor e pausas não aparecem no formulário');
    assert.equal(await page.locator('#hSetor').isVisible(),false);
    assert.equal(await page.locator('#hPausa').isVisible(),false);
    assert.ok(await page.locator('#hSolucao').evaluate(el=>getComputedStyle(el).minHeight.replace('px','')*1)>=300,'Área do relato ampliada no desktop');
    assert.equal(await page.locator('#abaChamados').count(),0);
    assert.equal(await page.getByRole('button',{name:/Abrir chamado|Fechar chamado|Iniciar agora|Finalizar atendimento/}).count(),0);
    const review=path.join(root,'.impeccable','review');await fs.mkdir(review,{recursive:true});
    await page.screenshot({path:path.join(review,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(await page.locator('.etapas button').first().getAttribute('aria-current'),'step');
    await page.locator('#hTitulo').fill('Ajuste de rede');
    assert.equal(await page.locator('.etapas button').nth(0).getAttribute('aria-label'),'Dados, concluído');
    await page.locator('#hInicio').fill('2026-10-19T19:00');await page.locator('#hFim').fill('2026-10-19T19:30');
    assert.equal(await page.locator('.etapas button').nth(1).getAttribute('aria-label'),'Atendimento, concluído');
    await page.locator('#hSolucao').fill('rede');await page.locator('#hMelhorarIA').click();
    assert.match(await page.locator('#hIAMensagem').innerText(),/pelo menos 20 caracteres/);
    assert.equal(await page.evaluate(()=>testState.aiCalls),0);
    const original='fiz ajuste na rede e voltou a funcionar';
    await page.locator('#hSolucao').fill(original);
    assert.equal(await page.locator('.etapas button').nth(2).getAttribute('aria-label'),'Relato, concluído');
    await page.evaluate(()=>window.failAI=true);await page.locator('#hMelhorarIA').click();
    await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('ainda não está disponível'));
    assert.equal(await page.locator('#hSolucao').inputValue(),original);
    await page.evaluate(()=>window.failAI=false);await page.locator('#hMelhorarIA').click();
    await page.locator('#hIASugestao').waitFor({state:'visible'});
    assert.equal(await page.locator('#hSolucao').inputValue(),original,'IA não substitui automaticamente');
    await page.locator('#hSolucao').fill(original+' e testei novamente');
    await page.locator('#hUsarIA').click();assert.match(await page.locator('#hIAMensagem').innerText(),/Seu texto mudou/);
    await page.locator('#hDescartarIA').click();await page.locator('#hMelhorarIA').click();await page.locator('#hIASugestao').waitFor({state:'visible'});
    await page.screenshot({path:path.join(review,'ia-sugestao.png'),fullPage:true});
    await page.locator('#hUsarIA').click();assert.match(await page.locator('#hSolucao').inputValue(),/Foi realizado o ajuste/);
    assert.equal(await page.evaluate(()=>testState.rows.length),2,'IA não salva atendimento');
    await page.locator('#hFim').fill('2026-10-19T18:30');await page.locator('#hSalvar').click();
    assert.match(await page.locator('#hErro').innerText(),/término deve ser posterior/);
    await page.locator('#hFim').fill('2026-10-19T19:30');assert.match(await page.locator('#hPrevia').innerText(),/0h 30min/);
    await page.locator('#hSalvar').click();await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('2h 30min'));
    assert.equal(await page.locator('#hHojeQtd').innerText(),'3');
    assert.equal(await page.locator('#hHojeHoras').innerText(),'2h 30min');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'hTitulo');
    assert.equal(await page.evaluate(()=>testState.rows.every(a=>a.fim)),true,'Todo novo registro já possui término');
    await page.getByRole('link',{name:'Meus relatórios'}).click();
    await page.waitForURL('**/relatorios.html#hRegistrosTitulo');
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('3 relatório(s)'));
    assert.equal(await page.locator('#horasForm').isVisible(),false);
    assert.equal(await page.locator('#hExportacao').isVisible(),false);
    assert.equal(await page.locator('#hLista [data-h-editar]').count(),3);
    await page.screenshot({path:path.join(review,'relatorios-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'relatorios-mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#hLista [data-h-editar]').first().click();
    await page.waitForURL('**/index.html#horasForm');
    await page.waitForFunction(()=>document.getElementById('horasFormTitulo').textContent==='Editar relatório');
    assert.match(await page.locator('#horasFormTitulo').innerText(),/Editar relatório/);
    const inicioAntes=await page.locator('#hInicio').inputValue();
    await page.locator('#hSolucao').fill(original);await page.locator('#hMelhorarIA').click();await page.locator('#hIASugestao').waitFor({state:'visible'});await page.locator('#hUsarIA').click();
    assert.equal(await page.locator('#hInicio').inputValue(),inicioAntes,'IA não altera horários');
    await page.locator('#hSalvar').click();
    await page.waitForFunction(()=>document.getElementById('horasMensagem').textContent.includes('Relatório salvo'));
    assert.equal(await page.evaluate(()=>testState.rows.find(a=>a.titulo==='Acesso ao sistema').solicitante),'Pessoa de teste','Editar preserva o solicitante antigo');
    assert.equal(await page.evaluate(()=>testState.rows.find(a=>a.titulo==='Acesso ao sistema').setor),'Financeiro','Editar preserva o setor antigo');
    assert.equal(await page.evaluate(()=>testState.rows.find(a=>a.titulo==='Acesso ao sistema').pausa_minutos),15,'Editar preserva a pausa antiga');
    await page.locator('#hCancelar').click();
    await page.evaluate(()=>window.deferAI=true);
    await page.locator('#hSolucao').fill(original);await page.locator('#hMelhorarIA').click();await page.waitForFunction(()=>window.finishAI);
    await page.locator('#hCancelar').click();await page.evaluate(()=>window.finishAI());await page.waitForTimeout(100);
    assert.equal(await page.locator('#hIASugestao').isVisible(),false,'Sugestão tardia não preenche outro relatório');
    await page.getByRole('link',{name:'Meus relatórios'}).click();
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('3 relatório(s)'));
    assert.equal(await page.locator('#hLista [data-h-excluir]').count(),3);
    await page.locator('#hLista [data-h-excluir]').first().click();assert.match(await page.locator('.registro-exclusao').innerText(),/não pode ser desfeita/);
    await page.screenshot({path:path.join(review,'excluir-relatorio.png'),fullPage:true});
    await page.locator('[data-h-cancelar-exclusao]').click();assert.equal(await page.evaluate(()=>testState.rows.length),3,'Cancelar exclusão preserva o relatório');
    await page.locator('#hLista [data-h-excluir]').first().click();await page.locator('[data-h-confirmar]').click();
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('2 relatório(s)'));
    assert.equal(await page.evaluate(()=>testState.rows.length),2,'Exclusão remove somente o registro selecionado');
    assert.equal(await page.locator('#hLista [data-h-excluir]').count(),2);
    const loginPage=await browser.newPage({viewport:{width:1440,height:900}});
    loginPage.on('pageerror',e=>errors.push(e.message));
    await loginPage.route('**/*',serve);
    await loginPage.goto('https://teste.invalid/index.html?preview-login');
    await loginPage.locator('#telaLogin').waitFor({state:'visible'});
    assert.equal(await loginPage.locator('.login-story').isVisible(),true);
    await loginPage.waitForTimeout(750);
    await loginPage.screenshot({path:path.join(review,'login-desktop.png'),fullPage:true});
    await loginPage.setViewportSize({width:390,height:844});
    await loginPage.screenshot({path:path.join(review,'login-mobile.png'),fullPage:true});
    assert.equal(await loginPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await loginPage.locator('.login-story').isVisible(),false);
    await loginPage.locator('#email').fill('teste@example.invalid');
    await loginPage.locator('#senha').fill('senha-sintetica');
    await loginPage.locator('#mostrarSenha').click();
    assert.equal(await loginPage.locator('#senha').getAttribute('type'),'text');
    assert.equal(await loginPage.locator('#mostrarSenha').getAttribute('aria-pressed'),'true');
    await loginPage.locator('#mostrarSenha').click();
    assert.equal(await loginPage.locator('#senha').getAttribute('type'),'password');
    assert.equal(await loginPage.locator('#lembrarAcesso').isChecked(),false);
    await loginPage.locator('#btnEntrar').click();
    await loginPage.locator('#telaApp').waitFor({state:'visible'});
    assert.deepEqual(await loginPage.evaluate(()=>[localStorage.getItem('plantao-ti-lembrar-acesso'),localStorage.getItem('sb-vidwjeyguypqhcuhgmar-auth-token'),sessionStorage.getItem('sb-vidwjeyguypqhcuhgmar-auth-token')]),['0',null,'synthetic-session']);
    await loginPage.goto('https://teste.invalid/index.html?preview-login');
    await loginPage.locator('#telaLogin').waitFor({state:'visible'});
    await loginPage.locator('#email').fill('teste@example.invalid');
    await loginPage.locator('#senha').fill('senha-sintetica');
    await loginPage.locator('#lembrarAcesso').check();
    await loginPage.locator('#btnEntrar').click();
    await loginPage.locator('#telaApp').waitFor({state:'visible'});
    assert.deepEqual(await loginPage.evaluate(()=>[localStorage.getItem('plantao-ti-lembrar-acesso'),localStorage.getItem('sb-vidwjeyguypqhcuhgmar-auth-token'),sessionStorage.getItem('sb-vidwjeyguypqhcuhgmar-auth-token')]),['1','synthetic-session',null]);
    assert.equal(await loginPage.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('senha-sintetica')),false,'Senha não é gravada pelo sistema');
    assert.deepEqual(errors,[]);
    console.log('OK: login azul, mostrar senha, acesso lembrado sem gravar senha; relatórios, edição, exclusão e IA. Tudo simulado.');
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});

// Teste local com dados sintéticos: não conecta ao Supabase nem envia e-mail.
// Rodar: NODE_DEPS=<pasta com node_modules do playwright> node tests/interface.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NODE_DEPS + '/playwright');

async function main() {
  const root=path.resolve(__dirname,'..');
  const mock=`
    const fixture = [
      // Registro antigo: sem solicitante/setor (precisa aparecer com "—").
      {id:'10000000-0000-0000-0000-000000000001',usuario_id:'teste',titulo:'Acesso ao sistema',solicitante:'',setor:'',descricao:'',solucao:'Acesso restabelecido',inicio:'2026-10-18T01:30:00Z',fim:'2026-10-18T03:00:00Z',pausa_minutos:0,minutos:90,relatorio_id:null,atualizado_em:'2026-10-18T03:00:00Z'},
      // Começa 23:40 e termina 00:20 do dia seguinte (Brasília): conta no dia em que começou.
      {id:'10000000-0000-0000-0000-000000000002',usuario_id:'teste',titulo:'Rede & telefonia',solicitante:'Maria - enfermeira',setor:'UTI adulto',descricao:'',solucao:'Conexão restabelecida',inicio:'2026-10-19T02:40:00Z',fim:'2026-10-19T03:20:00Z',pausa_minutos:0,minutos:40,relatorio_id:null,atualizado_em:'2026-10-19T03:20:00Z'}
    ];
    window.testState=JSON.parse(sessionStorage.getItem('plantao-test-state')||'null')||{rows:fixture,reports:[],payloads:[],mailCalls:0,aiCalls:0};
    const persist=()=>sessionStorage.setItem('plantao-test-state',JSON.stringify(testState));
    // Token Microsoft válido na aba, para o envio não abrir o login.
    sessionStorage.setItem('plantao-ti-ms-token',JSON.stringify({t:'token-sintetico',exp:Date.now()+3600000}));
    const minutos=a=>a.fim?(new Date(a.fim)-new Date(a.inicio))/60000:null;
    window.supabase={createClient(url,key,options){return {
      auth:{getSession:async()=>({data:{session:location.search.includes('preview-login')?null:{user:{id:'teste',email:'teste@example.invalid'}}}}),signInWithOAuth:async()=>({error:null}),signOut:async()=>({})},
      from(table){
        let op='select',payload,filters=[];
        const q={select(){return q},eq(k,v){filters.push(a=>a[k]===v);return q},is(k,v){filters.push(a=>a[k]===v);return q},in(){return q},order(){return q},range(){return q},limit(){return q},maybeSingle:async()=>({data:null}),single:async()=>({data:{id:'teste',nome:'Funcionário de teste',cargo:null}}),insert(v){op='insert';payload=v;return q},update(v){op='update';payload=v;return q},delete(){op='delete';return q},then(resolve,reject){
          try{
            let rows=table==='atendimentos'?testState.rows:table==='relatorios_horas'?testState.reports:[];
            if(op==='insert'||op==='update')testState.payloads.push({op,payload:structuredClone(payload)});
            if(op==='insert'){const a={pausa_minutos:0,...payload,id:crypto.randomUUID(),usuario_id:'teste',relatorio_id:null,atualizado_em:new Date().toISOString()};a.minutos=minutos(a);rows.unshift(a);persist();return Promise.resolve({data:[a]}).then(resolve,reject)}
            rows=rows.filter(a=>filters.every(f=>f(a)));
            if(op==='update')for(const a of rows){Object.assign(a,payload);a.minutos=minutos(a);a.atualizado_em=new Date().toISOString()}
            if(op==='delete')for(const a of rows){const index=testState.rows.findIndex(item=>item.id===a.id);if(index>=0)testState.rows.splice(index,1)}
            if(op!=='select')persist();
            return Promise.resolve({data:structuredClone(rows)}).then(resolve,reject);
          }catch(e){return Promise.reject(e).then(resolve,reject)}
        }};return q;
      },
      functions:{invoke:async(name,{body})=>{
        if(name==='revisar-relatorio'){testState.aiCalls++;if(window.failAI)return {error:new Error('IA indisponível')};if(window.deferAI)await new Promise(resolve=>window.finishAI=resolve);return {data:{texto:'Foi realizado o ajuste de rede, com restabelecimento da conexão.'}};}
        if(body.acao==='config')return {data:{destinatarios:['rh@example.invalid'],remetente:'teste@example.invalid'}};
        if(body.acao==='pdf')return {data:{arquivo:'teste.pdf',base64:btoa('%PDF-1.4 teste')}};
        testState.mailCalls++;
        const r={id:crypto.randomUUID(),usuario_id:'teste',nome:'Funcionário de teste',remetente:'teste@example.invalid',destinatarios:['rh@example.invalid'],itens:structuredClone(testState.rows.filter(a=>body.ids.includes(a.id))),estado:'aceito',criado_em:new Date().toISOString(),aceito_em:new Date().toISOString()};testState.reports.push(r);for(const a of testState.rows)if(body.ids.includes(a.id))a.relatorio_id=r.id;persist();
        return {data:{id:r.id}};
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
    .replace('<script src="pwa.js" defer></script>','')
    .replace('<link rel="stylesheet" href="login.css">',()=>`<style>${loginStyles}</style>`)
    .replace(/<link[^>]+>/g,'');
  html=prepare(html);reportsHtml=prepare(reportsHtml);
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',acceptDownloads:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const serve=route=>{const u=route.request().url();return u==='https://teste.invalid/'||u.startsWith('https://teste.invalid/index.html')?route.fulfill({contentType:'text/html',body:html}):u.startsWith('https://teste.invalid/relatorios.html')?route.fulfill({contentType:'text/html',body:reportsHtml}):route.abort();};
    await page.route('**/*',serve);

    // --- Formulário: solicitante e setor obrigatórios, sem pausas ---
    await page.goto('https://teste.invalid/');
    await page.waitForFunction(()=>document.getElementById('hHojeHoras').textContent==='2h 10min');
    assert.equal(await page.locator('#hHojeQtd').innerText(),'2');
    assert.equal(await page.locator('#horasForm').isVisible(),true);
    assert.equal(await page.locator('#telaLogin').isVisible(),false);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()),'#1769df');
    assert.equal(await page.locator('#hSolicitante').isVisible(),true,'Solicitante aparece no formulário');
    assert.equal(await page.locator('#hSetor').isVisible(),true,'Setor aparece no formulário');
    assert.equal(await page.locator('#hSolicitante').getAttribute('maxlength'),'120');
    assert.equal(await page.locator('#hSetor').getAttribute('maxlength'),'120');
    assert.equal(await page.locator('#hPausa').count(),0,'Sem campo de pausa');
    const ordem=await page.evaluate(()=>['hTitulo','hSolicitante','hSetor','hInicio'].map(id=>document.getElementById(id).getBoundingClientRect().top));
    assert.ok(ordem[0]<ordem[1]&&ordem[1]<=ordem[2]+1&&ordem[2]<ordem[3],'Solicitante e setor ficam entre Assunto e Início');
    const review=path.join(root,'.impeccable','review');await fs.mkdir(review,{recursive:true});
    await page.screenshot({path:path.join(review,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1000});

    assert.equal(await page.locator('.etapas button').first().getAttribute('aria-current'),'step');
    await page.locator('#hTitulo').fill('Ajuste de rede');
    assert.equal(await page.locator('.etapas button').nth(0).getAttribute('aria-label'),'Dados, etapa atual','Só o assunto não completa Dados');
    await page.locator('#hSolicitante').fill('João - recepção');
    await page.locator('#hSetor').fill('Pronto-socorro');
    assert.equal(await page.locator('.etapas button').nth(0).getAttribute('aria-label'),'Dados, concluído');
    await page.locator('#hInicio').fill('2026-10-19T19:00');await page.locator('#hFim').fill('2026-10-19T19:30');
    assert.equal(await page.locator('.etapas button').nth(1).getAttribute('aria-label'),'Atendimento, concluído');
    assert.doesNotMatch(await page.locator('#hPrevia').innerText(),/pausa/i);
    assert.match(await page.locator('#hPrevia').innerText(),/0h 30min/);

    // IA (sem mudanças): não troca o texto sozinha e não salva.
    await page.locator('#hSolucao').fill('rede');await page.locator('#hMelhorarIA').click();
    assert.match(await page.locator('#hIAMensagem').innerText(),/pelo menos 20 caracteres/);
    const original='fiz ajuste na rede e voltou a funcionar';
    await page.locator('#hSolucao').fill(original);
    assert.equal(await page.locator('.etapas button').nth(2).getAttribute('aria-label'),'Relato, concluído');
    await page.evaluate(()=>window.failAI=true);await page.locator('#hMelhorarIA').click();
    await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('ainda não está disponível'));
    assert.equal(await page.locator('#hSolucao').inputValue(),original);
    await page.evaluate(()=>window.failAI=false);await page.locator('#hMelhorarIA').click();
    await page.locator('#hIASugestao').waitFor({state:'visible'});
    assert.equal(await page.locator('#hSolucao').inputValue(),original,'IA não substitui automaticamente');
    await page.locator('#hUsarIA').click();assert.match(await page.locator('#hSolucao').inputValue(),/Foi realizado o ajuste/);
    assert.equal(await page.evaluate(()=>testState.rows.length),2,'IA não salva atendimento');

    // Validações do envio do formulário.
    await page.locator('#hSetor').fill('   ');await page.locator('#hSalvar').click();
    assert.match(await page.locator('#hErro').innerText(),/solicitante\) e o setor/);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'hSetor');
    await page.locator('#hSetor').fill('Pronto-socorro');
    await page.locator('#hFim').fill('2026-10-19T18:30');await page.locator('#hSalvar').click();
    assert.match(await page.locator('#hErro').innerText(),/término deve ser posterior/);
    await page.locator('#hFim').fill('2026-10-19T19:30');
    await page.locator('#hSalvar').click();await page.waitForFunction(()=>document.getElementById('hHojeHoras').textContent==='2h 40min');
    assert.equal(await page.locator('#hHojeQtd').innerText(),'3');
    const inserido=await page.evaluate(()=>testState.payloads.at(-1));
    assert.equal(inserido.op,'insert');
    assert.equal(inserido.payload.solicitante,'João - recepção');
    assert.equal(inserido.payload.setor,'Pronto-socorro');
    assert.equal('pausa_minutos' in inserido.payload,false,'Payload não manda pausa_minutos');
    assert.equal(await page.locator('#hSolicitante').inputValue(),'','Limpar zera o solicitante');
    assert.equal(await page.locator('#hSetor').inputValue(),'','Limpar zera o setor');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'hTitulo');

    // --- Meus relatórios: solicitante / setor, "+1d", sem legenda ---
    await page.getByRole('link',{name:'Meus relatórios'}).click();
    await page.waitForURL('**/relatorios.html#hRegistrosTitulo');
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('3 atendimento(s)'));
    assert.equal(await page.locator('#horasForm').isVisible(),false);
    assert.equal(await page.locator('.rel-legenda').count(),0,'Sem legenda fim de semana x semana');
    assert.equal(await page.locator('#hRegua .regua-dia').count(),7,'Régua com os 7 dias');
    const cards=await page.locator('#hLista .reg').evaluateAll(els=>els.map(el=>({titulo:el.querySelector('summary').textContent,quem:el.querySelector('.reg-quem').textContent,fim:el.querySelector('.reg-hora span').textContent,dica:el.querySelector('.reg-hora span').getAttribute('aria-label')})));
    const antigo=cards.find(c=>c.titulo==='Acesso ao sistema'),virada=cards.find(c=>c.titulo==='Rede & telefonia'),novo=cards.find(c=>c.titulo==='Ajuste de rede');
    assert.equal(antigo.quem,'——','Registro antigo mostra "—" no solicitante e no setor');
    assert.equal(virada.quem,'Maria - enfermeiraUTI adulto');
    assert.equal(novo.quem,'João - recepçãoPronto-socorro');
    assert.equal(virada.fim,'00:20 +1d','Término no dia seguinte');
    assert.equal(virada.dica,'termina em 19/10/2026 às 00:20');
    assert.equal(novo.fim,'19:30');assert.equal(novo.dica,null);
    const dias=await page.locator('#hLista .dia h4 span').allInnerTexts();
    assert.ok(dias.some(d=>/18 de outubro/.test(d)),'Chamado das 23:40 conta no dia em que começou');
    await page.screenshot({path:path.join(review,'relatorios-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'relatorios-mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1000});

    // CSV: solicitante e setor sim, pausas não.
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#hCsv').click()]);
    const csv=await fs.readFile(await download.path(),'utf8');
    const cabecalho=csv.replace(/^\ufeff/,'').split('\r\n')[0];
    assert.match(cabecalho,/"Solicitante";"Setor"/);
    assert.doesNotMatch(cabecalho,/Pausa/i);

    // Prévia do envio: sem coluna de pausas.
    await page.locator('#hPreparar').click();
    await page.locator('#horasPreview').waitFor({state:'visible'});
    const colunas=await page.locator('#hPreviewTabela th').allInnerTexts();
    assert.equal(colunas.some(c=>/Pausa/i.test(c)),false,'Prévia sem coluna Pausas');
    assert.match(await page.locator('#hPreviewTabela').innerText(),/—/,'Prévia mostra "—" no registro antigo');
    await page.locator('#hCancelarEnvio').click();

    // Editar: preenche solicitante e setor; UPDATE sem pausa_minutos.
    const editar=page.locator('#hLista .reg',{hasText:'Rede & telefonia'}).locator('[data-h-editar]');
    await editar.click();
    await page.waitForURL('**/index.html#horasForm');
    await page.waitForFunction(()=>document.getElementById('horasFormTitulo').textContent==='Editar relatório');
    assert.equal(await page.locator('#hSolicitante').inputValue(),'Maria - enfermeira');
    assert.equal(await page.locator('#hSetor').inputValue(),'UTI adulto');
    await page.locator('#hSetor').fill('UTI neonatal');
    await page.locator('#hSalvar').click();
    await page.waitForFunction(()=>document.getElementById('horasMensagem').textContent.includes('Relatório salvo'));
    const atualizado=await page.evaluate(()=>testState.payloads.at(-1));
    assert.equal(atualizado.op,'update');
    assert.equal(atualizado.payload.setor,'UTI neonatal');
    assert.equal('pausa_minutos' in atualizado.payload,false,'UPDATE não manda pausa_minutos');

    // Excluir.
    await page.getByRole('link',{name:'Meus relatórios'}).click();
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('3 atendimento(s)'));
    await page.locator('#hLista [data-h-excluir]').first().click();
    assert.match(await page.locator('.registro-exclusao').innerText(),/cópia fica guardada para auditoria/);
    await page.locator('[data-h-cancelar-exclusao]').click();assert.equal(await page.evaluate(()=>testState.rows.length),3,'Cancelar exclusão preserva o relatório');
    await page.locator('#hLista [data-h-excluir]').first().click();await page.locator('[data-h-confirmar]').click();
    await page.waitForFunction(()=>document.getElementById('hResumo').textContent.includes('2 atendimento(s)'));
    assert.equal(await page.evaluate(()=>testState.rows.length),2,'Exclusão remove somente o registro selecionado');

    // Tela de login (Microsoft).
    const loginPage=await browser.newPage({viewport:{width:1440,height:900}});
    loginPage.on('pageerror',e=>errors.push(e.message));
    await loginPage.route('**/*',serve);
    await loginPage.goto('https://teste.invalid/index.html?preview-login');
    await loginPage.locator('#telaLogin').waitFor({state:'visible'});
    assert.equal(await loginPage.locator('#btnEntrar').innerText(),'Entrar com Microsoft');
    await loginPage.screenshot({path:path.join(review,'login-desktop.png'),fullPage:true});
    await loginPage.setViewportSize({width:390,height:844});
    assert.equal(await loginPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

    assert.deepEqual(errors,[]);
    console.log('OK: solicitante/setor obrigatórios, sem pausas (tela, prévia, CSV e payload), término +1d, régua sem legenda, edição e exclusão. Tudo simulado.');
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});

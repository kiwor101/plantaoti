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
    // Envios ao RH em cada situação da confirmação de recebimento.
    const diasAtras=n=>new Date(Date.now()-n*864e5).toISOString();
    const envio=(id,extra)=>({id,usuario_id:'teste',nome:'Funcionário de teste',remetente:'teste@example.invalid',destinatarios:['rh@example.invalid'],itens:[{inicio:'2026-10-10T22:00:00Z',minutos:30}],estado:'aceito',criado_em:diasAtras(20),aceito_em:diasAtras(20),pede_confirmacao:true,recebido_em:null,recebido_por:null,lembretes:0,ultimo_lembrete_em:null,...extra});
    const envios=[envio('r-antigo',{pede_confirmacao:false}),envio('r-recebido',{recebido_em:'2026-11-16T14:30:00Z',recebido_por:'Maria do RH'}),envio('r-aguardando',{aceito_em:diasAtras(2)}),envio('r-alerta',{aceito_em:diasAtras(9)}),envio('r-bloqueado',{aceito_em:diasAtras(10),lembretes:1,ultimo_lembrete_em:diasAtras(0.1)})];
    window.testState=JSON.parse(sessionStorage.getItem('plantao-test-state')||'null')||{rows:fixture,reports:envios,payloads:[],lembretes:[],mailCalls:0,aiCalls:0};
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
        if(name==='revisar-relatorio'){testState.aiCalls++;(testState.aiModos||(testState.aiModos=[])).push(body.modo);(testState.aiPedidos||(testState.aiPedidos=[])).push(body.modo==='tom'?{modo:body.modo,tom:body.tom}:{modo:body.modo});testState.aiPedidos.at(-1).texto=body.texto;if(body.modo==='tom'&&!window.failAI)return {data:{texto:'Relato reescrito no tom '+body.tom+'.'}};if(window.failAI)return {error:new Error('IA indisponível')};if(window.deferAI)await new Promise(resolve=>window.finishAI=resolve);return {data:{texto:body.modo==='ortografia'?'Fiz ajuste na rede e voltou a funcionar.':'Foi realizado o ajuste de rede, com restabelecimento da conexão.'}};}
        if(body.acao==='config')return {data:{destinatarios:['rh@example.invalid'],remetente:'teste@example.invalid'}};
        if(body.acao==='pdf')return {data:{arquivo:'teste.pdf',base64:btoa('%PDF-1.4 teste')}};
        if(body.acao==='lembrete'){testState.lembretes.push(body.relatorio_id);const r=testState.reports.find(r=>r.id===body.relatorio_id);r.lembretes++;r.ultimo_lembrete_em=new Date().toISOString();persist();return {data:{id:r.id,estado:'lembrete'}};}
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

    // IA: menu "Melhorar texto ▾" com dois modos; troca direto no relato, com "Desfazer".
    const menuIA=async modo=>{await page.locator('#hMelhorarIA').click();await page.locator(`[data-ia-modo="${modo}"]`).click();};
    assert.match(await page.locator('.horas-nota-ia').innerText(),/enviado ao Google \(Gemini\).*Não escreva nome de paciente/);
    assert.equal(await page.locator('.horas-nota-ia').isVisible(),true,'aviso de privacidade visível');
    assert.equal(await page.locator('#hIASugestao').count(),0,'sem a caixa separada de sugestão');
    await page.locator('#hSolucao').fill('rede');await menuIA('melhorar');
    assert.match(await page.locator('#hIAMensagem').innerText(),/pelo menos 20 caracteres/);
    assert.equal(await page.locator('#hIAMenu').isHidden(),true,'menu fecha depois de escolher');
    const original='fiz ajuste na rede e voltou a funcionar';
    await page.locator('#hSolucao').fill(original);
    assert.equal(await page.locator('.etapas button').nth(2).getAttribute('aria-label'),'Relato, concluído');
    await page.locator('#hMelhorarIA').click();
    assert.equal(await page.locator('#hMelhorarIA').getAttribute('aria-expanded'),'true');
    assert.deepEqual(await page.locator('#hIAMenu [role=menuitem]').evaluateAll(b=>b.map(x=>x.firstChild.textContent)),['Melhorar texto','Só corrigir ortografia','Profissional','Empático','Casual','Amigável','Texto original']);
    assert.equal(await page.locator('#hIATons').innerText(),'Tons de escrita');
    assert.equal(await page.locator('#hIAOriginal').isDisabled(),true,'"Texto original" desabilitado sem revisão aplicada');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hIAMenu').isHidden(),true,'Esc fecha o menu');
    // Celular baixo (iPhone SE): o menu maior cabe na largura e rola na altura.
    await page.setViewportSize({width:375,height:667});await page.locator('#hSolucao').scrollIntoViewIfNeeded();await page.locator('#hMelhorarIA').click();
    assert.equal(await page.evaluate(()=>{const m=document.getElementById('hIAMenu'),r=m.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth&&m.clientHeight<=Math.min(innerHeight*.7,440)+1&&getComputedStyle(m).overflowY==='auto';}),true,'menu cabe no celular, com rolagem');
    await page.locator('#hIAOriginal').scrollIntoViewIfNeeded();assert.equal(await page.locator('#hIAOriginal').isVisible(),true,'"Texto original" alcançável rolando o menu');
    await page.locator('#hIAMenu').screenshot({path:path.join(review,'ia-menu-celular.png')});
    await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>window.failAI=true);await menuIA('melhorar');
    await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('ainda não está disponível'));
    assert.equal(await page.locator('#hSolucao').inputValue(),original,'erro da IA mantém o texto');
    assert.equal(await page.locator('#hDesfazerIA').isVisible(),false);
    await page.evaluate(()=>window.failAI=false);await menuIA('melhorar');
    await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('Texto revisado no relato'));
    assert.match(await page.locator('#hSolucao').inputValue(),/Foi realizado o ajuste/,'troca direto no campo');
    assert.equal(await page.evaluate(()=>testState.aiModos.at(-1)),'melhorar');
    await page.locator('#hDesfazerIA').click();
    assert.equal(await page.locator('#hSolucao').inputValue(),original,'Desfazer volta ao texto anterior');
    assert.equal(await page.locator('#hDesfazerIA').isVisible(),false);
    await menuIA('ortografia');
    await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('Ortografia corrigida'));
    assert.equal(await page.evaluate(()=>testState.aiModos.at(-1)),'ortografia');
    assert.equal(await page.locator('#hSolucao').inputValue(),'Fiz ajuste na rede e voltou a funcionar.');
    await page.locator('#hSolucao').press('End');await page.keyboard.type(' Testado.');
    assert.equal(await page.locator('#hDesfazerIA').isVisible(),false,'editar de novo tira o Desfazer');
    // Tons seguidos: "Texto original" volta ao que a pessoa escreveu ANTES da 1ª revisão da sequência.
    const meuTexto=await page.locator('#hSolucao').inputValue();
    const tomIA=async tom=>{await page.locator('#hMelhorarIA').click();await page.locator(`[data-ia-tom="${tom}"]`).click();
      await page.waitForFunction(t=>document.getElementById('hSolucao').value===`Relato reescrito no tom ${t}.`,tom);};
    await tomIA('profissional');
    assert.deepEqual(await page.evaluate(()=>{const {modo,tom}=testState.aiPedidos.at(-1);return {modo,tom};}),{modo:'tom',tom:'profissional'},'tom vai para a função');
    assert.match(await page.locator('#hIAMensagem').innerText(),/tom Profissional/);
    await tomIA('casual');await tomIA('amigavel');
    assert.equal(await page.evaluate(()=>testState.aiPedidos.at(-1).texto),'Relato reescrito no tom casual.','o 2º tom parte do texto do 1º');
    await page.locator('#hMelhorarIA').click();
    assert.equal(await page.locator('#hIAOriginal').isEnabled(),true,'"Texto original" habilitado depois da revisão');
    await page.screenshot({path:path.join(review,'ia-menu-tons.png'),fullPage:false});
    await page.locator('#hIAOriginal').click();
    assert.equal(await page.locator('#hSolucao').inputValue(),meuTexto,'"Texto original" volta ao texto da pessoa, mesmo depois de 3 tons');
    assert.equal(await page.locator('#hDesfazerIA').isVisible(),false);assert.equal(await page.locator('#hIAOriginal').isDisabled(),true);
    // "Desfazer" ao lado da mensagem também volta ao original da sequência.
    await tomIA('empatico');await tomIA('profissional');await page.locator('#hDesfazerIA').click();
    assert.equal(await page.locator('#hSolucao').inputValue(),meuTexto,'Desfazer volta ao original, não só 1 passo');
    // Editar à mão zera o "Texto original".
    await tomIA('casual');await page.locator('#hSolucao').press('End');await page.keyboard.type(' Ajuste manual.');
    assert.equal(await page.locator('#hIAOriginal').isDisabled(),true,'editar à mão zera o "Texto original"');
    assert.equal(await page.locator('#hDesfazerIA').isVisible(),false);
    // Depois de editar, a próxima revisão começa uma sequência nova a partir do texto editado.
    const editado=await page.locator('#hSolucao').inputValue();
    await tomIA('profissional');await page.locator('#hMelhorarIA').click();await page.locator('#hIAOriginal').click();
    assert.equal(await page.locator('#hSolucao').inputValue(),editado,'nova sequência guarda o texto editado');
    await menuIA('melhorar');await page.waitForFunction(()=>document.getElementById('hIAMensagem').textContent.includes('Texto revisado no relato'));
    await page.screenshot({path:path.join(review,'ia-desfazer.png'),fullPage:false});
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

    // Envios ao RH: situação da confirmação de recebimento.
    const envioDe=id=>page.locator('#hHistorico .envio',{has:page.locator(`[data-h-pdf="${id}"]`)});
    assert.equal(await envioDe('r-antigo').locator('.tag').count(),0,'Envio antigo: só "Enviado", sem etiqueta');
    assert.match(await envioDe('r-recebido').locator('.tag-ok').innerText(),/^Recebido pelo RH em 16\/11\/2026, 11:30 por Maria do RH$/);
    assert.equal(await envioDe('r-aguardando').locator('.tag-espera').innerText(),'Aguardando confirmação do RH');
    assert.equal(await envioDe('r-aguardando').locator('[data-h-lembrete]').count(),0,'Sem lembrete antes de 7 dias');
    assert.equal(await envioDe('r-alerta').locator('.tag-alerta').innerText(),'Sem confirmação há 9 dias');
    assert.equal(await envioDe('r-alerta').locator('[data-h-lembrete]').isEnabled(),true);
    assert.equal(await envioDe('r-bloqueado').locator('[data-h-lembrete]').isDisabled(),true,'Lembrete há menos de 24 h: botão desabilitado');
    assert.match(await envioDe('r-bloqueado').innerText(),/1 lembrete\(s\) enviado\(s\)/);
    assert.match(await envioDe('r-bloqueado').innerText(),/Próximo lembrete a partir de/);
    assert.equal(await page.locator('#hSemConfirmacao').innerText(),'2 envio(s) sem confirmação do RH');
    await page.locator('#hHistorico').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(review,'envios-rh.png'),fullPage:true});
    await envioDe('r-alerta').locator('[data-h-lembrete]').click();
    await page.waitForFunction(()=>document.getElementById('horasMensagem').textContent.includes('Lembrete enviado ao RH'));
    assert.deepEqual(await page.evaluate(()=>testState.lembretes),['r-alerta']);
    assert.equal(await envioDe('r-alerta').locator('[data-h-lembrete]').isDisabled(),true,'Depois do lembrete, botão fica desabilitado por 24 h');

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

// Valida a função com o Gemini e o Supabase simulados. Nunca usa uma chave real.
// Rodar: node tests/revisao-ia.cjs
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');

async function main(){
  const source=stripTypeScriptTypes(await fs.readFile(path.join(__dirname,'../supabase/functions/revisar-relatorio/index.ts'),'utf8')).replace(/^import .*$/m,'');
  // fila: respostas por chamada (para simular 503 e depois 200). clock: relógio falso em ms;
  // custo = quanto cada chamada ao Gemini "demora"; atrasoAuth = quanto o login "demora".
  const state={perfil:true,permitido:true,limiteErro:false,calls:0,reservas:0,mode:'ok',fila:[],payload:null,url:'',headers:null,logs:[],
    clock:0,custo:0,atrasoAuth:0,timeouts:[],esperas:[]};
  const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',GEMINI_API_KEY:'chave-falsa'};
  let handler;
  const admin={auth:{getUser:async token=>{state.clock+=state.atrasoAuth;return token==='valid'?{data:{user:{id:'user-test'}}}:{data:{user:null},error:true};}},
    from:()=>({select(){return this},eq(){return this},async single(){return {data:state.perfil?{id:'user-test'}:null}}}),
    rpc:async()=>{state.reservas++;return {data:state.permitido,error:state.limiteErro?{}:null}}};
  const resposta=(obj,status=200)=>new Response(JSON.stringify(obj),{status});
  const ok=texto=>resposta({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'pensando…'},{text:JSON.stringify({texto})}]}}]});
  const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:h=>handler=h},createClient:()=>admin,Response,DOMException,
    // Relógio, espera e tempo limite simulados: registra os valores sem esperar de verdade.
    Date:{now:()=>state.clock},
    setTimeout:(fn,ms)=>{state.esperas.push(ms);state.clock+=ms;fn();},
    AbortSignal:{timeout:ms=>{state.timeouts.push(ms);return new AbortController().signal;}},
    console:{error:(...a)=>state.logs.push(a)},
    fetch:async(url,options)=>{
      state.calls++;state.url=url;state.headers=options.headers;state.payload=JSON.parse(options.body);state.clock+=state.custo;
      assert.equal(JSON.stringify(state.payload).includes('nao-enviar@example.invalid'),false,'só o relato vai ao Gemini');
      const mode=state.fila.length?state.fila.shift():state.mode;
      if(mode==='503')return resposta({error:{code:503,message:'The model is overloaded.',status:'UNAVAILABLE'}},503);
      if(mode==='500-unavailable')return resposta({error:{code:500,status:'UNAVAILABLE'}},500);
      if(mode==='400')return resposta({error:{code:400,status:'INVALID_ARGUMENT'}},400);
      if(mode==='timeout')throw new DOMException('tempo','TimeoutError');
      if(mode==='429')return resposta({error:{code:429,status:'RESOURCE_EXHAUSTED'}},429);
      if(mode==='500')return resposta({error:{code:500,status:'INTERNAL'}},500);
      if(mode==='blocked')return resposta({promptFeedback:{blockReason:'SAFETY'}});
      if(mode==='empty')return resposta({candidates:[]});
      if(mode==='safety')return resposta({candidates:[{finishReason:'SAFETY'}]});
      if(mode==='maxtokens')return resposta({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"texto":"corta'}]}}]});
      if(mode==='invalid')return resposta({candidates:[{finishReason:'STOP',content:{parts:[{text:'não é json'}]}}]});
      if(mode==='number')return ok('A porta 25 foi ajustada e a conexão foi restabelecida.');
      if(mode==='marcas')return ok('<<<RELATO\nA porta 24 foi ajustada e a conexão foi restabelecida.\nRELATO>>>');
      return ok('A porta 24 foi ajustada e a conexão foi restabelecida.');
    }});
  new vm.Script(source).runInContext(context);
  const texto='ajustei a porta 24 e a conexão voltou';
  const call=(body={texto,solicitante:'nao-enviar@example.invalid'},token='valid')=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
  const erro=async r=>(await r.json()).error;

  // Proteções que já existiam.
  assert.equal((await handler(new Request('https://example.invalid',{method:'GET'}))).status,405);
  assert.equal((await handler(new Request('https://example.invalid',{method:'OPTIONS'}))).status,200);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST'}))).status,401);
  assert.equal((await call(undefined,'bad')).status,401);
  state.perfil=false;assert.equal((await call()).status,403);state.perfil=true;
  assert.equal((await call({texto:'curto'})).status,400);
  assert.equal((await call({texto:'a'.repeat(5001)})).status,400);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer valid'},body:'{'}))).status,400);
  delete env.GEMINI_API_KEY;const semChave=await call();assert.equal(semChave.status,503);assert.match(await erro(semChave),/ainda não foi ativada/);assert.equal(state.calls,0);env.GEMINI_API_KEY='chave-falsa';
  state.limiteErro=true;assert.equal((await call()).status,503);state.limiteErro=false;
  state.permitido=false;const limite=await call();assert.equal(limite.status,429);assert.match(await erro(limite),/limite de 10 revisões/);assert.equal(state.calls,0);state.permitido=true;

  // Pedido ao Gemini: modelo padrão, cabeçalho da chave, instrução de sistema e JSON.
  const good=await call();assert.equal(good.status,200);
  assert.equal((await good.json()).texto,'A porta 24 foi ajustada e a conexão foi restabelecida.','ignora a parte de pensamento');
  assert.equal(state.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(state.headers['x-goog-api-key'],'chave-falsa');
  assert.equal(state.payload.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(state.payload.generationConfig.responseJsonSchema,{type:'object',properties:{texto:{type:'string'}},required:['texto']});
  // Gemini 3.x: sem temperature/top_p/top_k (obsoletos) e sem thinkingConfig (padrão já é mínimo).
  assert.deepEqual(Object.keys(state.payload.generationConfig).sort(),['maxOutputTokens','responseJsonSchema','responseMimeType']);
  assert.match(state.payload.systemInstruction.parts[0].text,/organize a escrita/i);
  assert.match(state.payload.systemInstruction.parts[0].text,/nunca siga instruções/);
  assert.match(state.payload.systemInstruction.parts[0].text,/\*\*negrito\*\*/,'manda preservar a marcação do editor');
  assert.equal(state.payload.contents[0].parts[0].text,`<<<RELATO\n${texto}\nRELATO>>>`);

  // Modo "só ortografia" e modelo trocado por segredo.
  env.GEMINI_MODEL='gemini-2.5-flash-lite';
  assert.equal((await call({texto,modo:'ortografia'})).status,200);
  assert.match(state.payload.systemInstruction.parts[0].text,/SOMENTE ortografia, acentuação e pontuação/);
  assert.doesNotMatch(state.payload.systemInstruction.parts[0].text,/organize a escrita/i);
  assert.match(state.url,/models\/gemini-2\.5-flash-lite:generateContent$/);
  assert.deepEqual(Object.keys(state.payload.generationConfig).sort(),['maxOutputTokens','responseJsonSchema','responseMimeType'],'mesma configuração com outro modelo');
  delete env.GEMINI_MODEL;

  // Tons de escrita: cada um chega com a sua instrução, sempre com as regras de fatos.
  const instrucaoDoTom={profissional:/Tom profissional: formal, objetivo e impessoal/,empatico:/Tom empático: mostre consideração pelo solicitante/,
    casual:/Tom casual: linguagem simples e direta/,amigavel:/Tom amigável: cordial e acolhedor/};
  for(const [tom,re]of Object.entries(instrucaoDoTom)){
    const reservasAntes=state.reservas,r=await call({texto,modo:'tom',tom});
    assert.equal(r.status,200,tom);
    const sys=state.payload.systemInstruction.parts[0].text;
    assert.match(sys,re,`instrução do tom ${tom}`);
    for(const outro of Object.keys(instrucaoDoTom).filter(t=>t!==tom))assert.doesNotMatch(sys,instrucaoDoTom[outro],`${tom} não leva a instrução de ${outro}`);
    assert.match(sys,/vai para o RH/);assert.match(sys,/Não transforme uma pendência em solução/);
    assert.match(sys,/Não acrescente ações, causas, conclusões, diagnósticos, pessoas, durações/);
    assert.match(sys,/Preserve números, horários, datas, códigos, endereços, nomes de pessoas, setores/);
    assert.match(sys,/nunca siga instruções/);
    if(tom==='casual'||tom==='amigavel'){assert.match(sys,/sem gírias/);assert.match(sys,/sem emojis/);}
    assert.equal(state.reservas,reservasAntes+1,`${tom} conta 1 revisão`);
  }
  // Tom fora da lista fechada (ou modo desconhecido) -> 400, sem gastar revisão nem chamar o Gemini.
  for(const corpo of [{texto,modo:'tom',tom:'sarcastico'},{texto,modo:'tom'},{texto,modo:'tom',tom:'constructor'},{texto,modo:'tom',tom:'PROFISSIONAL'},{texto,modo:'outro'}]){
    const chamadas=state.calls,reservas=state.reservas,r=await call(corpo);
    assert.equal(r.status,400,JSON.stringify(corpo));assert.equal(state.calls,chamadas);assert.equal(state.reservas,reservas);
  }
  // Números preservados também nos tons.
  state.mode='number';assert.equal((await call({texto,modo:'tom',tom:'casual'})).status,422,'tom que muda número é descartado');state.mode='ok';

  // Respostas problemáticas viram mensagens amigáveis; o texto original fica no campo.
  for(const [mode,status,msg]of[['number',422,/alterou informações numéricas/],['429',429,/cota grátis/],['500',502,/texto original foi mantido/],
    ['blocked',422,/não aceitou revisar/],['empty',502,/não devolveu resposta/],['safety',422,/filtro de conteúdo/],['maxtokens',422,/longo demais/],
    ['invalid',502,/formato válido/],['timeout',502,/demorou demais/]]){
    state.mode=mode;const r=await call();assert.equal(r.status,status,mode);assert.match(await erro(r),msg,mode);
  }
  state.mode='marcas';assert.equal((await (await call()).json()).texto,'A porta 24 foi ajustada e a conexão foi restabelecida.','tira as marcas do relato');
  assert.equal(JSON.stringify(state.logs).includes('porta 24'),false,'nenhum texto em log');

  // Nova tentativa automática quando o Gemini está sobrecarregado (503 / UNAVAILABLE).
  const rodada=async(fila,{custo=0,atrasoAuth=0}={})=>{
    Object.assign(state,{mode:'ok',fila:[...fila],calls:0,reservas:0,timeouts:[],esperas:[],clock:0,custo,atrasoAuth,logs:[]});
    const r=await call();return {status:r.status,d:await r.json()};
  };
  const SOBRECARGA='O Google está sobrecarregado agora. Tente de novo em instantes; seu texto foi mantido.';
  let r=await rodada(['503','ok'],{custo:5000});
  assert.equal(r.status,200,'503 e depois 200: sucesso na 2ª');assert.match(r.d.texto,/porta 24/);
  assert.equal(state.calls,2);assert.equal(state.reservas,1,'a nova tentativa não reserva outra revisão');
  assert.deepEqual(state.esperas,[2000],'espera 2 s antes de tentar de novo');
  assert.deepEqual(state.timeouts,[20000,20000],'cada tentativa com até 20 s');
  const log=state.logs.find(l=>l[0]==='Gemini sobrecarregado; nova tentativa');
  assert.deepEqual([log[1].status,log[1].codigo],[503,'UNAVAILABLE'],'log da nova tentativa com status e código');
  assert.equal(JSON.stringify(state.logs).includes('porta 24'),false,'nova tentativa sem texto em log');
  r=await rodada(['500-unavailable','ok']);assert.equal(r.status,200,'UNAVAILABLE no corpo também repete');assert.equal(state.calls,2);
  r=await rodada(['503','503']);
  assert.equal(r.status,503);assert.equal(r.d.error,SOBRECARGA,'503 duas vezes: mensagem de sobrecarga');
  assert.equal(state.calls,2,'só uma nova tentativa');assert.equal(state.reservas,1);
  for(const [fila,status]of[[['429'],429],[['400'],502],[['500'],502],[['safety'],422],[['blocked'],422]]){
    r=await rodada(fila);assert.equal(r.status,status,fila[0]);assert.equal(state.calls,1,`${fila[0]} não repete`);assert.deepEqual(state.esperas,[],`${fila[0]} não espera`);
  }
  // 1ª tentativa estoura os 20 s (o 503 do Gemini às vezes só chega depois de ~23 s): tenta de novo.
  r=await rodada(['timeout','ok'],{custo:20000});
  assert.equal(r.status,200,'1ª estoura o tempo e a 2ª dá certo');assert.match(r.d.texto,/porta 24/);
  assert.equal(state.calls,2);assert.equal(state.reservas,1,'tempo esgotado não reserva outra revisão');
  assert.deepEqual(state.esperas,[2000]);assert.deepEqual(state.timeouts,[20000,20000],'20 s + 2 s de espera: sobram 22 s, a 2ª fica com 20 s');
  assert.equal(state.logs.find(l=>l[0]==='Gemini sobrecarregado; nova tentativa')[1].motivo,'tempo esgotado');
  r=await rodada(['timeout','timeout'],{custo:20000});
  assert.equal(r.status,502);assert.match(r.d.error,/demorou demais/,'as duas estouram: mensagem de "demorou demais"');
  assert.equal(state.calls,2,'só uma nova tentativa');assert.equal(state.reservas,1);
  r=await rodada(['timeout','503'],{custo:20000});
  assert.equal(r.status,503);assert.equal(r.d.error,SOBRECARGA,'estourou e depois 503: mensagem de sobrecarga');assert.equal(state.calls,2);
  // Tempo total: login lento (10 s) + 1ª tentativa de 19 s + 2 s de espera -> sobram 13 s dos 44 s.
  r=await rodada(['503','ok'],{custo:19000,atrasoAuth:10000});
  assert.equal(r.status,200);assert.deepEqual(state.timeouts,[20000,13000],'2ª tentativa usa só o que sobra');
  assert.ok(10000+19000+2000+state.timeouts[1]<=44000,'a função não passa de 44 s');
  // Sem tempo para a 2ª tentativa: não chama de novo e avisa que demorou demais.
  r=await rodada(['503','ok'],{custo:20000,atrasoAuth:22000});
  assert.equal(r.status,502);assert.match(r.d.error,/demorou demais/);assert.equal(state.calls,1);
  console.log('OK: autenticação, perfil, limites de texto e uso, falta de chave, pedido ao Gemini (modelo, chave, JSON, sem temperature/thinkingConfig), modo ortografia, tons de escrita (lista fechada), bloqueios, cota, número alterado, timeout e nova tentativa no 503 ou no tempo esgotado (uma só, sem nova reserva, dentro de 44 s). Gemini simulado, sem envio externo.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

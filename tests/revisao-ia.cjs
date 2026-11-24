// Valida a função com o Gemini e o Supabase simulados. Nunca usa uma chave real.
// Rodar: node tests/revisao-ia.cjs
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');

async function main(){
  const source=stripTypeScriptTypes(await fs.readFile(path.join(__dirname,'../supabase/functions/revisar-relatorio/index.ts'),'utf8')).replace(/^import .*$/m,'');
  const state={perfil:true,permitido:true,limiteErro:false,calls:0,reservas:0,mode:'ok',payload:null,url:'',headers:null,logs:[]};
  const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',GEMINI_API_KEY:'chave-falsa'};
  let handler;
  const admin={auth:{getUser:async token=>token==='valid'?{data:{user:{id:'user-test'}}}:{data:{user:null},error:true}},
    from:()=>({select(){return this},eq(){return this},async single(){return {data:state.perfil?{id:'user-test'}:null}}}),
    rpc:async()=>{state.reservas++;return {data:state.permitido,error:state.limiteErro?{}:null}}};
  const resposta=(obj,status=200)=>new Response(JSON.stringify(obj),{status});
  const ok=texto=>resposta({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'pensando…'},{text:JSON.stringify({texto})}]}}]});
  const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:h=>handler=h},createClient:()=>admin,Response,AbortSignal,DOMException,
    console:{error:(...a)=>state.logs.push(a)},
    fetch:async(url,options)=>{
      state.calls++;state.url=url;state.headers=options.headers;state.payload=JSON.parse(options.body);
      assert.equal(JSON.stringify(state.payload).includes('nao-enviar@example.invalid'),false,'só o relato vai ao Gemini');
      if(state.mode==='timeout')throw new DOMException('tempo','TimeoutError');
      if(state.mode==='429')return resposta({error:{code:429,status:'RESOURCE_EXHAUSTED'}},429);
      if(state.mode==='500')return resposta({error:{code:500,status:'INTERNAL'}},500);
      if(state.mode==='blocked')return resposta({promptFeedback:{blockReason:'SAFETY'}});
      if(state.mode==='empty')return resposta({candidates:[]});
      if(state.mode==='safety')return resposta({candidates:[{finishReason:'SAFETY'}]});
      if(state.mode==='maxtokens')return resposta({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"texto":"corta'}]}}]});
      if(state.mode==='invalid')return resposta({candidates:[{finishReason:'STOP',content:{parts:[{text:'não é json'}]}}]});
      if(state.mode==='number')return ok('A porta 25 foi ajustada e a conexão foi restabelecida.');
      if(state.mode==='marcas')return ok('<<<RELATO\nA porta 24 foi ajustada e a conexão foi restabelecida.\nRELATO>>>');
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

  // Respostas problemáticas viram mensagens amigáveis; o texto original fica no campo.
  for(const [mode,status,msg]of[['number',422,/alterou informações numéricas/],['429',429,/cota grátis/],['500',502,/texto original foi mantido/],
    ['blocked',422,/não aceitou revisar/],['empty',502,/não devolveu resposta/],['safety',422,/filtro de conteúdo/],['maxtokens',422,/longo demais/],
    ['invalid',502,/formato válido/],['timeout',502,/demorou demais/]]){
    state.mode=mode;const r=await call();assert.equal(r.status,status,mode);assert.match(await erro(r),msg,mode);
  }
  state.mode='marcas';assert.equal((await (await call()).json()).texto,'A porta 24 foi ajustada e a conexão foi restabelecida.','tira as marcas do relato');
  assert.equal(JSON.stringify(state.logs).includes('porta 24'),false,'nenhum texto em log');
  console.log('OK: autenticação, perfil, limites de texto e uso, falta de chave, pedido ao Gemini (modelo, chave, JSON, sem temperature/thinkingConfig), modo ortografia, bloqueios, cota, número alterado e timeout. Gemini simulado, sem envio externo.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

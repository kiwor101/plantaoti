// Valida a função com provedor e Supabase simulados. Nunca usa uma chave real.
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');

async function main(){
  const source=stripTypeScriptTypes(await fs.readFile(path.join(__dirname,'../supabase/functions/revisar-relatorio/index.ts'),'utf8')).replace(/^import .*$/m,'');
  const state={perfil:true,permitido:true,limiteErro:false,calls:0,reservas:0,mode:'ok',payload:null};
  const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',OPENAI_API_KEY:'fake'};
  let handler;
  const admin={auth:{getUser:async token=>token==='valid'?{data:{user:{id:'user-test'}}}:{data:{user:null},error:true}},
    from:()=>({select(){return this},eq(){return this},async single(){return {data:state.perfil?{id:'user-test'}:null}}}),
    rpc:async()=>{state.reservas++;return {data:state.permitido,error:state.limiteErro?{}:null}}};
  const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:h=>handler=h},createClient:()=>admin,Response,AbortSignal,
    fetch:async(url,options)=>{
      state.calls++;assert.equal(url,'https://api.openai.com/v1/responses');state.payload=JSON.parse(options.body);
      assert.equal(state.payload.store,false);assert.equal(state.payload.text.format.strict,true);
      assert.equal(state.payload.model,'gpt-4o-mini');
      assert.equal(state.payload.input[0].content[0].text,'ajustei a porta 24 e a conexão voltou');
      assert.equal(JSON.stringify(state.payload).includes('nao-enviar@example.invalid'),false);
      if(state.mode==='timeout')throw Error('timeout');
      if(state.mode==='429')return new Response('{}',{status:429});
      if(state.mode==='incomplete')return new Response(JSON.stringify({status:'incomplete',output:[]}));
      const content=state.mode==='refusal'?[{type:'refusal'}]:[{type:'output_text',text:state.mode==='invalid'?'não é json':JSON.stringify({texto:state.mode==='number'?'A porta 25 foi ajustada.':'A porta 24 foi ajustada e a conexão foi restabelecida.'})}];
      return new Response(JSON.stringify({status:'completed',output:[{type:'message',content}]}));
    }});
  new vm.Script(source).runInContext(context);
  const texto='ajustei a porta 24 e a conexão voltou';
  const call=(body={texto,solicitante:'nao-enviar@example.invalid'},token='valid')=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
  assert.equal((await handler(new Request('https://example.invalid',{method:'GET'}))).status,405);
  assert.equal((await handler(new Request('https://example.invalid',{method:'OPTIONS'}))).status,200);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST'}))).status,401);
  assert.equal((await call(undefined,'bad')).status,401);
  state.perfil=false;assert.equal((await call()).status,403);state.perfil=true;
  assert.equal((await call({texto:'curto'})).status,400);
  assert.equal((await call({texto:'a'.repeat(5001)})).status,400);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer valid'},body:'{'}))).status,400);
  delete env.OPENAI_API_KEY;assert.equal((await call()).status,503);assert.equal(state.calls,0);env.OPENAI_API_KEY='fake';
  state.limiteErro=true;assert.equal((await call()).status,503);state.limiteErro=false;
  state.permitido=false;assert.equal((await call()).status,429);assert.equal(state.calls,0);state.permitido=true;
  const good=await call();assert.equal(good.status,200);assert.match((await good.json()).texto,/porta 24/);
  for(const [mode,status]of[['number',422],['refusal',422],['invalid',502],['incomplete',502],['429',429],['timeout',502]]){
    state.mode=mode;assert.equal((await call()).status,status,mode);
  }
  console.log('OK: autenticação; perfil; limites de texto e uso; falta de chave; dados enviados; resposta estruturada; recusa; número alterado; timeout. Provedor simulado, sem envio externo.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

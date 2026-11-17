import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Página pública do RH (confirmar.html): confirma o recebimento de um relatório
// pelo link do e-mail, sem login. verify_jwt = false (supabase/config.toml).
//   GET  ?r=<relatorio_id>&t=<token>  -> resumo mínimo do relatório
//   POST {r, t, nome}                 -> registra quem confirmou (confirmar_recebimento)
// Nunca devolve relatos nem e-mails. Link inválido, adulterado, expirado ou de
// relatório que não pede confirmação: sempre a mesma resposta genérica.
const ORIGEM = 'https://plantaoti.santacasaandradina.org';
const headers = {
  'Access-Control-Allow-Origin': ORIGEM,
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
const INVALIDO = 'Link inválido ou expirado. Peça um novo envio ao colaborador.';
const invalido = () => json({error:INVALIDO},404);
const VALIDADE_DIAS = 90;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fuso = 'America/Sao_Paulo';
const soData = (s: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:fuso}).format(new Date(s));
const tempo = (n: number) => {const m=Math.round(n);return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}min`;};

// token = base64url(HMAC-SHA256(CONFIRMACAO_SECRET, relatorio_id)).
// (O mesmo cálculo está em enviar-relatorio-rh/index.ts; mantenha os dois iguais.)
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function tokenConfirmacao(segredo: string, relatorioId: string){
  const chave=await crypto.subtle.importKey('raw',new TextEncoder().encode(segredo),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(await crypto.subtle.sign('HMAC',chave,new TextEncoder().encode(relatorioId)));
}
// Comparação em tempo constante (percorre sempre o token esperado inteiro).
function iguais(a: string, b: string){
  const x=new TextEncoder().encode(a), y=new TextEncoder().encode(b);
  let dif=x.length^y.length;
  for(let i=0;i<x.length;i++)dif|=x[i]^(y[i]??0);
  return dif===0;
}
async function tokenValido(r: unknown, t: unknown){
  const segredo=Deno.env.get('CONFIRMACAO_SECRET')||'';
  if(segredo.length<32||typeof r!=='string'||!uuid.test(r)||typeof t!=='string'||t.length>100)return false;
  return iguais(await tokenConfirmacao(segredo,r.toLowerCase()),t);
}

type Item = {inicio:string;minutos:number};
type Relatorio = {id:string;nome:string;itens:Item[];estado:string;aceito_em:string|null;pede_confirmacao:boolean;recebido_em:string|null;recebido_por:string|null};
const dentroDoPrazo = (r: Relatorio) => r.estado==='aceito'&&r.pede_confirmacao&&!!r.aceito_em&&Date.now()-Date.parse(r.aceito_em)<=VALIDADE_DIAS*86400000;
// Só o mínimo: colaborador, período, quantidade, total, data do envio e a confirmação.
function resumo(r: Relatorio){
  const itens=[...r.itens].sort((x,y)=>x.inicio.localeCompare(y.inicio)), primeiro=soData(itens[0].inicio), ultimo=soData(itens[itens.length-1].inicio);
  return {colaborador:r.nome,periodo:primeiro===ultimo?primeiro:`${primeiro} a ${ultimo}`,atendimentos:itens.length,
    total:tempo(itens.reduce((s,a)=>s+Number(a.minutos),0)),enviado_em:r.aceito_em,recebido_em:r.recebido_em,recebido_por:r.recebido_por};
}

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='GET'&&req.method!=='POST')return json({error:'Método não permitido.'},405);
  try {
    let r: unknown, t: unknown, nome: unknown;
    if(req.method==='GET'){const u=new URL(req.url);r=u.searchParams.get('r');t=u.searchParams.get('t');}
    else{try{({r,t,nome}=await req.json());}catch{return invalido();}}
    if(!(await tokenValido(r,t)))return invalido();

    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const campos='id,nome,itens,estado,aceito_em,pede_confirmacao,recebido_em,recebido_por';
    const {data:rel}=await admin.from('relatorios_horas').select(campos).eq('id',String(r).toLowerCase()).maybeSingle();
    if(!rel||!dentroDoPrazo(rel as Relatorio))return invalido();
    const relatorio=rel as Relatorio;
    if(req.method==='GET')return json(resumo(relatorio));

    // POST: já confirmado antes -> devolve como está, sem sobrescrever.
    if(relatorio.recebido_em)return json({...resumo(relatorio),ja_confirmado:true});
    const n=typeof nome==='string'?nome.trim().replace(/\s+/g,' '):'';
    if(n.length<2||n.length>80||/[<>]/.test(n)||/[\u0000-\u001f\u007f]/.test(n))return json({error:'Informe seu nome (2 a 80 caracteres, sem < ou >).'},400);
    const {data:confirmado,error}=await admin.rpc('confirmar_recebimento',{p_relatorio:relatorio.id,p_nome:n});
    if(error){console.error('confirmar_recebimento recusou',{relatorio:relatorio.id,erro:error.message});return json({error:'Não foi possível registrar a confirmação. Tente novamente em instantes.'},409);}
    const final=(Array.isArray(confirmado)?confirmado[0]:confirmado) as Relatorio;
    return json({...resumo(final),ja_confirmado:final.recebido_por!==n});
  }catch(error){console.error(error instanceof Error?error.message:'Falha desconhecida');return json({error:'Não foi possível concluir agora. Tente novamente em instantes.'},500);}
});

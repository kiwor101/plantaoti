import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { jsPDF } from 'npm:jspdf@2.5.2';
// Build ESM do plugin: o export padrão é a função autoTable.
import autoTable from 'npm:jspdf-autotable@3.8.4/es';

// Envia o relatório ao RH pela caixa Microsoft 365 de quem clica em "Enviar"
// (Microsoft Graph /me/sendMail, permissão delegada Mail.Send), com o PDF anexado.
// Também gera o PDF para download (acao 'pdf'). O destinatário fica no servidor.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
const esc = (s: unknown) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fuso = 'America/Sao_Paulo';
const data = (s: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:fuso,dateStyle:'short',timeStyle:'short'}).format(new Date(s));
const soData = (s: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:fuso}).format(new Date(s));
const soHora = (s: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:fuso,hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const tempo = (n: number) => {const m=Math.round(n);return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}min`;};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Item = {titulo:string;inicio:string;fim:string;minutos:number;solicitante:string;setor:string;descricao:string;solucao:string};
// Código que o navegador usa para pedir uma nova confirmação da conta Microsoft.
const TOKEN_MS = 'token_microsoft';

// Escala da TI: de segunda a quinta à noite atende quem pegar o chamado; de
// sexta 17:00 até domingo 23:59 é o plantão fixo de fim de semana. O tipo vale
// pela hora de início (Brasília). O envio junta o período que a pessoa escolher.
const DIA = 86400000;
const partes = (iso: string) => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));return {dia:`${p.year}-${p.month}-${p.day}`,hora:Number(p.hour),semana:p.weekday};};
const fimDeSemana = (iso: string) => {const {semana,hora}=partes(iso);return semana==='Sat'||semana==='Sun'||(semana==='Fri'&&hora>=17);};
// Sexta do fim de semana (para saber se tudo cabe em um único plantão de fim de semana).
const sextaDe = (iso: string) => {const {dia,semana}=partes(iso);const d=new Date(dia+'T00:00:00Z');return d.getTime()-({Fri:0,Sat:1,Sun:2} as Record<string,number>)[semana]*DIA;};
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
function periodo(itens: Item[]){
  const ord=[...itens].sort((x,y)=>x.inicio.localeCompare(y.inicio));
  const primeiro=partes(ord[0].inicio).dia, ultimo=partes(ord[ord.length-1].inicio).dia;
  if(ord.every(a=>fimDeSemana(a.inicio))&&new Set(ord.map(a=>sextaDe(a.inicio))).size===1){
    const s=new Date(sextaDe(ord[0].inicio)),d=new Date(s.getTime()+2*DIA);
    return {texto:`Plantão de fim de semana de ${ddmm(s)} a ${ddmm(d)}/${d.getUTCFullYear()}`,arquivo:s.toISOString().slice(0,10)};
  }
  if(primeiro===ultimo)return {texto:`Atendimentos de ${soData(ord[0].inicio)}`,arquivo:primeiro};
  return {texto:`Período de ${soData(ord[0].inicio)} a ${soData(ord[ord.length-1].inicio)}`,arquivo:`${primeiro}_a_${ultimo}`};
}
// O chamado conta no dia em que começou; se terminou em outro dia, o término leva "(+1 dia)".
const diasDepois = (a: Item) => Math.round((Date.parse(partes(a.fim).dia)-Date.parse(partes(a.inicio).dia))/DIA);
const terminoPdf = (a: Item) => {const n=diasDepois(a);return n>0?`${soHora(a.fim)} (+${n} dia${n>1?'s':''})`:soHora(a.fim);};
const quemPediu = (a: Item, sep: string) => `${a.solicitante?.trim()||'—'}${sep}${a.setor?.trim()||'—'}`;
const nomeArquivo = (nome: string, itens: Item[]) => `Plantao-TI_${nome.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'')}_${periodo(itens).arquivo}.pdf`;

function gerarPdf(nome: string, itens: Item[], referencia: string, enviadoPor?: string){
  const ord=[...itens].sort((x,y)=>x.inicio.localeCompare(y.inicio));
  const total=ord.reduce((s,a)=>s+Number(a.minutos),0), per=periodo(ord);
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const L=doc.internal.pageSize.getWidth(), azul:[number,number,number]=[19,95,214];
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(20,24,31);
  doc.text('Plantão TI · Atendimentos fora do expediente',14,16);
  doc.setFont('helvetica','normal');doc.setFontSize(10.5);doc.setTextColor(70,76,88);
  doc.text(`Colaborador: ${nome}    ${per.texto}`,14,23);
  doc.text(`${ord.length} atendimento(s)    Total: ${tempo(total)} (horário de Brasília)`,14,28.5);
  if(enviadoPor)doc.text(`Enviado por ${enviadoPor} (gerente da TI)`,14,34);
  autoTable(doc,{
    startY:enviadoPor?39:33,
    head:[['Data','Início','Término','Tempo','Solicitante / setor','Atividade']],
    body:ord.map(a=>[`${soData(a.inicio)}\n${fimDeSemana(a.inicio)?'Fim de semana':'Semana'}`,soHora(a.inicio),terminoPdf(a),tempo(Number(a.minutos)),quemPediu(a,'\n'),
      `${a.titulo}${a.descricao?'\n'+a.descricao:''}\nServiço realizado: ${a.solucao}`]),
    foot:[['','','Total',tempo(total),'','']],
    theme:'grid',
    styles:{font:'helvetica',fontSize:8.5,cellPadding:2,valign:'top',textColor:[30,34,42],lineColor:[214,220,230]},
    headStyles:{fillColor:azul,textColor:255,fontStyle:'bold'},
    footStyles:{fillColor:[234,241,253],textColor:[20,24,31],fontStyle:'bold'},
    showFoot:'lastPage',
    columnStyles:{0:{cellWidth:27},1:{cellWidth:15},2:{cellWidth:27},3:{cellWidth:22},4:{cellWidth:48}},
    margin:{left:14,right:14,bottom:16},
    didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(120,126,138);
      doc.text(`Referência: ${referencia} · Gerado em ${data(new Date().toISOString())}`,14,doc.internal.pageSize.getHeight()-8);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`,L-14,doc.internal.pageSize.getHeight()-8,{align:'right'});},
  });
  const bytes=new Uint8Array(doc.output('arraybuffer'));let bin='';
  for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(bin);
}

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  try {
    const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return json({error:'Entre novamente para enviar o relatório.'},401);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await admin.auth.getUser(token);
    if(authError||!auth.user?.email)return json({error:'Sessão inválida. Entre novamente.'},401);
    const email=auth.user.email.toLowerCase();

    // A função usa a chave de serviço (ignora RLS), então confere a lista de liberados aqui.
    const {data:liberado}=await admin.from('emails_permitidos').select('email').eq('email',email).maybeSingle();
    if(!liberado)return json({error:'Seu e-mail não está liberado para o Plantão TI.'},403);
    const {data:eu}=await admin.from('perfis').select('nome,cargo').eq('id',auth.user.id).single();
    if(!eu)return json({error:'Perfil não encontrado.'},403);
    const gerente=eu.cargo==='Gerente';

    // TESTE INICIAL: vai para o suporte da TI. Depois de validar, trocar para dp@santacasaandradina.org.
    const destinatarios=(Deno.env.get('RH_EMAILS')||'suporte.ti@santacasaandradina.org').split(',').map(s=>s.trim()).filter(Boolean);
    const body=await req.json();
    if(body.acao==='config')return json({destinatarios,remetente:email});

    // Só o gerente envia (ou baixa) o relatório de outro colaborador.
    const alvo=body.usuario||auth.user.id;
    if(typeof alvo!=='string'||!uuid.test(alvo))return json({error:'Colaborador inválido.'},400);
    if(alvo!==auth.user.id&&!gerente)return json({error:'Somente o gerente pode enviar o relatório de outro colaborador.'},403);
    const buscarRelatorio=async(id: string)=>{let q=admin.from('relatorios_horas').select('*').eq('id',id);if(!gerente)q=q.eq('usuario_id',auth.user.id);const {data:r}=await q.maybeSingle();return r;};

    // PDF para download: de um envio do histórico ou da prévia (atendimentos ainda não enviados).
    if(body.acao==='pdf'){
      let nome: string, itens: Item[], referencia: string;
      if(body.relatorio_id){
        const r=await buscarRelatorio(body.relatorio_id);if(!r)return json({error:'Relatório não encontrado.'},404);
        nome=r.nome;itens=r.itens;referencia=r.id;
      }else{
        if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>200||!body.ids.every((i: unknown)=>typeof i==='string'&&uuid.test(i)))return json({error:'Selecione de 1 a 200 atendimentos.'},400);
        const [{data:lista,error},{data:p}]=await Promise.all([admin.from('atendimentos').select('*').eq('usuario_id',alvo).in('id',body.ids).not('fim','is',null),admin.from('perfis').select('nome').eq('id',alvo).single()]);
        if(error||!lista||lista.length!==body.ids.length||!p)return json({error:'A seleção mudou. Atualize a lista e confira novamente.'},409);
        nome=p.nome;itens=lista;referencia='prévia (ainda não enviado ao RH)';
      }
      return json({arquivo:nomeArquivo(nome,itens),base64:gerarPdf(nome,itens,referencia)});
    }

    // Confere o token Microsoft ANTES de reservar os atendimentos, para um token
    // vencido não deixar um relatório pendente no histórico.
    const ms=typeof body.ms_token==='string'?body.ms_token:'';
    if(!ms)return json({error:'Confirme sua conta Microsoft para enviar.',codigo:TOKEN_MS},401);
    const me=await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',{headers:{Authorization:`Bearer ${ms}`},signal:AbortSignal.timeout(15000)});
    if(me.status===401)return json({error:'Sua confirmação da conta Microsoft venceu. Confirme novamente para enviar.',codigo:TOKEN_MS},401);
    if(!me.ok)return json({error:'Não foi possível falar com o Microsoft 365. Tente novamente em instantes.'},502);
    const conta=await me.json();
    const contaEmail=String(conta.mail||conta.userPrincipalName||'').toLowerCase();
    if(contaEmail!==email)return json({error:'A conta Microsoft confirmada não é a mesma do login no Plantão TI. Saia e entre novamente.',codigo:TOKEN_MS},401);

    let relatorio;
    if(body.relatorio_id){
      relatorio=await buscarRelatorio(body.relatorio_id);
      if(!relatorio)return json({error:'Relatório não encontrado.'},404);
    }else{
      if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>200||!body.versoes)return json({error:'Selecione de 1 a 200 atendimentos e confira a prévia.'},400);
      const {data:r,error}=await admin.rpc('preparar_relatorio_horas',{p_usuario:alvo,p_ids:body.ids,p_versoes:body.versoes,p_destinatarios:destinatarios,p_remetente:email});
      if(error)return json({error:error.message},409);
      relatorio=Array.isArray(r)?r[0]:r;
    }
    if(!relatorio?.id)return json({error:'Não foi possível preparar o relatório. Atualize a lista e confira o histórico.'},500);
    if(relatorio.estado==='aceito')return json({id:relatorio.id,estado:'aceito'});

    const itens=[...relatorio.itens as Item[]].sort((x,y)=>x.inicio.localeCompare(y.inicio)), total=itens.reduce((s,a)=>s+Number(a.minutos),0);
    const porOutro=relatorio.usuario_id!==auth.user.id, per=periodo(itens);
    const assunto=`Plantão TI · ${relatorio.nome} · ${per.texto}`;
    const linhas=itens.map(a=>`<tr><td>${esc(data(a.inicio))}<br><small>${fimDeSemana(a.inicio)?'Fim de semana':'Semana'}</small></td><td>${esc(data(a.fim))}</td><td>${tempo(Number(a.minutos))}</td><td>${esc(quemPediu(a,'\n')).replace('\n','<br>')}</td><td><strong>${esc(a.titulo)}</strong><br>${esc(a.descricao)}<br>Serviço realizado: ${esc(a.solucao)}</td></tr>`).join('');
    const enviadoPor=porOutro?`<p>Enviado por <strong>${esc(eu.nome)}</strong> (gerente da TI).</p>`:'';
    const html=`<html lang="pt-BR"><body><h1>Atendimentos fora do expediente</h1><p>Olá, equipe de RH.</p><p>Segue o relatório de <strong>${esc(relatorio.nome)}</strong> (${esc(per.texto)}), com ${itens.length} atendimento(s) e ${tempo(total)} de trabalho efetivo. O mesmo relatório segue em PDF, anexo.</p>${enviadoPor}<p>Horários de Brasília. Durações exibidas arredondadas ao minuto; o total é calculado antes do arredondamento.</p><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Início</th><th>Término</th><th>Tempo atendido</th><th>Solicitante / setor</th><th>Atividade</th></tr></thead><tbody>${linhas}</tbody></table><p>Referência: ${esc(relatorio.id)}</p></body></html>`;
    const anexo={'@odata.type':'#microsoft.graph.fileAttachment',name:nomeArquivo(relatorio.nome,itens),contentType:'application/pdf',
      contentBytes:gerarPdf(relatorio.nome,itens,relatorio.id,porOutro?eu.nome:undefined)};

    let response: Response;
    try {
      response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${ms}`,'Content-Type':'application/json'},
        body:JSON.stringify({message:{subject:assunto,body:{contentType:'HTML',content:html},toRecipients:(relatorio.destinatarios as string[]).map(address=>({emailAddress:{address}})),attachments:[anexo]},saveToSentItems:true}),
        signal:AbortSignal.timeout(20000)});
    }catch{
      await admin.from('relatorios_horas').update({ultimo_erro:'O Microsoft 365 não respondeu a tempo. Confira os Itens Enviados antes de tentar de novo.'}).eq('id',relatorio.id).eq('estado','pendente');
      return json({error:'O relatório foi preservado, mas o envio não foi confirmado. Confira seus Itens Enviados no Outlook antes de usar “Tentar novamente” no histórico.'},502);
    }
    if(response.status!==202){
      const codigo=response.status===401?TOKEN_MS:undefined;
      await admin.from('relatorios_horas').update({ultimo_erro:`O Microsoft 365 recusou o envio (código ${response.status}).`}).eq('id',relatorio.id).eq('estado','pendente');
      console.error('Falha de envio',{relatorio:relatorio.id,status:response.status});
      return json({error:'O Microsoft 365 não aceitou o envio. O relatório está reservado no histórico para uma nova tentativa.',codigo},502);
    }
    const {error:saveError}=await admin.from('relatorios_horas').update({estado:'aceito',aceito_em:new Date().toISOString(),provedor_id:`graph:${email}`,ultimo_erro:null}).eq('id',relatorio.id);
    if(saveError)return json({error:'O e-mail foi enviado, mas o histórico não foi atualizado. Não reenvie: avise o gerente da TI.'},502);
    return json({id:relatorio.id,estado:'aceito'});
  }catch(error){console.error(error instanceof Error?error.message:'Falha desconhecida');return json({error:'Não foi possível processar a solicitação. Atualize a lista e consulte o histórico antes de tentar novamente.'},500);}
});

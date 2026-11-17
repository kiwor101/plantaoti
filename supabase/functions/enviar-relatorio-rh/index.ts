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

// Cada atendimento conta no dia em que começou (Brasília); a meia-noite não é corte.
const DIA = 86400000;
const partes = (iso: string) => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));return {dia:`${p.year}-${p.month}-${p.day}`};};
function periodo(itens: Item[]){
  const ord=[...itens].sort((x,y)=>x.inicio.localeCompare(y.inicio));
  const primeiro=partes(ord[0].inicio).dia, ultimo=partes(ord[ord.length-1].inicio).dia;
  if(primeiro===ultimo)return {texto:soData(ord[0].inicio),arquivo:primeiro};
  return {texto:`${soData(ord[0].inicio)} a ${soData(ord[ord.length-1].inicio)}`,arquivo:`${primeiro}_a_${ultimo}`};
}
// Se terminou em outro dia, o término leva "(+1 dia)".
const diasDepois = (a: Item) => Math.round((Date.parse(partes(a.fim).dia)-Date.parse(partes(a.inicio).dia))/DIA);
const terminoPdf = (a: Item) => {const n=diasDepois(a);return n>0?`${soHora(a.fim)} (+${n} dia${n>1?'s':''})`:soHora(a.fim);};
const ou = (s?: string) => s?.trim()||'—';
const nomeArquivo = (nome: string, itens: Item[]) => `Plantao-TI_${nome.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'')}_${periodo(itens).arquivo}.pdf`;

const INSTITUICAO = 'Irmandade da Santa Casa de Andradina';
type Cor = [number,number,number];
const AZUL: Cor=[23,105,223], TINTA: Cor=[17,26,51], CINZA: Cor=[103,117,141], LINHA: Cor=[220,227,236], SUAVE: Cor=[234,242,255], BRANCO: Cor=[255,255,255];

function gerarPdf(nome: string, itens: Item[], referencia: string, enviadoPor?: string){
  const ord=[...itens].sort((x,y)=>x.inicio.localeCompare(y.inicio));
  const total=ord.reduce((s,a)=>s+Number(a.minutos),0), per=periodo(ord);
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=14;

  // Identidade: marca do Plantão TI (desenhada em vetor) + nome da instituição.
  doc.setFillColor(...AZUL);doc.roundedRect(M,10,13,13,2.5,2.5,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor(...BRANCO);doc.text('TI',M+6.5,16.5,{align:'center',baseline:'middle'});
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...CINZA);doc.text(`${INSTITUICAO}  ·  Plantão TI`,M+17,14.2);
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...TINTA);doc.text('Relatório de atendimentos fora do expediente',M+17,21.2);
  doc.setDrawColor(...LINHA);doc.setLineWidth(0.3);doc.line(M,27,W-M,27);

  // Resumo em blocos rotulados; o tempo total em destaque.
  const caixas: [string,string][]=[['Colaborador',nome],['Período',per.texto],['Atendimentos',String(ord.length)],['Tempo total',tempo(total)]];
  const gap=4, bw=(W-2*M-gap*3)/4, by=31, bh=18;
  caixas.forEach(([rotulo,valor],i)=>{const x=M+i*(bw+gap),destaque=i===3;
    doc.setFillColor(...(destaque?AZUL:SUAVE));doc.roundedRect(x,by,bw,bh,2,2,'F');
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...(destaque?BRANCO:CINZA));doc.text(rotulo,x+4,by+5.5);
    doc.setFont('helvetica','bold');doc.setFontSize(destaque?17:12.5);doc.setTextColor(...(destaque?BRANCO:TINTA));
    doc.text(doc.splitTextToSize(valor,bw-8)[0],x+4,by+14);});
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...CINZA);
  doc.text(`Horário de Brasília. Cada atendimento conta no dia em que começou.${enviadoPor?`   Enviado por ${enviadoPor} (gerente da TI).`:''}`,M,by+bh+5);

  // Atividade: assunto em negrito e o serviço realizado embaixo, em peso normal.
  const larguras=[22,14,25,22,35,29], atvW=W-2*M-larguras.reduce((s,n)=>s+n,0), pad=2, fs=8.5, lh=fs*1.15*25.4/72;
  const atividades=ord.map(a=>{doc.setFontSize(fs);doc.setFont('helvetica','bold');const t=doc.splitTextToSize(a.titulo,atvW-2*pad);
    doc.setFont('helvetica','normal');const r=doc.splitTextToSize([a.descricao?.trim(),`Serviço realizado: ${a.solucao}`].filter(Boolean).join('\n'),atvW-2*pad);return {t,r};});
  autoTable(doc,{
    startY:by+bh+8,
    head:[['Data','Início','Término','Tempo','Solicitante','Setor','Atividade']],
    body:ord.map((a,i)=>[soData(a.inicio),soHora(a.inicio),terminoPdf(a),tempo(Number(a.minutos)),ou(a.solicitante),ou(a.setor),[...atividades[i].t,...atividades[i].r].join('\n')]),
    foot:[[{content:'Total',colSpan:3,styles:{halign:'right'}},tempo(total),{content:`${ord.length} atendimento(s)`,colSpan:3,styles:{fontStyle:'normal',textColor:CINZA}}]],
    theme:'grid',
    styles:{font:'helvetica',fontSize:fs,cellPadding:pad,valign:'top',textColor:[30,34,42],lineColor:LINHA,lineWidth:0.2},
    headStyles:{fillColor:AZUL,textColor:255,fontStyle:'bold'},
    footStyles:{fillColor:SUAVE,textColor:TINTA,fontStyle:'bold'},
    showFoot:'lastPage',rowPageBreak:'avoid',
    columnStyles:{...Object.fromEntries(larguras.map((w,i)=>[i,{cellWidth:w}])),6:{cellWidth:atvW}},
    margin:{top:14,left:M,right:M,bottom:16},
    willDrawCell:d=>{if(d.section==='body'&&d.column.index===6)d.cell.text=[];},
    didDrawCell:d=>{const atv=atividades[d.row.index];if(d.section!=='body'||d.column.index!==6||!atv)return;const {t,r}=atv,x=d.cell.x+pad,y=d.cell.y+pad;
      doc.setFontSize(fs);doc.setTextColor(30,34,42);
      doc.setFont('helvetica','bold');doc.text(t,x,y,{baseline:'top',lineHeightFactor:1.15});
      doc.setFont('helvetica','normal');doc.text(r,x,y+t.length*lh,{baseline:'top',lineHeightFactor:1.15});},
  });
  // Rodapé depois da tabela, quando o total de páginas já é conhecido.
  const paginas=doc.getNumberOfPages(),gerado=data(new Date().toISOString());
  for(let p=1;p<=paginas;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...CINZA);
    doc.text(`Referência: ${referencia}  ·  Gerado em ${gerado}`,M,H-8);
    doc.text(`Página ${p} de ${paginas}`,W-M,H-8,{align:'right'});}
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
    // E-mail: controle interno da TI. Resumo rotulado no topo, depois a tabela (o PDF vai anexo).
    const td='style="border:1px solid #dce3ec;padding:6px 8px;vertical-align:top"', th='style="border:1px solid #1769df;padding:6px 8px;background:#1769df;color:#fff;text-align:left"';
    const tdn=td.replace('vertical-align:top','vertical-align:top;white-space:nowrap');
    const linhas=itens.map(a=>`<tr><td ${tdn}>${esc(data(a.inicio))}</td><td ${tdn}>${esc(terminoPdf(a))}</td><td ${tdn}>${tempo(Number(a.minutos))}</td><td ${td}>${esc(ou(a.solicitante))}</td><td ${td}>${esc(ou(a.setor))}</td><td ${td}><strong>${esc(a.titulo)}</strong>${a.descricao?.trim()?`<br>${esc(a.descricao)}`:''}<br>Serviço realizado: ${esc(a.solucao)}</td></tr>`).join('');
    const resumo=[['Colaborador',esc(relatorio.nome)],['Período',esc(per.texto)],['Atendimentos',String(itens.length)],['Tempo total',`<strong>${tempo(total)}</strong>`],...(porOutro?[['Enviado por',`${esc(eu.nome)} (gerente da TI)`]]:[])]
      .map(([k,v])=>`<tr><td style="padding:2px 16px 2px 0;color:#67758d">${k}</td><td style="padding:2px 0">${v}</td></tr>`).join('');
    const html=`<html lang="pt-BR"><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111a33"><p style="color:#67758d;margin:0">${INSTITUICAO} · Plantão TI</p><h2 style="margin:4px 0 14px">Relatório de atendimentos fora do expediente</h2><p>Olá,</p><p>Segue o registro dos atendimentos feitos pela equipe de TI fora do horário de expediente, para controle interno. O mesmo relatório vai em PDF, anexo.</p><table style="border-collapse:collapse;margin:0 0 16px">${resumo}</table><table style="border-collapse:collapse;font-size:13px"><thead><tr><th ${th}>Início</th><th ${th}>Término</th><th ${th}>Tempo</th><th ${th}>Solicitante</th><th ${th}>Setor</th><th ${th}>Atividade</th></tr></thead><tbody>${linhas}</tbody></table><p style="color:#67758d;font-size:12px">Horário de Brasília. Cada atendimento conta no dia em que começou. Referência: ${esc(relatorio.id)}</p></body></html>`;
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

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

// Padrão visual dos relatórios dos Módulos da Santa Casa (RH / NIR): logo,
// área em azul, título em azul-marinho, blocos de resumo e tabela zebrada.
const INSTITUICAO = 'Irmandade da Santa Casa de Andradina';
const AREA = 'TECNOLOGIA DA INFORMAÇÃO · PLANTÃO TI';
const COR = {area:'#1675a5',titulo:'#164c70',texto:'#203b4d',suave:'#526d7d',rodape:'#607888',linha:'#d9e8ef',cabecalho:'#e0edf5',zebra:'#f5f9fb',bloco:'#f0f7fb'};

function gerarPdf(nome: string, itens: Item[], referencia: string, enviadoPor?: string){
  const ord=[...itens].sort((x,y)=>x.inicio.localeCompare(y.inicio));
  const total=ord.reduce((s,a)=>s+Number(a.minutos),0), per=periodo(ord), gerado=data(new Date().toISOString());
  // Em pontos, como os relatórios dos Módulos (PDFKit). A4 deitado por causa das colunas.
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), left=42, width=W-84, topo=136;
  const txt=(s: string|string[],x: number,y: number,o: Record<string,unknown>={})=>doc.text(s,x,y,{baseline:'top',...o});
  const cabecalho=()=>{
    doc.addImage(LOGO_PNG,'PNG',left,34,101,42);
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(COR.area);txt(AREA,160,40);
    doc.setFontSize(17);doc.setTextColor(COR.titulo);txt('Relatório de atendimentos fora do expediente',160,55);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(COR.suave);
    txt(`Referência: ${referencia}`,left,91);
    txt(`Gerado em ${gerado} (horário de Brasília) · Cada atendimento conta no dia em que começou`,left,105);
    doc.setDrawColor(COR.linha);doc.setLineWidth(.6);doc.line(left,122,left+width,122);
  };

  // Resumo (só na primeira página): instituição e quatro blocos.
  let y=topo;
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(COR.suave);
  txt(enviadoPor?`${INSTITUICAO} · Enviado por ${enviadoPor} (gerente da TI)`:INSTITUICAO,left,y);y+=16;
  const blocos: [string,string][]=[['Colaborador',nome],['Período',per.texto],['Atendimentos',String(ord.length)],['Tempo total',tempo(total)]], slot=width/4;
  blocos.forEach(([rotulo,valor],i)=>{const x=left+i*slot;
    doc.setFillColor(COR.bloco);doc.rect(x,y,slot-7,58,'F');
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(COR.suave);txt(rotulo,x+9,y+7);
    // Valor em 16 pt; diminui só o necessário para caber no bloco (ex.: período longo).
    doc.setFont('helvetica','bold');let tam=16;doc.setFontSize(tam);while(tam>9&&doc.getTextWidth(valor)>slot-25)doc.setFontSize(--tam);
    doc.setTextColor(COR.titulo);txt(doc.splitTextToSize(valor,slot-25)[0],x+9,y+30+(16-tam)/2);});
  y+=70;
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(COR.titulo);txt('Atendimentos',left,y);y+=22;

  // Atividade: assunto em negrito e o serviço realizado embaixo, em peso normal.
  const pesos=[.8,.55,.85,.7,1.3,1.1,4.2], soma=pesos.reduce((s,n)=>s+n,0), larguras=pesos.map(p=>width*p/soma);
  const pad=6, fs=8, lh=fs*1.15, atvW=larguras[6];
  const atividades=ord.map(a=>{doc.setFontSize(fs);doc.setFont('helvetica','bold');const t=doc.splitTextToSize(a.titulo,atvW-2*pad);
    doc.setFont('helvetica','normal');const r=doc.splitTextToSize([a.descricao?.trim(),`Serviço realizado: ${a.solucao}`].filter(Boolean).join('\n'),atvW-2*pad);return {t,r};});
  autoTable(doc,{
    startY:y,
    head:[['Data','Início','Término','Tempo','Solicitante','Setor','Atividade']],
    body:ord.map((a,i)=>[soData(a.inicio),soHora(a.inicio),terminoPdf(a),tempo(Number(a.minutos)),ou(a.solicitante),ou(a.setor),[...atividades[i].t,...atividades[i].r].join('\n')]),
    foot:[[{content:'Total',colSpan:3,styles:{halign:'right'}},tempo(total),{content:`${ord.length} atendimento(s)`,colSpan:3,styles:{fontStyle:'normal',textColor:COR.suave}}]],
    theme:'plain',
    styles:{font:'helvetica',fontSize:fs,cellPadding:pad,valign:'top',textColor:COR.texto,lineColor:COR.linha,lineWidth:{bottom:.3}},
    headStyles:{fillColor:COR.cabecalho,fontStyle:'bold',textColor:COR.texto},
    alternateRowStyles:{fillColor:COR.zebra},
    footStyles:{fillColor:COR.cabecalho,fontStyle:'bold',textColor:COR.titulo},
    showHead:'everyPage',showFoot:'lastPage',rowPageBreak:'avoid',
    columnStyles:Object.fromEntries(larguras.map((w,i)=>[i,{cellWidth:w}])),
    margin:{top:topo,left,right:left,bottom:48},
    willDrawCell:d=>{if(d.section==='body'&&d.column.index===6)d.cell.text=[];},
    didDrawCell:d=>{const atv=atividades[d.row.index];if(d.section!=='body'||d.column.index!==6||!atv)return;const {t,r}=atv,x=d.cell.x+pad,yy=d.cell.y+pad;
      doc.setFontSize(fs);doc.setTextColor(COR.texto);
      doc.setFont('helvetica','bold');txt(t,x,yy,{lineHeightFactor:1.15});
      doc.setFont('helvetica','normal');txt(r,x,yy+t.length*lh,{lineHeightFactor:1.15});},
    didDrawPage:()=>cabecalho(),
  });
  // Rodapé depois da tabela, quando o total de páginas já é conhecido.
  const paginas=doc.getNumberOfPages();
  for(let p=1;p<=paginas;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(COR.rodape);
    txt('Santa Casa · Tecnologia da Informação · Uso interno',left,H-30);
    txt(`${p} / ${paginas}`,left+width,H-30,{align:'right'});}
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
    // E-mail no mesmo padrão dos Módulos: logo (anexo inline "cid"), área, título, blocos de resumo e tabela zebrada.
    const td=`border-bottom:1px solid ${COR.linha};padding:7px 8px;vertical-align:top;color:${COR.texto}`, th=`style="background:${COR.cabecalho};padding:7px 8px;text-align:left;color:${COR.texto}"`;
    const linhas=itens.map((a,i)=>{const fundo=i%2?'':`background:${COR.zebra};`,c=`style="${fundo}${td}"`,n=`style="${fundo}${td};white-space:nowrap"`;
      return `<tr><td ${n}>${esc(data(a.inicio))}</td><td ${n}>${esc(terminoPdf(a))}</td><td ${n}>${tempo(Number(a.minutos))}</td><td ${c}>${esc(ou(a.solicitante))}</td><td ${c}>${esc(ou(a.setor))}</td><td ${c}><strong>${esc(a.titulo)}</strong>${a.descricao?.trim()?`<br>${esc(a.descricao)}`:''}<br>Serviço realizado: ${esc(a.solucao)}</td></tr>`;}).join('');
    const blocos=[['Colaborador',esc(relatorio.nome)],['Período',esc(per.texto)],['Atendimentos',String(itens.length)],['Tempo total',tempo(total)]]
      .map(([k,v])=>`<td style="background:${COR.bloco};padding:8px 12px;vertical-align:top"><div style="font-size:11px;color:${COR.suave}">${k}</div><div style="font-size:18px;font-weight:bold;color:${COR.titulo}">${v}</div></td>`).join('<td style="width:6px"></td>');
    const html=`<html lang="pt-BR"><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COR.texto}">
<table style="border-collapse:collapse;margin:0 0 6px"><tr><td style="padding:0 18px 0 0;vertical-align:middle"><img src="cid:logo-santa-casa" alt="Santa Casa de Andradina" width="120" height="50"></td><td style="vertical-align:middle"><div style="font-size:12px;font-weight:bold;color:${COR.area}">${AREA}</div><div style="font-size:20px;font-weight:bold;color:${COR.titulo}">Relatório de atendimentos fora do expediente</div></td></tr></table>
<p style="font-size:11px;color:${COR.suave};margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid ${COR.linha}">Referência: ${esc(relatorio.id)} · Horário de Brasília · Cada atendimento conta no dia em que começou</p>
<p>Olá,</p><p>Segue o registro dos atendimentos feitos pela equipe de TI fora do horário de expediente, para controle interno. O mesmo relatório vai em PDF, anexo.${porOutro?` Enviado por ${esc(eu.nome)} (gerente da TI).`:''}</p>
<table style="border-collapse:collapse;margin:0 0 16px"><tr>${blocos}</tr></table>
<table style="border-collapse:collapse;font-size:12px"><thead><tr><th ${th}>Início</th><th ${th}>Término</th><th ${th}>Tempo</th><th ${th}>Solicitante</th><th ${th}>Setor</th><th ${th}>Atividade</th></tr></thead><tbody>${linhas}</tbody></table>
<p style="font-size:11px;color:${COR.rodape};margin-top:16px">Santa Casa · Tecnologia da Informação · Uso interno</p></body></html>`;
    const anexo={'@odata.type':'#microsoft.graph.fileAttachment',name:nomeArquivo(relatorio.nome,itens),contentType:'application/pdf',
      contentBytes:gerarPdf(relatorio.nome,itens,relatorio.id,porOutro?eu.nome:undefined)};
    const logoInline={'@odata.type':'#microsoft.graph.fileAttachment',name:'logo-santa-casa.png',contentType:'image/png',contentBytes:LOGO_PNG.split(',')[1],contentId:'logo-santa-casa',isInline:true};

    let response: Response;
    try {
      response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${ms}`,'Content-Type':'application/json'},
        body:JSON.stringify({message:{subject:assunto,body:{contentType:'HTML',content:html},toRecipients:(relatorio.destinatarios as string[]).map(address=>({emailAddress:{address}})),attachments:[anexo,logoInline]},saveToSentItems:true}),
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

// Logo da Irmandade da Santa Casa de Andradina (icons/logo-santa-casa.png, 432x180, reduzida da logo dos Módulos).
const LOGO_PNG = 'data:image/png;base64,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';

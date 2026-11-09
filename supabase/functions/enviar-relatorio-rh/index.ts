import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Os destinatários são definidos no servidor, nunca recebidos do navegador.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
const esc = (s: unknown) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const data = (s: string) => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(s));
const tempo = (n: number) => {const m=Math.round(n);return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}min`;};
type Item = {titulo:string;inicio:string;fim:string;pausa_minutos:number;minutos:number;solicitante:string;setor:string;descricao:string;solucao:string};

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  try {
    const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return json({error:'Entre novamente para enviar o relatório.'},401);
    const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await admin.auth.getUser(token);
    if(authError||!auth.user)return json({error:'Sessão inválida. Entre novamente.'},401);
    const body=await req.json();
    const destinatarios=(Deno.env.get('RH_EMAILS')||'').split(',').map(s=>s.trim()).filter(Boolean);
    const remetente=Deno.env.get('EMAIL_FROM')||'', apiKey=Deno.env.get('RESEND_API_KEY');
    if(!apiKey||!remetente||!destinatarios.length||destinatarios.some(s=>! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))return json({error:'Envio ainda não configurado. Cadastre RH_EMAILS, EMAIL_FROM e RESEND_API_KEY no servidor.'},503);
    if(body.acao==='config')return json({destinatarios});
    let relatorio;
    if(body.relatorio_id){
      const {data:r,error}=await admin.from('relatorios_horas').select('*').eq('id',body.relatorio_id).eq('usuario_id',auth.user.id).single();
      if(error||!r)return json({error:'Relatório não encontrado.'},404);relatorio=r;
    }else{
      if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>200||!body.versoes)return json({error:'Selecione de 1 a 200 atendimentos e confira a prévia.'},400);
      const {data:r,error}=await admin.rpc('preparar_relatorio_horas',{p_usuario:auth.user.id,p_ids:body.ids,p_versoes:body.versoes,p_destinatarios:destinatarios,p_remetente:remetente});
      if(error)return json({error:error.message},409);
      relatorio=Array.isArray(r)?r[0]:r;
    }
    if(!relatorio?.id)return json({error:'Não foi possível preparar o relatório. Atualize a lista e confira o histórico.'},500);
    if(relatorio.estado==='aceito')return json({id:relatorio.id,estado:'aceito'});
    // O provedor guarda a idempotência por 24h. Fora dessa janela, exige
    // conciliação administrativa para não reenviar um e-mail já aceito.
    if(Date.now()-new Date(relatorio.criado_em).getTime()>23*3600000)return json({error:'Este relatório precisa de conferência administrativa no serviço de e-mail antes de outra tentativa. Nenhum registro foi liberado ou reenviado.'},409);
    const itens=relatorio.itens as Item[], total=itens.reduce((s,a)=>s+Number(a.minutos),0);
    const assunto=`Relatório de atendimentos fora do expediente · ${relatorio.nome} · ${relatorio.id.slice(0,8)}`;
    const linhas=itens.map(a=>`<tr><td>${esc(data(a.inicio))}</td><td>${esc(data(a.fim))}</td><td>${a.pausa_minutos} min</td><td>${tempo(Number(a.minutos))}</td><td>${esc(a.solicitante)}<br>${esc(a.setor)}</td><td><strong>${esc(a.titulo)}</strong><br>${esc(a.descricao)}<br>Serviço realizado: ${esc(a.solucao)}</td></tr>`).join('');
    const html=`<html lang="pt-BR"><body><h1>Atendimentos fora do expediente</h1><p>Olá, equipe de RH.</p><p>Segue o relatório de <strong>${esc(relatorio.nome)}</strong>, com ${itens.length} atendimento(s) e ${tempo(total)} de trabalho efetivo.</p><p>Horários de Brasília. As pausas já foram descontadas. Durações exibidas arredondadas ao minuto; o total é calculado antes do arredondamento.</p><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Início</th><th>Término</th><th>Pausas</th><th>Tempo atendido</th><th>Solicitante / setor</th><th>Atividade</th></tr></thead><tbody>${linhas}</tbody></table><p>Referência: ${esc(relatorio.id)}</p></body></html>`;
    const text=`Atendimentos fora do expediente\nFuncionário: ${relatorio.nome}\n${itens.length} atendimento(s) · Total: ${tempo(total)}\nHorário de Brasília; pausas descontadas.\n\n`+itens.map(a=>`${data(a.inicio)} até ${data(a.fim)} · ${tempo(Number(a.minutos))} · pausas: ${a.pausa_minutos} min\n${a.titulo}\nSolicitante: ${a.solicitante} / ${a.setor}\n${a.descricao}\nServiço realizado: ${a.solucao}`).join('\n\n')+`\n\nReferência: ${relatorio.id}`;
    let response: Response;
    try {
      response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`relatorio-horas/${relatorio.id}`},body:JSON.stringify({from:relatorio.remetente,to:relatorio.destinatarios,subject:assunto,html,text}),signal:AbortSignal.timeout(20000)});
    }catch{
      await admin.from('relatorios_horas').update({ultimo_erro:'Não foi possível confirmar a resposta do serviço de e-mail. Use “Verificar / tentar novamente”.'}).eq('id',relatorio.id).eq('estado','pendente');
      return json({error:'O relatório foi preservado, mas o envio não foi confirmado. Use “Verificar / tentar novamente” no histórico para consultar ou repetir a mesma solicitação.'},502);
    }
    const result=await response.json();
    if(!response.ok||!result.id){
      await admin.from('relatorios_horas').update({ultimo_erro:'O serviço de e-mail não confirmou o envio. Confira sua configuração antes de tentar novamente.'}).eq('id',relatorio.id).eq('estado','pendente');
      console.error('Falha de envio',{relatorio:relatorio.id,status:response.status});
      return json({error:'O serviço de e-mail não confirmou o envio. O relatório está reservado no histórico para uma nova tentativa.'},502);
    }
    const {error:saveError}=await admin.from('relatorios_horas').update({estado:'aceito',aceito_em:new Date().toISOString(),provedor_id:result.id,ultimo_erro:null}).eq('id',relatorio.id);
    if(saveError)return json({error:'O serviço aceitou o e-mail, mas o histórico não foi atualizado. Use “Verificar / tentar novamente” para reconciliar o mesmo envio.'},502);
    return json({id:relatorio.id,estado:'aceito'});
  }catch(error){console.error(error instanceof Error?error.message:'Falha desconhecida');return json({error:'Não foi possível processar a solicitação. Atualize a lista e consulte o histórico antes de tentar novamente.'},500);}
});

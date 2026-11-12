// Projeto Supabase da Santa Casa (login Microsoft + lista de e-mails liberados).
const SUPABASE_URL = 'https://iyrlbfrsrolwhybumler.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DzO4wyz9PQsy8enPNF00tg_RHlVStkh'; // chave publicável — protegida pelas políticas RLS
// Habilitar somente após publicar e configurar enviar-relatorio-rh.
const ENVIO_RH_ATIVO = true;
const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const preferenceKey = 'plantao-ti-lembrar-acesso';
const sessionKey = 'sb-iyrlbfrsrolwhybumler-auth-token';
const storedPreference = localStorage.getItem(preferenceKey);
let rememberAccess = storedPreference === '1' || (storedPreference === null && !!localStorage.getItem(sessionKey));
const authStorage = {
  getItem(key) { return (rememberAccess ? localStorage : sessionStorage).getItem(key); },
  setItem(key, value) {
    (rememberAccess ? sessionStorage : localStorage).removeItem(key);
    (rememberAccess ? localStorage : sessionStorage).setItem(key, value);
  },
  removeItem(key) { localStorage.removeItem(key); sessionStorage.removeItem(key); }
};
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: authStorage, persistSession: true }
});
let user = null, perfil = null;

function mostrarLogin() {
  $('telaLogin').classList.remove('hide');
  $('telaApp').classList.add('hide');
  $('lembrarAcesso').checked = rememberAccess;
}

// Token Microsoft (para enviar o relatório ao RH pelo Microsoft 365).
// Só vem logo após o login e vale ~1 h; guardamos na aba com folga de validade.
const msKey = 'plantao-ti-ms-token';
const MS_SCOPES = 'openid email profile Mail.Send';
function guardarTokenMicrosoft(session) {
  if (session?.provider_token) sessionStorage.setItem(msKey, JSON.stringify({ t: session.provider_token, exp: Date.now() + 50 * 60000 }));
}
function tokenMicrosoft() {
  try { const v = JSON.parse(sessionStorage.getItem(msKey) || 'null'); return v && v.exp > Date.now() ? v.t : null; } catch { return null; }
}
function esquecerTokenMicrosoft() { sessionStorage.removeItem(msKey); }
// Pede um token novo sem mostrar a escolha de conta (a Microsoft já conhece o usuário).
async function confirmarMicrosoft() {
  esquecerTokenMicrosoft();
  const {error} = await sb.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: MS_SCOPES, redirectTo: location.origin + location.pathname, queryParams: { login_hint: user?.email || '' } }
  });
  if (error) throw new Error('Não foi possível abrir a confirmação da conta Microsoft. Tente novamente.');
}

async function entrou(u) {
  user = u;
  const {data,error} = await sb.from('perfis').select('*').eq('id',u.id).single();
  if (error || !data) {
    mostrarLogin();
    $('erroLogin').textContent = 'Seu e-mail não está liberado para o Plantão TI ou o perfil não foi encontrado. Fale com o gerente da TI.';
    return;
  }
  perfil = data;
  $('quem').textContent = perfil.nome;
  $('avatar').textContent = perfil.nome.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase();
  $('telaLogin').classList.add('hide');
  $('telaApp').classList.remove('hide');
  document.dispatchEvent(new CustomEvent('sessao-pronta',{detail:u}));
}

async function iniciar() {
  // Erro devolvido pelo login Microsoft (ex.: e-mail fora da lista de liberados).
  const retorno = new URLSearchParams(location.search + '&' + location.hash.slice(1));
  const erroRetorno = retorno.get('error_description');
  // Só um retorno recente do login traz um token Microsoft novo.
  const voltouDoLogin = retorno.has('access_token') || retorno.has('code');
  if (erroRetorno) history.replaceState(null, '', location.pathname);
  try {
    const {data,error} = await sb.auth.getSession();
    if (error) throw error;
    if (data.session) { if (voltouDoLogin) guardarTokenMicrosoft(data.session); await entrou(data.session.user); return; }
    mostrarLogin();
    if (erroRetorno) $('erroLogin').textContent = /saving new user|não liberado/i.test(erroRetorno)
      ? 'Seu e-mail não está liberado para o Plantão TI. Fale com o gerente da TI.'
      : 'Não foi possível entrar: ' + erroRetorno;
  } catch {
    mostrarLogin();
    $('erroLogin').textContent = 'Não foi possível conectar. Confira a conexão e tente entrar novamente.';
  }
}

$('telaLogin').onsubmit = async e => {
  e.preventDefault();
  $('erroLogin').textContent = '';
  $('btnEntrar').disabled = true;
  rememberAccess = $('lembrarAcesso').checked;
  localStorage.setItem(preferenceKey,rememberAccess?'1':'0');
  if (!rememberAccess) localStorage.removeItem(sessionKey);
  const {error} = await sb.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: MS_SCOPES,
      redirectTo: location.origin + location.pathname,
      queryParams: { prompt: 'select_account' } // sempre mostra a escolha de conta Microsoft
    }
  });
  if (error) {
    $('erroLogin').textContent = 'Não foi possível abrir o login Microsoft. Tente novamente.';
    $('btnEntrar').disabled = false;
  }
};

$('btnSair').onclick = async () => {
  esquecerTokenMicrosoft();
  const {error} = await sb.auth.signOut();
  if (error) { alert('Não foi possível sair. Tente novamente.'); return; }
  location.href = location.pathname;
};

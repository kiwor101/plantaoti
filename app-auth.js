const SUPABASE_URL = 'https://vidwjeyguypqhcuhgmar.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Cb7iuzIgm5RZ8kDdhjN06Q_Y04JJSFb';
// Habilitar somente após publicar e configurar enviar-relatorio-rh.
const ENVIO_RH_ATIVO = false;
const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const preferenceKey = 'plantao-ti-lembrar-acesso';
const sessionKey = 'sb-vidwjeyguypqhcuhgmar-auth-token';
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

async function entrou(u) {
  user = u;
  const {data,error} = await sb.from('perfis').select('*').eq('id',u.id).single();
  if (error || !data) {
    mostrarLogin();
    $('erroLogin').textContent = 'Não foi possível carregar seu perfil. Tente novamente ou fale com o responsável pelo sistema.';
    return;
  }
  perfil = data;
  $('quem').textContent = perfil.nome;
  $('avatar').textContent = perfil.nome.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase();
  $('telaLogin').classList.add('hide');
  $('telaApp').classList.remove('hide');
  $('senha').value = '';
  document.dispatchEvent(new CustomEvent('sessao-pronta',{detail:u}));
}

async function iniciar() {
  try {
    const {data,error} = await sb.auth.getSession();
    if (error) throw error;
    if (data.session) await entrou(data.session.user);
    else mostrarLogin();
  } catch {
    mostrarLogin();
    $('erroLogin').textContent = 'Não foi possível conectar. Confira a conexão e tente entrar novamente.';
  }
}

$('mostrarSenha').onclick = () => {
  const revealing = $('senha').type === 'password';
  $('senha').type = revealing ? 'text' : 'password';
  $('mostrarSenha').textContent = revealing ? 'Ocultar' : 'Mostrar';
  $('mostrarSenha').setAttribute('aria-pressed',String(revealing));
  $('mostrarSenha').setAttribute('aria-label',revealing?'Ocultar senha':'Mostrar senha');
};

$('telaLogin').onsubmit = async e => {
  e.preventDefault();
  $('erroLogin').textContent = '';
  $('btnEntrar').disabled = true;
  rememberAccess = $('lembrarAcesso').checked;
  localStorage.setItem(preferenceKey,rememberAccess?'1':'0');
  if (!rememberAccess) localStorage.removeItem(sessionKey);
  try {
    const {data,error} = await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('senha').value});
    if (error) throw error;
    await entrou(data.user);
  } catch {
    $('erroLogin').textContent = 'Não foi possível entrar. Confira seu e-mail, senha e conexão.';
  } finally {
    $('btnEntrar').disabled = false;
  }
};

$('btnSair').onclick = async () => {
  const {error} = await sb.auth.signOut();
  if (error) { alert('Não foi possível sair. Tente novamente.'); return; }
  location.reload();
};

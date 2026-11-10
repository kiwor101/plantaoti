// PWA do Plantão TI: registra o service worker e oferece "instalar app" no celular.
// Arquivo isolado: se falhar, o site continua funcionando normalmente no PC e no celular.
(() => {
  'use strict';
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }

    const DISPENSOU = 'plantao-ti-pwa-dispensou';
    const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const celular = matchMedia('(max-width: 900px) and (pointer: coarse)').matches;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let dispensou = false;
    try { dispensou = localStorage.getItem(DISPENSOU) === '1'; } catch {}

    if (instalado) document.documentElement.classList.add('pwa-instalado');
    if (instalado || !celular || dispensou) return;

    let promptAndroid = null;

    function mostrarAviso(texto, comBotao) {
      if (document.getElementById('pwaAviso')) return;
      const css = document.createElement('style');
      css.textContent = `
        #pwaAviso{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;background:#fff;color:#10213c;border:1px solid #d8e2f0;border-radius:12px;box-shadow:0 10px 30px rgba(16,33,60,.18);font:14px/1.4 "IBM Plex Sans",system-ui,sans-serif}
        #pwaAviso img{width:40px;height:40px;border-radius:9px;flex:none}
        #pwaAviso p{margin:0;flex:1}
        #pwaAviso strong{display:block}
        #pwaAviso button{font:inherit;min-height:40px;border-radius:8px;cursor:pointer}
        #pwaInstalar{background:#1769df;color:#fff;border:0;padding:0 14px;font-weight:600}
        #pwaFechar{background:none;border:0;width:40px;color:#506481;font-size:20px}`;
      const div = document.createElement('div');
      div.id = 'pwaAviso';
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-label', 'Instalar o Plantão TI');
      div.innerHTML = `<img src="icons/icon-192.png" alt=""><p><strong>Instale o Plantão TI</strong><span></span></p>${comBotao ? '<button type="button" id="pwaInstalar">Instalar</button>' : ''}<button type="button" id="pwaFechar" aria-label="Fechar">×</button>`;
      div.querySelector('span').textContent = texto;
      document.head.appendChild(css);
      document.body.appendChild(div);
      div.querySelector('#pwaFechar').onclick = () => {
        try { localStorage.setItem(DISPENSOU, '1'); } catch {}
        div.remove();
      };
      const btn = div.querySelector('#pwaInstalar');
      if (btn) btn.onclick = async () => {
        if (!promptAndroid) return;
        promptAndroid.prompt();
        await promptAndroid.userChoice.catch(() => {});
        promptAndroid = null;
        div.remove();
      };
    }

    // Android / Chrome: o navegador avisa quando o app pode ser instalado.
    addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      promptAndroid = e;
      mostrarAviso('Abra direto da tela inicial, como um aplicativo.', true);
    });
    addEventListener('appinstalled', () => document.getElementById('pwaAviso')?.remove());

    // iPhone / iPad: o Safari não tem botão automático, então mostramos o passo a passo.
    if (ios) {
      addEventListener('load', () => setTimeout(() => mostrarAviso('Toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".', false), 1500));
    }
  } catch {}
})();

// Copia para www/ só o que o app precisa offline: a tela "Sem conexão" e o ícone.
// O resto vem do site publicado (server.url em capacitor.config.json).
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const www = path.join(__dirname, 'www');
fs.mkdirSync(path.join(www, 'icons'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'offline.html'), path.join(www, 'offline.html'));
fs.copyFileSync(path.join(raiz, 'icons', 'icon-192.png'), path.join(www, 'icons', 'icon-192.png'));
fs.writeFileSync(path.join(www, 'index.html'),
  '<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=https://plantaoti.santacasaandradina.org/index.html">');
console.log('www/ pronto');

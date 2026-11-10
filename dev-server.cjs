const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/relatorios.html': ['relatorios.html', 'text/html; charset=utf-8'],
  '/relatorios.js': ['relatorios.js', 'text/javascript; charset=utf-8'],
  '/app-auth.js': ['app-auth.js', 'text/javascript; charset=utf-8'],
  '/login.css': ['login.css', 'text/css; charset=utf-8'],
  '/pwa.js': ['pwa.js', 'text/javascript; charset=utf-8'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'],
  '/offline.html': ['offline.html', 'text/html; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/icons/icon-192.png': ['icons/icon-192.png', 'image/png'],
  '/icons/icon-512.png': ['icons/icon-512.png', 'image/png'],
  '/icons/icon-maskable-512.png': ['icons/icon-maskable-512.png', 'image/png'],
  '/icons/apple-touch-icon.png': ['icons/apple-touch-icon.png', 'image/png'],
  '/icons/favicon-32.png': ['icons/favicon-32.png', 'image/png'],
};

http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const resource = files[pathname];
  if (!resource) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const [filename, contentType] = resource;
  fs.readFile(path.join(__dirname, filename), (error, content) => {
    if (error) {
      response.writeHead(500);
      response.end('Unable to load file');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    response.end(content);
  });
}).listen(4173, '0.0.0.0', () => {
  console.log('Plantão TI: http://192.168.1.29:4173/');
});

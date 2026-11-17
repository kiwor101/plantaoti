# Plantão TI — app Android

App Android feito com [Capacitor](https://capacitorjs.com). Ele **abre o site publicado**
(`https://plantaoti.santacasaandradina.org`) dentro de um app próprio, com ícone na tela inicial.

- **Atualizações do site chegam no app sozinhas.** Só é preciso gerar outro APK quando mudar
  algo desta pasta (ícone, nome, permissões, versão do Capacitor).
- O login Microsoft acontece dentro do app e volta para ele (domínios liberados em `allowNavigation`
  no `capacitor.config.json`).
- **Baixar PDF / Exportar CSV**: dentro do app abrem o menu *Compartilhar* do Android
  (salvar no Drive, enviar por e-mail/WhatsApp, abrir no leitor de PDF). Ver `salvarArquivo()` em `relatorios.js`.
- Sem internet, aparece a tela `offline.html`.
- iPhone: não há app nativo (exige conta paga da Apple e um Mac). No iPhone use o PWA pelo Safari ou Chrome.

## Gerar o APK (GitHub Actions)

O APK é gerado na nuvem pelo workflow `.github/workflows/android-apk.yml`; não precisa de Android Studio.

1. **Uma vez só:** cadastrar os segredos em *Settings → Secrets and variables → Actions*:
   | Segredo | Conteúdo |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | arquivo `plantao-ti.jks.base64` |
   | `ANDROID_KEYSTORE_PASSWORD` | arquivo `senha.txt` |
   | `ANDROID_KEY_ALIAS` | arquivo `alias.txt` |

   Os arquivos ficam em `C:\Users\Ti\Documents\plantao-ti-chave-android\` (**fora do repositório**, que é público).
   Guarde uma cópia de segurança: sem essa chave os celulares não conseguem atualizar o app.
2. **Teste:** *Actions → APK Android → Run workflow*. O APK sai em *Artifacts* (vem dentro de um .zip).
3. **Versão para a equipe:** criar a tag `android-v1.0` (depois `android-v1.1`…). O APK vira anexo de uma
   *Release* do GitHub, com link direto para baixar no celular.

## Instalar no celular

1. Abrir o link da Release no Chrome do Android e baixar o `.apk`.
2. Tocar no arquivo. Na primeira vez o Android pede para **permitir instalar apps desta fonte** (Chrome).
3. Atualizar = instalar o APK novo por cima (os dados e o login continuam).

## Desenvolvimento local (opcional)

Precisa de Node 22+, JDK 21 e Android SDK (Android Studio).

```bash
npm install
npm run sync          # copia offline.html/ícone para www/ e sincroniza o projeto android/
npx cap open android  # abre no Android Studio
npm run icones        # regenera ícones/splash a partir de assets/
```

/* Relato e período completos no mesmo formulário. */
(() => {
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    #horas h2{font-size:29px;line-height:1.2;letter-spacing:-.025em;margin:0 0 6px}#horas h3{font-size:19px;margin:0 0 8px}
    .intro{color:var(--mute);margin:0 0 22px;max-width:65ch}
    .horas-shell{display:grid;grid-template-columns:190px minmax(0,1fr);gap:24px;align-items:start}
    .horas-nav{padding:6px 0;display:grid;gap:7px;position:sticky;top:20px}
    .horas-nav a{display:block;padding:12px 15px;border-radius:9px;color:var(--mute);font-weight:600;text-decoration:none}
    .horas-nav a:first-child{background:var(--brand-soft);color:var(--brand)}.horas-nav a:hover{color:var(--brand);background:var(--brand-soft)}
    .horas-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}
    #horasForm,.horas-ajuda,.horas-registros{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px}
    #horasForm{min-width:0}#horasForm h3{font-size:24px;letter-spacing:-.025em;margin-bottom:12px}
    .horas-ajuda{padding:22px}.horas-ajuda h3{font-size:18px!important}.horas-ajuda p{color:var(--mute);font-size:13px;margin:3px 0 0}
    .resumo-data{color:var(--mute);font-size:13px;margin-top:-2px}.resumo-metricas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:19px 0}
    .resumo-metrica{background:var(--brand-soft);padding:15px 12px;border-radius:9px;min-width:0}.resumo-metrica strong{display:block;font-size:19px;line-height:1.25;font-variant-numeric:tabular-nums;white-space:nowrap}.resumo-metrica span{display:block;font-size:12px;color:var(--mute);margin-top:4px}
    .resumo-observacao{font-size:12px;line-height:1.4;margin:-4px 0 16px!important}.resumo-ultimo{border-top:1px solid var(--line);padding-top:16px}.resumo-ultimo strong{display:block}.resumo-ultimo p{overflow-wrap:anywhere}
    .horas-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
    .horas-total{font-variant-numeric:tabular-nums;margin:16px 0 8px;padding:11px 13px;background:var(--brand-soft);border-radius:8px;color:var(--brand);font-weight:600}
    #horasForm>label:first-of-type{margin-top:10px}#hSolucao{min-height:170px}
    .horas-ia-linha{display:flex;justify-content:flex-end;margin-top:-47px;position:relative;padding:0 9px 9px;pointer-events:none}.horas-ia-linha button{pointer-events:auto;font-size:13px;padding:6px 11px}
    .horas-editor{padding-bottom:34px}.horas-nota-ia{font-size:12px;margin:12px 0 0}
    details{margin-top:18px}summary{cursor:pointer;font-weight:500;padding:4px 0}
    #hIASugestao{margin-top:20px;padding-top:20px;border-top:1px solid var(--line)}#hTextoIA{min-height:150px}
    #hSalvar{min-width:190px}#hCancelar{border-color:transparent;color:var(--mute)}
    .horas-registros{margin-top:20px}.horas-lista-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .horas-filtros{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0 16px}
    .horas-resumo{margin:16px 0;font-variant-numeric:tabular-nums}
    .horas-registro{border-top:1px solid var(--line);padding:15px 0;overflow-wrap:anywhere}
    .horas-registro-linha{display:grid;grid-template-columns:125px minmax(0,1fr) 115px 135px;align-items:center;gap:12px}.horas-registro-linha time,.horas-registro-linha .meta{color:var(--mute);font-size:13px}.horas-registro-linha strong{font-variant-numeric:tabular-nums;white-space:nowrap}.horas-registro-linha button{padding:7px 10px}
    .horas-registro details{margin:0}.horas-registro summary{font-weight:600;padding:0}.horas-registro-corpo{margin:12px 0 0;padding:13px 16px;background:var(--bg);border-radius:8px}.horas-registro-corpo p{margin:5px 0}.horas-registro .tag{margin-top:0}
    .horas-registro h4{font-size:17px;margin:0}.horas-registro p{margin:8px 0}
    .horas-top{display:flex;justify-content:space-between;gap:12px}.horas-top strong{white-space:nowrap;font-variant-numeric:tabular-nums}
    .tag{display:inline-block;font-size:12px;padding:2px 8px;border-radius:8px;background:var(--okbg);color:var(--ok);margin-top:6px}
    .tag.pendente{background:var(--openbg);color:var(--open)}
    #horasMensagem,#hIAMensagem{white-space:pre-wrap;overflow-wrap:anywhere}#hIAMensagem:empty,#horasMensagem:empty,#hErro:empty{display:none}
    #horasPreview{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:20px;margin-top:20px}
    #hPreviewTabela{overflow:auto;margin:12px 0}#horas table{border-collapse:collapse;width:100%;font-size:13px}
    #horas th,#horas td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top;min-width:105px}
    #horas td{white-space:pre-wrap}#hTabelaDica{display:none}.empty{padding:24px 0;color:var(--mute)}
    @media(max-width:1100px){.horas-shell{grid-template-columns:1fr}.horas-nav{position:static;display:flex;padding:0;gap:8px}.horas-nav a{padding:8px 13px}.horas-layout{grid-template-columns:minmax(0,1fr) 260px}}
    @media(max-width:800px){.horas-layout{grid-template-columns:1fr}.horas-ajuda{display:block}.resumo-metricas{max-width:460px}.horas-shell{gap:16px}.horas-registro-linha{grid-template-columns:100px minmax(0,1fr) 100px}.horas-registro-linha button{grid-column:2 / -1;justify-self:start}.horas-registro-corpo{margin-left:0}}
    @media(max-width:600px){#horas h2{font-size:25px}#horasForm,.horas-ajuda,.horas-registros{padding:18px}.horas-filtros{grid-template-columns:1fr;gap:0}.horas-top{flex-wrap:wrap}.horas-actions button{flex:1}#hTabelaDica{display:block}.horas-registros{margin-top:16px}.horas-ia-linha button{flex:0 0 auto}#hSalvar{min-width:0}.horas-registro-linha{grid-template-columns:1fr auto;gap:5px 10px}.horas-registro-linha time{grid-column:1 / -1}.horas-registro-linha button{grid-column:1 / -1}.horas-registro-linha strong{grid-column:2;grid-row:2}.horas-registro-linha details{grid-column:1;grid-row:2}}
    .sr-only{position:absolute!important;width:1px;height:1px;padding:0!important;margin:-1px!important;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0!important}
    #horas h2{font-size:32px;margin:0 0 22px;letter-spacing:-.025em}#horasForm{padding:22px 24px 20px;border-radius:7px;box-shadow:0 5px 24px rgba(21,39,65,.035)}
    .horas-shell{grid-template-columns:235px minmax(0,1fr);gap:24px}.horas-conteudo{min-width:0}.horas-layout{grid-template-columns:minmax(0,1fr) 31%;gap:20px}
    .horas-nav{gap:7px;padding:0;top:20px}.horas-nav a,.horas-nav #btnSair{display:flex;align-items:center;gap:16px;width:100%;padding:12px 22px;border:0;border-radius:6px;background:transparent;text-align:left;text-decoration:none;color:var(--ink);font-weight:500;font-size:15px}.horas-nav svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}.horas-nav a:first-child{background:var(--brand-soft);color:var(--brand);font-weight:600;position:relative}.horas-nav a:first-child:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand);border-radius:3px}.horas-nav #btnSair:hover{color:var(--brand);background:var(--brand-soft)}
    .etapas{display:flex;align-items:center;justify-content:center;gap:18px;color:#69758c;margin:0 0 17px}.etapas button{border:0;background:transparent;display:flex;align-items:center;gap:9px;padding:3px;color:inherit;white-space:nowrap;transition:color .2s ease}.etapas button span{display:grid;place-items:center;width:35px;height:35px;background:#e8edf3;border-radius:50%;font-size:16px;position:relative;transition:background-color .25s ease,color .25s ease,box-shadow .25s ease}.etapas button.is-active,.etapas button.is-complete{color:var(--brand);font-weight:600}.etapas button.is-active span,.etapas button.is-complete span{background:var(--brand);color:#fff}.etapas button.is-active span{box-shadow:0 0 0 4px var(--brand-soft)}.etapas button.is-complete span{font-size:0}.etapas button.is-complete span:after{content:"";width:11px;height:6px;border-left:2px solid white;border-bottom:2px solid white;transform:translateY(-2px) rotate(-45deg)}.etapas i{width:11%;height:2px;background:#d1d9e4;position:relative;overflow:hidden}.etapas i:after{content:"";position:absolute;inset:0;background:var(--brand);transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.16,1,.3,1)}.etapas i.is-complete:after{transform:scaleX(1)}
    .pagina-formulario .horas-registros{display:none}.pagina-relatorios .horas-layout,.pagina-relatorios #hFiltros,.pagina-relatorios #hExportacao,.pagina-relatorios #hEnvios,.pagina-relatorios #hVerTodos{display:none}.pagina-relatorios .horas-registros{margin-top:0}.pagina-relatorios .horas-nav a:first-child:not(.nav-atual){background:transparent;color:var(--ink);font-weight:500}.pagina-relatorios .horas-nav a:first-child:not(.nav-atual):before{content:none}.horas-nav a.nav-atual{background:var(--brand-soft);color:var(--brand);font-weight:600;position:relative}.horas-nav a.nav-atual:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand);border-radius:3px}
    @media(prefers-reduced-motion:reduce){.etapas button,.etapas button span,.etapas i:after{transition:none}}
    #horasForm label{font-weight:600;color:var(--ink);margin:14px 0 6px}#horasForm input{height:44px}#horasForm .row{gap:24px}#horasForm textarea{min-height:112px}
    .horas-total{min-height:42px;padding:10px 15px;margin:16px 0 16px;font-weight:500;color:var(--brand);background:var(--brand-soft)}.horas-total strong{font-weight:700}
    .editor-relato{border:1px solid #cbd5e3;border-radius:7px;overflow:hidden}.editor-barra{min-height:42px;background:#f7f9fc;border-bottom:1px solid #dce3ec;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px}.editor-ferramentas{display:flex;align-items:center;gap:2px}.editor-ferramentas button{border:0;background:transparent;padding:4px 8px;min-width:30px;font-size:16px;line-height:1.1;color:var(--ink)}.editor-ferramentas button:hover{background:var(--brand-soft)}.editor-ferramentas .separador{height:19px;width:1px;background:#d8dfe8;margin:0 3px}#hMelhorarIA{padding:5px 11px;font-size:13px;color:var(--brand);font-weight:600;white-space:nowrap}.editor-relato textarea{border:0;border-radius:0;resize:vertical;display:block;width:100%;min-height:104px;padding:13px 15px}.editor-relato:focus-within{outline:2px solid var(--brand);outline-offset:2px}.editor-relato textarea:focus-visible{outline:none}
    .horas-nota-ia{margin:8px 0 0;font-size:11px}#hSalvar{width:100%;min-height:46px;font-size:15px}#horasForm>.horas-actions{display:grid;grid-template-columns:1fr;gap:0;margin-top:8px}#hCancelar{justify-self:end;padding:5px 0;font-size:12px}
    .horas-ajuda{padding:20px;border-radius:7px}.resumo-cabecalho{display:flex;gap:15px;align-items:start;padding-bottom:17px;border-bottom:1px solid var(--line)}.resumo-cabecalho svg{width:30px;height:30px;flex:none}.horas-ajuda svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.horas-ajuda h3{margin:0!important;font-size:18px!important}.resumo-data{font-size:14px;margin-top:2px}.resumo-metricas{margin:18px 0;gap:14px}.resumo-metrica{min-height:137px;text-align:center;border-radius:6px;padding:14px 7px}.resumo-metrica svg{display:block;width:28px;height:28px;margin:0 auto 10px;color:var(--brand)}.resumo-metrica strong{font-size:22px;white-space:normal}.resumo-metrica span{font-size:13px;margin-top:2px}.resumo-ultimo{display:flex;gap:12px;padding-top:18px}.resumo-ultimo svg{width:25px;height:25px;flex:none;color:var(--mute)}.resumo-ultimo p{font-size:13px;margin:6px 0 0;color:var(--ink)}
    .horas-registros{border-radius:7px;padding:18px 20px 24px}.horas-lista-top{margin:0 0 15px}.horas-lista-top h3{font-size:18px!important;margin:0!important}.horas-lista-top #hVerTodos{border:0;color:#0879bc;padding:2px 0;font-size:13px;background:transparent}.horas-resumo{font-size:12px;color:var(--mute);margin:4px 0 13px}#hFiltros{margin:0 0 10px}#hFiltros summary{font-size:12px;color:var(--mute)}#hExportacao,#hEnvios{font-size:12px;margin-top:15px}#hLista{overflow-x:auto}#hLista table{width:100%;font-size:12px}#hLista th{background:#f2f5f8;color:var(--mute);font-weight:500}#hLista th,#hLista td{padding:7px 12px;min-width:0}#hLista th:first-child{border-radius:5px 0 0 5px}#hLista th:last-child{border-radius:0 5px 5px 0}#hLista td:nth-child(2){min-width:190px}#hLista td button{padding:3px 8px;font-size:12px}.registro-detalhe td{background:#f8fafb}.registro-detalhe p{margin:4px 0}.registro-acao{white-space:nowrap}
    @media(max-width:1150px){.horas-shell{grid-template-columns:190px minmax(0,1fr);gap:14px}.horas-layout{grid-template-columns:minmax(0,1fr) 270px}.horas-nav a,.horas-nav #btnSair{padding:10px 12px;gap:10px}}
    @media(max-width:900px){.horas-shell{grid-template-columns:1fr}.horas-nav{position:static;display:flex;gap:6px}.horas-nav a,.horas-nav #btnSair{width:auto}.horas-layout{grid-template-columns:minmax(0,1fr) 260px}}
    @media(max-width:750px){.horas-layout{grid-template-columns:1fr}.horas-ajuda{order:2}.resumo-metricas{max-width:none}.horas-nav svg{display:none}}
    #hLista .registro-expandir{margin:0}#hLista .registro-expandir summary{padding:0;color:var(--ink);font-weight:500;white-space:nowrap}#hLista .registro-conteudo{width:min(330px,70vw);padding:12px 0;white-space:normal}#hLista .registro-conteudo .desc{white-space:pre-wrap}#hLista .registro-conteudo p{margin:5px 0}#hLista td{white-space:nowrap}
    .horas-nota-ia{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;margin:0}.horas-ajuda #hCancelar{margin-top:10px;font-size:12px;padding:4px 0}
    .resumo-ultimo{position:relative}.resumo-ultimo>div{min-width:0;width:100%}.resumo-ultimo p{line-height:1.45}.resumo-ultimo p small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--mute);margin-top:4px;font-size:12px}.ultimo-hora{float:right;color:var(--mute);font-size:12px;margin-left:8px}
    .icone-relogio{display:inline-block;width:19px;height:19px;border:2px solid currentColor;border-radius:50%;vertical-align:-4px;margin-right:7px;position:relative}.icone-relogio:after{content:"";position:absolute;left:7px;top:3px;width:5px;height:7px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-10deg)}
    #hLista .registro-acao{display:flex;align-items:center;gap:6px}#hLista .registro-acao button[data-h-excluir]{color:#a62822;border-color:#e4b5b1}#hLista .registro-acao button[data-h-excluir]:hover{border-color:#a62822;background:#fff7f6}
    #hListaDica{display:none}@media(max-width:750px){#hListaDica{display:block;margin:7px 0;font-size:12px}}
    #hLista .registro-exclusao td{background:#fff7f6;white-space:normal;padding:12px 15px;border:1px solid #e7b3af}#hLista .registro-exclusao p{margin:0 0 9px;color:#74231f;font-size:13px}#hLista .registro-exclusao .horas-actions{margin:0}#hLista .registro-exclusao button[data-h-confirmar]{background:#a62822;border-color:#a62822;color:#fff;font-weight:600}#hLista .registro-exclusao button[data-h-confirmar]:hover:not(:disabled){background:#87201b}#hLista .registro-exclusao .err{display:block;margin-top:8px}
    #horasForm #hSolucao{min-height:clamp(300px,36vh,420px)}
    @media(max-width:600px){#horas h2{font-size:25px;margin-bottom:16px}#horasForm,.horas-ajuda,.horas-registros{padding:17px}.horas-nav a,.horas-nav #btnSair{font-size:13px;padding:8px 10px}.etapas{gap:5px;font-size:11px}.etapas button{gap:4px}.etapas button span{width:25px;height:25px;font-size:12px}.etapas i{width:5%}.editor-ferramentas button{min-width:25px;padding:4px}.editor-ferramentas button:nth-of-type(n+4),.editor-ferramentas .separador{display:none}#hMelhorarIA{font-size:11px;padding:5px}.horas-lista-top{align-items:start}#hLista th,#hLista td{padding:7px 9px}#hLista table{min-width:720px}#horasForm #hSolucao{min-height:230px}}
  `;
  document.head.append(style);
  document.querySelector('#telaApp main').innerHTML=`
    <section id="horas" aria-labelledby="horasTitulo" class="horas-shell">
      <nav class="horas-nav" aria-label="Navegação dos relatórios"><a href="index.html#horasForm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v15H6zM14 2v5h5M9 11h6M9 15h6"/></svg>Novo relatório</a><a href="relatorios.html#hRegistrosTitulo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v20H6zM9 7h6M9 12h6M9 17h4"/></svg>Meus relatórios</a></nav>
      <div class="horas-conteudo">
      <p id="horasMensagem" role="status" aria-live="polite"></p>
      <div class="horas-layout">
        <form id="horasForm">
          <h2 id="horasTitulo">Novo relatório de atendimento</h2><h3 id="horasFormTitulo" class="sr-only">Registrar relatório</h3>
          <div class="etapas" aria-label="Progresso do formulário"><button type="button" data-foco="hTitulo"><span aria-hidden="true">1</span>Dados</button><i aria-hidden="true"></i><button type="button" data-foco="hInicio"><span aria-hidden="true">2</span>Atendimento</button><i aria-hidden="true"></i><button type="button" data-foco="hSolucao"><span aria-hidden="true">3</span>Relato</button></div><span id="hEtapaStatus" class="sr-only" role="status"></span>
          <label for="hTitulo">Assunto *</label><input id="hTitulo" maxlength="120" placeholder="Descreva o assunto do atendimento..." required>
          <div class="row">
            <div><label for="hInicio">Início *</label><input id="hInicio" type="datetime-local" required></div>
            <div><label for="hFim">Término *</label><input id="hFim" type="datetime-local" required></div>
          </div>
          <div id="hPrevia" class="horas-total" aria-live="polite">Informe o início e o término para calcular o tempo atendido.</div>
          <label for="hSolucao">Relato do serviço realizado *</label>
          <div class="editor-relato"><div class="editor-barra"><div class="editor-ferramentas"><button type="button" data-format="bold" title="Negrito" aria-label="Negrito"><b>B</b></button><button type="button" data-format="italic" title="Itálico" aria-label="Itálico"><em>I</em></button><button type="button" data-format="underline" title="Sublinhado" aria-label="Sublinhado"><u>U</u></button><span class="separador"></span><button type="button" data-format="bullet" title="Lista" aria-label="Lista">≡</button><button type="button" data-format="number" title="Lista numerada" aria-label="Lista numerada">☷</button><span class="separador"></span><button type="button" data-format="link" title="Inserir link" aria-label="Inserir link">↗</button></div><button id="hMelhorarIA" type="button" title="Envia apenas o texto do relato à IA; você confere a sugestão antes de usar">✧ Melhorar texto</button></div><textarea id="hSolucao" maxlength="5000" placeholder="Descreva aqui o serviço realizado, incluindo ações, resultados e outras informações relevantes..." required></textarea></div>
          <p class="meta horas-nota-ia">A revisão envia somente este texto à OpenAI. Confira a sugestão antes de usar.</p>
          <p id="hIAMensagem" role="status" aria-live="polite"></p>
          <section id="hIASugestao" class="hide" aria-labelledby="hIATitulo">
            <h3 id="hIATitulo" tabindex="-1">Sugestão de texto</h3>
            <p class="meta">Confira se todos os fatos estão corretos. Você pode ajustar a sugestão abaixo.</p>
            <label for="hTextoIA">Texto revisado</label><textarea id="hTextoIA" maxlength="5000"></textarea>
            <div class="horas-actions"><button id="hUsarIA" type="button">Usar sugestão</button><button id="hDescartarIA" type="button">Manter meu texto</button></div>
          </section>
          <input id="hSetor" type="hidden"><input id="hPausa" type="hidden" value="0">
          <p class="err" id="hErro" role="alert"></p>
          <div class="horas-actions"><button type="submit" class="primary" id="hSalvar">Salvar relatório</button><button type="button" id="hCancelar">Limpar formulário</button></div>
        </form>
        <aside class="horas-ajuda" aria-label="Resumo acumulado">
          <div class="resumo-cabecalho"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/></svg><div><h3>Resumo acumulado</h3><div id="hResumoData" class="resumo-data">Todos os relatórios salvos</div></div></div>
          <div class="resumo-metricas"><div class="resumo-metrica"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v15H6zM14 2v5h5"/></svg><strong id="hHojeQtd">—</strong><span>Atendimentos</span></div><div class="resumo-metrica"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><strong id="hHojeHoras">—</strong><span>Horas acumuladas</span></div></div>
          <p class="resumo-observacao">As horas não descontam folgas ou compensações.</p>
          <div class="resumo-ultimo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v15H6zM14 2v5h5M9 11h6M9 15h6"/></svg><div><strong>Último relatório</strong><p id="hUltimo" class="meta">Nenhum relatório salvo.</p></div></div>
        </aside>
      </div>
      <section class="horas-registros" aria-labelledby="hRegistrosTitulo">
        <div class="horas-lista-top"><h3 id="hRegistrosTitulo">Meus últimos relatórios</h3><button id="hVerTodos" type="button">Ver todos os relatórios →</button><button id="horasAtualizar" type="button" class="sr-only">Atualizar lista</button></div>
        <details id="hFiltros"><summary>Filtrar por período e envio</summary><div class="horas-filtros">
          <div><label for="hDe">Data inicial</label><input id="hDe" type="date"></div><div><label for="hAte">Data final</label><input id="hAte" type="date"></div>
          <div><label for="hFiltro">Envio ao RH</label><select id="hFiltro"><option value="todos">Todos</option><option value="pendentes">Ainda não incluídos</option><option value="enviados">Aceitos para envio</option></select></div>
        </div><p class="meta">Filtro pela data de início, no horário de Brasília.</p></details>
        <div id="hResumo" class="horas-resumo" tabindex="-1" aria-live="polite">Carregando seus registros…</div>
        <p id="hListaDica" class="meta">Deslize a tabela para os lados para ver as ações Editar e Excluir.</p>
        <div id="hLista" role="region" aria-label="Tabela dos relatórios" aria-describedby="hListaDica" tabindex="0"></div>
        <details id="hExportacao"><summary>Exportar e conferir relatório para o RH</summary>
          <p class="meta">Reúna os registros do período selecionado. O envio ao RH está ${ENVIO_RH_ATIVO?'habilitado':'desativado durante a validação'}.</p>
          <div class="horas-actions"><button id="hPreparar" disabled>Conferir resumo para o RH</button><button id="hCsv" disabled>Exportar CSV para Excel</button></div>
          <section id="horasPreview" class="hide" aria-labelledby="hPreviewTitulo"><h3 id="hPreviewTitulo" tabindex="-1">Resumo para conferência</h3>
            <p id="hDestinatarios"></p><p id="hPreviewResumo"></p>
            <p class="meta" id="hTabelaDica">Deslize a tabela para os lados para ver todas as colunas. Com a tabela em foco, use as setas no teclado.</p>
            <div id="hPreviewTabela" role="region" aria-label="Registros do resumo" aria-describedby="hTabelaDica" tabindex="0"></div>
            <div class="horas-actions"><button id="hEnviar" class="primary" ${ENVIO_RH_ATIVO?'':'hidden'}>Enviar ao RH</button><button id="hCancelarEnvio">Fechar resumo</button></div>
          </section>
        </details>
        <details id="hEnvios"><summary>Histórico de envios ao RH</summary><p class="meta">“Aceito para envio” confirma a aceitação pelo serviço de e-mail, não a leitura pelo RH.</p><div id="hHistorico"></div></details>
      </section>
      </div>
    </section>`;
  const sair=$('btnSair');sair.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5v18h5M13 7l5 5-5 5M8 12h10"/></svg>Sair';document.querySelector('.horas-nav').append(sair);
  document.querySelector('.horas-ajuda').append($('hCancelar'));
  const paginaRelatorios=location.pathname.endsWith('/relatorios.html');
  document.body.classList.add(paginaRelatorios?'pagina-relatorios':'pagina-formulario');
  document.querySelectorAll('.horas-nav a').forEach((link,index)=>{if((index===1)===paginaRelatorios){link.classList.add('nav-atual');link.setAttribute('aria-current','page');}});
  if(paginaRelatorios){$('hRegistrosTitulo').textContent='Meus relatórios';document.title='Meus relatórios · Plantão TI';}
  else document.title='Novo relatório · Plantão TI';
  let registros=[],relatorios=[],editing=null,prontos=[],versoes={},ready=false,usuarioAtual=null,geracao=0,busy=false,aiGeracao=0,aiOriginal='',aiBusy=false,mostrarTodos=false,excluindoId=null,excluirErro='';
  const brasil=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(d));
  const diaBrasil=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
  const local=d=>{const v=new Date(d);return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}T${String(v.getHours()).padStart(2,'0')}:${String(v.getMinutes()).padStart(2,'0')}`;};
  const duracao=n=>{const m=Math.round(Number(n)||0);return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}min`;};
  const msg=(s,erro=false)=>{$('horasMensagem').textContent=s;$('horasMensagem').classList.toggle('err',erro);};
  const aiMsg=(s,erro=false)=>{$('hIAMensagem').textContent=s;$('hIAMensagem').classList.toggle('err',erro);};
  function erroTexto(e){return /42P01|PGRST205|schema cache|does not exist/i.test(`${e.code||''} ${e.message}`)?'Não foi possível acessar os relatórios. Fale com o responsável pela instalação.':e.message||'Não foi possível concluir. Confira a conexão e tente novamente.';}
  document.addEventListener('sessao-pronta',async e=>{usuarioAtual=e.detail.id;await carregarHoras();});
  async function carregarHoras(){
    const foco=$('hLista').contains(document.activeElement)||$('hHistorico').contains(document.activeElement)||$('horasPreview').contains(document.activeElement);
    const rodada=++geracao;ready=false;$('hPreparar').disabled=true;$('hCsv').disabled=true;$('horasPreview').classList.add('hide');
    try{
      const buscar=async tabela=>{const todos=[];for(let offset=0;;offset+=500){const {data,error}=await sb.from(tabela).select('*').eq('usuario_id',usuarioAtual).order(tabela==='atendimentos'?'inicio':'criado_em',{ascending:false}).order('id').range(offset,offset+499);if(error)throw error;todos.push(...data);if(data.length<500)return todos;}};
      const [itens,hist]=await Promise.all([buscar('atendimentos'),buscar('relatorios_horas')]);
      if(rodada!==geracao)return;registros=itens;relatorios=hist;ready=true;render();if(foco)$('hResumo').focus();
      const editarId=!paginaRelatorios?new URLSearchParams(location.search).get('editar'):null;
      if(editarId){const registro=registros.find(a=>a.id===editarId&&!a.relatorio_id);if(registro){editar(registro);history.replaceState(null,'',location.pathname+'#horasForm');}}
    }catch(e){if(rodada!==geracao)return;msg(erroTexto(e),true);$('hResumo').textContent='Não foi possível atualizar os relatórios. Tente novamente.';}
  }
  function filtrados(){const de=$('hDe').value,ate=$('hAte').value,filtro=$('hFiltro').value;if(de&&ate&&de>ate)return [];return registros.filter(a=>{const dia=diaBrasil(a.inicio),r=relatorios.find(r=>r.id===a.relatorio_id);return(!de||dia>=de)&&(!ate||dia<=ate)&&(filtro==='todos'||filtro==='pendentes'&&!a.relatorio_id||filtro==='enviados'&&r?.estado==='aceito');});}
  function estado(a){if(!a.fim)return 'Registro antigo: complete o término';if(!a.relatorio_id)return 'Salvo';return relatorios.find(r=>r.id===a.relatorio_id)?.estado==='aceito'?'Aceito para envio ao RH':'Envio aguardando confirmação';}
  function linhaRegistro(a){
    const i=new Date(a.inicio),f=a.fim?new Date(a.fim):null,horario=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(d);
    const acoes=!a.relatorio_id?`<button type="button" data-h-editar="${a.id}" aria-label="Editar ${esc(a.titulo)}">Editar</button><button type="button" data-h-excluir="${a.id}" aria-label="Excluir ${esc(a.titulo)}">Excluir</button>`:'—';
    const linha=`<tr><td>${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(i)}</td><td><details class="registro-expandir"><summary>${esc(a.titulo)}</summary><div class="registro-conteudo"><span class="tag ${a.fim?'':'pendente'}">${esc(estado(a))}</span>${a.solicitante||a.setor?`<p class="meta">${esc([a.solicitante,a.setor].filter(Boolean).join(' · '))}</p>`:''}${a.pausa_minutos?`<p class="meta">Pausas: ${a.pausa_minutos} min</p>`:''}${a.descricao?`<p class="desc">${esc(a.descricao)}</p>`:''}<p class="desc">${esc(a.solucao)}</p></div></details></td><td>${horario(i)}</td><td>${f?horario(f):'—'}</td><td>${f?duracao(a.minutos):'Sem término'}</td><td><div class="registro-acao">${acoes}</div></td></tr>`;
    if(excluindoId!==a.id)return linha;
    return linha+`<tr class="registro-exclusao"><td colspan="6"><p>Excluir definitivamente o relatório “${esc(a.titulo)}”? As horas registradas nele também sairão dos totais. Esta ação não pode ser desfeita.</p><div class="horas-actions"><button type="button" data-h-confirmar="${a.id}" ${busy?'disabled':''}>Sim, excluir relatório</button><button type="button" data-h-cancelar-exclusao ${busy?'disabled':''}>Cancelar</button></div>${excluirErro?`<span class="err" role="alert">${esc(excluirErro)}</span>`:''}</td></tr>`;
  }
  function render(){
    $('horasPreview').classList.add('hide');const itens=filtrados(),finalizados=itens.filter(a=>a.fim),pendentes=finalizados.filter(a=>!a.relatorio_id),invalido=$('hDe').value&&$('hAte').value&&$('hDe').value>$('hAte').value;
    const concluídos=registros.filter(a=>a.fim);
    $('hHojeQtd').textContent=String(concluídos.length);$('hHojeHoras').textContent=duracao(concluídos.reduce((s,a)=>s+(Number(a.minutos)||0),0));
    $('hUltimo').innerHTML=registros.length?`<span class="ultimo-hora">${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(registros[0].inicio))}</span>${esc(registros[0].titulo)}<small>${esc(registros[0].solucao||'')}</small>`:'Nenhum relatório salvo.';
    $('hResumo').textContent=invalido?'A data inicial deve ser anterior ou igual à final.':`${itens.length} relatório(s) · ${duracao(finalizados.reduce((s,a)=>s+Number(a.minutos),0))} de atendimento`;
    $('hPreparar').disabled=!ready||!pendentes.length||busy;$('hCsv').disabled=!ready||!finalizados.length||busy;
    $('hVerTodos').textContent=mostrarTodos?'Mostrar últimos relatórios ↑':'Ver todos os relatórios →';$('hVerTodos').hidden=paginaRelatorios||itens.length<=3;
    $('hLista').innerHTML=itens.length?`<table aria-label="Relatórios registrados"><thead><tr><th>Data</th><th>Assunto</th><th>Início</th><th>Término</th><th>Duração</th><th>Ações</th></tr></thead><tbody>${(paginaRelatorios||mostrarTodos?itens:itens.slice(0,3)).map(linhaRegistro).join('')}</tbody></table>`:'<p class="empty">Nenhum relatório registrado. Use “Novo relatório” para criar o primeiro.</p>';
    $('hHistorico').innerHTML=relatorios.length?relatorios.map(r=>`<article class="horas-registro"><strong>Envio ${esc(r.id.slice(0,8))}</strong><p>${brasil(r.criado_em)} · ${r.itens.length} registro(s) · ${duracao(r.itens.reduce((s,a)=>s+Number(a.minutos),0))}</p><p class="meta">${esc(r.destinatarios.join(', '))} · ${r.estado==='aceito'?'Aceito para envio em '+brasil(r.aceito_em):'Aguardando confirmação'}</p>${r.estado!=='aceito'&&ENVIO_RH_ATIVO?`<p>${esc(r.ultimo_erro||'Verifique o resultado do envio.')}</p><button data-h-retomar="${r.id}">Verificar / tentar novamente</button>`:''}</article>`).join(''):'<p class="meta">Nenhum envio realizado.</p>';
  }
  function atualizarEtapas(){
    const titulo=!!$('hTitulo').value.trim(),inicio=new Date($('hInicio').value),fim=new Date($('hFim').value),pausa=Number($('hPausa').value);
    const horarioValido=!!$('hInicio').value&&!!$('hFim').value&&Number.isFinite(inicio.getTime())&&Number.isFinite(fim.getTime())&&inicio<=new Date()&&fim<=new Date()&&fim>inicio&&Number.isInteger(pausa)&&pausa>=0&&(fim-inicio)/60000>pausa;
    const completos=[titulo,titulo&&horarioValido,titulo&&horarioValido&&!!$('hSolucao').value.trim()];
    const atual=completos.findIndex(valor=>!valor);
    const botoes=[...document.querySelectorAll('.etapas button')];
    botoes.forEach((botao,index)=>{const completo=completos[index],ativo=index===(atual===-1?2:atual);botao.classList.toggle('is-complete',completo);botao.classList.toggle('is-active',ativo&&!completo);botao.setAttribute('aria-label',`${['Dados','Atendimento','Relato'][index]}, ${completo?'concluído':ativo?'etapa atual':'pendente'}`);if(ativo&&!completo)botao.setAttribute('aria-current','step');else botao.removeAttribute('aria-current');});
    document.querySelectorAll('.etapas i').forEach((linha,index)=>linha.classList.toggle('is-complete',completos[index]));
    const status=atual===-1?'Todas as etapas estão completas. Revise e salve o relatório.':`Etapa atual: ${['Dados','Atendimento','Relato'][atual]}.`;
    if($('hEtapaStatus').textContent!==status)$('hEtapaStatus').textContent=status;
  }
  function previa(){const inicio=new Date($('hInicio').value),fim=new Date($('hFim').value),pausa=Number($('hPausa').value);$('hPrevia').innerHTML=!$('hInicio').value||!$('hFim').value?'Informe o início e o término para calcular o tempo atendido.':fim>inicio&&Number.isInteger(pausa)&&pausa>=0&&(fim-inicio)/60000>pausa?`<span class="icone-relogio" aria-hidden="true"></span>Duração do atendimento: &nbsp; <strong>${duracao((fim-inicio)/60000-pausa)}</strong>${pausa?` <small>(descontados ${pausa} min de pausas)</small>`:''}`:'Confira os horários e as pausas: o tempo atendido deve ser maior que zero.';atualizarEtapas();}
  function limparIA(){aiGeracao++;aiBusy=false;$('hMelhorarIA').disabled=false;$('hMelhorarIA').textContent='Melhorar texto';$('hIASugestao').classList.add('hide');$('hTextoIA').value='';aiMsg('');}
  function limpar(){editing=null;$('horasForm').reset();$('hSetor').value='';$('hPausa').value='0';$('horasFormTitulo').textContent='Registrar relatório';$('horasTitulo').textContent='Novo relatório de atendimento';$('hSalvar').textContent='Salvar relatório';$('hCancelar').textContent='Limpar formulário';$('hErro').textContent='';limparIA();previa();}
  function editar(a){limpar();editing=a.id;$('horasFormTitulo').textContent='Editar relatório';$('horasTitulo').textContent='Editar relatório de atendimento';$('hSalvar').textContent='Salvar alterações';$('hCancelar').textContent='Cancelar edição';for(const [id,key]of[['hTitulo','titulo'],['hSetor','setor'],['hSolucao','solucao']])$(id).value=a[key]||'';$('hInicio').value=local(a.inicio);$('hFim').value=a.fim?local(a.fim):'';$('hPausa').value=a.pausa_minutos||0;previa();$('hTitulo').focus();}
  $('hCancelar').onclick=()=>{limpar();$('hTitulo').focus();};$('horasAtualizar').onclick=()=>carregarHoras();$('hVerTodos').onclick=()=>{mostrarTodos=!mostrarTodos;render();$('hRegistrosTitulo').focus();};
  document.querySelectorAll('[data-foco]').forEach(b=>b.onclick=()=>$(b.dataset.foco).focus());
  document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{const campo=$('hSolucao'),inicio=campo.selectionStart,fim=campo.selectionEnd,selecionado=campo.value.slice(inicio,fim),tipo=b.dataset.format;
    const antes={bold:'**',italic:'*',underline:'<u>',bullet:'- ',number:'1. ',link:'['}[tipo],depois={bold:'**',italic:'*',underline:'</u>',bullet:'',number:'',link:'](https://)'}[tipo];
    const novo=antes+(selecionado||'texto')+depois;if(campo.value.length-(fim-inicio)+novo.length>5000)return aiMsg('O relato atingiu o limite de 5.000 caracteres.',true);
    campo.setRangeText(novo,inicio,fim,'select');campo.focus();campo.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const id of ['hInicio','hFim','hPausa'])$(id).addEventListener('input',previa);
  for(const id of ['hTitulo','hSolucao'])$(id).addEventListener('input',atualizarEtapas);
  atualizarEtapas();
  for(const id of ['hDe','hAte','hFiltro'])$(id).addEventListener('input',render);
  $('hLista').onclick=async e=>{
    if(busy)return;
    const editarBotao=e.target.closest('[data-h-editar]');if(editarBotao){const a=registros.find(a=>a.id===editarBotao.dataset.hEditar);if(a&&!a.relatorio_id)location.href=`index.html?editar=${encodeURIComponent(a.id)}#horasForm`;return;}
    const excluirBotao=e.target.closest('[data-h-excluir]');if(excluirBotao){const a=registros.find(a=>a.id===excluirBotao.dataset.hExcluir);if(!a||a.relatorio_id)return;excluindoId=a.id;excluirErro='';render();$('hLista').querySelector('[data-h-confirmar]')?.focus();return;}
    if(e.target.closest('[data-h-cancelar-exclusao]')){const id=excluindoId;excluindoId=null;excluirErro='';render();$('hLista').querySelector(`[data-h-excluir="${id}"]`)?.focus();return;}
    const confirmar=e.target.closest('[data-h-confirmar]');if(!confirmar)return;
    const atual=registros.find(a=>a.id===confirmar.dataset.hConfirmar);if(!atual||atual.id!==excluindoId||atual.relatorio_id){excluirErro='Este relatório não pode mais ser excluído. Atualize a lista.';render();return;}
    busy=true;render();
    try{const {data,error}=await sb.from('atendimentos').delete().eq('id',atual.id).eq('usuario_id',usuarioAtual).is('relatorio_id',null).eq('atualizado_em',atual.atualizado_em).select('id');if(error)throw error;if(data?.length!==1)throw new Error('O relatório mudou ou já foi incluído no envio ao RH. Atualize a lista e confira antes de excluir.');excluindoId=null;excluirErro='';if(editing===atual.id)limpar();msg('Relatório excluído. As horas foram atualizadas.');await carregarHoras();$('hResumo').focus();}
    catch(erro){excluirErro=erroTexto(erro);}
    finally{busy=false;if(ready)render();}
  };
  $('horasForm').onsubmit=async e=>{
    e.preventDefault();if(busy)return;const inicio=new Date($('hInicio').value),fim=new Date($('hFim').value),pausa=Number($('hPausa').value),titulo=$('hTitulo').value.trim(),solucao=$('hSolucao').value.trim();
    const erro=s=>{$('hErro').textContent=s;};if(!titulo||!solucao)return erro('Preencha o assunto e o relato do serviço realizado.');
    if(!Number.isFinite(inicio.getTime())||!Number.isFinite(fim.getTime()))return erro('Informe início e término válidos.');
    if(inicio>new Date()||fim>new Date())return erro('Os horários não podem estar no futuro.');
    if(!Number.isInteger(pausa)||pausa<0||(fim-inicio)/60000<=pausa)return erro('O término deve ser posterior ao início e as pausas devem ser menores que o intervalo.');
    const atual=registros.find(a=>a.id===editing),payload={titulo,solucao,inicio:inicio.toISOString(),fim:fim.toISOString(),pausa_minutos:pausa,solicitante:atual?.solicitante||'',setor:$('hSetor').value.trim(),descricao:atual?.descricao||''};
    busy=true;$('hSalvar').disabled=true;$('hCancelar').disabled=true;limparIA();
    try{const query=editing?sb.from('atendimentos').update(payload).eq('id',editing).is('relatorio_id',null).eq('atualizado_em',atual?.atualizado_em):sb.from('atendimentos').insert(payload);const {data,error}=await query.select('id');if(error)throw error;if(data.length!==1)throw new Error('O registro mudou. Atualize a lista e confira antes de editar.');limpar();msg('Relatório salvo. Suas horas foram atualizadas.');await carregarHoras();$('hTitulo').focus();}
    catch(e){erro(erroTexto(e));}finally{busy=false;$('hSalvar').disabled=false;$('hCancelar').disabled=false;if(ready)render();}
  };
  async function invoke(nome,body){const {data,error}=await sb.functions.invoke(nome,{body});if(error){let detail;try{detail=await error.context?.json();}catch{}throw new Error(detail?.error||(nome==='revisar-relatorio'?'A revisão com IA ainda não está disponível. Você pode continuar escrevendo e salvar normalmente.':'Não foi possível acessar o envio ao RH.'));}if(data?.error)throw new Error(data.error);return data;}
  $('hMelhorarIA').onclick=async()=>{
    if(aiBusy||busy)return;const texto=$('hSolucao').value.trim();if(texto.length<20)return aiMsg('Escreva pelo menos 20 caracteres sobre o serviço antes de pedir a revisão.',true);
    const rodada=++aiGeracao;aiOriginal=texto;aiBusy=true;$('hIASugestao').classList.add('hide');$('hMelhorarIA').disabled=true;$('hMelhorarIA').textContent='Revisando texto…';aiMsg('Preparando uma sugestão. Seu texto original será mantido.');
    try{const data=await invoke('revisar-relatorio',{texto});if(rodada!==aiGeracao)return;if(typeof data.texto!=='string'||!data.texto.trim()||data.texto.length>5000)throw new Error('A sugestão não veio em um formato válido. Seu texto foi mantido.');$('hTextoIA').value=data.texto;$('hIASugestao').classList.remove('hide');aiMsg('Sugestão pronta. Confira e escolha se deseja usá-la.');$('hIATitulo').focus();}
    catch(e){if(rodada===aiGeracao)aiMsg(e.message,true);}finally{if(rodada===aiGeracao){aiBusy=false;$('hMelhorarIA').disabled=false;$('hMelhorarIA').textContent='Melhorar texto';}}
  };
  $('hUsarIA').onclick=()=>{if($('hSolucao').value.trim()!==aiOriginal)return aiMsg('Seu texto mudou desde a solicitação. Peça uma nova revisão para não substituir suas alterações.',true);const sugestao=$('hTextoIA').value.trim();if(!sugestao)return aiMsg('A sugestão está vazia. Ajuste o texto ou mantenha o original.',true);$('hSolucao').value=sugestao;atualizarEtapas();$('hIASugestao').classList.add('hide');aiMsg('Sugestão aplicada ao formulário. Confira e salve o relatório quando estiver pronto.');$('hSolucao').focus();};
  $('hDescartarIA').onclick=()=>{limparIA();$('hSolucao').focus();};
  function tabela(itens){return `<table><thead><tr><th>Início (Brasília)</th><th>Término (Brasília)</th><th>Pausas</th><th>Tempo atendido</th><th>Solicitante / setor</th><th>Relato</th></tr></thead><tbody>${itens.map(a=>`<tr><td>${brasil(a.inicio)}</td><td>${brasil(a.fim)}</td><td>${a.pausa_minutos} min</td><td>${duracao(a.minutos)}</td><td>${esc([a.solicitante,a.setor].filter(Boolean).join(' / '))}</td><td>${esc(a.titulo)}\n${esc(a.descricao)}${a.descricao?'\n':''}${esc(a.solucao)}</td></tr>`).join('')}</tbody></table>`;}
  $('hPreparar').onclick=async()=>{prontos=filtrados().filter(a=>a.fim&&!a.relatorio_id);if(prontos.length>200)return msg('Selecione um período menor: cada resumo aceita até 200 registros.',true);versoes=Object.fromEntries(prontos.map(a=>[a.id,a.atualizado_em]));$('hPreviewResumo').textContent=`${perfil.nome} · ${prontos.length} registro(s) · ${duracao(prontos.reduce((s,a)=>s+Number(a.minutos),0))}`;$('hPreviewTabela').innerHTML=tabela(prontos);$('horasPreview').classList.remove('hide');$('hPreviewTitulo').focus();$('hEnviar').disabled=true;
    if(!ENVIO_RH_ATIVO){$('hDestinatarios').textContent='Prévia para validação. O envio de e-mail está desativado.';return;}
    $('hDestinatarios').textContent='Consultando destinatários…';try{const data=await invoke('enviar-relatorio-rh',{acao:'config'});$('hDestinatarios').textContent='Para: '+data.destinatarios.join(', ');$('hEnviar').disabled=false;}catch(e){$('hDestinatarios').textContent=e.message;}
  };
  $('hCancelarEnvio').onclick=()=>{$('horasPreview').classList.add('hide');$('hPreparar').focus();};
  async function enviar(body,botao){if(busy||!ENVIO_RH_ATIVO)return;busy=true;botao.disabled=true;msg('Enviando o resumo. Aguarde a confirmação…');try{const data=await invoke('enviar-relatorio-rh',body);msg(`Envio ${data.id.slice(0,8)} aceito pelo serviço de e-mail.`);}catch(e){msg(e.message,true);}finally{busy=false;botao.disabled=false;await carregarHoras();$('hResumo').focus();}}
  $('hEnviar').onclick=()=>enviar({ids:prontos.map(a=>a.id),versoes},$('hEnviar'));
  $('hHistorico').onclick=e=>{const b=e.target.closest('[data-h-retomar]');if(b)enviar({relatorio_id:b.dataset.hRetomar},b);};
  $('hCsv').onclick=()=>{const itens=filtrados().filter(a=>a.fim),cel=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"',rows=[['Colaborador','Início (Brasília)','Término (Brasília)','Pausas (min)','Tempo atendido (min)','Assunto','Solicitante','Setor','Contexto anterior','Relato','Envio ao RH']];itens.forEach(a=>rows.push([perfil.nome,brasil(a.inicio),brasil(a.fim),a.pausa_minutos,Number(a.minutos).toFixed(2),a.titulo,a.solicitante,a.setor,a.descricao,a.solucao,estado(a)]));const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cel).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='relatorios-ti.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();

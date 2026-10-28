
// SCRIPT V3 — Download SICOM Matozinhos — ViewState CDATA fix + paginação
// Injete no console da aba paginaPrincipal.jsf (tabId 1725554565)

window._sicom = {ok:0, erros:0, running:true, log:[]};

const MENSAIS = ['ACOMPANHAMENTO','BALANCETE','FLPG'];
const ANUAIS  = ['BASICO','DCASP','DOCIP','EXTRATOS','PPA','PRO','EDITAL','OBRA','DECRETOSLEIS','PCA'];
const ANOS    = ['2021','2022','2023','2024','2025','2026'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchComTimeout(url, opts, ms=25000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, {...opts, signal:ctrl.signal}); }
  finally { clearTimeout(tid); }
}

// Atualiza ViewState no DOM — suporta CDATA e texto simples
function atualizaVS(text) {
  const m = text.match(/id="javax\.faces\.ViewState"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/update>/)
           || text.match(/id="javax\.faces\.ViewState"[^>]*>([\s\S]*?)<\/update>/);
  if (m?.[1]?.trim()) {
    const el = document.querySelector('[name="javax.faces.ViewState"]');
    if (el) { el.value = m[1].trim(); return true; }
  }
  return false;
}

// Pesquisa via AJAX fetch — retorna rowKeys da pág 1
async function pesquisarAjax(mod, ano, orgaos) {
  const form = document.getElementById('formulario');
  const params = new URLSearchParams(new FormData(form));
  params.set('formulario:modulo', mod);
  params.set('formulario:exercicio', ano);
  params.set('formulario:valida', 'S');
  params.set('formulario:atual', '');
  params.set('formulario:orgaos', orgaos);
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', 'formulario:j_idt199');
  params.append('javax.faces.partial.execute', '@form');
  params.append('javax.faces.partial.render', 'formulario:tabelaAcompanhamento formulario:panelFiltros formulario:panelAction messages');
  try {
    const resp = await fetchComTimeout(form.action, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest'},
      body:params.toString(), credentials:'include'
    }, 25000);
    if (!resp.ok) return {rowKeys:[], err:'http-'+resp.status};
    const text = await resp.text();
    atualizaVS(text);
    const rowKeys = [...new Set([...text.matchAll(/data-rk="(\d+)"/g)].map(m=>m[1]))];
    return {rowKeys};
  } catch(e) {
    return {rowKeys:[], err:e.message.substring(0,40)};
  }
}

// Avança para próxima página via DOM click — retorna novos rowKeys ou []
async function paginarProximo(timeoutMs=18000) {
  const btnNext = document.querySelector(
    '#formulario\\:tabelaAcompanhamento_paginator_bottom .ui-paginator-next:not(.ui-state-disabled)'
  );
  if (!btnNext) return [];

  const primeiroPrev = document.querySelector(
    '#formulario\\:tabelaAcompanhamento_data tr[data-rk]'
  )?.getAttribute('data-rk');

  btnNext.click();

  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await sleep(600);
    const primeiro = document.querySelector(
      '#formulario\\:tabelaAcompanhamento_data tr[data-rk]'
    )?.getAttribute('data-rk');
    if (primeiro && primeiro !== primeiroPrev) {
      await sleep(400);
      return [...document.querySelectorAll(
        '#formulario\\:tabelaAcompanhamento_data tr[data-rk]'
      )].map(r => r.getAttribute('data-rk')).filter(Boolean);
    }
  }
  return [];
}

// Baixa arquivo por rowKey via POST direto
async function baixarPorKey(rk) {
  const selInput = document.getElementById('formulario:tabelaAcompanhamento_selection');
  if (selInput) selInput.value = rk;
  const form = document.getElementById('formulario');
  const params = new URLSearchParams(new FormData(form));
  params.append('formulario:backUpRemessa', '');
  try {
    const resp = await fetchComTimeout(form.action, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:params.toString(), credentials:'include'
    }, 30000);
    const cd = resp.headers.get('content-disposition') || '';
    if (!cd.includes('attachment')) {
      const text = await resp.text(); atualizaVS(text);
      return 'no-attach:'+resp.status;
    }
    const blob = await resp.blob();
    const fname = (cd.match(/filename[*]?=["']?([^;"'\n]+)/i)?.[1] || 'sicom_'+rk+'.zip').replace(/['"]/g,'');
    const burl = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=burl; a.download=fname;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(burl); a.remove();}, 3000);
    return 'ok:'+fname;
  } catch(e) { return 'err:'+e.message.substring(0,30); }
}

async function baixarModAno(mod, ano) {
  const orgaos = MENSAIS.includes(mod) ? '2' : '';
  const {rowKeys, err} = await pesquisarAjax(mod, ano, orgaos);
  if (err) { window._sicom.log.push('ERRO:'+mod+'/'+ano+':'+err); return; }
  if (!rowKeys.length) { window._sicom.log.push('0:'+mod+'/'+ano); return; }

  window._sicom.log.push('['+mod+'/'+ano+']='+rowKeys.length);

  // Pág 1 (via fetch rowKeys)
  for (const rk of rowKeys) {
    if (!window._sicom.running) return;
    const res = await baixarPorKey(rk);
    if (res.startsWith('ok:')) window._sicom.ok++;
    else { window._sicom.erros++; window._sicom.log.push('ERR:'+rk+':'+res); }
    await sleep(200);
  }

  // Páginas adicionais via DOM (se houver paginator ativo)
  let pagina = 2;
  while (window._sicom.running && pagina <= 30) {
    const proximo = await paginarProximo(18000);
    if (!proximo.length) break;
    window._sicom.log.push('['+mod+'/'+ano+':p'+pagina+']='+proximo.length);
    for (const rk of proximo) {
      if (!window._sicom.running) return;
      const res = await baixarPorKey(rk);
      if (res.startsWith('ok:')) window._sicom.ok++;
      else { window._sicom.erros++; window._sicom.log.push('ERR:'+rk+':'+res); }
      await sleep(200);
    }
    pagina++;
  }
}

(async () => {
  console.log('=== SICOM V3 iniciado ===');
  window._sicom.log.push('inicio');
  for (const mod of [...MENSAIS, ...ANUAIS]) {
    for (const ano of ANOS) {
      if (!window._sicom.running) { console.log('PARADO'); return; }
      try { await baixarModAno(mod, ano); }
      catch(e) {
        window._sicom.erros++;
        window._sicom.log.push('EXCECAO:'+mod+'/'+ano+':'+e.message.substring(0,50));
      }
      await sleep(300);
    }
  }
  const msg = 'FIM:'+window._sicom.ok+'ok/'+window._sicom.erros+'erros';
  window._sicom.log.push(msg);
  window._sicom.running = false;
  console.log('=== SICOM V3', msg, '===');
})();

'Script V3 iniciado. Status: window._sicom | Parar: window._sicom.running=false';

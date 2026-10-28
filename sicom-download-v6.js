
// SCRIPT V6 — Download SICOM Matozinhos
// Abordagem: PrimeFaces.ab() para busca + aguardaFila + beh fetch para seleção + fetch para download
// Esta é a versão funcional. Injete no console do Chrome na aba paginaPrincipal.jsf
//
// MÓDULOS: ACOMPANHAMENTO, BALANCETE, FLPG (mensais, orgaos='2')
//          BASICO, DCASP, DOCIP, EXTRATOS, PPA, PRO, EDITAL, OBRA, DECRETOSLEIS, PCA (anuais, orgaos='')
// ANOS: 2021-2026
//
// Para injetar: abrir DevTools > Console > colar o conteúdo abaixo

window._sicom = {ok:0, erros:0, running:true, log:[]};

const MENSAIS = ['ACOMPANHAMENTO','BALANCETE','FLPG'];
const ANUAIS  = ['BASICO','DCASP','DOCIP','EXTRATOS','PPA','PRO','EDITAL','OBRA','DECRETOSLEIS','PCA'];
const ANOS    = ['2021','2022','2023','2024','2025','2026'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchT(url, opts, ms=25000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, {...opts, signal:c.signal}); }
  finally { clearTimeout(t); }
}
function clearQ() {
  try { PrimeFaces.ajax.Queue.requests = []; } catch(e){}
  try { const p=window.widget_menuSup_j_idt13; if(p?.stop) p.stop(); } catch(e){}
}
function atualizaVS(text) {
  const m = text.match(/id="javax\.faces\.ViewState"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/update>/)
           || text.match(/id="javax\.faces\.ViewState"[^>]*>([\s\S]*?)<\/update>/);
  if (m?.[1]?.trim()) { const el=document.querySelector('[name="javax.faces.ViewState"]'); if(el) el.value=m[1].trim(); }
}

// Aguarda fila AJAX drenar (usado após PrimeFaces.ab e btn.click)
async function aguardaFila(ms=25000) {
  const t0=Date.now();
  while (Date.now()-t0 < 2000) { await sleep(150); if ((PrimeFaces.ajax.Queue.requests?.length??0)>0) break; }
  while (Date.now()-t0 < ms) {
    await sleep(400);
    if ((PrimeFaces.ajax.Queue.requests?.length??0)===0) { await sleep(500); return true; }
  }
  return false;
}

// Busca via PrimeFaces.ab() real + aguarda fila drenar
async function pesquisarDOM(mod, ano, orgaos) {
  clearQ();
  const s = id => document.getElementById(id);
  s('formulario:modulo').value = mod;
  s('formulario:exercicio').value = ano;
  s('formulario:valida').value = 'S';
  s('formulario:atual').value = '';
  s('formulario:orgaos').value = orgaos;
  PrimeFaces.ab({source:'formulario:j_idt199', update:'formulario:tabelaAcompanhamento formulario:panelFiltros formulario:panelAction messages'});
  await aguardaFila(25000);
  return [...document.querySelectorAll('#formulario\\:tabelaAcompanhamento_data tr[data-rk]')].map(r=>r.getAttribute('data-rk')).filter(Boolean);
}

// Seleciona linha no servidor via fetch beh() — obrigatório antes do download
async function selecionarLinha(rk) {
  const form = document.getElementById('formulario');
  const p = new URLSearchParams(new FormData(form));
  p.set('formulario:tabelaAcompanhamento_selection', rk);
  p.append('javax.faces.partial.ajax', 'true');
  p.append('javax.faces.source', 'formulario:tabelaAcompanhamento');
  p.append('javax.faces.partial.execute', 'formulario:tabelaAcompanhamento');
  p.append('javax.faces.partial.render', 'formulario:panelAction messages');
  p.append('javax.faces.behavior.event', 'rowSelect');
  p.append('javax.faces.partial.event', 'rowSelect');
  try {
    const r = await fetchT(form.action, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest'}, body:p.toString(), credentials:'include'}, 22000);
    const txt = await r.text(); atualizaVS(txt);
    return r.ok;
  } catch(e) { return false; }
}

// Download via fetch (após selecionarLinha)
async function baixar(rk) {
  const sel = document.getElementById('formulario:tabelaAcompanhamento_selection');
  if (sel) sel.value = rk;
  const form = document.getElementById('formulario');
  const p = new URLSearchParams(new FormData(form));
  p.append('formulario:backUpRemessa', '');
  try {
    const r = await fetchT(form.action, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:p.toString(), credentials:'include'}, 30000);
    const cd = r.headers.get('content-disposition')||'';
    if (!cd.includes('attachment')) { return 'no-att:'+r.status; }
    const blob = await r.blob();
    const fn = (cd.match(/filename[*]?=["']?([^;"'\n]+)/i)?.[1]||'sicom_'+rk+'.zip').replace(/['"]/g,'');
    const u=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=u; a.download=fn; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},3000);
    return 'ok:'+fn;
  } catch(e){return 'err:'+e.message.substring(0,30);}
}

// Avança paginação via DOM + aguarda fila
async function pagProximo() {
  const btn = document.querySelector('#formulario\\:tabelaAcompanhamento_paginator_bottom .ui-paginator-next:not(.ui-state-disabled)');
  if (!btn) return [];
  clearQ(); btn.click();
  await aguardaFila(25000);
  return [...document.querySelectorAll('#formulario\\:tabelaAcompanhamento_data tr[data-rk]')].map(r=>r.getAttribute('data-rk')).filter(Boolean);
}

async function baixarModAno(mod, ano) {
  const orgaos = MENSAIS.includes(mod)?'2':'';
  let rks = await pesquisarDOM(mod, ano, orgaos);
  if (!rks.length) { window._sicom.log.push('0:'+mod+'/'+ano); return; }
  window._sicom.log.push('['+mod+'/'+ano+']='+rks.length);
  let pg=1;
  while (window._sicom.running) {
    for (const rk of rks) {
      if (!window._sicom.running) return;
      const sel = await selecionarLinha(rk);
      if (!sel) { window._sicom.erros++; window._sicom.log.push('E-sel:'+rk); await sleep(500); continue; }
      const res = await baixar(rk);
      if (res.startsWith('ok:')) { window._sicom.ok++; window._sicom.log.push('DL:'+res.substring(3,35)); }
      else { window._sicom.erros++; window._sicom.log.push('E-dl:'+rk+':'+res.substring(0,25)); }
      await sleep(300);
    }
    pg++; rks = await pagProximo();
    if (!rks.length || pg>30) break;
    window._sicom.log.push('['+mod+'/'+ano+':p'+pg+']='+rks.length);
  }
}

(async()=>{
  console.log('=== SICOM V6 iniciado ===');
  window._sicom.log.push('inicio');
  for (const mod of [...MENSAIS,...ANUAIS]) {
    for (const ano of ANOS) {
      if (!window._sicom.running) { console.log('PARADO'); return; }
      try { await baixarModAno(mod,ano); }
      catch(e) { window._sicom.erros++; window._sicom.log.push('EXC:'+mod+'/'+ano+':'+e.message.substring(0,50)); }
      await sleep(500);
    }
  }
  const msg='FIM:'+window._sicom.ok+'ok/'+window._sicom.erros+'erros';
  window._sicom.log.push(msg); window._sicom.running=false;
  console.log('=== SICOM V6',msg,'===');
})();

'V6 iniciado. Status: window._sicom | Parar: window._sicom.running=false';

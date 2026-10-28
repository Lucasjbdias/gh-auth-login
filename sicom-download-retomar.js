
// RETOMADA — Download SICOM Matozinhos (módulos faltantes)
// AM e BALANCETE já baixados — começa em FLPG + todos os anuais

window._sicom = {ok:0, erros:0, skip:0, running:true, log:[]};

const MENSAIS = ['FLPG'];   // AM e BALANCETE já ok
const ANUAIS  = ['BASICO','DCASP','DOCIP','EXTRATOS','PPA','PRO','EDITAL','OBRA','DECRETOSLEIS','PCA'];
const ANOS    = ['2021','2022','2023','2024','2025','2026'];

const jq = window.jQuery || window.$;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function clearQ() {
  PrimeFaces.ajax.Queue.requests = [];
  const poll = window.widget_menuSup_j_idt13;
  if (poll?.stop) poll.stop();
}

async function aguardaTabela(timeoutMs = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await sleep(300);
    if (document.querySelectorAll('#formulario\\:tabelaAcompanhamento_data tr').length > 0) return true;
  }
  return false;
}

async function habilitaEBaixa(rowEl) {
  clearQ();
  const widget = window.widget_formulario_tabelaAcompanhamento;
  const beh    = widget?.cfg?.behaviors?.rowSelect;
  if (!beh) return 'sem-behavior';

  widget.selectRow(jq(rowEl), false);
  await sleep(100);
  beh({});

  const btn = document.getElementById('formulario:backUpRemessa');
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    if (!btn.disabled && !btn.classList.contains('ui-state-disabled')) break;
  }
  if (btn.disabled) return 'btn-disabled';

  btn.click();
  await sleep(5000);
  return 'ok';
}

async function processarFiltro(modulo, ano, atual) {
  const s = id => document.getElementById(id);
  if (!s('formulario:modulo')) { window._sicom.log.push('ERRO: form não encontrado em '+modulo+'/'+ano); return; }

  s('formulario:modulo').value    = modulo;
  s('formulario:exercicio').value = ano;
  s('formulario:valida').value    = 'S';
  s('formulario:atual').value     = atual;
  s('formulario:orgaos').value    = '2';

  clearQ();
  s('formulario:j_idt199').click();
  const achou = await aguardaTabela(7000);
  if (!achou) { window._sicom.log.push('sem-resultado:'+modulo+'/'+ano); return; }

  const linhasTotal = document.querySelectorAll('#formulario\\:tabelaAcompanhamento_data tr').length;
  window._sicom.log.push(`[${modulo}/${ano}] ${linhasTotal} códigos`);

  let pagina = 1;
  while (window._sicom.running) {
    const linhas = [...document.querySelectorAll('#formulario\\:tabelaAcompanhamento_data tr')];
    if (!linhas.length) break;

    for (const linha of linhas) {
      if (!window._sicom.running) return;
      const code = linha.getAttribute('data-rk');
      const res = await habilitaEBaixa(linha);
      if (res === 'ok') {
        window._sicom.ok++;
        console.log(`  ✓ ${modulo}/${ano} code=${code} (total: ${window._sicom.ok}ok)`);
      } else {
        window._sicom.erros++;
        console.log(`  ✗ ${modulo}/${ano} code=${code} [${res}] (${window._sicom.erros}erros)`);
      }
      await sleep(300);
    }

    const btnNext = document.querySelector('#formulario\\:tabelaAcompanhamento_paginator_bottom .ui-paginator-next:not(.ui-state-disabled)');
    if (!btnNext) break;
    clearQ();
    btnNext.click();
    await sleep(3000);
    pagina++;
  }
}

(async () => {
  clearQ();
  console.log('=== SICOM Retomada: FLPG + Anuais ===');
  window._sicom.log.push('retomada-inicio');
  for (const mod of [...MENSAIS, ...ANUAIS]) {
    for (const ano of ANOS) {
      if (!window._sicom.running) { console.log('PARADO pelo usuário'); return; }
      const atual = MENSAIS.includes(mod) ? 'S' : '';
      try { await processarFiltro(mod, ano, atual); }
      catch(e) {
        window._sicom.erros++;
        const msg = `EXCEÇÃO ${mod}/${ano}: ${e.message}`;
        console.error(msg); window._sicom.log.push(msg);
        clearQ();
        await sleep(1000);
      }
    }
  }
  console.log(`\n=== CONCLUÍDO: ${window._sicom.ok} ok / ${window._sicom.erros} erros ===`);
  window._sicom.log.push('concluido:'+window._sicom.ok+'ok/'+window._sicom.erros+'erros');
  window._sicom.running = false;
})();

return 'Retomada iniciada. Ver progresso: window._sicom | Parar: window._sicom.running = false';

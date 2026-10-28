const https = require('https');
const path  = require('path');
process.chdir('C:\\OneDrive\\39 - Aplicações Desenvolvimento\\Sistemas IA Novos\\franca-dias-gestIA');
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const bigint = (_, v) => typeof v === 'bigint' ? Number(v) : v;

function httpsGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

async function lookupCnpj(cnpj) {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return null;
  const data = await httpsGet(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
  if (data && data.razao_social) return data.razao_social;
  // fallback
  await new Promise(r => setTimeout(r, 1500));
  const d2 = await httpsGet(`https://publica.cnpj.ws/cnpj/${c}`);
  return d2 && d2.razao_social ? d2.razao_social : null;
}

async function main() {
  console.log('\n===== ANÁLISE COMPLETA GesIA — MATOZINHOS =====\n');

  // 1. Top 30 fornecedores
  const forn30 = await prisma.$queryRaw`
    SELECT cpfCnpj, nome,
           SUM(valorEmpenhado) AS empenhado,
           SUM(valorLiquidado) AS liquidado,
           SUM(valorPago)      AS pago,
           COUNT(*)            AS qtd
    FROM Empenho
    WHERE cpfCnpj IS NOT NULL AND cpfCnpj != ''
    GROUP BY cpfCnpj, nome
    ORDER BY empenhado DESC
    LIMIT 30
  `;

  console.log('--- TOP 30 FORNECEDORES (com lookup CNPJ) ---');
  const rows = JSON.parse(JSON.stringify(forn30, bigint));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const doc = (r.cpfCnpj || '').replace(/\D/g, '');
    let nomeReal = r.nome || '';
    if (doc.length === 14 && (!nomeReal || nomeReal === doc)) {
      await new Promise(res => setTimeout(res, 800));
      nomeReal = await lookupCnpj(doc) || nomeReal || '?';
    }
    const emp = (r.empenhado / 1e6).toFixed(2);
    const fmt = doc.length === 14
      ? `${doc.slice(0,2)}.${doc.slice(2,5)}.${doc.slice(5,8)}/${doc.slice(8,12)}-${doc.slice(12)}`
      : doc;
    console.log(`${String(i+1).padStart(2)}. ${fmt.padEnd(20)} R$ ${emp.padStart(8)} MM  ${r.qtd} emp.  ${nomeReal}`);
  }

  // 2. Cobertura mensal por ano
  console.log('\n--- COBERTURA MENSAL POR ANO (empenhos) ---');
  const cob = await prisma.$queryRaw`
    SELECT exercicio, competencia, COUNT(*) as qtd
    FROM Empenho
    GROUP BY exercicio, competencia
    ORDER BY exercicio, competencia
  `;
  const cobData = JSON.parse(JSON.stringify(cob, bigint));
  const anos = [...new Set(cobData.map(r => r.exercicio))].sort();
  for (const ano of anos) {
    const meses = cobData.filter(r => r.exercicio === ano).map(r => r.competencia);
    const mesesU = [...new Set(meses)].sort();
    console.log(`  ${ano}: ${mesesU.length} competências → ${mesesU.join(' | ')}`);
  }

  // 3. Diagnóstico pago zerado 2023/2024
  console.log('\n--- DIAGNÓSTICO CAMPO PAGO 2023/2024 ---');
  const diag = await prisma.$queryRaw`
    SELECT exercicio,
           COUNT(*) as total,
           SUM(CASE WHEN valorPago > 0 THEN 1 ELSE 0 END) as comPago,
           SUM(CASE WHEN valorPago = 0 OR valorPago IS NULL THEN 1 ELSE 0 END) as semPago,
           SUM(valorEmpenhado) as empenhado,
           SUM(valorPago) as pago
    FROM Empenho
    WHERE exercicio IN (2021,2022,2023,2024,2025)
    GROUP BY exercicio ORDER BY exercicio
  `;
  const diagD = JSON.parse(JSON.stringify(diag, bigint));
  for (const r of diagD) {
    const pct = r.total > 0 ? ((r.comPago / r.total) * 100).toFixed(1) : '0';
    console.log(`  ${r.exercicio}: ${r.comPago}/${r.total} empenhos com valorPago > 0 (${pct}%) | Empenhado R$ ${(r.empenhado/1e6).toFixed(2)}MM | Pago R$ ${(r.pago/1e6).toFixed(2)}MM`);
  }

  // 4. Distribuição por função (normalizada)
  console.log('\n--- DESPESA POR FUNÇÃO (normalizada) ---');
  const funcoes = await prisma.$queryRaw`
    SELECT exercicio,
           CASE
             WHEN codigoFuncao IN ('10') OR LOWER(nomeFuncao) LIKE '%sa%de%' OR LOWER(nomeFuncao) LIKE '%saude%' THEN 'Saúde'
             WHEN codigoFuncao IN ('12') OR LOWER(nomeFuncao) LIKE '%educa%' THEN 'Educação'
             WHEN codigoFuncao IN ('04') OR LOWER(nomeFuncao) LIKE '%adminis%' THEN 'Administração'
             WHEN codigoFuncao IN ('15') OR LOWER(nomeFuncao) LIKE '%urban%' THEN 'Urbanismo'
             WHEN codigoFuncao IN ('08') OR LOWER(nomeFuncao) LIKE '%assist%' THEN 'Assistência Social'
             WHEN codigoFuncao IN ('20') OR LOWER(nomeFuncao) LIKE '%agri%' THEN 'Agricultura'
             WHEN codigoFuncao IN ('26') OR LOWER(nomeFuncao) LIKE '%trans%' THEN 'Transporte'
             WHEN codigoFuncao IN ('06') OR LOWER(nomeFuncao) LIKE '%segur%' THEN 'Segurança'
             ELSE COALESCE(nomeFuncao, 'Função ' || codigoFuncao)
           END AS funcaoNorm,
           SUM(valorEmpenhado) as empenhado
    FROM Empenho
    GROUP BY exercicio, funcaoNorm
    ORDER BY exercicio, empenhado DESC
  `;
  const fnD = JSON.parse(JSON.stringify(funcoes, bigint));
  const fAnos = [...new Set(fnD.map(r => r.exercicio))].sort();
  for (const ano of fAnos) {
    const items = fnD.filter(r => r.exercicio === ano).sort((a,b) => b.empenhado - a.empenhado).slice(0, 5);
    const total = items.reduce((s, r) => s + r.empenhado, 0);
    console.log(`  ${ano}:`);
    for (const it of items) {
      const pct = total > 0 ? ((it.empenhado/total)*100).toFixed(1) : '0';
      console.log(`    ${it.funcaoNorm.padEnd(20)} R$ ${(it.empenhado/1e6).toFixed(2).padStart(8)} MM (${pct}%)`);
    }
  }

  // 5. Execução mensal 2025/2026
  console.log('\n--- EXECUÇÃO MENSAL 2025-2026 ---');
  const exec = await prisma.$queryRaw`
    SELECT exercicio, competencia,
           SUM(valorEmpenhado) as emp,
           SUM(valorLiquidado) as liq,
           SUM(valorPago)      as pago,
           COUNT(*)            as qtd
    FROM Empenho
    WHERE exercicio IN (2025, 2026)
    GROUP BY exercicio, competencia
    ORDER BY exercicio, competencia
  `;
  const execD = JSON.parse(JSON.stringify(exec, bigint));
  for (const r of execD) {
    console.log(`  ${r.exercicio}/${r.competencia}  Emp: R$ ${(r.emp/1e6).toFixed(2)}MM  Liq: R$ ${(r.liq/1e6).toFixed(2)}MM  Pago: R$ ${(r.pago/1e6).toFixed(2)}MM  (${r.qtd} emp.)`);
  }

  // 6. Alertas se houver
  const alertas = await prisma.alerta.findMany({ take: 20, orderBy: { criadoEm: 'desc' } });
  if (alertas.length > 0) {
    console.log('\n--- ALERTAS NO GesIA ---');
    for (const a of alertas) {
      console.log(`  [${a.tipo}] ${a.descricao} | ${a.criadoEm}`);
    }
  }

  await prisma.$disconnect();
  console.log('\n===== FIM DA ANÁLISE =====');
}

main().catch(e => { console.error(e); process.exit(1); });

import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";

// Gera os dicionários SICOM (JSON) a partir das tabelas oficiais TCE-MG 2026.
// Uso: tsx scripts/gen-sicom.ts
const BASE = "D:\\Projetos\\franca-dias-gestorIA";
const OUT = path.resolve("src/lib/sicom/data");
fs.mkdirSync(OUT, { recursive: true });

function rows(file: string, sheet?: string): unknown[][] {
  const wb = XLSX.readFile(path.join(BASE, file));
  const ws = wb.Sheets[sheet ?? wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
}
const txt = (v: unknown) => (v == null ? "" : String(v).trim());

// 1) Ementário da Receita: natureza (8 díg) -> especificação
{
  const r = rows("Ementario_da_Receita_Orcamentaria_TCEMG_2026_v1.8.xlsx", "EMENTARIO DA REC_26");
  const map: Record<string, string> = {};
  for (const l of r) {
    const cod = txt(l[7]);
    const nome = txt(l[8]);
    if (/^\d{8}$/.test(cod) && nome) map[cod] = nome;
  }
  fs.writeFileSync(path.join(OUT, "receita.json"), JSON.stringify(map));
  console.log("receita.json:", Object.keys(map).length);
}

// 2) Tabelas de Despesas: natureza (ex. 3.3.90.32.00) -> {nome, tipo}
{
  const r = rows("Tabelas-de-Despesas-2026.xlsx", "DESPESAS");
  const map: Record<string, { nome: string; tipo: string }> = {};
  for (const l of r) {
    const cod = txt(l[5]);
    const nome = txt(l[6]);
    if (/^\d\.\d\.\d{2}\.\d{2}\.\d{2}$/.test(cod) && nome) map[cod] = { nome, tipo: txt(l[7]) };
  }
  fs.writeFileSync(path.join(OUT, "despesa.json"), JSON.stringify(map));
  console.log("despesa.json:", Object.keys(map).length);
}

// 3) Fontes de Recursos: código principal (3 díg) -> nomenclatura
{
  const r = rows("Tabela-de-Fontes-Recursos-para-2026_v1.6.xlsx", "TABELA DE FONTES_2026");
  const map: Record<string, string> = {};
  for (const l of r) {
    const cod = txt(l[0]);
    const nome = txt(l[1]);
    if (/^\d{3}$/.test(cod) && nome) map[cod] = nome;
  }
  fs.writeFileSync(path.join(OUT, "fontes.json"), JSON.stringify(map));
  console.log("fontes.json:", Object.keys(map).length);
}

// 4) Natureza das Rubricas (folha): código -> {nome, status}
{
  const r = rows("Natureza_Rubricas_Remunuracao_Desconto_versao-1.3_ate-NT-06-2026.xlsx", "Planilha1");
  const map: Record<string, { nome: string; status: string }> = {};
  for (const l of r) {
    const cod = txt(l[0]);
    const nome = txt(l[1]);
    if (/^\d{3,5}$/.test(cod) && nome) map[cod] = { nome, status: txt(l[5]) };
  }
  fs.writeFileSync(path.join(OUT, "rubricas.json"), JSON.stringify(map));
  console.log("rubricas.json:", Object.keys(map).length);
}

// 5) PCASP (Plano de Contas Contábil): conta (9 díg) -> nome
{
  const file = fs.readdirSync(BASE).find((f) => /^PLANO-DE-CONTAS-CONTABIL/i.test(f));
  if (file) {
    const r = rows(file, "PCASP_TCEMG");
    const map: Record<string, string> = {};
    for (const l of r) {
      const dig = txt(l[7]).replace(/\D/g, "");
      const nome = txt(l[8]);
      if (/^\d{9}$/.test(dig) && nome) map[dig] = nome;
    }
    fs.writeFileSync(path.join(OUT, "pcasp.json"), JSON.stringify(map));
    console.log("pcasp.json:", Object.keys(map).length);
  } else {
    console.log("PCASP não encontrado em", BASE);
  }
}

console.log("OK ->", OUT);

import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador Tabela Prática de Rubricas — mapeamento verba → nome + flags tributárias.
// Arquivo: Relatorio_Tabela_Pratica_de_Rubricas.xlsx
// Colunas: VERBA | DESCRIÇÃO DA VERBA | IRRF | IRRF 13º | IRRF FÉRIAS |
//          RGPS | RGPS 13º | RPPS | RPPS 13º | FGTS | FGTS 13º

function strXls(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function boolXls(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  const s = String(v).trim().toLowerCase();
  if (s === "sim" || s === "s" || s === "x" || s === "1" || s === "true" || s === "✓") return true;
  if (typeof v === "number" && v !== 0) return true;
  return false;
}

interface RubricaRow {
  verba: string;
  descricao: string;
  irrf: boolean;
  irrf13: boolean;
  irrfFerias: boolean;
  rgps: boolean;
  rgps13: boolean;
  rpps: boolean;
  rpps13: boolean;
  fgts: boolean;
  fgts13: boolean;
}

export const tabelaRubricasImporter: Importer = {
  id: "TABELA_RUBRICAS",
  nome: "Tabela de Rubricas (folha)",
  descricao:
    "Planilha de referência de verbas (rubricas) com flags IRRF, RGPS, RPPS e FGTS para categorização tributária da folha.",
  formatos: [".xlsx", ".xls"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "TABELA_RUBRICAS") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    const nArq = ctx.nomeArquivo.toUpperCase();
    if (/RUBRICAS?/.test(nArq) || /TABELA.*RUBRICAS?/i.test(nArq)) return 93;
    if (/TABELA.*PRATICA/i.test(nArq) && /RUBRICA/i.test(nArq)) return 95;
    // Detecta pelo cabeçalho da planilha
    const sheets = ctx.sheetNames ?? [];
    if (sheets.some((s) => /rubrica/i.test(s))) return 88;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const wb = ctx.workbook ?? XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

    if (rows.length < 2) {
      return { registros: 0, resumo: "Planilha vazia.", avisos: ["Nenhuma rubrica encontrada."] };
    }

    // Descobrir índices de colunas pelo cabeçalho
    const header = rows[0].map((c) => String(c).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
    const col = (patt: RegExp): number => header.findIndex((h) => patt.test(h));

    const iVerba = Math.max(col(/^verba$/), 0);
    const iDesc = Math.max(col(/desc.*verba|descri/), 1);
    const iIrrf = col(/^irrf$/) ?? 2;
    const iIrrf13 = col(/irrf.*13/) ?? 3;
    const iIrrfFer = col(/irrf.*fer/) ?? 4;
    const iRgps = col(/^rgps$/) ?? 5;
    const iRgps13 = col(/rgps.*13/) ?? 6;
    const iRpps = col(/^rpps$/) ?? 7;
    const iRpps13 = col(/rpps.*13/) ?? 8;
    const iFgts = col(/^fgts$/) ?? 9;
    const iFgts13 = col(/fgts.*13/) ?? 10;

    const rubricas: RubricaRow[] = [];
    const avisos: string[] = [];

    for (const row of rows.slice(1)) {
      const verba = strXls(row[iVerba]);
      const descricao = strXls(row[iDesc]);
      if (!verba || !descricao) continue;

      rubricas.push({
        verba,
        descricao,
        irrf: boolXls(row[iIrrf]),
        irrf13: boolXls(row[iIrrf13]),
        irrfFerias: boolXls(row[iIrrfFer]),
        rgps: boolXls(row[iRgps]),
        rgps13: boolXls(row[iRgps13]),
        rpps: boolXls(row[iRpps]),
        rpps13: boolXls(row[iRpps13]),
        fgts: boolXls(row[iFgts]),
        fgts13: boolXls(row[iFgts13]),
      });
    }

    if (!rubricas.length) {
      return { registros: 0, resumo: "Nenhuma rubrica válida encontrada.", avisos: ["Verifique se a planilha possui as colunas VERBA e DESCRIÇÃO DA VERBA."] };
    }

    let ok = 0;
    let erros = 0;

    for (const r of rubricas) {
      try {
        await (db as any).tabelaRubrica.upsert({
          where: { verba: r.verba },
          update: {
            descricao: r.descricao,
            irrf: r.irrf,
            irrf13: r.irrf13,
            irrfFerias: r.irrfFerias,
            rgps: r.rgps,
            rgps13: r.rgps13,
            rpps: r.rpps,
            rpps13: r.rpps13,
            fgts: r.fgts,
            fgts13: r.fgts13,
          },
          create: {
            verba: r.verba,
            descricao: r.descricao,
            irrf: r.irrf,
            irrf13: r.irrf13,
            irrfFerias: r.irrfFerias,
            rgps: r.rgps,
            rgps13: r.rgps13,
            rpps: r.rpps,
            rpps13: r.rpps13,
            fgts: r.fgts,
            fgts13: r.fgts13,
          },
        });
        ok++;
      } catch {
        erros++;
      }
    }

    await db.importacao.create({
      data: {
        tipoDado: "TABELA_RUBRICAS",
        nomeArquivo: ctx.nomeArquivo,
        totalRegistros: rubricas.length,
        registrosOk: ok,
        registrosErro: erros,
        status: erros === 0 ? "PROCESSADO" : "COM_ERROS",
        detalhes: JSON.stringify({ total: rubricas.length, ok, erros }),
      },
    });

    if (erros) avisos.push(`${erros} rubrica(s) com erro ao gravar.`);

    const comIrrf = rubricas.filter((r) => r.irrf).length;
    const comRgps = rubricas.filter((r) => r.rgps || r.rpps).length;
    const comFgts = rubricas.filter((r) => r.fgts).length;

    return {
      registros: ok,
      resumo: `${ok} rubricas importadas. ${comIrrf} com IRRF, ${comRgps} previdência (RGPS/RPPS), ${comFgts} FGTS.`,
      avisos,
      dados: { total: rubricas.length, ok, erros, comIrrf, comRgps, comFgts },
    };
  },
};

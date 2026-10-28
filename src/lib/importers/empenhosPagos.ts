import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador EMPENHOS_PAGOS.XLS — pagamento individual por empenho.
// Colunas: Num.Emp | DT Emp. | Vlr. Empenho | DT Liq. | Vlr. Liquidação |
//          Num.Pagto | DT Pagto | Vlr. Pago | Credor | CNPJ/CPF |
//          Classif. Orcamentaria | Histórico Emp. | Histórico Liq. | Fonte de Recurso
// Agrega por Num.Emp → atualiza Empenho com dataLiquidacao e dataPagamento finais.

function numXls(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function strXls(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function dateXls(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

// Normaliza o número do empenho removendo '/AAAA - N' ao final, retorna apenas 'N'
function normNumEmp(s: string): string {
  const m = s.match(/^(\d+)\s*\/\s*\d+/);
  return m ? m[1] : s.trim();
}

interface PagamentoCsv {
  numEmp: string;
  ano: number;
  chave: string; // "NUMERO/ANO"
  dataEmp: Date | null;
  dataLiq: Date | null;
  dataPagto: Date | null;
  vlrLiquidado: number;
  vlrPago: number;
}

export const empenhosPagosImporter: Importer = {
  id: "EMPENHOS_PAGOS",
  nome: "Empenhos Pagos (EMPENHOS_PAGOS.XLS)",
  descricao:
    "Planilha com pagamentos individuais por empenho. Atualiza data de liquidação e pagamento nos empenhos existentes.",
  formatos: [".xlsx", ".xls"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "EMPENHOS_PAGOS") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    const nArq = ctx.nomeArquivo.toUpperCase();
    if (/EMPENHOS?_PAGOS?/.test(nArq)) return 94;
    if (/EMPENHO/i.test(nArq) && /PAGO/i.test(nArq)) return 88;
    // Detecta pelo header: coluna "DT Liq." e "Num.Pagto"
    if (ctx.sheetNames && (nArq.includes("EMPNH") || nArq.includes("PAGO"))) return 70;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const wb = ctx.workbook ?? XLSX.read(buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

    if (rows.length < 2) {
      return { registros: 0, resumo: "Planilha vazia.", avisos: ["Nenhuma linha de dados."] };
    }

    const header = rows[0].map((c) => String(c).toLowerCase().trim());
    const col = (patt: RegExp): number => header.findIndex((h) => patt.test(h));

    const iNum = Math.max(col(/num\.?emp/), 0);
    const iDataEmp = col(/dt.*emp/) ?? 1;
    const iVlrEmp = col(/vlr.*emp/) ?? 2;
    const iDataLiq = col(/dt.*liq/) ?? 3;
    const iVlrLiq = col(/vlr.*liquid/) ?? 4;
    const iDataPagto = col(/dt.*pag/) ?? 6;
    const iVlrPago = col(/vlr.*pago/) ?? 7;

    const avisos: string[] = [];
    const pagamentos: PagamentoCsv[] = [];

    for (const row of rows.slice(1)) {
      const numRaw = strXls(row[iNum]);
      if (!numRaw) continue;

      const m = numRaw.match(/^(\d+)\s*\/\s*(\d+)/);
      const numEmp = m ? m[1] : numRaw;
      const ano = m ? Number(m[2]) : new Date().getFullYear();

      pagamentos.push({
        numEmp,
        ano,
        chave: `${ano}/${numEmp}`,
        dataEmp: dateXls(row[iDataEmp]),
        dataLiq: dateXls(row[iDataLiq]),
        dataPagto: dateXls(row[iDataPagto]),
        vlrLiquidado: numXls(row[iVlrLiq]),
        vlrPago: numXls(row[iVlrPago]),
      });
    }

    // Agrega por chave (empenho pode ter múltiplos pagamentos)
    const agg = new Map<string, { dataLiq: Date | null; dataPagto: Date | null; vlrLiq: number; vlrPago: number; numEmp: string; ano: number }>();
    for (const p of pagamentos) {
      const prev = agg.get(p.chave);
      if (!prev) {
        agg.set(p.chave, { dataLiq: p.dataLiq, dataPagto: p.dataPagto, vlrLiq: p.vlrLiquidado, vlrPago: p.vlrPago, numEmp: p.numEmp, ano: p.ano });
      } else {
        // Último pagamento (max date) e soma de valores
        if (p.dataPagto && (!prev.dataPagto || p.dataPagto > prev.dataPagto)) prev.dataPagto = p.dataPagto;
        if (p.dataLiq && (!prev.dataLiq || p.dataLiq > prev.dataLiq)) prev.dataLiq = p.dataLiq;
        prev.vlrLiq += p.vlrLiquidado;
        prev.vlrPago += p.vlrPago;
      }
    }

    let atualizados = 0;
    let naoEncontrados = 0;

    for (const [chave, dados] of agg) {
      // Busca empenho por codigoExterno (criado pelo empenhosXls) ou por numero+exercicio
      const empenho = await db.empenho.findFirst({
        where: {
          OR: [
            { codigoExterno: chave },
            { numero: dados.numEmp, exercicio: { orgao: { id: "orgao-matozinhos" }, ano: dados.ano } },
          ],
        },
        select: { id: true },
      });

      if (!empenho) {
        naoEncontrados++;
        continue;
      }

      await db.empenho.update({
        where: { id: empenho.id },
        data: {
          dataLiquidacao: dados.dataLiq ?? undefined,
          dataPagamento: dados.dataPagto ?? undefined,
          valorLiquidado: dados.vlrLiq || undefined,
          valorPago: dados.vlrPago || undefined,
        },
      });
      atualizados++;
    }

    if (naoEncontrados > 0) {
      avisos.push(`${naoEncontrados} empenho(s) não encontrados no banco (importe EMPENHOS.XLS primeiro).`);
    }

    await db.importacao.create({
      data: {
        tipoDado: "EMPENHOS_PAGOS",
        nomeArquivo: ctx.nomeArquivo,
        totalRegistros: pagamentos.length,
        registrosOk: atualizados,
        registrosErro: naoEncontrados,
        status: naoEncontrados === 0 ? "PROCESSADO" : "COM_ERROS",
        detalhes: JSON.stringify({ pagamentos: pagamentos.length, atualizados, naoEncontrados }),
      },
    });

    return {
      registros: atualizados,
      resumo: `${pagamentos.length} pagamentos processados. ${atualizados} empenhos atualizados com data de liquidação e pagamento.`,
      avisos,
      dados: { pagamentos: pagamentos.length, atualizados, naoEncontrados },
    };
  },
};

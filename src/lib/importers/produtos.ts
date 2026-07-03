import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador do CATÁLOGO DE PRODUTOS (planilha "Produtos").
// Colunas: Código | Descrição | Especificação | Unidade de Medida |
//          Grupo de Produtos | Lote ? | Classificação
// Additivo e idempotente: insere apenas códigos ainda não cadastrados.

function txt(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
/** normaliza código removendo zeros à esquerda (000061 -> 61) p/ casar bases. */
export function normCodigo(c: string): string {
  const t = c.trim();
  return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t;
}

export const produtosImporter: Importer = {
  id: "PRODUTOS",
  nome: "Catálogo de Produtos",
  descricao:
    "Planilha 'Produtos' (Código, Descrição, Especificação, Unidade, Grupo, Classificação). Cadastra os produtos no almoxarifado.",
  formatos: [".xlsx", ".xls"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "PRODUTOS") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    if (ctx.sheetNames?.some((n) => /^produtos$/i.test(n))) {
      // confirma cabeçalho
      const ws = ctx.workbook?.Sheets[ctx.sheetNames.find((n) => /^produtos$/i.test(n))!];
      if (ws) {
        const head = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })[0] ?? [];
        const h = head.map((c) => txt(c).toLowerCase());
        if (h.includes("código") || h.includes("codigo")) return 95;
      }
      return 80;
    }
    if (/produto/i.test(ctx.nomeArquivo)) return 55;
    return 0;
  },

  async importar(_buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const wb = ctx.workbook!;
    const nomeAba = wb.SheetNames.find((n) => /^produtos$/i.test(n)) ?? wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], {
      header: 1,
      blankrows: false,
      defval: "",
    });

    // Cabeçalho na 1ª linha; dados a partir da 2ª.
    const dados = rows.slice(1);

    // Códigos já cadastrados (para inserir só os novos).
    const existentes = new Set(
      (await db.produto.findMany({ select: { codigo: true } }))
        .map((p) => (p.codigo ? normCodigo(p.codigo) : ""))
        .filter(Boolean)
    );

    const novos: {
      codigo: string;
      descricao: string;
      categoria: string;
      unidadeMedida: string;
    }[] = [];
    let ignorados = 0;
    const vistos = new Set<string>();

    for (const r of dados) {
      const codigoRaw = txt(r[0]);
      if (!codigoRaw) continue;
      const codigo = normCodigo(codigoRaw);
      if (existentes.has(codigo) || vistos.has(codigo)) {
        ignorados++;
        continue;
      }
      vistos.add(codigo);
      const descricao = txt(r[1]) || txt(r[2]) || `Produto ${codigo}`;
      novos.push({
        codigo,
        descricao,
        categoria: txt(r[4]) || "Não classificado",
        unidadeMedida: txt(r[3]) || null as unknown as string,
      });
    }

    let gravados = 0;
    for (let i = 0; i < novos.length; i += 500) {
      const lote = novos.slice(i, i + 500);
      await db.produto.createMany({ data: lote });
      gravados += lote.length;
    }

    const total = await db.produto.count();
    return {
      registros: gravados,
      resumo: `Catálogo de produtos importado: ${gravados} novos cadastrados, ${ignorados} já existentes. Total no sistema: ${total}.`,
      avisos: ignorados ? [`${ignorados} produto(s) já estavam cadastrados (ignorados).`] : [],
      dados: { gravados, ignorados, total },
    };
  },
};

import type { Importer, DetectContext, ImportResult } from "./types";
import { importarExecucaoOrcamentaria } from "../importacaoOrcamentaria";

// Importador de Execução Orçamentária (planilhas SICOM/TCE-MG).
// Reaproveita o parser/persistência de ../importacaoOrcamentaria.

export const execucaoOrcamentariaImporter: Importer = {
  id: "EXECUCAO_ORCAMENTARIA",
  nome: "Execução Orçamentária (SICOM/TCE-MG)",
  descricao:
    "Planilha Excel com abas de Execução de Receita e Despesa (ESTIMADO/ORÇADO + valores mensais empenhado/liquidado/pago).",
  formatos: [".xlsx", ".xls"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "EXECUCAO_ORCAMENTARIA") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    const tem = (re: RegExp) => ctx.sheetNames?.some((n) => re.test(n)) ?? false;
    if (tem(/receita/i) && tem(/despesa/i)) return 90;
    if (/exec.*or[cç]/i.test(ctx.nomeArquivo)) return 70;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const r = await importarExecucaoOrcamentaria(buffer, ctx.nomeArquivo);
    return {
      registros: r.receitasGravadas + r.dotacoesGravadas + r.empenhosGravados,
      resumo:
        `Execução orçamentária ${r.ano} (${r.orgao}) importada: ` +
        `${r.receitasGravadas} receitas, ${r.dotacoesGravadas} dotações e ` +
        `${r.empenhosGravados} lançamentos. ${r.alertasGerados} alertas recalculados.`,
      alertasGerados: r.alertasGerados,
      avisos: r.avisos,
      dados: { ...r },
    };
  },
};

import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { execucaoOrcamentariaImporter } from "./execucaoOrcamentaria";
import { produtosImporter } from "./produtos";
import { relacaoNafImporter } from "./relacaoNaf";
import { comprasDiretasImporter } from "./comprasDiretas";
import { demoDespesaImporter } from "./demoDespesa";
import { balanceteSicomImporter } from "./balanceteSicom";
import { amSicomImporter } from "./amSicom";
import { remessaGenericaImporter } from "./remessaGenerica";
import { csvGenericoImporter } from "./csvGenerico";

// =====================================================================
// REGISTRY de importadores.
// Para adicionar um novo formato: importe seu Importer e inclua na lista.
// =====================================================================

export const IMPORTADORES: Importer[] = [
  execucaoOrcamentariaImporter,
  produtosImporter,
  // controleComprasImporter aposentado: o QRP-por-produto (sem fornecedor) foi
  // substituído pelo COMPRAS_LICITACAO (mais completo). Fonte única para evitar duplicidade.
  relacaoNafImporter,
  comprasDiretasImporter,
  demoDespesaImporter,
  balanceteSicomImporter,
  amSicomImporter, // remessa mensal AM: empenhos, receitas, liquidações, pagamentos
  // ↓ novos importadores especializados de remessa entram aqui (folha, obra…)
  remessaGenericaImporter, // ingestor genérico p/ qualquer outro módulo de remessa (.zip)
  csvGenericoImporter, // fallback genérico — manter por último
];

/** Catálogo enxuto para a interface (sem as funções). */
export function listarImportadores() {
  return IMPORTADORES.map(({ id, nome, descricao, formatos }) => ({
    id,
    nome,
    descricao,
    formatos,
  }));
}

/** Extensões aceitas no input de upload (união de todos os importadores). */
export function extensoesAceitas(): string[] {
  return [...new Set(IMPORTADORES.flatMap((i) => i.formatos))];
}

export interface DispatchResult extends ImportResult {
  importador: string;
  nomeImportador: string;
}

/**
 * Detecta o importador adequado e executa a importação.
 * @param tipoHint id de importador escolhido manualmente (opcional).
 */
export async function dispatchImport(
  buffer: Buffer,
  args: { nomeArquivo: string; tipoHint?: string }
): Promise<DispatchResult> {
  const extensao = (args.nomeArquivo.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
  const ctx: DetectContext = {
    nomeArquivo: args.nomeArquivo,
    extensao,
    tipoHint: args.tipoHint || undefined,
  };

  if (extensao === ".xlsx" || extensao === ".xls") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    ctx.workbook = wb;
    ctx.sheetNames = wb.SheetNames;
  } else {
    ctx.textoCsv = buffer.toString("utf8");
  }

  // Se o usuário forçou um importador, respeita (desde que ele aceite > 0).
  let escolhido: Importer | null = null;
  let melhorScore = 0;
  for (const imp of IMPORTADORES) {
    const score = imp.detectar(ctx);
    if (score > melhorScore) {
      melhorScore = score;
      escolhido = imp;
    }
  }

  if (!escolhido || melhorScore <= 0) {
    throw new Error(
      "Nenhum importador reconheceu este arquivo. Verifique o formato ou escolha o tipo manualmente."
    );
  }

  const resultado = await escolhido.importar(buffer, ctx);
  return {
    importador: escolhido.id,
    nomeImportador: escolhido.nome,
    ...resultado,
  };
}

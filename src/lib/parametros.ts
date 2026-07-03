import { db } from "./db";

// Parâmetros configuráveis (Seção 15). Valores-padrão usados quando o órgão
// ainda não configurou. O motor de alertas e o consultor leem daqui.

export const PARAMETROS_PADRAO = {
  // Prazos (dias) para alertar contrato vencendo — gera um alerta por faixa.
  contrato_alerta_dias: "60,30,15",
  // Estoque mínimo: alerta quando abaixo de X% do consumo médio mensal.
  estoque_alerta_percentual: "20",
  // Concentração de fornecedor: alerta acima de X% dos pagamentos da secretaria.
  fornecedor_concentracao_percentual: "30",
  // Preço fora da média: alerta quando X% acima da média histórica.
  preco_variacao_percentual: "25",
  // Consumo de combustível: alerta quando X% acima da média da frota.
  veiculo_consumo_percentual: "30",
  // Despesa liquidada não paga: alerta após X dias.
  despesa_nao_paga_dias: "30",
  // Crescimento de despesa por secretaria considerado atípico (%).
  despesa_crescimento_percentual: "25",
} as const;

export type ChaveParametro = keyof typeof PARAMETROS_PADRAO;

/** Lê todos os parâmetros mesclando os configurados com os padrões. */
export async function lerParametros(): Promise<Record<string, string>> {
  const registros = await db.parametro.findMany();
  const map: Record<string, string> = { ...PARAMETROS_PADRAO };
  for (const r of registros) map[r.chave] = r.valor;
  return map;
}

export function paramNumero(
  params: Record<string, string>,
  chave: ChaveParametro,
  padrao = 0
): number {
  const v = Number(params[chave] ?? PARAMETROS_PADRAO[chave]);
  return Number.isFinite(v) ? v : padrao;
}

export function paramLista(
  params: Record<string, string>,
  chave: ChaveParametro
): number[] {
  return (params[chave] ?? PARAMETROS_PADRAO[chave])
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

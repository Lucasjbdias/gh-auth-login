// Formatação em português do Brasil. Usado em todos os painéis.

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const num0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Formata valor monetário: 1234.5 -> "R$ 1.234,50" */
export function moeda(valor: number | null | undefined): string {
  return brl.format(valor ?? 0);
}

/** Formata valor monetário compacto para cards: 1250000 -> "R$ 1,25 mi" */
export function moedaCompacta(valor: number | null | undefined): string {
  const v = valor ?? 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${num.format(v / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${num.format(v / 1_000)} mil`;
  return brl.format(v);
}

/** Número com separador de milhar pt-BR. */
export function numero(valor: number | null | undefined, casas = 2): string {
  return (casas === 0 ? num0 : num).format(valor ?? 0);
}

/** Percentual: 0.42 (fração) -> "42,0%". Passe `fracao=false` se já vier 42. */
export function percentual(
  valor: number | null | undefined,
  fracao = true,
  casas = 1
): string {
  const v = (valor ?? 0) * (fracao ? 100 : 1);
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** Data curta: "23/06/2026". */
export function data(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

/** Mês por número: 1 -> "Janeiro". */
export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? "—";
}

/** Variação percentual entre dois valores; retorna fração (0.15 = +15%). */
export function variacao(atual: number, anterior: number): number {
  if (!anterior) return atual > 0 ? 1 : 0;
  return (atual - anterior) / anterior;
}

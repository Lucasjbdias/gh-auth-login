import { db } from "./db";

// =====================================================================
// COMPARATIVO ENTRE EXERCÍCIOS (união da execução para análise de desvios).
// Compara os dois exercícios mais recentes do órgão, em PERÍODO EQUIVALENTE
// (meses 1..mesCorte, onde mesCorte = último mês com execução no ano atual),
// para que o "desvio" reflita mudança real e não meses ainda não executados.
// =====================================================================

export interface LinhaDesvio {
  nome: string;
  atual: number;
  anterior: number;
  delta: number;
  varPct: number; // fração
}

export interface Comparativo {
  orgao: string;
  anoAtual: number;
  anoAnterior: number;
  mesCorte: number;
  receita: {
    atual: number;
    anterior: number;
    delta: number;
    varPct: number;
    mensal: { mes: number; anterior: number; atual: number }[];
    porOrigem: LinhaDesvio[];
  };
  despesa: {
    empAtual: number;
    empAnterior: number;
    varEmp: number;
    liqAtual: number;
    liqAnterior: number;
    pagoAtual: number;
    pagoAnterior: number;
    mensal: { mes: number; anterior: number; atual: number }[];
    porElemento: LinhaDesvio[];
    porUnidade: LinhaDesvio[];
  };
}

function varPct(atual: number, anterior: number): number {
  if (!anterior) return atual > 0 ? 1 : 0;
  return (atual - anterior) / anterior;
}

/** Junta dois mapas chave→valor em linhas de desvio, ordenadas por |delta|. */
function montarDesvios(
  mapAtual: Map<string, number>,
  mapAnterior: Map<string, number>,
  limite = 12
): LinhaDesvio[] {
  const chaves = new Set([...mapAtual.keys(), ...mapAnterior.keys()]);
  const linhas: LinhaDesvio[] = [];
  for (const nome of chaves) {
    const atual = mapAtual.get(nome) ?? 0;
    const anterior = mapAnterior.get(nome) ?? 0;
    if (atual === 0 && anterior === 0) continue;
    linhas.push({ nome, atual, anterior, delta: atual - anterior, varPct: varPct(atual, anterior) });
  }
  return linhas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limite);
}

export async function comparativoExercicios(): Promise<Comparativo | null> {
  const org =
    (await db.orgao.findUnique({ where: { id: "orgao-matozinhos" } })) ??
    (await db.orgao.findFirst());
  if (!org) return null;

  const exs = await db.exercicio.findMany({
    where: { orgaoId: org.id },
    orderBy: { ano: "desc" },
    take: 2,
  });
  if (exs.length < 2) return null;
  const [atual, anterior] = exs;

  const secretarias = await db.secretaria.findMany({ where: { orgaoId: org.id } });
  const nomeSec = new Map(secretarias.map((s) => [s.id, s.nome]));

  const [empA, empB, recA, recB] = await Promise.all([
    db.empenho.findMany({ where: { exercicioId: atual.id } }),
    db.empenho.findMany({ where: { exercicioId: anterior.id } }),
    db.receita.findMany({ where: { exercicioId: atual.id } }),
    db.receita.findMany({ where: { exercicioId: anterior.id } }),
  ]);

  // Mês de corte = último mês com atividade RELEVANTE de empenho no ano atual
  // (≥10% do mês de pico). Evita que lançamentos esparsos de meses futuros
  // (ex.: provisões em dezembro) façam o corte ir até o fim do ano e
  // distorçam a comparação (parcial × ano cheio).
  const mensalEmpAtual = Array<number>(12).fill(0);
  for (const e of empA) if (e.mes >= 1 && e.mes <= 12) mensalEmpAtual[e.mes - 1] += e.valorEmpenhado;
  const pico = Math.max(0, ...mensalEmpAtual);
  let mesCorte = 1;
  for (let m = 1; m <= 12; m++) if (mensalEmpAtual[m - 1] >= 0.1 * pico) mesCorte = m;
  const noCorte = (mes: number) => mes >= 1 && mes <= mesCorte;

  // ---------- RECEITA ----------
  const recAtual = recA.filter((r) => noCorte(r.mes)).reduce((s, r) => s + r.valorArrecadado, 0);
  const recAnterior = recB.filter((r) => noCorte(r.mes)).reduce((s, r) => s + r.valorArrecadado, 0);

  const mensalReceita = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, anterior: 0, atual: 0 }));
  for (const r of recA) mensalReceita[r.mes - 1] && (mensalReceita[r.mes - 1].atual += r.valorArrecadado);
  for (const r of recB) mensalReceita[r.mes - 1] && (mensalReceita[r.mes - 1].anterior += r.valorArrecadado);

  const origemA = new Map<string, number>();
  const origemB = new Map<string, number>();
  for (const r of recA) if (noCorte(r.mes)) origemA.set(r.origem ?? "—", (origemA.get(r.origem ?? "—") ?? 0) + r.valorArrecadado);
  for (const r of recB) if (noCorte(r.mes)) origemB.set(r.origem ?? "—", (origemB.get(r.origem ?? "—") ?? 0) + r.valorArrecadado);

  // ---------- DESPESA ----------
  const sumEmp = (arr: typeof empA, f: (e: (typeof empA)[number]) => number) =>
    arr.filter((e) => noCorte(e.mes)).reduce((s, e) => s + f(e), 0);

  const mensalDespesa = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, anterior: 0, atual: 0 }));
  for (const e of empA) mensalDespesa[e.mes - 1] && (mensalDespesa[e.mes - 1].atual += e.valorEmpenhado);
  for (const e of empB) mensalDespesa[e.mes - 1] && (mensalDespesa[e.mes - 1].anterior += e.valorEmpenhado);

  const elemA = new Map<string, number>();
  const elemB = new Map<string, number>();
  for (const e of empA) if (noCorte(e.mes)) elemA.set(e.elemento ?? "—", (elemA.get(e.elemento ?? "—") ?? 0) + e.valorEmpenhado);
  for (const e of empB) if (noCorte(e.mes)) elemB.set(e.elemento ?? "—", (elemB.get(e.elemento ?? "—") ?? 0) + e.valorEmpenhado);

  const uoA = new Map<string, number>();
  const uoB = new Map<string, number>();
  for (const e of empA) if (noCorte(e.mes)) { const k = nomeSec.get(e.secretariaId ?? "") ?? "Sem unidade"; uoA.set(k, (uoA.get(k) ?? 0) + e.valorEmpenhado); }
  for (const e of empB) if (noCorte(e.mes)) { const k = nomeSec.get(e.secretariaId ?? "") ?? "Sem unidade"; uoB.set(k, (uoB.get(k) ?? 0) + e.valorEmpenhado); }

  const empAtual = sumEmp(empA, (e) => e.valorEmpenhado);
  const empAnterior = sumEmp(empB, (e) => e.valorEmpenhado);

  return {
    orgao: org.nome,
    anoAtual: atual.ano,
    anoAnterior: anterior.ano,
    mesCorte,
    receita: {
      atual: recAtual,
      anterior: recAnterior,
      delta: recAtual - recAnterior,
      varPct: varPct(recAtual, recAnterior),
      mensal: mensalReceita,
      porOrigem: montarDesvios(origemA, origemB),
    },
    despesa: {
      empAtual,
      empAnterior,
      varEmp: varPct(empAtual, empAnterior),
      liqAtual: sumEmp(empA, (e) => e.valorLiquidado),
      liqAnterior: sumEmp(empB, (e) => e.valorLiquidado),
      pagoAtual: sumEmp(empA, (e) => e.valorPago),
      pagoAnterior: sumEmp(empB, (e) => e.valorPago),
      mensal: mensalDespesa,
      porElemento: montarDesvios(elemA, elemB),
      porUnidade: montarDesvios(uoA, uoB),
    },
  };
}

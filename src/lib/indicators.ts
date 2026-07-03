import { db } from "./db";

// =====================================================================
// MOTOR DE INDICADORES (Camada 5)
// Funções de consulta reutilizadas por todos os painéis (Camada 7).
// Todas recebem o exercicioId para escopar ao exercício financeiro.
// =====================================================================

/** Retorna o exercício aberto mais recente (usado como padrão nos painéis). */
export async function exercicioAtual() {
  return db.exercicio.findFirst({
    where: { aberto: true },
    orderBy: { ano: "desc" },
    include: { orgao: true },
  });
}

// ---------------------- RECEITAS ----------------------

export async function resumoReceitas(exercicioId: string) {
  const receitas = await db.receita.findMany({ where: { exercicioId } });
  const previsto = soma(receitas, (r) => r.valorPrevisto);
  const arrecadado = soma(receitas, (r) => r.valorArrecadado);
  const propria = soma(
    receitas.filter((r) => r.receitaPropria),
    (r) => r.valorArrecadado
  );
  const transferencias = arrecadado - propria;
  return {
    previsto,
    arrecadado,
    propria,
    transferencias,
    realizacao: previsto ? arrecadado / previsto : 0,
  };
}

/** Arrecadação x previsão por mês. */
export async function receitaMensal(exercicioId: string) {
  const receitas = await db.receita.findMany({ where: { exercicioId } });
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    previsto: 0,
    arrecadado: 0,
  }));
  for (const r of receitas) {
    const m = meses[r.mes - 1];
    if (m) {
      m.previsto += r.valorPrevisto;
      m.arrecadado += r.valorArrecadado;
    }
  }
  return meses;
}

/** Receita agrupada por origem/espécie (ISS, IPTU, etc.). */
export async function receitaPorOrigem(exercicioId: string) {
  const receitas = await db.receita.findMany({ where: { exercicioId } });
  return agrupar(
    receitas,
    (r) => r.origem ?? "Não classificada",
    (r) => r.valorArrecadado
  );
}

// ---------------------- DESPESAS ----------------------

export async function resumoDespesas(exercicioId: string) {
  const dotacoes = await db.dotacaoOrcamentaria.findMany({ where: { exercicioId } });
  const fixado = soma(dotacoes, (d) => d.valorFixado);

  const empenhos = await db.empenho.findMany({ where: { exercicioId } });
  const empenhado = soma(empenhos, (e) => e.valorEmpenhado);
  const liquidado = soma(empenhos, (e) => e.valorLiquidado);
  const pago = soma(empenhos, (e) => e.valorPago);

  return {
    fixado,
    empenhado,
    liquidado,
    pago,
    saldo: fixado - empenhado,
    execucao: fixado ? empenhado / fixado : 0,
  };
}

export async function despesaMensal(exercicioId: string) {
  const empenhos = await db.empenho.findMany({ where: { exercicioId } });
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    empenhado: 0,
    liquidado: 0,
    pago: 0,
  }));
  for (const e of empenhos) {
    const m = meses[e.mes - 1];
    if (m) {
      m.empenhado += e.valorEmpenhado;
      m.liquidado += e.valorLiquidado;
      m.pago += e.valorPago;
    }
  }
  return meses;
}

/** Despesa empenhada agrupada por secretaria. */
export async function despesaPorSecretaria(exercicioId: string) {
  const empenhos = await db.empenho.findMany({
    where: { exercicioId },
    include: { secretaria: true },
  });
  return agrupar(
    empenhos,
    (e) => e.secretaria?.nome ?? "Sem secretaria",
    (e) => e.valorEmpenhado
  );
}

/** Despesa paga agrupada por fornecedor (ranking). */
export async function despesaPorFornecedor(exercicioId: string, limite = 10) {
  const empenhos = await db.empenho.findMany({
    where: { exercicioId },
    include: { fornecedor: true },
  });
  return agrupar(
    empenhos,
    (e) => e.fornecedor?.nome ?? "Sem fornecedor",
    (e) => e.valorPago
  ).slice(0, limite);
}

export async function despesaPorElemento(exercicioId: string) {
  const empenhos = await db.empenho.findMany({ where: { exercicioId } });
  return agrupar(
    empenhos,
    (e) => e.elemento ?? "Não classificado",
    (e) => e.valorEmpenhado
  );
}

/** Despesa empenhada agrupada por função de governo (nome). */
export async function despesaPorFuncao(exercicioId: string) {
  const empenhos = await db.empenho.findMany({ where: { exercicioId } });
  return agrupar(
    empenhos,
    (e) => (e.funcao ?? "Não classificada").replace(/^Função\s*$/, "Não classificada"),
    (e) => e.valorEmpenhado
  );
}

// ---------------------- COMPRAS / CONTRATOS ----------------------

export async function contratosVencendo(exercicioId: string, dias = 60) {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return db.contrato.findMany({
    where: {
      exercicioId,
      situacao: "VIGENTE",
      dataFim: { lte: limite },
    },
    include: { fornecedor: true, secretaria: true },
    orderBy: { dataFim: "asc" },
  });
}

export async function resumoCompras(exercicioId: string) {
  const licitacoes = await db.licitacao.findMany({ where: { exercicioId } });
  const contratos = await db.contrato.findMany({ where: { exercicioId } });
  const hoje = new Date();
  return {
    totalLicitacoes: licitacoes.length,
    emAndamento: licitacoes.filter((l) => l.situacao === "EM_ANDAMENTO").length,
    comprasDiretas: licitacoes.filter((l) => l.compraDireta).length,
    valorContratado: soma(licitacoes, (l) => l.valorContratado),
    contratosVigentes: contratos.filter((c) => c.situacao === "VIGENTE").length,
    contratosVencidos: contratos.filter(
      (c) => c.situacao === "VIGENTE" && c.dataFim && c.dataFim < hoje
    ).length,
  };
}

// ---------------------- ALMOXARIFADO ----------------------

export async function resumoEstoque() {
  // Leve: count + soma via SQL (evita carregar dezenas de milhares de produtos).
  const totalProdutos = await db.produto.count();
  const raw = await db.$queryRawUnsafe<{ v: number }[]>(
    "SELECT COALESCE(SUM(estoqueAtual*custoMedio),0) AS v FROM Produto"
  );
  const valorTotal = Number(raw[0]?.v ?? 0);
  // Produtos com estoque mínimo definido são poucos; filtramos o crítico em memória.
  const comMinimo = await db.produto.findMany({ where: { estoqueMinimo: { gt: 0 } } });
  const criticos = comMinimo.filter((p) => p.estoqueAtual <= p.estoqueMinimo);
  return {
    totalProdutos,
    valorTotal,
    produtosCriticos: criticos.length,
    criticos,
  };
}

// ---------------------- FROTA ----------------------

export async function resumoFrota(exercicioId?: string) {
  const veiculos = await db.veiculo.findMany();
  const abastecimentos = await db.abastecimento.findMany();
  const manutencoes = await db.manutencao.findMany();
  const gastoCombustivel = soma(abastecimentos, (a) => a.valorTotal);
  const gastoManutencao = soma(manutencoes, (m) => m.valor);
  return {
    total: veiculos.length,
    ativos: veiculos.filter((v) => v.situacao === "ATIVO").length,
    parados: veiculos.filter((v) => v.situacao === "PARADO").length,
    gastoCombustivel,
    gastoManutencao,
    custoTotal: gastoCombustivel + gastoManutencao,
  };
}

/** Custo total (combustível + manutenção) por veículo, ranking. */
export async function custoPorVeiculo(limite = 10) {
  const veiculos = await db.veiculo.findMany({
    include: { abastecimentos: true, manutencoes: true, secretaria: true },
  });
  return veiculos
    .map((v) => {
      const comb = soma(v.abastecimentos, (a) => a.valorTotal);
      const manut = soma(v.manutencoes, (m) => m.valor);
      const litros = soma(v.abastecimentos, (a) => a.litros);
      return {
        id: v.id,
        placa: v.placa,
        modelo: v.modelo,
        secretaria: v.secretaria?.nome ?? "—",
        combustivel: comb,
        manutencao: manut,
        custoTotal: comb + manut,
        litros,
      };
    })
    .sort((a, b) => b.custoTotal - a.custoTotal)
    .slice(0, limite);
}

// ---------------------- FORNECEDORES ----------------------

export async function rankingFornecedores(exercicioId: string, limite = 10) {
  const empenhos = await db.empenho.findMany({
    where: { exercicioId },
    include: { fornecedor: true },
  });
  return agrupar(
    empenhos,
    (e) => e.fornecedor?.nome ?? "Sem fornecedor",
    (e) => e.valorPago
  ).slice(0, limite);
}

// ---------------------- CONTROLE ----------------------

export async function resumoAlertas() {
  const alertas = await db.alerta.findMany();
  const ativos = alertas.filter(
    (a) => !["RESOLVIDO", "ARQUIVADO", "JUSTIFICADO"].includes(a.status)
  );
  return {
    total: alertas.length,
    criticos: ativos.filter((a) => a.gravidade === "VERMELHO").length,
    laranja: ativos.filter((a) => a.gravidade === "LARANJA").length,
    amarelo: ativos.filter((a) => a.gravidade === "AMARELO").length,
    pendentes: ativos.length,
    resolvidos: alertas.filter((a) => a.status === "RESOLVIDO").length,
  };
}

// =====================================================================
// Utilitários internos
// =====================================================================

function soma<T>(itens: T[], fn: (t: T) => number): number {
  return itens.reduce((acc, t) => acc + (fn(t) || 0), 0);
}

/** Agrupa por chave, soma o valor e retorna ordenado desc. */
function agrupar<T>(
  itens: T[],
  chave: (t: T) => string,
  valor: (t: T) => number
): { nome: string; valor: number }[] {
  const map = new Map<string, number>();
  for (const it of itens) {
    const k = chave(it);
    map.set(k, (map.get(k) ?? 0) + (valor(it) || 0));
  }
  return [...map.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

import { db } from "./db";
import { lerParametros, paramNumero, paramLista } from "./parametros";

// =====================================================================
// MOTOR DE ALERTAS (Camada 6 / Fluxo 8)
// Aplica as regras de validação (Camada 4) e parâmetros configuráveis
// (Seção 15), gerando alertas classificados em VERDE/AMARELO/LARANJA/VERMELHO.
//
// `gerarAlertas(exercicioId)` recalcula os alertas automáticos. É idempotente:
// remove os alertas automáticos anteriores ainda NOVOS antes de recriar, mas
// preserva os que já receberam providência/justificativa do gestor.
// =====================================================================

type Gravidade = "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO";

interface AlertaNovo {
  tipo: string;
  gravidade: Gravidade;
  titulo: string;
  descricao: string;
  recomendacao?: string;
  valorEnvolvido?: number;
  secretariaId?: string | null;
  entidadeOrigem?: string;
  entidadeOrigemId?: string;
  prazoSugerido?: Date | null;
}

export async function gerarAlertas(exercicioId: string) {
  const params = await lerParametros();
  const novos: AlertaNovo[] = [];

  novos.push(...(await regraContratosVencendo(exercicioId, params)));
  novos.push(...(await regraContratoVencidoComPagamento(exercicioId)));
  novos.push(...(await regraConcentracaoFornecedor(exercicioId, params)));
  novos.push(...(await regraPrecoForaMedia(exercicioId, params)));
  novos.push(...(await regraEstoqueBaixo(params)));
  novos.push(...(await regraConsumoFrota(params)));
  novos.push(...(await regraAbastecimentoIncompativel()));
  novos.push(...(await regraDespesaNaoPaga(exercicioId, params)));
  novos.push(...(await regraInconsistenciaExecucao(exercicioId)));
  novos.push(...(await regraDadosIncompletos()));

  // Limpa apenas alertas automáticos ainda NOVOS (preserva os tratados).
  await db.alerta.deleteMany({ where: { status: "NOVO", codigo: { startsWith: "AUTO-" } } });

  let seq = await proximaSequencia();
  for (const a of novos) {
    await db.alerta.create({
      data: {
        codigo: `AUTO-${String(seq++).padStart(5, "0")}`,
        tipo: a.tipo,
        gravidade: a.gravidade,
        titulo: a.titulo,
        descricao: a.descricao,
        recomendacao: a.recomendacao,
        valorEnvolvido: a.valorEnvolvido,
        secretariaId: a.secretariaId ?? null,
        entidadeOrigem: a.entidadeOrigem,
        entidadeOrigemId: a.entidadeOrigemId,
        prazoSugerido: a.prazoSugerido ?? null,
        status: "NOVO",
      },
    });
  }
  return novos.length;
}

async function proximaSequencia() {
  return (await db.alerta.count()) + 1;
}

// ----------------------- REGRAS -----------------------

/** Contrato vencendo nas faixas configuradas (ex.: 60/30/15 dias). */
async function regraContratosVencendo(exercicioId: string, params: Record<string, string>) {
  const faixas = paramLista(params, "contrato_alerta_dias").sort((a, b) => b - a);
  const maxDias = faixas[0] ?? 60;
  const limite = new Date();
  limite.setDate(limite.getDate() + maxDias);
  const hoje = new Date();

  const contratos = await db.contrato.findMany({
    where: { exercicioId, situacao: "VIGENTE", dataFim: { lte: limite, gte: hoje } },
    include: { fornecedor: true },
  });

  return contratos.map<AlertaNovo>((c) => {
    const dias = Math.ceil((c.dataFim!.getTime() - hoje.getTime()) / 86_400_000);
    const grav: Gravidade = dias <= 15 ? "LARANJA" : dias <= 30 ? "AMARELO" : "AMARELO";
    return {
      tipo: "CONTRATO_VENCENDO",
      gravidade: grav,
      titulo: `Contrato nº ${c.numero} vence em ${dias} dias`,
      descricao: `O contrato nº ${c.numero} (${c.fornecedor?.nome ?? "fornecedor não informado"}) vence em ${dias} dias. Antecipar a análise evita interrupção do serviço.`,
      recomendacao: "Iniciar análise de renovação ou nova contratação.",
      valorEnvolvido: c.valorAtualizado || c.valorInicial,
      secretariaId: c.secretariaId,
      entidadeOrigem: "Contrato",
      entidadeOrigemId: c.id,
      prazoSugerido: c.dataFim,
    };
  });
}

/** Pagamento vinculado a contrato vencido (crítico). */
async function regraContratoVencidoComPagamento(exercicioId: string) {
  const hoje = new Date();
  const contratos = await db.contrato.findMany({
    where: { exercicioId, dataFim: { lt: hoje } },
    include: { empenhos: true, fornecedor: true },
  });
  const out: AlertaNovo[] = [];
  for (const c of contratos) {
    const pagosAposFim = c.empenhos.filter(
      (e) => e.dataPagamento && c.dataFim && e.dataPagamento > c.dataFim
    );
    if (pagosAposFim.length) {
      const valor = pagosAposFim.reduce((s, e) => s + e.valorPago, 0);
      out.push({
        tipo: "PAGAMENTO_CONTRATO_VENCIDO",
        gravidade: "VERMELHO",
        titulo: `Pagamento em contrato vencido — nº ${c.numero}`,
        descricao: `Há pagamentos registrados após o fim da vigência do contrato nº ${c.numero}. Isso exige justificativa formal.`,
        recomendacao: "Verificar a regularidade dos pagamentos e encaminhar ao controle interno.",
        valorEnvolvido: valor,
        secretariaId: c.secretariaId,
        entidadeOrigem: "Contrato",
        entidadeOrigemId: c.id,
      });
    }
  }
  return out;
}

/** Concentração de fornecedor acima do limite por secretaria. */
async function regraConcentracaoFornecedor(exercicioId: string, params: Record<string, string>) {
  const limite = paramNumero(params, "fornecedor_concentracao_percentual", 30) / 100;
  const empenhos = await db.empenho.findMany({
    where: { exercicioId },
    include: { fornecedor: true, secretaria: true },
  });

  // total por secretaria e por (secretaria, fornecedor)
  const totalSec = new Map<string, number>();
  const totalSecForn = new Map<string, { valor: number; forn: string; secId: string | null; secNome: string }>();
  for (const e of empenhos) {
    if (!e.secretariaId || !e.fornecedorId) continue; // sem fornecedor não há concentração
    totalSec.set(e.secretariaId, (totalSec.get(e.secretariaId) ?? 0) + e.valorPago);
    const key = `${e.secretariaId}::${e.fornecedorId}`;
    const cur = totalSecForn.get(key) ?? {
      valor: 0,
      forn: e.fornecedor?.nome ?? "—",
      secId: e.secretariaId,
      secNome: e.secretaria?.nome ?? "—",
    };
    cur.valor += e.valorPago;
    totalSecForn.set(key, cur);
  }

  const out: AlertaNovo[] = [];
  for (const { valor, forn, secId, secNome } of totalSecForn.values()) {
    const tot = totalSec.get(secId!) ?? 0;
    if (tot > 0 && valor / tot >= limite) {
      const pct = Math.round((valor / tot) * 100);
      out.push({
        tipo: "CONCENTRACAO_FORNECEDOR",
        gravidade: pct >= 50 ? "LARANJA" : "AMARELO",
        titulo: `${forn} concentra ${pct}% dos pagamentos de ${secNome}`,
        descricao: `Este fornecedor recebeu uma parte muito alta dos pagamentos da secretaria. Vale revisar os contratos e processos vinculados.`,
        recomendacao: "Revisar contratos e avaliar diversificação de fornecedores.",
        valorEnvolvido: valor,
        secretariaId: secId,
        entidadeOrigem: "Secretaria",
        entidadeOrigemId: secId ?? undefined,
      });
    }
  }
  return out;
}

/** Item comprado com preço acima da média histórica do produto. */
async function regraPrecoForaMedia(_exercicioId: string, params: Record<string, string>) {
  const limite = paramNumero(params, "preco_variacao_percentual", 25) / 100;
  // Leve: parte dos itens comprados (poucos milhares), não dos ~40k produtos.
  const itens = await db.itemComprado.findMany({
    where: { produtoId: { not: null }, valorUnitario: { gt: 0 } },
    select: { produtoId: true, valorUnitario: true },
  });
  const porProduto = new Map<string, number[]>();
  for (const it of itens) {
    const arr = porProduto.get(it.produtoId!) ?? [];
    arr.push(it.valorUnitario);
    porProduto.set(it.produtoId!, arr);
  }
  const candidatos: { produtoId: string; pct: number; max: number }[] = [];
  for (const [produtoId, precos] of porProduto) {
    if (precos.length < 2) continue;
    const media = precos.reduce((a, b) => a + b, 0) / precos.length;
    const max = Math.max(...precos);
    if (media > 0 && (max - media) / media >= limite) {
      candidatos.push({ produtoId, pct: Math.round(((max - media) / media) * 100), max });
    }
  }
  const top = candidatos.sort((a, b) => b.pct - a.pct).slice(0, 20);
  if (!top.length) return [];
  const prods = await db.produto.findMany({
    where: { id: { in: top.map((t) => t.produtoId) } },
    select: { id: true, descricao: true },
  });
  const nome = new Map(prods.map((p) => [p.id, p.descricao]));
  return top.map<AlertaNovo>((t) => ({
    tipo: "PRECO_FORA_MEDIA",
    gravidade: t.pct >= 40 ? "VERMELHO" : "LARANJA",
    titulo: `${nome.get(t.produtoId) ?? "Produto"}: preço ${t.pct}% acima da média`,
    descricao: `O produto "${nome.get(t.produtoId) ?? ""}" teve compra com preço ${t.pct}% acima da média histórica. Verifique se houve fato que justifique o aumento.`,
    recomendacao: "Comparar com preços de referência e revisar o processo de compra.",
    valorEnvolvido: t.max,
    entidadeOrigem: "Produto",
    entidadeOrigemId: t.produtoId,
  }));
}

/** Estoque abaixo do mínimo. */
async function regraEstoqueBaixo(_params: Record<string, string>) {
  const produtos = await db.produto.findMany();
  return produtos
    .filter((p) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo)
    .map<AlertaNovo>((p) => ({
      tipo: "ESTOQUE_BAIXO",
      gravidade: p.estoqueAtual <= 0 ? "VERMELHO" : "AMARELO",
      titulo: `Estoque baixo: ${p.descricao}`,
      descricao: `O produto "${p.descricao}" está com estoque de ${p.estoqueAtual} ${p.unidadeMedida ?? ""}, abaixo do mínimo de ${p.estoqueMinimo}.`,
      recomendacao: "Programar reposição do material.",
      entidadeOrigem: "Produto",
      entidadeOrigemId: p.id,
    }));
}

/** Veículo com consumo (km/l) muito abaixo da média da frota = gasto fora do padrão. */
async function regraConsumoFrota(params: Record<string, string>) {
  const limite = paramNumero(params, "veiculo_consumo_percentual", 30) / 100;
  const veiculos = await db.veiculo.findMany({ include: { abastecimentos: true } });

  const consumos = veiculos
    .map((v) => {
      const litros = v.abastecimentos.reduce((s, a) => s + a.litros, 0);
      const kms = v.abastecimentos
        .map((a) => a.quilometragem ?? 0)
        .filter((k) => k > 0);
      const distancia = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) : 0;
      const kmPorLitro = litros > 0 && distancia > 0 ? distancia / litros : null;
      const custo = v.abastecimentos.reduce((s, a) => s + a.valorTotal, 0);
      return { v, kmPorLitro, custo };
    })
    .filter((c) => c.kmPorLitro !== null);

  if (!consumos.length) return [];
  const media = consumos.reduce((s, c) => s + (c.kmPorLitro ?? 0), 0) / consumos.length;

  const out: AlertaNovo[] = [];
  for (const c of consumos) {
    // consumo pior que a média além do limite (rende menos km por litro)
    if (media > 0 && (media - (c.kmPorLitro ?? 0)) / media >= limite) {
      out.push({
        tipo: "CONSUMO_VEICULO",
        gravidade: "LARANJA",
        titulo: `Veículo ${c.v.placa} com consumo fora do padrão`,
        descricao: `O veículo placa ${c.v.placa} apresentou rendimento ${Math.round(((media - (c.kmPorLitro ?? 0)) / media) * 100)}% abaixo da média da frota. Verifique manutenção ou registros de abastecimento.`,
        recomendacao: "Inspecionar o veículo e validar os registros de quilometragem.",
        valorEnvolvido: c.custo,
        secretariaId: c.v.secretariaId,
        entidadeOrigem: "Veiculo",
        entidadeOrigemId: c.v.id,
      });
    }
  }
  return out;
}

/** Abastecimento com volume maior que a capacidade do tanque. */
async function regraAbastecimentoIncompativel() {
  const veiculos = await db.veiculo.findMany({
    where: { capacidadeTanque: { gt: 0 } },
    include: { abastecimentos: true },
  });
  const out: AlertaNovo[] = [];
  for (const v of veiculos) {
    for (const a of v.abastecimentos) {
      if (v.capacidadeTanque && a.litros > v.capacidadeTanque * 1.05) {
        out.push({
          tipo: "ABASTECIMENTO_INCOMPATIVEL",
          gravidade: "VERMELHO",
          titulo: `Abastecimento incompatível — ${v.placa}`,
          descricao: `Abastecimento de ${a.litros} L no veículo ${v.placa}, acima da capacidade do tanque (${v.capacidadeTanque} L).`,
          recomendacao: "Conferir a nota e o registro do abastecimento.",
          valorEnvolvido: a.valorTotal,
          secretariaId: v.secretariaId,
          entidadeOrigem: "Abastecimento",
          entidadeOrigemId: a.id,
        });
      }
    }
  }
  return out;
}

/** Despesa liquidada e não paga há mais de X dias. */
async function regraDespesaNaoPaga(exercicioId: string, _params: Record<string, string>) {
  // Avaliado no nível da dotação (totais), evitando falsos positivos da
  // fragmentação mensal dos lançamentos. Só valores materiais; limitado aos maiores.
  const LIMIAR = 100_000;
  const dotacoes = await db.dotacaoOrcamentaria.findMany({ where: { exercicioId } });
  return dotacoes
    .map((d) => ({ d, naoPago: d.valorLiquidado - d.valorPago }))
    .filter((x) => x.naoPago > LIMIAR)
    .sort((a, b) => b.naoPago - a.naoPago)
    .slice(0, 30)
    .map<AlertaNovo>(({ d, naoPago }) => ({
      tipo: "DESPESA_NAO_PAGA",
      gravidade: "AMARELO",
      titulo: `Despesa liquidada e não paga — ${d.elemento ?? d.funcao ?? "dotação"}`,
      descricao: `Há R$ ${naoPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} liquidados e ainda não pagos nesta dotação (possível restos a pagar).`,
      recomendacao: "Verificar a programação financeira do pagamento.",
      valorEnvolvido: naoPago,
      secretariaId: d.secretariaId,
      entidadeOrigem: "DotacaoOrcamentaria",
      entidadeOrigemId: d.id,
    }));
}

/** Inconsistência: liquidado > empenhado ou pago > liquidado. */
async function regraInconsistenciaExecucao(exercicioId: string) {
  // Avaliado por dotação (totais do exercício): liquidado não pode exceder
  // empenhado, nem pago exceder liquidado. Limitado aos maiores desvios.
  const dotacoes = await db.dotacaoOrcamentaria.findMany({ where: { exercicioId } });
  return dotacoes
    .map((d) => ({
      d,
      exc: Math.max(d.valorLiquidado - d.valorEmpenhado, d.valorPago - d.valorLiquidado),
    }))
    .filter((x) => x.exc > 0.01)
    .sort((a, b) => b.exc - a.exc)
    .slice(0, 30)
    .map<AlertaNovo>(({ d, exc }) => ({
      tipo: "INCONSISTENCIA_EXECUCAO",
      gravidade: "VERMELHO",
      titulo: `Inconsistência na execução — ${d.elemento ?? d.funcao ?? "dotação"}`,
      descricao: `Nesta dotação (${[d.funcao, d.elemento].filter(Boolean).join(" / ")}) há valor liquidado ou pago acima da etapa anterior. Verifique os lançamentos.`,
      recomendacao: "Conferir empenho, liquidação e pagamento na contabilidade.",
      valorEnvolvido: exc,
      secretariaId: d.secretariaId,
      entidadeOrigem: "DotacaoOrcamentaria",
      entidadeOrigemId: d.id,
    }));
}

/** Cadastros incompletos (fornecedor sem documento). */
async function regraDadosIncompletos() {
  const fornecedores = await db.fornecedor.findMany({
    where: { OR: [{ documento: null }, { documento: "" }] },
    take: 15, // evita ruído quando há muitos cadastros incompletos
  });
  return fornecedores.map<AlertaNovo>((f) => ({
    tipo: "DADOS_INCOMPLETOS",
    gravidade: "AMARELO",
    titulo: `Fornecedor sem CNPJ/CPF: ${f.nome}`,
    descricao: `O fornecedor "${f.nome}" está sem documento cadastrado. Isso prejudica a rastreabilidade.`,
    recomendacao: "Completar o cadastro do fornecedor.",
    entidadeOrigem: "Fornecedor",
    entidadeOrigemId: f.id,
  }));
}

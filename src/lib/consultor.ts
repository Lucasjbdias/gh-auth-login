import { db } from "./db";
import {
  resumoDespesas,
  resumoReceitas,
  despesaPorSecretaria,
  rankingFornecedores,
  custoPorVeiculo,
  contratosVencendo,
  resumoEstoque,
} from "./indicators";
import { moeda, percentual, data as fmtData } from "./format";
import { responderComIA, iaDisponivel } from "./consultorIA";

// =====================================================================
// CONSULTOR DE GESTÃO (Módulo 10 / Seção 13)
// Versão 1: inteligência baseada em regras e correspondência de intenção.
// Cada resposta segue o formato da Seção 13:
//   resposta simples, indicador usado, fonte, período, alerta, recomendação, link.
// =====================================================================

export interface RespostaConsultor {
  resposta: string;
  indicador: string;
  fonte: string;
  periodo: string;
  alerta?: string;
  recomendacao?: string;
  link?: string;
}

interface Intencao {
  nome: string;
  palavras: string[][];
  responder: (exercicioId: string, periodo: string) => Promise<RespostaConsultor>;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const INTENCOES: Intencao[] = [
  {
    nome: "despesa_secretaria_maior",
    palavras: [["secretaria"], ["mais", "maior", "gast", "despesa", "consumo"]],
    responder: async (exId, periodo) => {
      const lista = await despesaPorSecretaria(exId);
      const total = lista.reduce((s, l) => s + l.valor, 0);
      const top = lista[0];
      const pct = total ? top.valor / total : 0;
      return {
        resposta: top
          ? `A ${top.nome} concentrou ${percentual(pct)} das despesas empenhadas (${moeda(top.valor)}).`
          : "Não há despesas registradas no período.",
        indicador: "Despesa empenhada por secretaria",
        fonte: "Empenhos importados",
        periodo,
        recomendacao: "Acompanhar a execução desta secretaria e verificar justificativas.",
        link: "/despesas",
      };
    },
  },
  {
    nome: "fornecedor_maior",
    palavras: [["fornecedor"], ["mais", "maior", "receb", "pag", "concentr"]],
    responder: async (exId, periodo) => {
      const lista = await rankingFornecedores(exId, 1);
      const top = lista[0];
      return {
        resposta: top
          ? `O fornecedor que mais recebeu foi ${top.nome}, com ${moeda(top.valor)} em pagamentos.`
          : "Não há pagamentos registrados.",
        indicador: "Total pago por fornecedor",
        fonte: "Empenhos/pagamentos importados",
        periodo,
        recomendacao: "Revisar contratos e processos vinculados a este fornecedor.",
        link: "/fornecedores",
      };
    },
  },
  {
    nome: "veiculo_combustivel",
    palavras: [["veiculo", "carro", "frota"], ["combustivel", "gast", "consum", "caro"]],
    responder: async (_exId, periodo) => {
      const lista = await custoPorVeiculo(1);
      const top = lista[0];
      return {
        resposta: top
          ? `O veículo de maior custo é o ${top.placa} (${top.modelo}), com ${moeda(top.custoTotal)} entre combustível e manutenção.`
          : "Não há veículos com custos registrados.",
        indicador: "Custo total por veículo",
        fonte: "Abastecimentos e manutenções",
        periodo,
        recomendacao: "Avaliar manutenção e uso do veículo.",
        link: "/veiculos",
      };
    },
  },
  {
    nome: "contratos_vencendo",
    palavras: [["contrato"], ["venc", "expir", "renov"]],
    responder: async (exId, periodo) => {
      const lista = await contratosVencendo(exId, 30);
      return {
        resposta: lista.length
          ? `Há ${lista.length} contrato(s) vencendo nos próximos 30 dias. O mais próximo é o nº ${lista[0].numero}, em ${fmtData(lista[0].dataFim)}.`
          : "Nenhum contrato vence nos próximos 30 dias.",
        indicador: "Contratos próximos do vencimento",
        fonte: "Cadastro de contratos",
        periodo,
        alerta: lista.length ? "Existem contratos próximos do vencimento." : undefined,
        recomendacao: "Iniciar análise de renovação ou nova contratação.",
        link: "/contratos",
      };
    },
  },
  {
    nome: "estoque_acabando",
    palavras: [["produto", "estoque", "material"], ["acab", "baix", "falt", "repor", "minimo"]],
    responder: async (_exId, periodo) => {
      const r = await resumoEstoque();
      return {
        resposta: r.produtosCriticos
          ? `Há ${r.produtosCriticos} produto(s) com estoque no nível crítico. Ex.: ${r.criticos.slice(0, 3).map((p) => p.descricao).join(", ")}.`
          : "Nenhum produto está abaixo do estoque mínimo.",
        indicador: "Produtos abaixo do estoque mínimo",
        fonte: "Movimentações do almoxarifado",
        periodo,
        alerta: r.produtosCriticos ? "Produtos abaixo do estoque mínimo." : undefined,
        recomendacao: "Programar a reposição dos materiais críticos.",
        link: "/almoxarifado",
      };
    },
  },
  {
    nome: "receita_situacao",
    palavras: [["receita", "arrecad"], []],
    responder: async (exId, periodo) => {
      const r = await resumoReceitas(exId);
      const abaixo = r.realizacao < 0.9;
      return {
        resposta: `A arrecadação é de ${moeda(r.arrecadado)}, equivalente a ${percentual(r.realizacao)} da previsão (${moeda(r.previsto)}).`,
        indicador: "Realização da receita (previsto x arrecadado)",
        fonte: "Receitas importadas",
        periodo,
        alerta: abaixo ? "Arrecadação abaixo do esperado para o período." : undefined,
        recomendacao: abaixo ? "Revisar previsão e acompanhar as fontes com queda." : undefined,
        link: "/receitas",
      };
    },
  },
  {
    nome: "despesa_situacao",
    palavras: [["despesa", "gast"], []],
    responder: async (exId, periodo) => {
      const r = await resumoDespesas(exId);
      return {
        resposta: `A despesa empenhada é de ${moeda(r.empenhado)} (${percentual(r.execucao)} do fixado). Liquidado: ${moeda(r.liquidado)}; pago: ${moeda(r.pago)}.`,
        indicador: "Execução da despesa (fixado x empenhado x liquidado x pago)",
        fonte: "Dotações e empenhos importados",
        periodo,
        link: "/despesas",
      };
    },
  },
];

/** Resposta para "o que devo acompanhar" / "existe alerta crítico". */
async function respostaAlertas(periodo: string): Promise<RespostaConsultor> {
  const criticos = await db.alerta.findMany({
    where: { gravidade: { in: ["VERMELHO", "LARANJA"] }, status: { notIn: ["RESOLVIDO", "ARQUIVADO", "JUSTIFICADO"] } },
    orderBy: { gravidade: "asc" },
    take: 5,
  });
  return {
    resposta: criticos.length
      ? `Há ${criticos.length} ponto(s) de atenção. Destaque: ${criticos[0].titulo}.`
      : "Não há alertas críticos no momento.",
    indicador: "Alertas críticos pendentes",
    fonte: "Motor de alertas",
    periodo,
    alerta: criticos.length ? "Existem alertas críticos pendentes." : undefined,
    recomendacao: "Abrir o painel de alertas e registrar providências.",
    link: "/alertas",
  };
}

export async function consultar(
  pergunta: string,
  exercicioId: string,
  periodoLabel: string
): Promise<RespostaConsultor> {
  const q = norm(pergunta);

  // Modo "sempre": com chave configurada, a IA responde tudo (fundamentada nos
  // indicadores). Configurável por CONSULTOR_IA_MODE; padrão é "fallback".
  if (iaDisponivel() && process.env.CONSULTOR_IA_MODE === "sempre") {
    const ia = await responderComIA(pergunta, exercicioId, periodoLabel);
    if (ia) return ia;
  }

  if (/(acompanhar|atencao|critic|alerta|risco)/.test(q)) {
    return respostaAlertas(periodoLabel);
  }

  let melhor: { intencao: Intencao; score: number } | null = null;
  for (const intencao of INTENCOES) {
    let score = 0;
    let obrigatoriasOk = true;
    for (const grupo of intencao.palavras) {
      if (grupo.length === 0) continue;
      const acerto = grupo.some((p) => q.includes(norm(p)));
      if (acerto) score++;
      else if (grupo === intencao.palavras[0]) obrigatoriasOk = false;
    }
    if (obrigatoriasOk && score > (melhor?.score ?? 0)) melhor = { intencao, score };
  }

  if (melhor) return melhor.intencao.responder(exercicioId, periodoLabel);

  // Nenhuma regra correspondeu: tenta a IA (se houver chave) para a cauda longa.
  const ia = await responderComIA(pergunta, exercicioId, periodoLabel);
  if (ia) return ia;

  return {
    resposta:
      "Não consegui identificar a pergunta. Tente algo como: \"Como está a despesa?\", \"Quais contratos vencem este mês?\" ou \"Qual veículo mais gastou combustível?\".",
    indicador: "—",
    fonte: "—",
    periodo: periodoLabel,
  };
}

// Reexporta as perguntas sugeridas (definidas em módulo client-safe).
export { PERGUNTAS_SUGERIDAS } from "./perguntas";

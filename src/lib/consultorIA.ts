import Anthropic from "@anthropic-ai/sdk";
import type { RespostaConsultor } from "./consultor";
import {
  resumoReceitas,
  resumoDespesas,
  despesaPorSecretaria,
  rankingFornecedores,
  contratosVencendo,
  resumoFrota,
  resumoEstoque,
  resumoAlertas,
  custoPorVeiculo,
} from "./indicators";
import { moeda, percentual } from "./format";

// =====================================================================
// CONSULTOR COM IA (preparação da Versão 2 — opcional).
//
// Usa a API da Anthropic para responder em linguagem natural, SEMPRE
// fundamentado nos indicadores reais do banco (passados no contexto).
// A chave é lida de ANTHROPIC_API_KEY — NUNCA fica embutida no código.
// Sem chave, `responderComIA` devolve null e o chamador usa o motor de regras.
// =====================================================================

const MODELO = process.env.CONSULTOR_MODEL ?? "claude-sonnet-4-6";

export function iaDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Monta um resumo compacto e fiel dos indicadores para fundamentar a IA. */
async function montarContexto(exercicioId: string): Promise<string> {
  const [rec, desp, porSec, forns, vencendo, frota, estoque, alertas, veic] =
    await Promise.all([
      resumoReceitas(exercicioId),
      resumoDespesas(exercicioId),
      despesaPorSecretaria(exercicioId),
      rankingFornecedores(exercicioId, 5),
      contratosVencendo(exercicioId, 30),
      resumoFrota(),
      resumoEstoque(),
      resumoAlertas(),
      custoPorVeiculo(5),
    ]);

  const totalSec = porSec.reduce((s, p) => s + p.valor, 0);
  const linhas: string[] = [];
  linhas.push("# RECEITAS");
  linhas.push(`Previsto: ${moeda(rec.previsto)}; Arrecadado: ${moeda(rec.arrecadado)} (${percentual(rec.realizacao)} da previsão); Própria: ${moeda(rec.propria)}; Transferências: ${moeda(rec.transferencias)}.`);
  linhas.push("# DESPESAS");
  linhas.push(`Fixado: ${moeda(desp.fixado)}; Empenhado: ${moeda(desp.empenhado)} (${percentual(desp.execucao)}); Liquidado: ${moeda(desp.liquidado)}; Pago: ${moeda(desp.pago)}; Saldo: ${moeda(desp.saldo)}.`);
  linhas.push("Despesa por secretaria: " + porSec.slice(0, 6).map((s) => `${s.nome} ${moeda(s.valor)} (${percentual(totalSec ? s.valor / totalSec : 0)})`).join("; ") + ".");
  linhas.push("# FORNECEDORES (top pagamentos)");
  linhas.push(forns.map((f) => `${f.nome}: ${moeda(f.valor)}`).join("; ") + ".");
  linhas.push("# CONTRATOS");
  linhas.push(`Vencendo em 30 dias: ${vencendo.length}.` + (vencendo[0] ? ` Mais próximo: nº ${vencendo[0].numero} em ${vencendo[0].dataFim?.toLocaleDateString("pt-BR")}.` : ""));
  linhas.push("# FROTA");
  linhas.push(`Veículos: ${frota.ativos} ativos de ${frota.total}; combustível ${moeda(frota.gastoCombustivel)}; manutenção ${moeda(frota.gastoManutencao)}; custo total ${moeda(frota.custoTotal)}.`);
  linhas.push("Veículos de maior custo: " + veic.map((v) => `${v.placa} (${moeda(v.custoTotal)})`).join("; ") + ".");
  linhas.push("# ALMOXARIFADO");
  linhas.push(`Produtos: ${estoque.totalProdutos}; críticos: ${estoque.produtosCriticos}; valor em estoque ${moeda(estoque.valorTotal)}.`);
  linhas.push("# ALERTAS");
  linhas.push(`Críticos: ${alertas.criticos}; risco médio: ${alertas.laranja}; atenção: ${alertas.amarelo}; pendentes: ${alertas.pendentes}.`);
  return linhas.join("\n");
}

const SYSTEM = `Você é o "Consultor de Gestão" do GesIA, um assistente para gestores públicos municipais (prefeitos, secretários, controle interno).
Responda SEMPRE em português do Brasil, com linguagem simples e acessível — evite jargão técnico-contábil.
Use EXCLUSIVAMENTE os dados fornecidos no contexto. Se a resposta não estiver nos dados, diga claramente que a informação não está disponível e sugira qual dado importar.
Nunca invente números. Você aponta, explica e sugere providências — não decide pelo gestor.
Responda APENAS com um objeto JSON válido (sem markdown, sem cercas de código) no formato:
{"resposta": string, "recomendacao": string, "alerta": string|null, "link": string|null}
Onde "link" pode ser uma das rotas: /receitas, /despesas, /compras, /contratos, /produtos, /almoxarifado, /veiculos, /fornecedores, /alertas (ou null).`;

export async function responderComIA(
  pergunta: string,
  exercicioId: string,
  periodoLabel: string
): Promise<RespostaConsultor | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const contexto = await montarContexto(exercicioId);
  const client = new Anthropic({ apiKey });

  try {
    const res = await client.messages.create({
      model: MODELO,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Período analisado: ${periodoLabel}\n\nDADOS DISPONÍVEIS:\n${contexto}\n\nPERGUNTA DO GESTOR:\n${pergunta}`,
        },
      ],
    });

    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = extrairJson(texto);
    if (!parsed) {
      // Se não veio JSON, usa o texto cru como resposta.
      return {
        resposta: texto || "Não foi possível gerar a resposta.",
        indicador: "Análise por IA sobre os indicadores internos",
        fonte: "Consultor IA (Anthropic) — dados internos do GesIA",
        periodo: periodoLabel,
      };
    }

    return {
      resposta: parsed.resposta ?? "",
      indicador: "Análise por IA sobre os indicadores internos",
      fonte: "Consultor IA (Anthropic) — dados internos do GesIA",
      periodo: periodoLabel,
      alerta: parsed.alerta ?? undefined,
      recomendacao: parsed.recomendacao ?? undefined,
      link: parsed.link ?? undefined,
    };
  } catch (err) {
    console.error("Falha no Consultor IA, usando motor de regras:", err);
    return null;
  }
}

interface RespostaIaJson {
  resposta?: string;
  recomendacao?: string;
  alerta?: string | null;
  link?: string | null;
}

function extrairJson(texto: string): RespostaIaJson | null {
  // Tenta o texto inteiro; se falhar, extrai o primeiro bloco {...}.
  const tentativas = [texto];
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) tentativas.push(m[0]);
  for (const t of tentativas) {
    try {
      return JSON.parse(t) as RespostaIaJson;
    } catch {
      // tenta a próxima
    }
  }
  return null;
}

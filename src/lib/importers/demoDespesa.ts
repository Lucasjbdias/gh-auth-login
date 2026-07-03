import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador do DEMONSTRATIVO DA DESPESA FIXADA (SICOM, texto hierárquico).
// Indentação fixa: 3 = órgão/unidade, 7 = função, 14 = elemento, 37 = fonte.
// Usa este demonstrativo para ENRIQUECER NOMES:
//  - unidades orçamentárias (código "01.01" → sigla "1.1") → nome real
//  - funções de governo (código "01" → "Legislativa") → relabela empenho.funcao
// Não recria dotações (o fixado já vem do EXEC_ORC).

function decode(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}
function siglaUO(cod: string): string {
  return cod.split(".").map((s) => String(parseInt(s, 10))).join(".");
}
function limparNome(rest: string): string {
  return rest.replace(/\s+[\d.]+,\d{2}\s*$/, "").trim();
}

export const demoDespesaImporter: Importer = {
  id: "DEMO_DESPESA",
  nome: "Demonstrativo da Despesa Fixada (SICOM)",
  descricao:
    "Demonstrativo hierárquico da despesa fixada. Completa os nomes das unidades orçamentárias e das funções de governo.",
  formatos: [".txt"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "DEMO_DESPESA") return 100;
    if (ctx.extensao !== ".txt") return 0;
    if (ctx.textoCsv && /DEMONSTRATIVO DA DESPESA/i.test(ctx.textoCsv)) return 95;
    if (/demodespesa|demonstrativo/i.test(ctx.nomeArquivo)) return 70;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const linhas = decode(buffer).replace(/\r/g, "").split("\n");

    const unidades = new Map<string, string>(); // sigla "1.1" -> nome
    const funcoes = new Map<number, string>(); // 1 -> "Legislativa"

    for (const ln of linhas) {
      const indent = ln.length - ln.trimStart().length;
      const t = ln.trimStart();
      const m = t.match(/^([\d.]+)\s+(.*)$/);
      if (!m) continue;
      const code = m[1];
      const nome = limparNome(m[2]);
      if (!nome) continue;

      if (indent <= 4) {
        if (/^\d{2}\.\d{2}$/.test(code)) unidades.set(siglaUO(code), nome);
      } else if (indent >= 5 && indent <= 10) {
        if (/^\d{2}$/.test(code)) funcoes.set(parseInt(code, 10), nome);
      }
    }

    const org =
      (await db.orgao.findUnique({ where: { id: "orgao-matozinhos" } })) ??
      (await db.orgao.findFirst());

    // ---- Enriquece nomes de unidades (secretarias U.O.) ----
    let uoRenomeadas = 0;
    if (org) {
      for (const [sigla, nome] of unidades) {
        const r = await db.secretaria.updateMany({ where: { orgaoId: org.id, sigla }, data: { nome } });
        uoRenomeadas += r.count;
      }
    }

    // ---- Relabela função nos empenhos ("Função 1" -> "Legislativa") ----
    let empAtualizados = 0;
    for (const [cod, nome] of funcoes) {
      const r = await db.empenho.updateMany({ where: { funcao: `Função ${cod}` }, data: { funcao: nome } });
      empAtualizados += r.count;
    }

    await db.importacao.create({
      data: {
        tipoDado: "DEMO_DESPESA",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação Demonstrativo",
        totalRegistros: unidades.size + funcoes.size,
        registrosOk: uoRenomeadas + empAtualizados,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ unidades: unidades.size, funcoes: funcoes.size, uoRenomeadas, empAtualizados }),
      },
    });

    return {
      registros: uoRenomeadas + empAtualizados,
      resumo:
        `Demonstrativo importado: ${unidades.size} unidades e ${funcoes.size} funções lidas. ` +
        `${uoRenomeadas} unidade(s) renomeada(s); ${empAtualizados} empenho(s) com função nomeada.`,
      avisos: [],
      dados: { unidades: unidades.size, funcoes: funcoes.size, uoRenomeadas, empAtualizados },
    };
  },
};

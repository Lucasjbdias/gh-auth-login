import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador BCM_QRP_Lotação — Relatório de Lotação hierárquico do SICOM/TCE-MG.
// Formato: relatório de texto latin1 com quebras de página a cada ~48 linhas.
// Hierarquia de código:
//   001             → órgão (ex.: Prefeitura Municipal)
//   001.101         → secretaria/unidade
//   001.101.021     → programa
//   001.101.021.00022 → atividade/verba
// Persiste apenas Orgao (nível 1) e Secretaria (nível 2), atualizando nomes reais.

function decode(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  return utf8.includes("") ? buf.toString("latin1") : utf8;
}

interface ItemLotacao {
  codigo: string;
  descricao: string;
  nivel: 1 | 2 | 3 | 4;
}

const RE_CABECALHO =
  /^\s{5,}(?:UF:|MUNIC|ENTIDADE:|RELAT|C[oó]digo|FOLHA:|\d{2}\s+\w{3}\s+\d{4}|\s*$)/i;

function parseLotacao(texto: string): ItemLotacao[] {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const itens: ItemLotacao[] = [];

  for (const ln of linhas) {
    if (!ln.trim() || RE_CABECALHO.test(ln)) continue;

    // Linha de dado: começa com espaços, depois código, depois descrição
    const m = ln.match(/^\s{3}(\d{3}(?:\.\d{3})*(?:\.\d{5})?)\s{2,}(.+?)\s*$/);
    if (!m) continue;

    const codigo = m[1].trim();
    const descricao = m[2].trim();
    if (!descricao || descricao.length < 2) continue;

    const partes = codigo.split(".");
    let nivel: 1 | 2 | 3 | 4 = 1;
    if (partes.length === 2) nivel = 2;
    else if (partes.length === 3) nivel = 3;
    else if (partes.length === 4) nivel = 4;

    itens.push({ codigo, descricao, nivel });
  }

  return itens;
}

export const lotacaoImporter: Importer = {
  id: "LOTACAO_QRP",
  nome: "Lotação QRP (BCM_QRP_Lotacao)",
  descricao:
    "Relatório de Lotação hierárquico do SICOM: popula órgãos e secretarias/unidades com nomes reais.",
  formatos: [".txt"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "LOTACAO_QRP") return 100;
    if (ctx.extensao !== ".txt") return 0;
    const t = ctx.textoCsv ?? "";
    if (/RELAT[O�]RIO DE LOTA[C�][A�]O/i.test(t)) return 95;
    if (/BCM_QRP_Lot/i.test(ctx.nomeArquivo)) return 90;
    if (/MUNIC.PIO:.*MATOZINHOS/i.test(t) && /LOTA/i.test(t)) return 88;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const texto = decode(buffer);
    const itens = parseLotacao(texto);
    const avisos: string[] = [];

    if (!itens.length) {
      avisos.push("Nenhum item de lotação encontrado no arquivo.");
      return { registros: 0, resumo: "Nenhum item encontrado.", avisos };
    }

    // Garantir que o Orgao raiz existe
    const org = await db.orgao.upsert({
      where: { id: "orgao-matozinhos" },
      update: {},
      create: {
        id: "orgao-matozinhos",
        nome: "Prefeitura Municipal de Matozinhos",
        municipio: "Matozinhos",
        uf: "MG",
        tipo: "PREFEITURA",
      },
    });

    let orgaosAtt = 0;
    let secretariasAtt = 0;

    // Nível 1 → atualizar nome do órgão raiz (o único órgão 001)
    const nivel1 = itens.filter((i) => i.nivel === 1);
    for (const item of nivel1) {
      await db.orgao.update({
        where: { id: org.id },
        data: { nome: item.descricao, codigo: item.codigo },
      });
      orgaosAtt++;
    }

    // Nível 2 → upsert Secretarias
    const nivel2 = itens.filter((i) => i.nivel === 2);
    const secExist = await db.secretaria.findMany({
      where: { orgaoId: org.id },
      select: { id: true, codigo: true },
    });
    const mapSec = new Map<string, string>();
    for (const s of secExist) if (s.codigo) mapSec.set(s.codigo, s.id);

    for (const item of nivel2) {
      if (mapSec.has(item.codigo)) {
        await db.secretaria.update({
          where: { id: mapSec.get(item.codigo)! },
          data: { nome: item.descricao },
        });
      } else {
        const novo = await db.secretaria.create({
          data: {
            orgaoId: org.id,
            nome: item.descricao,
            codigo: item.codigo,
          },
        });
        mapSec.set(item.codigo, novo.id);
      }
      secretariasAtt++;
    }

    const total = orgaosAtt + secretariasAtt;
    await db.importacao.create({
      data: {
        tipoDado: "LOTACAO_QRP",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação Lotação QRP",
        totalRegistros: itens.length,
        registrosOk: total,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({
          total: itens.length,
          orgaosAtt,
          secretariasAtt,
          nivel3: itens.filter((i) => i.nivel === 3).length,
          nivel4: itens.filter((i) => i.nivel === 4).length,
        }),
      },
    });

    return {
      registros: total,
      resumo: `Lotação importada: ${orgaosAtt} órgão(s) e ${secretariasAtt} secretarias/unidades atualizados. Total de ${itens.length} itens hierárquicos processados.`,
      avisos,
      dados: { orgaosAtt, secretariasAtt, totalItens: itens.length },
    };
  },
};

import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";
import { normCodigo } from "./produtos";
import { gerarAlertas } from "../alerts";
import { exercicioAtual } from "../indicators";

// Importador do relatório "CONTROLE DE COMPRAS — Movimentação por Produto" (QRP).
// Layout de impressão: cada item ocupa várias linhas (linha principal com
// processo/modalidade/quantidades, linhas de continuação da descrição, linha
// de classificação "Consumo/Permanente" com o Valor Unitário, e linha "Total:").
// Persiste em ItemComprado, vinculando ao Produto (por código) e à Licitação
// (por número do processo).

function txt(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function mapModalidade(s: string): string {
  const u = s.toUpperCase();
  if (u.includes("PREG")) return "PREGAO";
  if (u.includes("CONCORR")) return "CONCORRENCIA";
  if (u.includes("TOMADA")) return "TOMADA_PRECOS";
  if (u.includes("CONVITE")) return "CONVITE";
  if (u.includes("DISPENSA")) return "DISPENSA";
  if (u.includes("INEXIG")) return "INEXIGIBILIDADE";
  if (u.includes("ADES")) return "ADESAO_ATA";
  if (u.includes("CREDENC")) return "CREDENCIAMENTO";
  return "PREGAO";
}

interface ItemParse {
  codigo: string;
  desc: string;
  processo: string;
  modalidade: string;
  comprada: number;
  valorUnit: number;
  tipo: string; // Consumo | Permanente | Serviço
}

export const controleComprasImporter: Importer = {
  id: "CONTROLE_COMPRAS",
  nome: "Controle de Compras por Produto (QRP)",
  descricao:
    "Relatório de movimentação de compras por produto (processo, modalidade, quantidades e valor unitário). Gera os itens comprados e as licitações.",
  formatos: [".xls", ".xlsx"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "CONTROLE_COMPRAS") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    const nome = ctx.sheetNames?.[0];
    if (nome && ctx.workbook) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ctx.workbook.Sheets[nome], {
        header: 1,
        blankrows: false,
      }).slice(0, 12);
      const texto = rows.map((r) => (r as unknown[]).map(txt).join(" ")).join(" ");
      if (/CONTROLE DE COMPRAS/i.test(texto) && /movimenta/i.test(texto)) return 95;
    }
    if (/controlecompras|qrp/i.test(ctx.nomeArquivo)) return 65;
    return 0;
  },

  async importar(_buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const wb = ctx.workbook!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      blankrows: false,
      defval: "",
    });

    // 1) Parse das linhas em itens.
    const itensParse: ItemParse[] = [];
    let atual: ItemParse | null = null;
    const finalizar = () => {
      if (atual) itensParse.push(atual);
      atual = null;
    };
    for (const r of rows) {
      const col1 = txt(r[1]);
      const col12 = txt(r[12]);
      const main = col1.match(/^(\d{3,7})\s*-\s*(.*)$/);
      if (main) {
        finalizar();
        atual = {
          codigo: normCodigo(main[1]),
          desc: main[2].trim(),
          processo: txt(r[4]),
          modalidade: txt(r[6]),
          comprada: num(r[12]),
          valorUnit: 0,
          tipo: "",
        };
        continue;
      }
      if (!atual) continue;
      if (col12 === "Total:") {
        finalizar();
        continue;
      }
      if (/^(Consumo|Permanente|Servi[cç]o)$/i.test(col1)) {
        atual.valorUnit = num(r[13]);
        atual.tipo = col1;
        continue;
      }
      // Continuação da descrição (ignora bandas de cabeçalho repetidas).
      if (col1 && !/^(UF|Munic|Entidade|Produto)/i.test(col1) && !col1.includes(":")) {
        atual.desc = `${atual.desc} ${col1}`.trim();
      }
    }
    finalizar();

    // 2) Mapa de produtos por código normalizado.
    const prods = await db.produto.findMany({ select: { id: true, codigo: true } });
    const mapaProduto = new Map<string, string>();
    for (const p of prods) if (p.codigo) mapaProduto.set(normCodigo(p.codigo), p.id);

    // Órgão e cache de exercícios/licitações.
    const orgao = await db.orgao.upsert({
      where: { id: "orgao-matozinhos" },
      update: {},
      create: { id: "orgao-matozinhos", nome: "Município de Matozinhos", municipio: "Matozinhos", uf: "MG" },
    });
    const ativo = await exercicioAtual();
    const exCache = new Map<number, string>();
    async function getExercicio(ano: number): Promise<string> {
      if (exCache.has(ano)) return exCache.get(ano)!;
      const ex = await db.exercicio.upsert({
        where: { orgaoId_ano: { orgaoId: orgao.id, ano } },
        update: {},
        create: { orgaoId: orgao.id, ano, aberto: false },
      });
      exCache.set(ano, ex.id);
      return ex.id;
    }

    const licCache = new Map<string, string>();
    const licExistentes = await db.licitacao.findMany({
      where: { exercicio: { orgaoId: orgao.id } },
      select: { id: true, numeroProcesso: true },
    });
    for (const l of licExistentes) licCache.set(l.numeroProcesso, l.id);

    // Idempotência: limpa apenas os itens desta origem.
    await db.itemComprado.deleteMany({ where: { origemImport: "CONTROLE_COMPRAS" } });

    // 3) Persiste licitações (sob demanda) e itens.
    const itensData: any[] = [];
    const totalPorLicitacao = new Map<string, number>();
    let semProduto = 0;
    let produtosCriados = 0;

    for (const it of itensParse) {
      if (it.comprada <= 0) continue;

      // Produto: usa o existente ou cria um mínimo a partir do relatório.
      let produtoId = mapaProduto.get(it.codigo) ?? null;
      if (!produtoId) {
        const novo = await db.produto.create({
          data: { codigo: it.codigo, descricao: it.desc || `Produto ${it.codigo}`, ultimoPrecoUnit: it.valorUnit },
        });
        produtoId = novo.id;
        mapaProduto.set(it.codigo, novo.id);
        produtosCriados++;
      }

      // Licitação pelo número do processo.
      let licitacaoId: string | null = null;
      if (it.processo) {
        const numero = it.processo.replace(/\s+/g, "");
        if (licCache.has(numero)) {
          licitacaoId = licCache.get(numero)!;
        } else {
          const anoProc = Number(numero.match(/(20\d{2})/)?.[1] ?? ativo?.ano ?? new Date().getFullYear());
          const exId = await getExercicio(anoProc);
          const lic = await db.licitacao.create({
            data: {
              exercicioId: exId,
              numeroProcesso: numero,
              modalidade: mapModalidade(it.modalidade),
              objeto: "Aquisição de produtos (controle de compras)",
              situacao: "HOMOLOGADO",
            },
          });
          licCache.set(numero, lic.id);
          licitacaoId = lic.id;
        }
      } else {
        semProduto++;
      }

      // Serviços/obras: as "quantidades" do relatório são valores em R$ — o
      // comprado já É o valor da contratação. Consumo/Permanente: qtd × unitário.
      const ehServico = /servi/i.test(it.tipo);
      const quantidade = ehServico ? 1 : it.comprada;
      const valorUnitario = ehServico ? it.comprada : it.valorUnit;
      const valorTotal = ehServico
        ? it.comprada
        : Math.round(it.comprada * it.valorUnit * 100) / 100;

      itensData.push({
        licitacaoId,
        produtoId,
        descricao: it.desc || it.codigo,
        quantidade,
        valorUnitario,
        valorTotal,
        origemImport: "CONTROLE_COMPRAS",
      });
      if (licitacaoId) {
        totalPorLicitacao.set(licitacaoId, (totalPorLicitacao.get(licitacaoId) ?? 0) + valorTotal);
      }
    }

    let gravados = 0;
    for (let i = 0; i < itensData.length; i += 300) {
      const lote = itensData.slice(i, i + 300);
      await db.itemComprado.createMany({ data: lote });
      gravados += lote.length;
    }

    // Atualiza o valor contratado de cada licitação com a soma dos itens.
    for (const [licId, total] of totalPorLicitacao) {
      await db.licitacao.update({
        where: { id: licId },
        data: { valorContratado: Math.round(total * 100) / 100, valorEstimado: Math.round(total * 100) / 100 },
      });
    }

    const alertasGerados = ativo ? await gerarAlertas(ativo.id) : 0;

    await db.importacao.create({
      data: {
        tipoDado: "CONTROLE_COMPRAS",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação Excel",
        totalRegistros: gravados,
        registrosOk: gravados,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ itensLidos: itensParse.length, licitacoes: licCache.size, produtosCriados }),
      },
    });

    const avisos: string[] = [];
    if (produtosCriados) avisos.push(`${produtosCriados} produto(s) do relatório não estavam no catálogo e foram criados.`);

    return {
      registros: gravados,
      resumo:
        `Controle de compras importado: ${gravados} itens comprados, ` +
        `${licCache.size} licitações vinculadas. ${alertasGerados} alertas recalculados.`,
      alertasGerados,
      avisos,
      dados: { itensLidos: itensParse.length, gravados, licitacoes: licCache.size, produtosCriados },
    };
  },
};

import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";
import { normCodigo } from "./produtos";
import { gerarAlertas } from "../alerts";
import { exercicioAtual } from "../indicators";

// Importador da RELAÇÃO DE NAF (Notas de Autorização de Fornecimento).
// Relatório texto: cada NAF é um bloco com fornecedor (+CNPJ), processo,
// modalidade, órgão/unidade (com NOMES), elemento e itens. Persiste:
//  - Fornecedor (cadastro com CNPJ)
//  - Licitacao (reutiliza/cria por nº do processo; define fornecedor vencedor)
//  - ItemComprado (com fornecedor) — base para o painel de Fornecedores
//  - enriquece os NOMES das secretarias (U.O.) a partir de Órgão/Unidade

function numBR(s: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function decode(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}
/** "02.08" -> "2.8" (remove zeros à esquerda de cada segmento). */
function siglaUO(cod: string): string {
  return cod
    .split(".")
    .map((s) => String(parseInt(s, 10)))
    .join(".");
}
const modalidade = (s: string): string => {
  const u = (s || "").toUpperCase();
  if (u.includes("PREG")) return "PREGAO";
  if (u.includes("CONCORR")) return "CONCORRENCIA";
  if (u.includes("TOMADA")) return "TOMADA_PRECOS";
  if (u.includes("CONVITE")) return "CONVITE";
  if (u.includes("DISPENSA")) return "DISPENSA";
  if (u.includes("INEXIG")) return "INEXIGIBILIDADE";
  if (u.includes("ADES")) return "ADESAO_ATA";
  if (u.includes("CREDENC")) return "CREDENCIAMENTO";
  return "PREGAO";
};

interface ItemNaf { codigo: string; desc: string; unidade: string; qtd: number; vunit: number; vtotal: number; }
interface Naf {
  processo: string;
  modalidade: string;
  objeto: string;
  fornCodigo: string;
  fornNome: string;
  cnpj: string;
  unidadeCod: string;
  unidadeNome: string;
  itens: ItemNaf[];
}

function parseNafs(texto: string): Naf[] {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const nafs: Naf[] = [];
  let atual: Naf | null = null;
  let emItens = false;

  const push = () => { if (atual) nafs.push(atual); };

  for (const ln of linhas) {
    if (/Número da NAF:|N[uú]mero da NAF:/.test(ln)) {
      push();
      atual = { processo: "", modalidade: "", objeto: "", fornCodigo: "", fornNome: "", cnpj: "", unidadeCod: "", unidadeNome: "", itens: [] };
      emItens = false;
      continue;
    }
    if (!atual) continue;

    let m;
    if ((m = ln.match(/N[uú]mero Processo:\s*([\d]+\s*\/\s*\d+)/))) atual.processo = m[1].replace(/\s+/g, "");
    if ((m = ln.match(/Modalidade:\s*(.+?)\s{2,}/))) atual.modalidade = m[1].trim();
    if ((m = ln.match(/Objeto:\s*(.+?)\s*$/))) atual.objeto = m[1].trim();
    if ((m = ln.match(/Fornecedor:\s*(\d+)\s*-\s*(.+?)\s*$/))) { atual.fornCodigo = m[1]; atual.fornNome = m[2].trim(); }
    if ((m = ln.match(/^\s*CNPJ\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/))) atual.cnpj = m[1];
    if ((m = ln.match(/^\s*Unidade:\s*([\d.]+)\s+(.+?)\s*$/))) { atual.unidadeCod = m[1]; atual.unidadeNome = m[2].trim(); }

    if (/Descri.+Material|Valor Unit/i.test(ln) && /Quantidade/i.test(ln)) { emItens = true; continue; }
    if (/Valor Total:/.test(ln)) { emItens = false; continue; }

    if (emItens) {
      const t = ln.trimEnd();
      if (/^\s*\d{4,5}\s+\d+/.test(t)) {
        const parts = t.trim().split(/\s{2,}/);
        if (parts.length >= 5) {
          const [item, codigo] = parts[0].split(/\s+/);
          void item;
          const vtotal = numBR(parts[parts.length - 1]);
          const vunit = numBR(parts[parts.length - 2]);
          const qtd = numBR(parts[parts.length - 3]);
          const unidade = parts[parts.length - 4];
          const desc = parts.slice(1, parts.length - 4).join(" ");
          atual.itens.push({ codigo: normCodigo(codigo), desc, unidade, qtd, vunit, vtotal });
        }
      } else if (t.trim() && atual.itens.length) {
        // continuação de descrição
        atual.itens[atual.itens.length - 1].desc += " " + t.trim();
      }
    }
  }
  push();
  return nafs;
}

export const relacaoNafImporter: Importer = {
  id: "RELACAO_NAF",
  nome: "Relação de NAF (compras/fornecedores)",
  descricao:
    "Notas de Autorização de Fornecimento (texto). Cadastra fornecedores com CNPJ, vincula às licitações e gera os itens comprados; enriquece os nomes das unidades.",
  formatos: [".txt"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "RELACAO_NAF") return 100;
    if (ctx.extensao !== ".txt") return 0;
    if (ctx.textoCsv && /NOTA DE AUTORIZA/i.test(ctx.textoCsv)) return 95;
    if (/naf/i.test(ctx.nomeArquivo)) return 70;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const nafs = parseNafs(decode(buffer));

    const org = await db.orgao.upsert({
      where: { id: "orgao-matozinhos" },
      update: {},
      create: { id: "orgao-matozinhos", nome: "Município de Matozinhos", municipio: "Matozinhos", uf: "MG" },
    });
    const ativo = await exercicioAtual();

    // ---- Fornecedores (upsert por CNPJ; fallback por nome) ----
    const fornExistentes = await db.fornecedor.findMany({ select: { id: true, documento: true, nome: true } });
    const mapForn = new Map<string, string>();
    for (const f of fornExistentes) if (f.documento) mapForn.set(f.documento, f.id);
    let fornCriados = 0;
    async function getFornecedor(cnpj: string, nome: string): Promise<string | null> {
      if (!nome) return null;
      const chave = cnpj || `nome:${nome}`;
      if (mapForn.has(chave)) return mapForn.get(chave)!;
      const novo = await db.fornecedor.create({
        data: { nome, documento: cnpj || null, tipoPessoa: "PJ", cadastroCompleto: Boolean(cnpj) },
      });
      mapForn.set(chave, novo.id);
      fornCriados++;
      return novo.id;
    }

    // ---- Mapa de produtos por código ----
    const prods = await db.produto.findMany({ select: { id: true, codigo: true } });
    const mapProd = new Map<string, string>();
    for (const p of prods) if (p.codigo) mapProd.set(normCodigo(p.codigo), p.id);

    // ---- Licitações por processo (reutiliza as do QRP) ----
    const licExist = await db.licitacao.findMany({
      where: { exercicio: { orgaoId: org.id } },
      select: { id: true, numeroProcesso: true },
    });
    const mapLic = new Map<string, string>();
    for (const l of licExist) mapLic.set(l.numeroProcesso, l.id);
    const exCache = new Map<number, string>();
    async function getExercicio(ano: number): Promise<string> {
      if (exCache.has(ano)) return exCache.get(ano)!;
      const ex = await db.exercicio.upsert({
        where: { orgaoId_ano: { orgaoId: org.id, ano } },
        update: {},
        create: { orgaoId: org.id, ano, aberto: false },
      });
      exCache.set(ano, ex.id);
      return ex.id;
    }

    // ---- Enriquecimento de nomes de secretaria (U.O.) ----
    const nomesUO = new Map<string, string>();
    for (const n of nafs) if (n.unidadeCod && n.unidadeNome) nomesUO.set(siglaUO(n.unidadeCod), n.unidadeNome);
    let uoRenomeadas = 0;
    for (const [sigla, nome] of nomesUO) {
      const r = await db.secretaria.updateMany({ where: { orgaoId: org.id, sigla }, data: { nome } });
      if (r.count > 0) uoRenomeadas += r.count;
    }

    // ---- Idempotência: remove apenas os itens desta origem ----
    await db.itemComprado.deleteMany({ where: { origemImport: "RELACAO_NAF" } });

    // ---- Persiste itens e enriquece licitações ----
    const itensData: any[] = [];
    let semFornecedor = 0;
    for (const n of nafs) {
      const fornecedorId = await getFornecedor(n.cnpj, n.fornNome);
      if (!fornecedorId) semFornecedor++;

      let licitacaoId: string | null = null;
      if (n.processo) {
        if (mapLic.has(n.processo)) {
          licitacaoId = mapLic.get(n.processo)!;
        } else {
          const ano = Number(n.processo.match(/(20\d{2})/)?.[1] ?? ativo?.ano ?? new Date().getFullYear());
          const exId = await getExercicio(ano);
          const lic = await db.licitacao.create({
            data: { exercicioId: exId, numeroProcesso: n.processo, modalidade: modalidade(n.modalidade), objeto: n.objeto || "Compras (NAF)", situacao: "HOMOLOGADO" },
          });
          mapLic.set(n.processo, lic.id);
          licitacaoId = lic.id;
        }
        // Define fornecedor vencedor / objeto na licitação.
        if (licitacaoId && fornecedorId) {
          await db.licitacao.update({ where: { id: licitacaoId }, data: { fornecedorVencId: fornecedorId, objeto: n.objeto || undefined } });
        }
      }

      for (const it of n.itens) {
        itensData.push({
          licitacaoId,
          fornecedorId,
          produtoId: mapProd.get(it.codigo) ?? null,
          descricao: it.desc || it.codigo,
          quantidade: it.qtd,
          valorUnitario: it.vunit,
          valorTotal: it.vtotal || Math.round(it.qtd * it.vunit * 100) / 100,
          origemImport: "RELACAO_NAF",
        });
      }
    }

    let gravados = 0;
    for (let i = 0; i < itensData.length; i += 300) {
      await db.itemComprado.createMany({ data: itensData.slice(i, i + 300) });
      gravados += Math.min(300, itensData.length - i);
    }

    const alertasGerados = ativo ? await gerarAlertas(ativo.id) : 0;

    await db.importacao.create({
      data: {
        tipoDado: "RELACAO_NAF",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação NAF",
        totalRegistros: nafs.length,
        registrosOk: gravados,
        registrosErro: semFornecedor,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ nafs: nafs.length, fornCriados, uoRenomeadas }),
      },
    });

    const avisos: string[] = [];
    if (uoRenomeadas) avisos.push(`${uoRenomeadas} unidade(s) orçamentária(s) renomeada(s) com o nome real.`);
    if (semFornecedor) avisos.push(`${semFornecedor} NAF(s) sem fornecedor identificado.`);

    return {
      registros: gravados,
      resumo:
        `Relação de NAF importada: ${nafs.length} notas, ${fornCriados} fornecedores cadastrados, ` +
        `${gravados} itens com fornecedor vinculado. ${alertasGerados} alertas recalculados.`,
      alertasGerados,
      avisos,
      dados: { nafs: nafs.length, fornCriados, gravados, uoRenomeadas },
    };
  },
};

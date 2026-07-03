import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";
import { normCodigo } from "./produtos";
import { gerarAlertas } from "../alerts";
import { exercicioAtual } from "../indicators";

// Importador da RELAÇÃO DE COMPRAS / SERVIÇOS AUTORIZADOS (relatório texto).
// Atende AOS DOIS modos do relatório, distinguidos pelo cabeçalho/linha:
//   - "Compras Diretas"        -> dispensa      (origem COMPRAS_DIRETAS)
//   - "Processos Licitatórios" -> licitação     (origem COMPRAS_LICITACAO)
// Agrupado por produto; cada autorização (NAF Global/Parcial) traz fornecedor,
// processo/compra direta, modalidade e os valores. Persiste ItemComprado com a
// origem correspondente (coexistem; cada origem limpa só a si mesma).

function numBR(s: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function decode(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}
function normNome(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}
function dataBR(s: string): Date | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}
function mapModalidade(s: string): string {
  const u = (s || "").toUpperCase();
  if (u.includes("PREG")) return "PREGAO";
  if (u.includes("CONCORR")) return "CONCORRENCIA";
  if (u.includes("TOMADA")) return "TOMADA_PRECOS";
  if (u.includes("CONVITE")) return "CONVITE";
  if (u.includes("INEXIG")) return "INEXIGIBILIDADE";
  if (u.includes("ADES")) return "ADESAO_ATA";
  if (u.includes("CREDENC")) return "CREDENCIAMENTO";
  if (u.includes("DISPENSA")) return "DISPENSA";
  return "DISPENSA";
}

interface Registro {
  prodCod: string;
  prodNome: string;
  fornNome: string;
  numero: string; // nº da compra direta ou do processo licitatório
  modalidade: string;
  isLic: boolean;
  ano: number;
  data: Date | null;
  qtd: number;
  vunit: number;
  vtotal: number;
}

function parse(texto: string): Registro[] {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const regs: Registro[] = [];
  let prod: { cod: string; nome: string } | null = null;
  let pend: { fornNome: string; data: Date | null; numero: string; modalidade: string; isLic: boolean } | null = null;

  for (const ln of linhas) {
    let m;
    if ((m = ln.match(/^\s*Produto:\s*(\d+)\s*-\s*(.+?)\s*$/))) {
      prod = { cod: normCodigo(m[1]), nome: m[2].trim() };
      pend = null;
      continue;
    }
    if ((m = ln.match(/NAF Global\s*\/\s*Parci\s*(\d+)\s*\/\s*(\d+)\s+Data:\s*([\d/]+)\s+Fornecedor:\s*(\d+)\s*-\s*(.+?)\s*$/))) {
      pend = { fornNome: m[5].trim(), data: dataBR(m[3]), numero: "", modalidade: "", isLic: false };
      continue;
    }
    // Linha do processo: "Compra Direta: 000010 ... Modalidade:0001 - Dispensa"
    //                 ou "Processo Licitatóri000058 ... Modalidade:0009 - PREGÃO ELETRONICO"
    if ((m = ln.match(/(Compra Direta|Processo Licitat\w*)\D*?(\d+)\s+Data:\s*[\d/]+\s+Modalidade:\s*(.+?)\s*$/))) {
      if (pend) {
        pend.numero = m[2];
        pend.modalidade = m[3].trim();
        pend.isLic = /Licitat/i.test(m[1]);
      }
      continue;
    }
    if (/Total do Produto|TOTAL GERAL/i.test(ln)) {
      pend = null;
      continue;
    }
    // Linha de valores: termina com 3 números pt-BR (qtd, unitário, total).
    if ((m = ln.match(/([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s*$/))) {
      if (pend && prod) {
        regs.push({
          prodCod: prod.cod,
          prodNome: prod.nome,
          fornNome: pend.fornNome,
          numero: pend.numero,
          modalidade: pend.modalidade,
          isLic: pend.isLic,
          ano: pend.data?.getUTCFullYear() ?? 0,
          data: pend.data,
          qtd: numBR(m[1]),
          vunit: numBR(m[2]),
          vtotal: numBR(m[3]),
        });
        pend = null;
      }
    }
  }
  return regs;
}

export const comprasDiretasImporter: Importer = {
  id: "COMPRAS_AUTORIZADAS",
  nome: "Compras/Serviços Autorizados (Diretas e Licitatórios)",
  descricao:
    "Relação de compras autorizadas por produto — modos Compras Diretas (dispensa) e Processos Licitatórios — com fornecedor, modalidade, quantidade e valor.",
  formatos: [".txt"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "COMPRAS_AUTORIZADAS" || ctx.tipoHint === "COMPRAS_DIRETAS") return 100;
    if (ctx.extensao !== ".txt") return 0;
    const t = ctx.textoCsv ?? "";
    if (/COMPRAS\s*\/\s*SERVI.OS AUTORIZADOS/i.test(t)) return 96;
    if (/Compras Diretas|Processos Licitat/i.test(t)) return 90;
    if (/comprasservicoautorizado|compradireta/i.test(ctx.nomeArquivo)) return 70;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const regs = parse(decode(buffer));

    const org = await db.orgao.upsert({
      where: { id: "orgao-matozinhos" },
      update: {},
      create: { id: "orgao-matozinhos", nome: "Município de Matozinhos", municipio: "Matozinhos", uf: "MG" },
    });
    const ativo = await exercicioAtual();
    const origem = (r: Registro) => (r.isLic ? "COMPRAS_LICITACAO" : "COMPRAS_DIRETAS");

    // Fornecedores por nome (reutiliza os já cadastrados, ex.: via NAF com CNPJ).
    const fornExist = await db.fornecedor.findMany({ select: { id: true, nome: true } });
    const mapForn = new Map<string, string>();
    for (const f of fornExist) mapForn.set(normNome(f.nome), f.id);
    let fornCriados = 0;
    async function getForn(nome: string): Promise<string | null> {
      if (!nome) return null;
      const k = normNome(nome);
      if (mapForn.has(k)) return mapForn.get(k)!;
      const novo = await db.fornecedor.create({ data: { nome: nome.trim(), tipoPessoa: "PJ", cadastroCompleto: false } });
      mapForn.set(k, novo.id);
      fornCriados++;
      return novo.id;
    }

    // Produtos por código.
    const prods = await db.produto.findMany({ select: { id: true, codigo: true } });
    const mapProd = new Map<string, string>();
    for (const p of prods) if (p.codigo) mapProd.set(normCodigo(p.codigo), p.id);

    // Exercícios e licitações (uma por número + ano).
    const exCache = new Map<number, string>();
    async function getEx(ano: number): Promise<string> {
      if (exCache.has(ano)) return exCache.get(ano)!;
      const ex = await db.exercicio.upsert({
        where: { orgaoId_ano: { orgaoId: org.id, ano } },
        update: {},
        create: { orgaoId: org.id, ano, aberto: false },
      });
      exCache.set(ano, ex.id);
      return ex.id;
    }
    const licExist = await db.licitacao.findMany({ where: { exercicio: { orgaoId: org.id } }, select: { id: true, numeroProcesso: true } });
    const mapLic = new Map<string, string>();
    for (const l of licExist) mapLic.set(l.numeroProcesso, l.id);
    async function getLic(r: Registro, fornecedorId: string | null): Promise<string | null> {
      if (!r.numero || !r.ano) return null;
      const numero = r.isLic ? `${r.numero}/${r.ano}` : `CD ${r.numero}/${r.ano}`;
      if (mapLic.has(numero)) return mapLic.get(numero)!;
      const exId = await getEx(r.ano);
      const lic = await db.licitacao.create({
        data: {
          exercicioId: exId,
          numeroProcesso: numero,
          modalidade: mapModalidade(r.modalidade),
          objeto: r.isLic ? "Compras por processo licitatório" : "Compras diretas (dispensa)",
          situacao: "HOMOLOGADO",
          compraDireta: !r.isLic,
          fornecedorVencId: fornecedorId,
        },
      });
      mapLic.set(numero, lic.id);
      return lic.id;
    }

    // Idempotência: limpa apenas as origens presentes neste arquivo.
    const origensArquivo = new Set(regs.map(origem));
    for (const o of origensArquivo) await db.itemComprado.deleteMany({ where: { origemImport: o } });

    const itens: any[] = [];
    for (const r of regs) {
      const fornecedorId = await getForn(r.fornNome);
      const licitacaoId = await getLic(r, fornecedorId);
      itens.push({
        licitacaoId,
        fornecedorId,
        produtoId: mapProd.get(r.prodCod) ?? null,
        descricao: r.prodNome || r.prodCod,
        quantidade: r.qtd,
        valorUnitario: r.vunit,
        valorTotal: r.vtotal || Math.round(r.qtd * r.vunit * 100) / 100,
        data: r.data,
        origemImport: origem(r),
      });
    }

    let gravados = 0;
    for (let i = 0; i < itens.length; i += 300) {
      await db.itemComprado.createMany({ data: itens.slice(i, i + 300) });
      gravados += Math.min(300, itens.length - i);
    }

    const alertasGerados = ativo ? await gerarAlertas(ativo.id) : 0;
    const totalValor = itens.reduce((s, i) => s + i.valorTotal, 0);
    const tipo = origensArquivo.has("COMPRAS_LICITACAO") ? "processos licitatórios" : "compras diretas";

    await db.importacao.create({
      data: {
        tipoDado: [...origensArquivo].join("+"),
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação Compras Autorizadas",
        totalRegistros: regs.length,
        registrosOk: gravados,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ registros: regs.length, fornCriados, licitacoes: mapLic.size, tipo }),
      },
    });

    return {
      registros: gravados,
      resumo:
        `Compras autorizadas (${tipo}) importadas: ${gravados} itens ` +
        `(R$ ${Math.round(totalValor).toLocaleString("pt-BR")}), ${fornCriados} novos fornecedores. ` +
        `${alertasGerados} alertas recalculados.`,
      alertasGerados,
      avisos: fornCriados ? [`${fornCriados} fornecedor(es) criados sem CNPJ (relatório não traz documento).`] : [],
      dados: { registros: regs.length, gravados, fornCriados, totalValor, origens: [...origensArquivo] },
    };
  },
};

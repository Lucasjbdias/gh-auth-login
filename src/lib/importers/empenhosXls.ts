import * as XLSX from "xlsx";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";
import { gerarAlertas } from "../alerts";
import { exercicioAtual } from "../indicators";

// Importador EMPENHOS.XLS — relatório detalhado de empenhos com 25 colunas.
// Aba: "DADOS"
// Colunas: Num.Emp | Ano | DT Emp. | Vlr. Empenhado | Vlr. Anulação | Vlr. Complemento |
//          Vlr. Liquidado | Vlr. Liquidado Anulado | Vlr. Pagamento | Vlr. Pagamento Dev. |
//          Nº Credor | Nome | CNPJ/CPF | Ficha | Classif. Orcamentaria | Histórico Emp. |
//          Fonte de Recurso | Nº Processo | Tipo Contrato | Data Inic. Vig. | Data Final Vig. |
//          Valor Contrato | Modalidade Licitação | Classificação Licitação | Nº Licitação

function numXls(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function strXls(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function dateXls(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
}

function normDoc(doc: string): string {
  return doc.replace(/[.\-\/]/g, "").replace(/\s/g, "").trim();
}

function normNome(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
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
  return "DISPENSA";
}

// Extrai as partes da classificação orçamentária no formato xx.yy.func.subfunc.prog...
function parseCLassif(classif: string) {
  const parts = classif.split(".");
  return {
    orgaoCod: parts[0] ?? "",       // ex: "02"
    unidadeCod: parts[1] ?? "",     // ex: "04"
    funcao: parts[2] ?? "",
    subfuncao: parts[3] ?? "",
    programa: parts[4] ?? "",
    elemento: parts[9] ?? "",
  };
}

export const empenhosXlsImporter: Importer = {
  id: "EMPENHOS_XLS",
  nome: "Empenhos Detalhado (EMPENHOS.XLS)",
  descricao:
    "Planilha Excel com todos os empenhos do exercício: fornecedor (CNPJ), classificação orçamentária completa, processo, contrato e licitação. Aba 'DADOS' com 25 colunas.",
  formatos: [".xlsx", ".xls"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "EMPENHOS_XLS") return 100;
    if (![".xlsx", ".xls"].includes(ctx.extensao)) return 0;
    const nArq = ctx.nomeArquivo.toUpperCase();
    if (/^EMPENHOS\.XL/.test(nArq) || /^EMPENHOS_\d/.test(nArq)) return 92;
    if (/EMPENHO/i.test(nArq) && ctx.sheetNames?.some((s) => /DADOS/i.test(s))) return 85;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const wb = ctx.workbook ?? XLSX.read(buffer, { type: "buffer", cellDates: true });
    const abaName = wb.SheetNames.find((s) => /dados/i.test(s)) ?? wb.SheetNames[0];
    const ws = wb.Sheets[abaName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];

    if (rows.length < 2) {
      return { registros: 0, resumo: "Planilha vazia.", avisos: ["Nenhuma linha de dados encontrada."] };
    }

    // Descobre índice de colunas pelo cabeçalho (linha 0)
    const header = rows[0].map((c) => String(c).toLowerCase().trim());
    const col = (patt: RegExp): number => header.findIndex((h) => patt.test(h));

    const iNum = col(/num\.?emp/i) ?? 0;
    const iAno = col(/^ano$/) ?? 1;
    const iData = col(/dt\.?\s*emp|data.*emp/) ?? 2;
    const iEmpenhado = col(/vlr.*emp[e]nh/) ?? 3;
    const iAnulado = col(/anula/) ?? 4;
    const iComplemento = col(/complemento/) ?? 5;
    const iLiquidado = col(/vlr.*liquid/) ?? 6;
    const iPago = col(/vlr.*pag[a-z]/) ?? 8;
    const iNomeFor = col(/nome/) ?? 11;
    const iCnpj = col(/cnpj|cpf/) ?? 12;
    const iClassif = col(/classif/) ?? 14;
    const iHistorico = col(/hist.*emp/) ?? 15;
    const iFonte = col(/fonte/) ?? 16;
    const iProcesso = col(/processo/) ?? 17;
    const iModalidade = col(/modalidade/) ?? 22;
    const iNumLic = col(/n.*licita/) ?? 24;

    const avisos: string[] = [];
    let ok = 0;
    let erros = 0;

    const org = await db.orgao.upsert({
      where: { id: "orgao-matozinhos" },
      update: {},
      create: {
        id: "orgao-matozinhos",
        nome: "Prefeitura Municipal de Matozinhos",
        municipio: "Matozinhos",
        uf: "MG",
      },
    });

    // Cache de exercícios
    const exCache = new Map<number, string>();
    async function getEx(ano: number): Promise<string> {
      if (exCache.has(ano)) return exCache.get(ano)!;
      const ex = await db.exercicio.upsert({
        where: { orgaoId_ano: { orgaoId: org.id, ano } },
        update: {},
        create: { orgaoId: org.id, ano, aberto: ano >= new Date().getFullYear() - 1 },
      });
      exCache.set(ano, ex.id);
      return ex.id;
    }

    // Cache de fornecedores por documento
    const fornPorDoc = new Map<string, string>();
    const fornExist = await db.fornecedor.findMany({ select: { id: true, documento: true, nome: true } });
    for (const f of fornExist) {
      if (f.documento) fornPorDoc.set(normDoc(f.documento), f.id);
    }
    const fornPorNome = new Map<string, string>();
    for (const f of fornExist) fornPorNome.set(normNome(f.nome), f.id);
    let fornCriados = 0;

    async function getForn(nome: string, cnpjRaw: string): Promise<string | null> {
      if (!nome) return null;
      const doc = normDoc(cnpjRaw);
      if (doc && fornPorDoc.has(doc)) return fornPorDoc.get(doc)!;
      const nNome = normNome(nome);
      if (fornPorNome.has(nNome)) return fornPorNome.get(nNome)!;
      const tipoPessoa = doc.length === 11 ? "PF" : "PJ";
      const novo = await db.fornecedor.create({
        data: { nome: nome.trim(), documento: doc || null, tipoPessoa },
      });
      if (doc) fornPorDoc.set(doc, novo.id);
      fornPorNome.set(nNome, novo.id);
      fornCriados++;
      return novo.id;
    }

    // Cache de secretarias (por código orgao.unidade)
    const secExist = await db.secretaria.findMany({
      where: { orgaoId: org.id },
      select: { id: true, codigo: true },
    });
    const mapSec = new Map<string, string>(); // "001.102" → id
    for (const s of secExist) if (s.codigo) mapSec.set(s.codigo, s.id);

    // Mapeamento de código de 2 dígitos da classificação → código lotação 001.1XX
    function getSecId(orgaoCod: string, unidCod: string): string | null {
      const codFull = `001.1${unidCod.padStart(2, "0")}`;
      if (mapSec.has(codFull)) return mapSec.get(codFull)!;
      // Fallback: procura por qualquer secretaria que termine em "XX" (código lotação)
      for (const [k, v] of mapSec) {
        if (k.endsWith(`.1${unidCod.padStart(2, "0")}`)) return v;
      }
      return null;
    }

    // Processa linhas (ignora linha 0 = cabeçalho)
    const dataRows = rows.slice(1).filter((r) => {
      const v = r[iNum];
      return v !== "" && v !== null && v !== undefined;
    });

    for (const row of dataRows) {
      try {
        const numStr = strXls(row[iNum]);
        const anoVal = Number(strXls(row[iAno])) || new Date().getFullYear();
        const dataEmp = dateXls(row[iData]) ?? new Date(anoVal, 0, 1);
        const vlrEmp = numXls(row[iEmpenhado]);
        const vlrAnul = numXls(row[iAnulado]);
        const vlrComp = numXls(row[iComplemento]);
        const vlrLiq = numXls(row[iLiquidado]);
        const vlrPago = numXls(row[iPago]);
        const nomeFor = strXls(row[iNomeFor]);
        const cnpjRaw = strXls(row[iCnpj]);
        const classif = strXls(row[iClassif]);
        const historico = strXls(row[iHistorico]);
        const fonte = strXls(row[iFonte]);
        const numProcesso = strXls(row[iProcesso]);
        const modalidade = strXls(row[iModalidade]);
        const numLic = strXls(row[iNumLic]);

        if (!numStr) continue;

        const exId = await getEx(anoVal);
        const fornId = await getForn(nomeFor, cnpjRaw);

        const { orgaoCod, unidadeCod, funcao, subfuncao, programa, elemento } = parseCLassif(classif);
        const secretariaId = getSecId(orgaoCod, unidadeCod);

        const vlrEmpFinal = vlrEmp - vlrAnul + vlrComp;

        // Idempotência: tenta update por codigoExterno, cria se não existir
        const chave = `${anoVal}/${numStr}`;
        const existente = await db.empenho.findFirst({
          where: { codigoExterno: chave, origemDado: "EMPENHOS_XLS" },
          select: { id: true },
        });

        if (existente) {
          await db.empenho.update({
            where: { id: existente.id },
            data: {
              valorEmpenhado: vlrEmpFinal,
              valorLiquidado: vlrLiq,
              valorPago: vlrPago,
              fornecedorId: fornId ?? undefined,
              numProcesso: numProcesso || undefined,
              fonteRecurso: fonte || undefined,
              historico: historico.slice(0, 500) || undefined,
              funcao: funcao || undefined,
              subfuncao: subfuncao || undefined,
              programa: programa || undefined,
              elemento: elemento || undefined,
            },
          });
        } else {
          await db.empenho.create({
            data: {
              exercicioId: exId,
              numero: numStr,
              data: dataEmp,
              mes: dataEmp.getMonth() + 1,
              secretariaId,
              fornecedorId: fornId,
              funcao,
              subfuncao,
              programa,
              elemento,
              objeto: historico.slice(0, 500) || null,
              numProcesso: numProcesso || null,
              fonteRecurso: fonte || null,
              historico: historico.slice(0, 500) || null,
              valorEmpenhado: vlrEmpFinal,
              valorLiquidado: vlrLiq,
              valorPago: vlrPago,
              origemDado: "EMPENHOS_XLS",
              codigoExterno: chave,
            },
          });
        }

        ok++;
      } catch {
        erros++;
      }
    }

    const ativo = await exercicioAtual();
    const alertasGerados = ativo ? await gerarAlertas(ativo.id) : 0;

    await db.importacao.create({
      data: {
        tipoDado: "EMPENHOS_XLS",
        nomeArquivo: ctx.nomeArquivo,
        totalRegistros: dataRows.length,
        registrosOk: ok,
        registrosErro: erros,
        status: erros === 0 ? "PROCESSADO" : "COM_ERROS",
        detalhes: JSON.stringify({ ok, erros, fornCriados, alertasGerados }),
      },
    });

    if (erros) avisos.push(`${erros} linha(s) com erro de processamento.`);
    if (fornCriados) avisos.push(`${fornCriados} fornecedor(es) criados.`);

    return {
      registros: ok,
      resumo: `${ok} empenhos importados (${dataRows.length} no arquivo). ${fornCriados} fornecedores. ${alertasGerados} alertas recalculados.`,
      alertasGerados,
      avisos,
      dados: { ok, erros, fornCriados, alertasGerados },
    };
  },
};

import { unzipSync } from "fflate";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador de Remessa SICOM — Acompanhamento Mensal (AM).
// Arquivos CSV dentro do ZIP:
//   IDE.CSV    → identificação (município;cnpj;órgão;unidade;exercício;mês;…)
//   EMP.CSV    → empenhos: tipo 10 = cabeçalho; tipo 12 = credor (CNPJ/CPF)
//   REC.CSV    → receitas arrecadadas: tipo 10 = rubrica+valor
//   LQD.CSV    → liquidações: tipo 10 = numEmpenho+valor+data
//   OPS.CSV    → ordens de pagamento: tipo 11 = numEmpenho+valor+data+credor
// Persiste: Empenho (com fornecedor, liquidado, pago) e Receita.

const MUNICIPIOS: Record<string, string> = { "01474": "Capim Branco", "01813": "Matozinhos" };

function numBR(s: string): number {
  if (!s || !s.trim()) return 0;
  const n = parseFloat(s.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseDDMMYYYY(s: string): Date | null {
  if (!s || s.length !== 8) return null;
  const d = parseInt(s.slice(0, 2), 10);
  const m = parseInt(s.slice(2, 4), 10) - 1;
  const y = parseInt(s.slice(4, 8), 10);
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000) return null;
  return new Date(y, m, d);
}

function lerCsv(zip: Record<string, Uint8Array>, nome: RegExp): string | null {
  const key = Object.keys(zip).find((k) => nome.test(k));
  return key ? Buffer.from(zip[key]).toString("latin1") : null;
}

function linhas(csv: string | null): string[][] {
  if (!csv) return [];
  return csv
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.split(";"));
}

export const amSicomImporter: Importer = {
  id: "REMESSA_AM",
  nome: "Remessa SICOM — Acompanhamento Mensal (AM)",
  descricao:
    "Pacote ZIP da remessa mensal AM do SICOM: empenhos, liquidações, pagamentos e receitas. Gera Empenho e Receita.",
  formatos: [".zip"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "REMESSA_AM") return 100;
    if (ctx.extensao !== ".zip") return 0;
    if (/^AM_/i.test(ctx.nomeArquivo)) return 95;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const zip = unzipSync(new Uint8Array(buffer));

    const ide = lerCsv(zip, /(^|\/)IDE\.CSV$/i);
    const empCsv = lerCsv(zip, /(^|\/)EMP\.CSV$/i);
    const recCsv = lerCsv(zip, /(^|\/)REC\.CSV$/i);
    const lqdCsv = lerCsv(zip, /(^|\/)LQD\.CSV$/i);
    const opsCsv = lerCsv(zip, /(^|\/)OPS\.CSV$/i);

    if (!ide) throw new Error("ZIP não parece remessa AM (falta IDE.CSV).");

    // IDE: municipio;cnpj;orgao;unidade;exercicio;mes;…
    const idc = ide.trim().split("\n")[0].split(";").map((s) => s.trim());
    const munCod = idc[0] ?? "";
    const orgaoCodigo = idc[2] ?? "";
    const ano = Number(idc[4]) || new Date().getFullYear();
    const mes = Number(idc[5]) || 0;
    const municipio = MUNICIPIOS[munCod] ?? `Município ${munCod}`;

    // Reutiliza o Orgao principal do município se existir (evita fragmentação
    // e garante que os dados apareçam nos dashboards que usam exercicioAtual).
    const orgaoExistente = await db.orgao.findFirst({
      where: { municipio: { contains: municipio } },
      orderBy: { criadoEm: "asc" },
    });
    const orgao = orgaoExistente ?? (await db.orgao.upsert({
      where: { id: `orgao-sicom-${munCod}` },
      update: {},
      create: {
        id: `orgao-sicom-${munCod}`,
        nome: `Município de ${municipio}`,
        municipio,
        uf: "MG",
      },
    }));
    const exercicio = await db.exercicio.upsert({
      where: { orgaoId_ano: { orgaoId: orgao.id, ano } },
      update: {},
      create: { orgaoId: orgao.id, ano, aberto: ano >= new Date().getFullYear() },
    });

    // Idempotência: SICOM é fonte autoritativa — substitui qualquer dado anterior
    // para este exercício/mês (seja de Excel ou de remessa anterior).
    await db.empenho.deleteMany({ where: { exercicioId: exercicio.id, mes } });
    await db.receita.deleteMany({ where: { exercicioId: exercicio.id, mes } });

    // Cache de Secretaria e Unidade (lookups evitam N+1 repetidos).
    const secCache = new Map<string, string>(); // secCod → id
    const uniCache = new Map<string, string>(); // codUnidade → id

    async function obterSecretariaId(codUnidade: string): Promise<string> {
      const secCod = codUnidade.substring(0, 5); // "02006"
      if (secCache.has(secCod)) return secCache.get(secCod)!;
      let sec = await db.secretaria.findFirst({
        where: { orgaoId: orgao.id, codigo: secCod },
      });
      if (!sec) {
        sec = await db.secretaria.create({
          data: {
            id: `sec-sicom-${orgao.id}-${secCod}`,
            orgaoId: orgao.id,
            nome: `Unidade ${secCod}`,
            codigo: secCod,
          },
        });
      }
      secCache.set(secCod, sec.id);
      return sec.id;
    }

    async function obterUnidadeId(codUnidade: string): Promise<string> {
      if (uniCache.has(codUnidade)) return uniCache.get(codUnidade)!;
      const secId = await obterSecretariaId(codUnidade);
      let uni = await db.unidadeOrcamentaria.findFirst({
        where: { secretariaId: secId, codigo: codUnidade },
      });
      if (!uni) {
        uni = await db.unidadeOrcamentaria.create({
          data: {
            id: `uni-sicom-${orgao.id}-${codUnidade}`,
            secretariaId: secId,
            nome: `Unidade ${codUnidade}`,
            codigo: codUnidade,
          },
        });
      }
      uniCache.set(codUnidade, uni.id);
      return uni.id;
    }

    // ── EMP.CSV: monta mapas de empenho + credor ──────────────────────
    // Tipo 10: [1]=orgao [2]=codUnidade [3]=funcao [4]=subfuncao [5]=programa
    //          [6]=acao [7]=fonte [8]=elemento [9]=modalidade [10]=numero
    //          [11]=data(DDMMYYYY) [12]=tipoEmp [13]=modLic [14]=valor [15]=historico
    // Tipo 12: [1]=codUnidade [2]=numEmpenho [3]=tipoPessoa(1=PF,2=PJ) [4]=documento
    type EmpRow = {
      codUnidade: string;
      funcao: string;
      elemento: string;
      fonte: string;
      numero: string;
      data: Date | null;
      valor: number;
      historico: string;
    };
    const empMap = new Map<string, EmpRow>();
    const credorMap = new Map<string, { tipo: string; doc: string }>();

    for (const c of linhas(empCsv)) {
      if (c[0] === "10" && c[10]) {
        empMap.set(c[10], {
          codUnidade: c[2] ?? "",
          funcao: c[3] ?? "",
          elemento: c[8] ?? "",
          fonte: c[7] ?? "",
          numero: c[10],
          data: parseDDMMYYYY(c[11] ?? ""),
          valor: numBR(c[14] ?? ""),
          historico: (c[15] ?? "").trim(),
        });
      } else if (c[0] === "12" && c[2] && c[4] && !credorMap.has(c[2])) {
        credorMap.set(c[2], { tipo: c[3] ?? "2", doc: c[4] });
      }
    }

    // ── LQD.CSV: numEmpenho → {valorLiquidado, dataLiquidacao} ────────
    // Tipo 10: [5]=numEmpenho [7]=data(DDMMYYYY) [9]=valor
    type LqdRow = { valor: number; data: Date | null };
    const lqdMap = new Map<string, LqdRow>();
    for (const c of linhas(lqdCsv)) {
      if (c[0] === "10" && c[5]) {
        const ex = lqdMap.get(c[5]);
        lqdMap.set(c[5], {
          valor: (ex?.valor ?? 0) + numBR(c[9] ?? ""),
          data: parseDDMMYYYY(c[7] ?? "") ?? ex?.data ?? null,
        });
      }
    }

    // ── OPS.CSV: numEmpenho → {valorPago, dataPagamento, credor} ──────
    // Tipo 11: [6]=numEmpenho [4]=data [11]=valor [12]=tipoPessoa [13]=documento
    type OpsRow = { valor: number; data: Date | null; doc?: string; tipo?: string };
    const opsMap = new Map<string, OpsRow>();
    for (const c of linhas(opsCsv)) {
      if (c[0] === "11" && c[6]) {
        const ex = opsMap.get(c[6]);
        opsMap.set(c[6], {
          valor: (ex?.valor ?? 0) + numBR(c[11] ?? ""),
          data: parseDDMMYYYY(c[4] ?? "") ?? ex?.data ?? null,
          doc: c[13] || ex?.doc,
          tipo: c[12] || ex?.tipo,
        });
      }
    }

    // ── REC.CSV: tipo 10 → receitas arrecadadas ───────────────────────
    // Formato V1 (até 2022): 10+ cols — [3]=fonte [5]=codReceita [6]=tipoReceita [9]=valorArrecadado
    // Formato V2 (2023+):     7 cols  — [3]=fonte [5]=codReceita [6]=valorArrecadado
    type RecRow = {
      codigo: string;
      valorArrecadado: number;
      fonte: string;
      origem: string;
    };
    const recDados: RecRow[] = [];
    for (const c of linhas(recCsv)) {
      if (c[0] === "10" && c[5]) {
        const v2 = c.length < 10; // formato compacto: valor em c[6]
        recDados.push({
          codigo: c[5],
          valorArrecadado: numBR(v2 ? (c[6] ?? "") : (c[9] ?? "")),
          fonte: c[3] ?? "",
          origem: v2 ? "" : (c[8] ?? ""),
        });
      }
    }

    // ── Upsert fornecedores (batch) ───────────────────────────────────
    const allDocs = new Map<string, string>(); // doc → tipo
    for (const [, credor] of credorMap) {
      if (credor.doc?.length >= 11) allDocs.set(credor.doc, credor.tipo);
    }
    for (const [, ops] of opsMap) {
      if (ops.doc && ops.doc.length >= 11 && !allDocs.has(ops.doc))
        allDocs.set(ops.doc, ops.tipo ?? "2");
    }

    const fornMap = new Map<string, string>(); // doc → fornecedorId
    for (const [doc, tipo] of allDocs) {
      const existing = await db.fornecedor.findFirst({ where: { documento: doc } });
      if (existing) {
        fornMap.set(doc, existing.id);
      } else {
        const isPJ = tipo === "2" || doc.length >= 14;
        const novo = await db.fornecedor.create({
          data: {
            documento: doc,
            nome: isPJ ? `CNPJ ${doc}` : `CPF ${doc}`,
            tipoPessoa: isPJ ? "PJ" : "PF",
            cadastroCompleto: false,
          },
        });
        fornMap.set(doc, novo.id);
      }
    }

    // ── Cria Empenhos em lote ─────────────────────────────────────────
    let empCreated = 0;
    const empBatch: Record<string, unknown>[] = [];

    for (const [numEmp, emp] of empMap) {
      if (!emp.codUnidade) continue;
      const secId = await obterSecretariaId(emp.codUnidade);
      const uniId = await obterUnidadeId(emp.codUnidade);

      const credor = credorMap.get(numEmp);
      const ops = opsMap.get(numEmp);
      const doc = credor?.doc ?? ops?.doc;
      const fornId = doc ? (fornMap.get(doc) ?? null) : null;
      const lqd = lqdMap.get(numEmp);
      const pagOps = opsMap.get(numEmp);

      empBatch.push({
        exercicioId: exercicio.id,
        numero: numEmp,
        data: emp.data ?? new Date(ano, mes - 1, 1),
        mes,
        secretariaId: secId,
        unidadeId: uniId,
        fornecedorId: fornId,
        funcao: emp.funcao || null,
        elemento: emp.elemento || null,
        fonteRecurso: emp.fonte || null,
        historico: emp.historico || null,
        valorEmpenhado: emp.valor,
        valorLiquidado: lqd?.valor ?? 0,
        valorPago: pagOps?.valor ?? 0,
        dataLiquidacao: lqd?.data ?? null,
        dataPagamento: pagOps?.data ?? null,
        origemDado: "REMESSA_AM",
        codigoExterno: `${munCod}-${orgaoCodigo}-${ano}-${String(mes).padStart(2, "0")}-${numEmp}`,
      });

      if (empBatch.length >= 500) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.empenho.createMany({ data: empBatch.splice(0, 500) as any });
        empCreated += 500;
      }
    }
    if (empBatch.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.empenho.createMany({ data: empBatch as any });
      empCreated += empBatch.length;
    }

    // Atualiza empenhos de meses anteriores que foram liquidados/pagos neste mês.
    let empUpdated = 0;
    const orphLqd = [...lqdMap.entries()].filter(([k]) => !empMap.has(k));
    const orphOps = [...opsMap.entries()].filter(([k]) => !empMap.has(k));
    for (const [numEmp, lqd] of orphLqd) {
      const r = await db.empenho.updateMany({
        where: { exercicioId: exercicio.id, numero: numEmp },
        data: {
          valorLiquidado: lqd.valor,
          ...(lqd.data ? { dataLiquidacao: lqd.data } : {}),
        },
      });
      empUpdated += r.count;
    }
    for (const [numEmp, ops] of orphOps) {
      const r = await db.empenho.updateMany({
        where: { exercicioId: exercicio.id, numero: numEmp },
        data: {
          valorPago: ops.valor,
          ...(ops.data ? { dataPagamento: ops.data } : {}),
        },
      });
      empUpdated += r.count;
    }

    // ── Cria Receitas em lote ─────────────────────────────────────────
    let recCreated = 0;
    const recBatch: Record<string, unknown>[] = [];
    for (const r of recDados) {
      recBatch.push({
        exercicioId: exercicio.id,
        mes,
        codigo: r.codigo,
        descricao: `Receita ${r.codigo}`,
        fonte: r.fonte || null,
        origem: r.origem || null,
        valorArrecadado: r.valorArrecadado,
        origemDado: "REMESSA_AM",
        codigoExterno: `${munCod}-${orgaoCodigo}-${ano}-${String(mes).padStart(2, "0")}-rec-${r.codigo}`,
      });
      if (recBatch.length >= 500) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.receita.createMany({ data: recBatch.splice(0, 500) as any });
        recCreated += 500;
      }
    }
    if (recBatch.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.receita.createMany({ data: recBatch as any });
      recCreated += recBatch.length;
    }

    const total = empCreated + recCreated;
    await db.importacao.create({
      data: {
        tipoDado: "REMESSA_AM",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação SICOM",
        totalRegistros: total,
        registrosOk: total,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({
          municipio,
          orgaoCodigo,
          ano,
          mes,
          empenhos: empCreated,
          empenhosAtualizados: empUpdated,
          receitas: recCreated,
        }),
      },
    });

    return {
      registros: total,
      resumo: `AM SICOM: ${municipio} (órgão ${orgaoCodigo}), ${String(mes).padStart(2, "0")}/${ano} — ${empCreated} empenhos, ${recCreated} receitas.`,
      avisos:
        empUpdated > 0 ? [`${empUpdated} empenhos de meses anteriores atualizados com liquidações/pagamentos deste mês.`] : [],
      dados: { municipio, orgaoCodigo, ano, mes, empenhos: empCreated, receitas: recCreated, empUpdated },
    };
  },
};

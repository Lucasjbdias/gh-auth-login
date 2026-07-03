import * as XLSX from "xlsx";
import { db } from "./db";
import { gerarAlertas } from "./alerts";
import { nomeReceita } from "./sicom";

// =====================================================================
// IMPORTADOR DE EXECUÇÃO ORÇAMENTÁRIA (Excel — padrão SICOM/TCE-MG).
//
// Lê uma planilha com as abas "EXECUÇÃO RECEITA - AAAA" e
// "EXECUÇÃO DESPESA - AAAA" e persiste em Receita, DotacaoOrcamentaria e
// Empenho, criando Órgão/Exercício/Secretarias conforme necessário.
//
// Observações sobre o mapeamento:
//  - A planilha não traz NOMES de secretarias; as unidades orçamentárias são
//    identificadas por código (ÓRGÃO.UNIDADE). Criamos uma "Secretaria" por
//    unidade chamada "U.O. {orgao}.{unid}".
//  - Receita: as linhas analíticas (com FICHA) são usadas para evitar dupla
//    contagem dos subtotais sintéticos. O ESTIMADO anual é distribuído em 12
//    meses para alimentar o gráfico previsto x arrecadado.
// =====================================================================

export interface ResultadoImportacao {
  ano: number;
  orgao: string;
  receitasGravadas: number;
  dotacoesGravadas: number;
  empenhosGravados: number;
  totalEstimadoReceita: number;
  totalArrecadado: number;
  totalOrcadoDespesa: number;
  totalEmpenhado: number;
  totalLiquidado: number;
  totalPago: number;
  alertasGerados: number;
  avisos: string[];
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Classifica a receita em uma origem coarse a partir do código contábil. */
function origemReceita(codigo: string): { origem: string; propria: boolean } {
  if (codigo.startsWith("1.1.1.2") || codigo.startsWith("1.1.1.3"))
    return { origem: "Impostos sobre Patrimônio e Renda", propria: true };
  if (codigo.startsWith("1.1.1.4")) return { origem: "ISS e Impostos s/ Serviços", propria: true };
  if (codigo.startsWith("1.1")) return { origem: "Impostos, Taxas e Contribuições", propria: true };
  if (codigo.startsWith("1.2")) return { origem: "Contribuições", propria: true };
  if (codigo.startsWith("1.3")) return { origem: "Receita Patrimonial", propria: true };
  if (codigo.startsWith("1.6")) return { origem: "Receita de Serviços", propria: true };
  if (codigo.startsWith("1.7")) return { origem: "Transferências Correntes", propria: false };
  if (codigo.startsWith("1.9")) return { origem: "Outras Receitas Correntes", propria: true };
  if (codigo.startsWith("2.4") || codigo.startsWith("2.7"))
    return { origem: "Transferências de Capital", propria: false };
  if (codigo.startsWith("2.")) return { origem: "Receitas de Capital", propria: false };
  return { origem: "Outras Receitas", propria: false };
}

function detectarAno(wb: XLSX.WorkBook, nomeArquivo: string): number {
  for (const nome of wb.SheetNames) {
    const m = nome.match(/(20\d{2})/);
    if (m) return Number(m[1]);
  }
  const m = nomeArquivo.match(/(20\d{2})/);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
}

export async function importarExecucaoOrcamentaria(
  buffer: Buffer,
  nomeArquivo: string
): Promise<ResultadoImportacao> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const avisos: string[] = [];

  const abaReceita = wb.SheetNames.find((n) => /receita/i.test(n));
  const abaDespesa = wb.SheetNames.find((n) => /despesa/i.test(n));
  if (!abaReceita && !abaDespesa) {
    throw new Error(
      "A planilha não tem abas de Execução de Receita/Despesa reconhecíveis."
    );
  }

  const ano = detectarAno(wb, nomeArquivo);

  // Órgão e exercício (Matozinhos). Marca este exercício como o ativo.
  const orgao = await db.orgao.upsert({
    where: { id: `orgao-matozinhos` },
    update: {},
    create: {
      id: `orgao-matozinhos`,
      nome: "Município de Matozinhos",
      tipo: "PREFEITURA",
      municipio: "Matozinhos",
      uf: "MG",
    },
  });

  const exercicio = await db.exercicio.upsert({
    where: { orgaoId_ano: { orgaoId: orgao.id, ano } },
    update: { aberto: true },
    create: { orgaoId: orgao.id, ano, aberto: true },
  });
  // O exercício recém-importado passa a ser o ativo no dashboard.
  await db.exercicio.updateMany({
    where: { NOT: { id: exercicio.id } },
    data: { aberto: false },
  });

  // Idempotência: limpa dados anteriores deste exercício.
  await db.empenho.deleteMany({ where: { exercicioId: exercicio.id } });
  await db.dotacaoOrcamentaria.deleteMany({ where: { exercicioId: exercicio.id } });
  await db.receita.deleteMany({ where: { exercicioId: exercicio.id } });

  // ---------------- RECEITAS ----------------
  let receitasGravadas = 0;
  let totalEstimadoReceita = 0;
  let totalArrecadado = 0;
  if (abaReceita) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaReceita], {
      header: 1,
      raw: true,
      blankrows: false,
    });
    const hIdx = rows.findIndex((r) => txt(r[0]).toUpperCase() === "RECEITA");
    const dados = hIdx >= 0 ? rows.slice(hIdx + 1) : rows;

    const receitas: {
      exercicioId: string;
      mes: number;
      codigo: string;
      descricao: string;
      fonte: string;
      origem: string;
      receitaPropria: boolean;
      valorPrevisto: number;
      valorArrecadado: number;
    }[] = [];

    for (const r of dados) {
      const codigo = txt(r[0]);
      const ficha = txt(r[3]);
      if (!codigo || !/^\d/.test(codigo)) continue;
      if (!ficha) continue; // só linhas analíticas (evita subtotais sintéticos)

      const fonte = txt(r[4]);
      const estimado = num(r[5]);
      // Nomenclatura oficial (Ementário SICOM); cai na heurística se não achar.
      const heur = origemReceita(codigo);
      const dig = codigo.replace(/\D/g, "");
      const descricao = nomeReceita(dig) ?? txt(r[1]) ?? codigo;
      const origem = nomeReceita(dig.slice(0, 2).padEnd(8, "0")) ?? heur.origem;
      const propria = heur.propria;
      const previstoMes = estimado / 12;

      for (let mes = 1; mes <= 12; mes++) {
        const arrec = num(r[5 + mes]); // col6 = Janeiro
        receitas.push({
          exercicioId: exercicio.id,
          mes,
          codigo,
          descricao,
          fonte,
          origem,
          receitaPropria: propria,
          valorPrevisto: previstoMes,
          valorArrecadado: arrec,
        });
        totalArrecadado += arrec;
      }
      totalEstimadoReceita += estimado;
    }

    await criarEmLotes(receitas, (lote) => db.receita.createMany({ data: lote }));
    receitasGravadas = receitas.length;
  } else {
    avisos.push("Aba de receita não encontrada — só despesas foram importadas.");
  }

  // ---------------- DESPESAS ----------------
  let dotacoesGravadas = 0;
  let empenhosGravados = 0;
  let totalOrcadoDespesa = 0;
  let totalEmpenhado = 0;
  let totalLiquidado = 0;
  let totalPago = 0;

  if (abaDespesa) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaDespesa], {
      header: 1,
      raw: true,
      blankrows: false,
    });
    const hIdx = rows.findIndex((r) => txt(r[0]).toUpperCase() === "ORGÃO" || txt(r[0]).toUpperCase() === "ÓRGÃO");
    const dados = hIdx >= 0 ? rows.slice(hIdx + 1) : rows;

    // 1ª passada: descobre as unidades orçamentárias e cria as "secretarias".
    const chavesUnidade = new Set<string>();
    for (const r of dados) {
      if (!txt(r[8])) continue; // sem ficha => não é linha analítica
      chavesUnidade.add(`${txt(r[0]) || "0"}.${txt(r[1]) || "0"}`);
    }
    const mapaSecretaria = new Map<string, string>();
    for (const chave of chavesUnidade) {
      const nome = `U.O. ${chave}`;
      const existente = await db.secretaria.findFirst({
        where: { orgaoId: orgao.id, nome },
      });
      const sec = existente
        ? existente
        : await db.secretaria.create({
            data: { orgaoId: orgao.id, nome, sigla: chave },
          });
      mapaSecretaria.set(chave, sec.id);
    }

    const dotacoes: any[] = [];
    const empenhos: any[] = [];

    for (const r of dados) {
      const ficha = txt(r[8]);
      if (!ficha) continue;
      const chave = `${txt(r[0]) || "0"}.${txt(r[1]) || "0"}`;
      const secretariaId = mapaSecretaria.get(chave) ?? null;
      const funcaoCod = txt(r[3]);
      const funcao = funcaoCod ? `Função ${funcaoCod}` : null;
      const elemento = txt(r[11]) || txt(r[7]) || "Não classificado";
      const fonte = txt(r[12]);
      const orcado = num(r[9]);

      const empTotal = num(r[25]);
      const liqTotal = num(r[38]);
      const pagoTotal = num(r[51]);

      dotacoes.push({
        exercicioId: exercicio.id,
        secretariaId,
        funcao,
        elemento,
        fonteRecurso: fonte,
        valorFixado: orcado,
        valorEmpenhado: empTotal,
        valorLiquidado: liqTotal,
        valorPago: pagoTotal,
      });
      totalOrcadoDespesa += orcado;

      for (let mes = 1; mes <= 12; mes++) {
        const emp = num(r[12 + mes]); // col13 = Janeiro empenhado
        const liq = num(r[25 + mes]); // col26 = Janeiro liquidado
        const pago = num(r[38 + mes]); // col39 = Janeiro pago
        if (emp === 0 && liq === 0 && pago === 0) continue;
        empenhos.push({
          exercicioId: exercicio.id,
          numero: `${ano}/F${ficha}-${String(mes).padStart(2, "0")}`,
          data: new Date(Date.UTC(ano, mes - 1, 15)),
          mes,
          secretariaId,
          funcao,
          elemento,
          fonteRecurso: fonte,
          valorEmpenhado: emp,
          valorLiquidado: liq,
          valorPago: pago,
          dataLiquidacao: liq ? new Date(Date.UTC(ano, mes - 1, 18)) : null,
          dataPagamento: pago ? new Date(Date.UTC(ano, mes - 1, 25)) : null,
        });
        totalEmpenhado += emp;
        totalLiquidado += liq;
        totalPago += pago;
      }
    }

    await criarEmLotes(dotacoes, (lote) => db.dotacaoOrcamentaria.createMany({ data: lote }));
    await criarEmLotes(empenhos, (lote) => db.empenho.createMany({ data: lote }));
    dotacoesGravadas = dotacoes.length;
    empenhosGravados = empenhos.length;
  } else {
    avisos.push("Aba de despesa não encontrada — só receitas foram importadas.");
  }

  // Recalcula alertas com base nos novos dados.
  const alertasGerados = await gerarAlertas(exercicio.id);

  // Registra a importação.
  await db.importacao.create({
    data: {
      tipoDado: "EXECUCAO_ORCAMENTARIA",
      nomeArquivo,
      usuarioResponsavel: "Importação Excel",
      totalRegistros: receitasGravadas + dotacoesGravadas + empenhosGravados,
      registrosOk: receitasGravadas + dotacoesGravadas + empenhosGravados,
      registrosErro: 0,
      status: "PROCESSADO",
      detalhes: JSON.stringify({ ano, orgao: orgao.nome, abas: wb.SheetNames, avisos }),
    },
  });

  return {
    ano,
    orgao: orgao.nome,
    receitasGravadas,
    dotacoesGravadas,
    empenhosGravados,
    totalEstimadoReceita,
    totalArrecadado,
    totalOrcadoDespesa,
    totalEmpenhado,
    totalLiquidado,
    totalPago,
    alertasGerados,
    avisos,
  };
}

/** createMany em lotes (SQLite tem limite de variáveis por statement). */
async function criarEmLotes<T>(
  itens: T[],
  fn: (lote: T[]) => Promise<unknown>,
  tamanho = 200
): Promise<void> {
  for (let i = 0; i < itens.length; i += tamanho) {
    await fn(itens.slice(i, i + tamanho));
  }
}

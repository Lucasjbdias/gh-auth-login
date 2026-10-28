import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador MANAD.TXT — arquivo SEFIP/GFIP pipe-delimited.
// LGPD: NÃO armazena dados individuais de servidores.
// Agrega K050 (servidores) em FolhaPagamento mensal (contagens apenas).
//
// Estrutura dos registros principais:
//   0000 | nome_empregador | cnpj | ... | periodo_inicio | periodo_fim
//   K050 | cnpj_emp | periodo | matricula | cpf | pis | categoria | nome |
//         data_nasc | data_admissao | data_demissao | indicador | tipo | ... | data_opcao_fgts
//
// Categorias SEFIP relevantes:
//   01 = empregado CLT, 05 = avulso, 11 = político, 12 = estatutário,
//   20 = servidor federal, 21 = servidor estadual/municipal

function decode(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  return utf8.includes("�") ? buf.toString("latin1") : utf8;
}

function parseDDMMYYYY(s: string): Date | null {
  if (!s || s.length !== 8) return null;
  const d = parseInt(s.slice(0, 2), 10);
  const mo = parseInt(s.slice(2, 4), 10) - 1;
  const y = parseInt(s.slice(4, 8), 10);
  if (isNaN(d + mo + y) || y < 1900) return null;
  return new Date(y, mo, d);
}

interface ServidorK050 {
  cnpjEmp: string;
  periodo: string; // DDMMAAAA
  matricula: string;
  categoria: string;
  dataAdmissao: Date | null;
  dataDemissao: Date | null;
  indicador: string; // 1=ativo, 3=aposentado, 5=pensionista
}

interface RegistroManad {
  periodoInicio: Date | null;
  periodoFim: Date | null;
  cnpj: string;
  nome: string;
  servidores: ServidorK050[];
}

function parseManad(texto: string): RegistroManad {
  const linhas = texto.replace(/\r/g, "").split("\n");
  let periodoInicio: Date | null = null;
  let periodoFim: Date | null = null;
  let cnpj = "";
  let nome = "";
  const servidores: ServidorK050[] = [];

  for (const ln of linhas) {
    if (!ln.trim()) continue;
    const campos = ln.split("|");
    const tipo = campos[0]?.trim();

    if (tipo === "0000") {
      nome = campos[1]?.trim() ?? "";
      cnpj = (campos[2] ?? "").replace(/[^\d]/g, "");
      periodoInicio = parseDDMMYYYY(campos[6]?.trim() ?? "");
      periodoFim = parseDDMMYYYY(campos[7]?.trim() ?? "");
    } else if (tipo === "K050") {
      const dataAdm = parseDDMMYYYY(campos[9]?.trim() ?? "");
      const dataDem = parseDDMMYYYY(campos[10]?.trim() ?? "");
      const indicador = (campos[11] ?? "").trim();
      servidores.push({
        cnpjEmp: (campos[1] ?? "").replace(/[^\d]/g, ""),
        periodo: campos[2]?.trim() ?? "",
        matricula: campos[3]?.trim() ?? "",
        categoria: campos[6]?.trim() ?? "",
        dataAdmissao: dataAdm,
        dataDemissao: dataDem,
        indicador,
      });
    }
  }

  return { periodoInicio, periodoFim, cnpj, nome, servidores };
}

// Conta servidores ativos em um determinado mês
function contarAtivos(srvs: ServidorK050[], ano: number, mes: number): { ativos: number; inativos: number; comissionados: number } {
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0); // último dia do mês

  let ativos = 0;
  let inativos = 0;
  let comissionados = 0;

  for (const s of srvs) {
    // Admitido antes ou durante o mês
    const admitido = !s.dataAdmissao || s.dataAdmissao <= fimMes;
    // Não demitido antes do mês
    const ativo = !s.dataDemissao || s.dataDemissao >= inicioMes;

    if (!admitido || !ativo) continue;

    if (s.indicador === "1" || s.indicador === "12") ativos++;
    else if (s.indicador === "3" || s.indicador === "5" ||
             (s.dataDemissao && s.dataDemissao < inicioMes)) inativos++;
    else ativos++;

    // Comissionados: categoria 11 (político)
    if (s.categoria === "11") comissionados++;
  }

  return { ativos, inativos, comissionados };
}

export const manadImporter: Importer = {
  id: "MANAD_FOLHA",
  nome: "MANAD / SEFIP (folha agr. LGPD)",
  descricao:
    "Arquivo MANAD.TXT do SEFIP pipe-delimitado. Importa SOMENTE totais agregados de servidores por mês (LGPD: sem CPF ou nome individual).",
  formatos: [".txt"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "MANAD_FOLHA") return 100;
    if (ctx.extensao !== ".txt") return 0;
    const t = ctx.textoCsv ?? "";
    if (/^0000\|/m.test(t) && /^K050\|/m.test(t)) return 96;
    if (/^0000\|/m.test(t) && /^0001\|/m.test(t)) return 88;
    if (/MANAD/i.test(ctx.nomeArquivo) && ctx.extensao === ".txt") return 80;
    return 0;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const texto = decode(buffer);
    const data = parseManad(texto);
    const avisos: string[] = [];

    if (!data.servidores.length) {
      return { registros: 0, resumo: "Nenhum registro K050 encontrado.", avisos: ["Arquivo não contém registros de servidores (K050)."] };
    }

    // Determinar intervalo de meses a processar
    const inicio = data.periodoInicio ?? new Date(2021, 0, 1);
    const fim = data.periodoFim ?? new Date();

    const tenant = await db.tenant.findFirst({ select: { id: true } });
    const tenantId = tenant?.id ?? null;

    let gravados = 0;
    const erros: string[] = [];

    // Percorre cada mês do período
    let cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (cur <= fim) {
      const ano = cur.getFullYear();
      const mes = cur.getMonth() + 1;
      const { ativos, inativos, comissionados } = contarAtivos(data.servidores, ano, mes);
      const total = ativos + inativos;

      if (total === 0) {
        cur = new Date(ano, mes, 1);
        continue;
      }

      try {
        await db.folhaPagamento.upsert({
          where: {
            tenantId_ano_mes_orgaoCodigo_secretariaNome: {
              tenantId: tenantId ?? "",
              ano,
              mes,
              orgaoCodigo: data.cnpj || "MANAD",
              secretariaNome: "GERAL",
            },
          },
          update: {
            qtdServidores: total,
            qtdAtivos: ativos,
            qtdInativos: inativos,
            qtdComissionados: comissionados,
            origemDado: "MANAD",
          },
          create: {
            tenantId: tenantId ?? "",
            ano,
            mes,
            orgaoCodigo: data.cnpj || "MANAD",
            secretariaNome: "GERAL",
            qtdServidores: total,
            qtdAtivos: ativos,
            qtdInativos: inativos,
            qtdComissionados: comissionados,
            origemDado: "MANAD",
          },
        });
        gravados++;
      } catch (e) {
        erros.push(`${ano}/${mes}: ${e instanceof Error ? e.message : String(e)}`);
      }

      cur = new Date(ano, mes, 1);
    }

    avisos.push(`LGPD: apenas totais mensais foram armazenados. Nenhum CPF, PIS ou nome individual foi persistido.`);
    if (erros.length) avisos.push(`${erros.length} mês(es) com erro de gravação.`);

    await db.importacao.create({
      data: {
        tipoDado: "MANAD_FOLHA",
        nomeArquivo: ctx.nomeArquivo,
        totalRegistros: data.servidores.length,
        registrosOk: gravados,
        registrosErro: erros.length,
        status: erros.length === 0 ? "PROCESSADO" : "COM_ERROS",
        detalhes: JSON.stringify({
          totalK050: data.servidores.length,
          mesesGravados: gravados,
          periodoInicio: inicio.toISOString().slice(0, 10),
          periodoFim: fim.toISOString().slice(0, 10),
        }),
      },
    });

    return {
      registros: gravados,
      resumo:
        `MANAD importado: ${data.servidores.length} registros K050. ` +
        `${gravados} meses de folha agregada gravados (${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}). ` +
        `Sem dados individuais (conformidade LGPD).`,
      avisos,
      dados: { totalK050: data.servidores.length, mesesGravados: gravados },
    };
  },
};

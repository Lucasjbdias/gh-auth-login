import { unzipSync } from "fflate";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";
import { nomeConta, classeContabil } from "../sicom";

// Importador de REMESSA SICOM — Balancete (módulo BAL).
// O arquivo é um ZIP com CSVs delimitados por ";":
//   IDE.csv      -> identificação (município;cnpj;órgão;unidade;exercício;mês;data)
//   BALANCETE.csv-> registros: tipo 10 = conta PCASP + saldos (D/C); tipo 17 = por fonte
// Persiste em SaldoContabil, mapeando a conta pelo PCASP. 100% local.

const MUNICIPIOS: Record<string, string> = { "01474": "Capim Branco", "01813": "Matozinhos" };

function numBR(s: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function lerCsv(zip: Record<string, Uint8Array>, nome: RegExp): string | null {
  const key = Object.keys(zip).find((k) => nome.test(k));
  return key ? Buffer.from(zip[key]).toString("latin1") : null;
}

export const balanceteSicomImporter: Importer = {
  id: "REMESSA_BALANCETE",
  nome: "Remessa SICOM — Balancete",
  descricao:
    "Pacote (ZIP) de remessa do Balancete (SICOM): contas contábeis (PCASP) e saldos por mês. Gera a base contábil para análise.",
  formatos: [".zip"],

  detectar(ctx: DetectContext): number {
    if (ctx.tipoHint === "REMESSA_BALANCETE") return 100;
    if (ctx.extensao !== ".zip") return 0;
    if (/balancete/i.test(ctx.nomeArquivo)) return 95;
    return 0; // outros ZIPs vão para o ingestor genérico de remessa
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const zip = unzipSync(new Uint8Array(buffer));
    const ide = lerCsv(zip, /(^|\/)IDE\.csv$/i);
    const bal = lerCsv(zip, /(^|\/)BALANCETE\.csv$/i);
    if (!ide || !bal) {
      throw new Error("ZIP não parece uma remessa de Balancete (faltam IDE.csv/BALANCETE.csv).");
    }

    // IDE: municipio;cnpj;orgao;unidade;exercicio;mes;data
    const idc = ide.trim().split("\n")[0].split(";").map((s) => s.trim());
    const munCod = idc[0] ?? "";
    const orgaoCodigo = idc[2] ?? "";
    const ano = Number(idc[4]) || new Date().getFullYear();
    const mes = Number(idc[5]) || 0;
    const municipio = MUNICIPIOS[munCod] ?? `Município ${munCod}`;

    // Reutiliza o Orgao principal do município se existir (mesma lógica do AM importer).
    const orgaoExistente = await db.orgao.findFirst({
      where: { municipio: { contains: municipio } },
      orderBy: { criadoEm: "asc" },
    });
    const orgao = orgaoExistente ?? (await db.orgao.upsert({
      where: { id: `orgao-sicom-${munCod}` },
      update: {},
      create: { id: `orgao-sicom-${munCod}`, nome: `Município de ${municipio}`, municipio, uf: "MG" },
    }));
    const exercicio = await db.exercicio.upsert({
      where: { orgaoId_ano: { orgaoId: orgao.id, ano } },
      update: {},
      create: { orgaoId: orgao.id, ano, aberto: ano >= new Date().getFullYear() },
    });

    // Idempotência: limpa este (exercício, mês, órgão).
    await db.saldoContabil.deleteMany({ where: { exercicioId: exercicio.id, mes, orgaoCodigo } });

    const linhas = bal.replace(/\r/g, "").split("\n");
    const dados: any[] = [];
    for (const ln of linhas) {
      const c = ln.split(";");
      if (c[0] === "10") {
        const conta = (c[1] || "").trim();
        if (!/^\d+$/.test(conta)) continue;
        dados.push({
          exercicioId: exercicio.id,
          municipio,
          orgaoCodigo,
          mes,
          conta,
          contaNome: nomeConta(conta),
          classe: classeContabil(conta).classe,
          saldoAnterior: numBR(c[3]),
          naturezaAnterior: (c[4] || "").trim() || null,
          debito: numBR(c[5]),
          credito: numBR(c[6]),
          saldoAtual: numBR(c[7]),
          naturezaAtual: (c[8] || "").trim() || null,
          fonte: null,
        });
      }
    }

    let gravados = 0;
    for (let i = 0; i < dados.length; i += 300) {
      await db.saldoContabil.createMany({ data: dados.slice(i, i + 300) });
      gravados += Math.min(300, dados.length - i);
    }

    await db.importacao.create({
      data: {
        tipoDado: "REMESSA_BALANCETE",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação SICOM",
        totalRegistros: gravados,
        registrosOk: gravados,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ municipio, orgaoCodigo, ano, mes, contas: gravados }),
      },
    });

    return {
      registros: gravados,
      resumo: `Balancete SICOM importado: ${municipio} (órgão ${orgaoCodigo}), ${String(mes).padStart(2, "0")}/${ano} — ${gravados} contas contábeis.`,
      avisos: [],
      dados: { municipio, orgaoCodigo, ano, mes, contas: gravados },
    };
  },
};

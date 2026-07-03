import { unzipSync } from "fflate";
import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Ingestor GENÉRICO de remessa SICOM (qualquer módulo: AM, IP, FLPG, Edital,
// Obra, Cadastro Básico, etc.). Descompacta o ZIP e CATALOGA cada CSV: nº de
// linhas, tipos de registro (1ª coluna) e amostras. Não interpreta o negócio —
// serve para reconhecer o conteúdo e embasar os parsers especializados.
// Os módulos com parser dedicado (ex.: Balancete) têm detecção de maior peso.

const MUNICIPIOS: Record<string, string> = { "01474": "Capim Branco", "01813": "Matozinhos" };
const ORGAOS: Record<string, string> = { "01": "Prefeitura", "02": "Câmara" };

function dec(u: Uint8Array): string {
  return Buffer.from(u).toString("latin1");
}

export const remessaGenericaImporter: Importer = {
  id: "REMESSA_SICOM",
  nome: "Remessa SICOM (genérico — qualquer módulo)",
  descricao:
    "Pacote (ZIP) de qualquer módulo do SICOM. Cataloga os arquivos, tipos de registro e amostras — base para análises especializadas.",
  formatos: [".zip"],

  detectar(ctx: DetectContext): number {
    if (ctx.extensao !== ".zip") return 0;
    return 45;
  },

  async importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const zip = unzipSync(new Uint8Array(buffer));
    const nomes = Object.keys(zip);

    // Identificação (IDE.csv), comum às remessas.
    let municipio: string | null = null;
    let orgaoCodigo: string | null = null;
    let ano: number | null = null;
    let mes: number | null = null;
    const ideKey = nomes.find((k) => /(^|\/)IDE\.csv$/i.test(k));
    if (ideKey) {
      const campos = dec(zip[ideKey]).trim().split(/\r?\n/)[0].split(";").map((s) => s.trim());
      municipio = MUNICIPIOS[campos[0]] ?? campos[0] ?? null;
      orgaoCodigo = campos[2] ?? null;
      const anoIdx = campos.findIndex((c) => /^20\d{2}$/.test(c));
      if (anoIdx >= 0) {
        ano = Number(campos[anoIdx]);
        const m = Number(campos[anoIdx + 1]);
        if (m >= 1 && m <= 13) mes = m;
      }
    }

    // Módulo: do nome do arquivo (ex.: "AM_01474_02_04_2026.zip").
    const modulo = (ctx.nomeArquivo.split(/[_\.]/)[0] || "REMESSA").toUpperCase();

    const arquivos = nomes
      .filter((k) => /\.csv$/i.test(k))
      .map((k) => {
        const linhas = dec(zip[k]).replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
        const tipos: Record<string, number> = {};
        for (const l of linhas) {
          const t = l.split(";")[0].trim();
          if (t) tipos[t] = (tipos[t] ?? 0) + 1;
        }
        return {
          nome: k.split("/").pop(),
          linhas: linhas.length,
          tiposRegistro: tipos,
          amostra: linhas.slice(0, 3),
        };
      })
      .filter((a) => (a.linhas ?? 0) > 0);

    const totalLinhas = arquivos.reduce((s, a) => s + a.linhas, 0);

    await db.importacao.create({
      data: {
        tipoDado: `REMESSA_${modulo}`,
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Ingestor SICOM",
        totalRegistros: totalLinhas,
        registrosOk: totalLinhas,
        registrosErro: 0,
        status: "PROCESSADO",
        detalhes: JSON.stringify({ modulo, municipio, orgaoCodigo, ano, mes, arquivos }),
      },
    });

    const orgaoLabel = ORGAOS[orgaoCodigo ?? ""] ?? orgaoCodigo ?? "—";
    return {
      registros: totalLinhas,
      resumo:
        `Remessa ${modulo} catalogada: ${municipio ?? "?"} · ${orgaoLabel} · ` +
        `${mes ? String(mes).padStart(2, "0") + "/" : ""}${ano ?? ""} — ${arquivos.length} arquivos, ${totalLinhas} registros.`,
      avisos: ["Catalogação genérica (sem análise de negócio). Parser especializado é criado por módulo."],
      dados: { modulo, municipio, orgaoCodigo, ano, mes, arquivos: arquivos.length, totalLinhas },
    };
  },
};

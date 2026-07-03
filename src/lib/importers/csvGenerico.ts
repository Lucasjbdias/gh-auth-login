import type { Importer, DetectContext, ImportResult } from "./types";
import { db } from "../db";

// Importador CSV genérico (fallback): valida o formato (separador, colunas,
// campos obrigatórios) e registra a importação, sem persistir dados de negócio.
// Útil para qualquer CSV ainda sem importador dedicado. Quando um formato
// específico ganhar seu próprio Importer, ele terá pontuação de detecção maior.

export const csvGenericoImporter: Importer = {
  id: "CSV_GENERICO",
  nome: "CSV genérico (validação)",
  descricao:
    "Qualquer arquivo .csv. Detecta separador, valida colunas/obrigatórios e registra a importação (sem gravar dados de negócio).",
  formatos: [".csv", ".txt"],

  detectar(ctx: DetectContext): number {
    if ([".csv", ".txt"].includes(ctx.extensao)) return 10; // baixa prioridade (fallback)
    if (ctx.textoCsv && ctx.textoCsv.includes(",")) return 5;
    return 0;
  },

  async importar(_buffer: Buffer, ctx: DetectContext): Promise<ImportResult> {
    const texto = ctx.textoCsv ?? "";
    const linhas = texto
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    if (linhas.length < 1) throw new Error("Arquivo vazio ou sem conteúdo válido.");

    const separador = linhas[0].includes(";") ? ";" : ",";
    const cabecalho = linhas[0].split(separador).map((c) => c.trim());
    const totalColunas = cabecalho.length;

    const dados = linhas.slice(1);
    let registrosOk = 0;
    let registrosErro = 0;
    const erros: { linha: number; motivo: string }[] = [];

    dados.forEach((linha, idx) => {
      const colunas = linha.split(separador);
      const faltando =
        colunas.length < totalColunas ||
        colunas.slice(0, totalColunas).some((c) => c.trim().length === 0);
      if (faltando) {
        registrosErro++;
        if (erros.length < 5) {
          erros.push({
            linha: idx + 2,
            motivo:
              colunas.length < totalColunas
                ? `Esperadas ${totalColunas} colunas, encontradas ${colunas.length}.`
                : "Há colunas obrigatórias em branco.",
          });
        }
      } else {
        registrosOk++;
      }
    });

    const status = registrosErro > 0 ? "COM_ERROS" : "PROCESSADO";
    await db.importacao.create({
      data: {
        tipoDado: ctx.tipoHint || "CSV",
        nomeArquivo: ctx.nomeArquivo,
        usuarioResponsavel: "Importação CSV",
        totalRegistros: dados.length,
        registrosOk,
        registrosErro,
        status,
        detalhes: JSON.stringify({ cabecalho, separador, erros }),
      },
    });

    return {
      registros: dados.length,
      resumo: `CSV "${ctx.nomeArquivo}" validado: ${registrosOk} linha(s) OK, ${registrosErro} com erro(s). Colunas: ${cabecalho.length}.`,
      avisos:
        registrosErro > 0
          ? [`${registrosErro} linha(s) com problemas de formato.`]
          : [],
      dados: { cabecalho, registrosOk, registrosErro, status },
    };
  },
};

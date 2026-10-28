import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { listarImportadores } from "@/lib/importers/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMPORTADORES_DISPONIVEIS = listarImportadores()
  .map((i) => `- ${i.id}: ${i.nome} — ${i.descricao}`)
  .join("\n");

const SYSTEM_PROMPT = `Você é um especialista em análise de dados financeiros municipais brasileiros.
Analise o conteúdo do arquivo fornecido e retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown) com o formato:
{
  "formato": "nome do formato detectado",
  "descricao": "descrição em 1-2 frases do que contém o arquivo",
  "importadorSugerido": "ID do importador ou null",
  "totalLinhas": número estimado de registros de dados,
  "camposIdentificados": ["campo1", "campo2", ...],
  "qualidade": "BOA | MEDIA | BAIXA",
  "observacoes": "notas importantes sobre a qualidade, encoding, colunas ausentes, etc.",
  "insights": "2-3 observações relevantes sobre os dados (valores, período, entidades, etc.)"
}

Importadores disponíveis no sistema:
${IMPORTADORES_DISPONIVEIS}

Se o arquivo for LGPD-sensível (CPF, dados pessoais de servidores), mencione isso em observacoes.`;

function extrairAmostra(buffer: Buffer, nomeArquivo: string): string {
  const ext = (nomeArquivo.match(/\.[^.]+$/)?.[0] || "").toLowerCase();

  if (ext === ".xlsx" || ext === ".xls") {
    try {
      const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 10 });
      const linhas: string[] = [`Arquivo Excel. Abas: ${wb.SheetNames.join(", ")}`];
      for (const sheetName of wb.SheetNames.slice(0, 3)) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
        linhas.push(`\n--- Aba: ${sheetName} ---`);
        for (const row of rows.slice(0, 8)) {
          linhas.push(row.map((c) => String(c ?? "").trim()).join(" | "));
        }
      }
      return linhas.join("\n");
    } catch {
      return buffer.slice(0, 2000).toString("utf8");
    }
  }

  // Texto (CSV, TXT)
  const utf8 = buffer.toString("utf8");
  const texto = utf8.includes("") ? buffer.toString("latin1") : utf8;
  const linhas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  // Primeiras 20 e últimas 5 linhas para contexto
  const amostra = [
    ...linhas.slice(0, 20),
    linhas.length > 25 ? `\n... (${linhas.length - 25} linhas omitidas) ...\n` : "",
    ...linhas.slice(-5),
  ].join("\n");
  return amostra.slice(0, 6000); // limite seguro de tokens
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      erro: "Chave ANTHROPIC_API_KEY não configurada. Configure-a no .env para usar a análise por IA.",
      semIA: true,
    });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, erro: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const amostra = extrairAmostra(buffer, file.name);

    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: process.env.CONSULTOR_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Arquivo: ${file.name} (${(buffer.length / 1024).toFixed(1)} KB)\n\nConteúdo (amostra):\n${amostra}`,
        },
      ],
    });

    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Tenta extrair JSON da resposta
    let analise: Record<string, unknown> | null = null;
    try {
      analise = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (m) {
        try { analise = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!analise) {
      return NextResponse.json({ ok: true, analise: null, textoLivre: texto });
    }

    return NextResponse.json({ ok: true, analise });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao analisar arquivo." },
      { status: 500 }
    );
  }
}

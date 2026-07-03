import { NextResponse } from "next/server";
import { dispatchImport, listarImportadores } from "@/lib/importers/registry";

export const dynamic = "force-dynamic";
// Necessário para ler arquivos binários (Excel) no runtime Node.
export const runtime = "nodejs";

// Catálogo de importadores disponíveis (usado pelo formulário de upload).
export async function GET() {
  return NextResponse.json({ importadores: listarImportadores() });
}

export async function POST(req: Request) {
  try {
    let buffer: Buffer;
    let nomeArquivo: string;
    let tipoDado: string;

    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("application/octet-stream")) {
      // Uploads grandes: arquivo enviado como raw bytes, metadados na query string
      const url = new URL(req.url);
      nomeArquivo = url.searchParams.get("filename") ?? "arquivo.zip";
      tipoDado = url.searchParams.get("tipoDado") ?? "";
      buffer = Buffer.from(await req.arrayBuffer());
    } else {
      // Upload padrão via multipart form-data
      const form = await req.formData();
      const file = form.get("file");
      tipoDado = String(form.get("tipoDado") || "").trim();

      if (!(file instanceof File)) {
        return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
      }

      nomeArquivo = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const resultado = await dispatchImport(buffer, {
      nomeArquivo,
      tipoHint: tipoDado || undefined,
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro interno ao processar a importação." },
      { status: 500 }
    );
  }
}

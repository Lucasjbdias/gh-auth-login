import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PARAMETROS_PADRAO } from "@/lib/parametros";

export const dynamic = "force-dynamic";

// POST /api/parametros
// Corpo: { parametros: { [chave]: valor } }
// Faz upsert de cada parâmetro reconhecido (chaves base = PARAMETROS_PADRAO).
export async function POST(req: Request) {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, erro: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const parametros =
    corpo && typeof corpo === "object" && "parametros" in corpo
      ? (corpo as { parametros?: Record<string, unknown> }).parametros
      : undefined;

  if (!parametros || typeof parametros !== "object") {
    return NextResponse.json(
      { ok: false, erro: "Informe o objeto 'parametros'." },
      { status: 400 }
    );
  }

  const chavesValidas = Object.keys(PARAMETROS_PADRAO);
  const salvos: string[] = [];

  for (const chave of chavesValidas) {
    if (!(chave in parametros)) continue;
    const bruto = (parametros as Record<string, unknown>)[chave];
    const valor = bruto == null ? "" : String(bruto).trim();
    await db.parametro.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });
    salvos.push(chave);
  }

  return NextResponse.json({ ok: true, salvos });
}

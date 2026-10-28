import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testarConfigEmail } from "@/lib/email";

export async function POST() {
  const config = await db.configEmail.findFirst({ where: { ativo: true } });
  if (!config) return NextResponse.json({ ok: false, error: "Nenhuma configuração de email ativa." });

  const resultado = await testarConfigEmail(config.id);
  if (resultado.ok) {
    await db.configEmail.update({ where: { id: config.id }, data: { testadoEm: new Date() } });
  }
  return NextResponse.json(resultado);
}

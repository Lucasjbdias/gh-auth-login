import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const config = await db.configEmail.findFirst({ orderBy: { criadoEm: "desc" } });
  if (!config) return NextResponse.json({ ok: true, config: null });
  // Ocultar senha na resposta
  return NextResponse.json({ ok: true, config: { ...config, senha: config.senha ? "••••••••" : "" } });
}

export async function POST(req: NextRequest) {
  const { host, porta, seguro, usuario, senha, nomeRemetente, emailRemetente } = await req.json();
  if (!host || !usuario || !nomeRemetente || !emailRemetente) {
    return NextResponse.json({ ok: false, error: "Host, usuário, nome e email remetente são obrigatórios." }, { status: 400 });
  }

  const existente = await db.configEmail.findFirst();
  let config;
  if (existente) {
    config = await db.configEmail.update({
      where: { id: existente.id },
      data: {
        host, porta: Number(porta) || 587, seguro: !!seguro,
        usuario, nomeRemetente, emailRemetente,
        ...(senha && senha !== "••••••••" ? { senha } : {}),
        ativo: true,
      },
    });
  } else {
    config = await db.configEmail.create({
      data: { host, porta: Number(porta) || 587, seguro: !!seguro, usuario, senha: senha ?? "", nomeRemetente, emailRemetente },
    });
  }

  return NextResponse.json({ ok: true, config: { ...config, senha: "••••••••" } });
}

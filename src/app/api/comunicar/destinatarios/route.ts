import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const destinatarios = await db.destinatario.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json({ ok: true, destinatarios });
}

export async function POST(req: NextRequest) {
  const { nome, email, cargo, setor, telefone } = await req.json();
  if (!nome || !email) return NextResponse.json({ ok: false, error: "Nome e email são obrigatórios." }, { status: 400 });

  const existente = await db.destinatario.findFirst({ where: { email } });
  if (existente) return NextResponse.json({ ok: false, error: "Email já cadastrado." }, { status: 400 });

  const destinatario = await db.destinatario.create({ data: { nome, email, cargo, setor, telefone } });
  return NextResponse.json({ ok: true, destinatario });
}

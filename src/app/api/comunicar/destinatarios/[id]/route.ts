import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { nome, email, cargo, setor, telefone, ativo } = await req.json();
  const dest = await db.destinatario.update({ where: { id }, data: { nome, email, cargo, setor, telefone, ativo } });
  return NextResponse.json({ ok: true, destinatario: dest });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.destinatario.update({ where: { id }, data: { ativo: false } });
  return NextResponse.json({ ok: true });
}

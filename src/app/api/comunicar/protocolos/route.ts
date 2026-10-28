import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const protocolos = await db.comunicacaoProtocolo.findMany({
    include: {
      destinatarios: { include: { destinatario: true } },
      tramitacoes: { orderBy: { criadoEm: "desc" }, take: 1 },
      _count: { select: { emails: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
  return NextResponse.json({ ok: true, protocolos });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { titulo, descricao, tipo, origemTipo, origemId, municipio, prioridade, prazo, destinatarioIds } = body;

  if (!titulo) return NextResponse.json({ ok: false, error: "Título obrigatório." }, { status: 400 });

  // Gerar número ANO/SEQUENCIAL
  const ano = new Date().getFullYear();
  const count = await db.comunicacaoProtocolo.count();
  const numero = `${ano}/${String(count + 1).padStart(5, "0")}`;

  const protocolo = await db.comunicacaoProtocolo.create({
    data: {
      numero,
      titulo,
      descricao,
      tipo: tipo ?? "COMUNICACAO",
      origemTipo,
      origemId,
      municipio,
      prioridade: prioridade ?? "NORMAL",
      prazo: prazo ? new Date(prazo) : null,
      destinatarios: destinatarioIds?.length
        ? { create: destinatarioIds.map((id: string) => ({ destinatarioId: id, papel: "RESPONSAVEL" })) }
        : undefined,
      tramitacoes: {
        create: { acao: "CRIADO", descricao: `Protocolo ${numero} criado.` },
      },
    },
    include: { destinatarios: { include: { destinatario: true } }, tramitacoes: true },
  });

  return NextResponse.json({ ok: true, protocolo });
}

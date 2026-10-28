import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const protocolo = await db.comunicacaoProtocolo.findUnique({
    where: { id },
    include: {
      destinatarios: { include: { destinatario: true } },
      emails: { orderBy: { criadoEm: "desc" } },
      tramitacoes: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!protocolo) return NextResponse.json({ ok: false, error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, protocolo });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, prioridade, prazo, titulo, descricao, destinatarioIds } = body;

  const data: Record<string, unknown> = {};
  if (status !== undefined) { data.status = status; if (status === "RESOLVIDO") data.resolvidoEm = new Date(); }
  if (prioridade !== undefined) data.prioridade = prioridade;
  if (prazo !== undefined) data.prazo = prazo ? new Date(prazo) : null;
  if (titulo !== undefined) data.titulo = titulo;
  if (descricao !== undefined) data.descricao = descricao;

  const protocolo = await db.comunicacaoProtocolo.update({
    where: { id },
    data,
  });

  if (destinatarioIds !== undefined) {
    await db.protocoloComEmail.deleteMany({ where: { protocoloId: id } });
    if (destinatarioIds.length > 0) {
      await db.protocoloComEmail.createMany({
        data: destinatarioIds.map((did: string) => ({ protocoloId: id, destinatarioId: did })),
      });
    }
  }

  if (status !== undefined) {
    await db.tramitacaoCom.create({
      data: { protocoloId: id, acao: "STATUS_ALTERADO", descricao: `Status alterado para ${status}.` },
    });
  }
  if (prazo !== undefined) {
    await db.tramitacaoCom.create({
      data: { protocoloId: id, acao: "PRAZO_ALTERADO", descricao: prazo ? `Prazo definido para ${new Date(prazo).toLocaleDateString("pt-BR")}.` : "Prazo removido." },
    });
  }

  return NextResponse.json({ ok: true, protocolo });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.comunicacaoProtocolo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

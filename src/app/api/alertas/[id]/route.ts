import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const STATUS_VALIDOS = [
  "NOVO",
  "EM_ANALISE",
  "AGUARDANDO_SECRETARIA",
  "JUSTIFICADO",
  "CORRIGIDO",
  "RESOLVIDO",
  "ESCALADO",
  "ARQUIVADO",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { status?: string; providencia?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { erro: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { status, providencia } = body;

  if (!status || !STATUS_VALIDOS.includes(status)) {
    return NextResponse.json(
      { erro: "Status inválido." },
      { status: 400 }
    );
  }

  try {
    const alerta = await db.alerta.update({
      where: { id },
      data: {
        status,
        providencia,
        dataResolucao: status === "RESOLVIDO" ? new Date() : undefined,
      },
    });

    await db.logAuditoria.create({
      data: {
        acao: "ALERTA_" + status,
        entidade: "Alerta",
        entidadeId: id,
      },
    });

    return NextResponse.json(alerta);
  } catch {
    return NextResponse.json(
      { erro: "Alerta não encontrado ou não foi possível atualizar." },
      { status: 404 }
    );
  }
}

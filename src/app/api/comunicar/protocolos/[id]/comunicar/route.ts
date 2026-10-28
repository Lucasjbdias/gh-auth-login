import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enviarEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tipo, assunto, corpo, paraEmails } = await req.json();

  if (!assunto || !corpo || !paraEmails?.length) {
    return NextResponse.json({ ok: false, error: "Assunto, corpo e destinatários são obrigatórios." }, { status: 400 });
  }

  const resultado = await enviarEmail({ para: paraEmails, assunto, corpo });

  const email = await db.emailProtocolo.create({
    data: {
      protocoloId: id,
      tipo: tipo ?? "INICIAL",
      assunto,
      corpo,
      paraEmails: JSON.stringify(paraEmails),
      status: resultado.ok ? "ENVIADO" : "FALHOU",
      erro: resultado.erro ?? null,
      enviadoEm: resultado.ok ? new Date() : null,
    },
  });

  await db.tramitacaoCom.create({
    data: {
      protocoloId: id,
      acao: resultado.ok ? "EMAIL_ENVIADO" : "EMAIL_FALHOU",
      descricao: resultado.simulado
        ? `Email registrado (sem SMTP configurado): ${assunto}`
        : resultado.ok
        ? `Email enviado para: ${paraEmails.join(", ")}`
        : `Falha ao enviar: ${resultado.erro}`,
    },
  });

  if (resultado.ok) {
    await db.comunicacaoProtocolo.update({
      where: { id },
      data: { status: "AGUARDANDO_RESPOSTA" },
    });
  }

  return NextResponse.json({ ok: resultado.ok, email, simulado: resultado.simulado, erro: resultado.erro });
}

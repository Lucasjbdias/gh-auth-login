import { db } from "@/lib/db";

export interface EnvioEmail {
  para: string[];
  assunto: string;
  corpo: string; // HTML
}

export interface ResultadoEnvio {
  ok: boolean;
  erro?: string;
  simulado?: boolean; // true quando SMTP não configurado
}

export async function enviarEmail(msg: EnvioEmail): Promise<ResultadoEnvio> {
  const config = await db.configEmail.findFirst({ where: { ativo: true } });

  if (!config) {
    return { ok: true, simulado: true };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.porta,
      secure: config.seguro,
      auth: { user: config.usuario, pass: config.senha },
    });

    await transporter.sendMail({
      from: `"${config.nomeRemetente}" <${config.emailRemetente}>`,
      to: msg.para.join(", "),
      subject: msg.assunto,
      html: msg.corpo,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function testarConfigEmail(id: string): Promise<ResultadoEnvio> {
  const config = await db.configEmail.findUnique({ where: { id } });
  if (!config) return { ok: false, erro: "Configuração não encontrada." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.porta,
      secure: config.seguro,
      auth: { user: config.usuario, pass: config.senha },
    });
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

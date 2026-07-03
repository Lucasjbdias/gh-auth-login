import { NextResponse } from "next/server";
import { consultar } from "@/lib/consultor";
import { exercicioAtual } from "@/lib/indicators";
import { nomeMes } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let pergunta = "";
  try {
    const body = await req.json();
    pergunta = (body?.pergunta ?? "").toString();
  } catch {
    pergunta = "";
  }

  if (!pergunta.trim()) {
    return NextResponse.json({
      resposta: "Digite uma pergunta para o consultor.",
      indicador: "—",
      fonte: "—",
      periodo: "—",
    });
  }

  const ex = await exercicioAtual();
  if (!ex) {
    return NextResponse.json({
      resposta:
        "Ainda não há um exercício aberto com dados. Cadastre um exercício e importe os dados para consultar.",
      indicador: "—",
      fonte: "—",
      periodo: "—",
    });
  }

  const periodo = `${nomeMes(new Date().getMonth() + 1)}/${ex.ano}`;
  const r = await consultar(pergunta, ex.id, periodo);
  return NextResponse.json(r);
}

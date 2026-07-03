import { PageHeader } from "@/components/ui";
import { exercicioAtual } from "@/lib/indicators";
import { Chat } from "./Chat";

export const dynamic = "force-dynamic";

export default async function ConsultorPage() {
  const ex = await exercicioAtual();

  return (
    <div>
      <PageHeader
        titulo="Consultor de Dados"
        descricao="Faça perguntas em linguagem natural sobre receitas, despesas, contratos, frota, estoque e alertas do órgão."
      />
      <Chat
        periodo={
          ex ? `${ex.orgao.nome} • Exercício ${ex.ano}` : "Sem exercício aberto"
        }
      />
    </div>
  );
}

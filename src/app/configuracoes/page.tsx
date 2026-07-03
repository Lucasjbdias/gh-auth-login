import { db } from "@/lib/db";
import { exercicioAtual } from "@/lib/indicators";
import { lerParametros, PARAMETROS_PADRAO } from "@/lib/parametros";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  EmptyState,
  Badge,
} from "@/components/ui";
import FormParametros, { CampoParametro } from "./FormParametros";

export const dynamic = "force-dynamic";

// Descrições e unidades amigáveis para cada chave de parâmetro (Seção 15).
const META_PARAMETROS: Record<
  string,
  { descricao: string; unidade: string }
> = {
  contrato_alerta_dias: {
    descricao:
      "Prazos (em dias) para alertar sobre contratos próximos do vencimento. Separe por vírgula para gerar um alerta por faixa.",
    unidade: "dias",
  },
  estoque_alerta_percentual: {
    descricao:
      "Alerta quando o estoque ficar abaixo deste percentual do consumo médio mensal.",
    unidade: "%",
  },
  fornecedor_concentracao_percentual: {
    descricao:
      "Alerta quando um único fornecedor concentrar mais que este percentual dos pagamentos da secretaria.",
    unidade: "%",
  },
  preco_variacao_percentual: {
    descricao:
      "Alerta quando um preço estiver acima da média histórica neste percentual.",
    unidade: "%",
  },
  veiculo_consumo_percentual: {
    descricao:
      "Alerta quando o consumo de combustível de um veículo exceder a média da frota neste percentual.",
    unidade: "%",
  },
  despesa_nao_paga_dias: {
    descricao:
      "Alerta quando uma despesa liquidada permanecer sem pagamento após este número de dias.",
    unidade: "dias",
  },
  despesa_crescimento_percentual: {
    descricao:
      "Alerta quando a despesa de uma secretaria crescer acima deste percentual em relação ao período anterior.",
    unidade: "%",
  },
};

export default async function ConfiguracoesPage() {
  const [orgao, ex, params] = await Promise.all([
    db.orgao.findFirst(),
    exercicioAtual(),
    lerParametros(),
  ]);

  const campos: CampoParametro[] = Object.keys(PARAMETROS_PADRAO).map((chave) => {
    const meta = META_PARAMETROS[chave] ?? { descricao: chave, unidade: "" };
    return {
      chave,
      descricao: meta.descricao,
      unidade: meta.unidade,
      valor: params[chave] ?? PARAMETROS_PADRAO[chave as keyof typeof PARAMETROS_PADRAO],
    };
  });

  return (
    <div>
      <PageHeader
        titulo="Configurações"
        descricao="Dados do órgão e parâmetros do motor de alertas e do consultor."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          rotulo="Órgão"
          valor={orgao?.nome ?? "Não cadastrado"}
          sub={
            orgao
              ? `${orgao.municipio} / ${orgao.uf}${
                  orgao.tipo ? ` · ${orgao.tipo}` : ""
                }`
              : "Cadastre o órgão"
          }
          cor="brand"
        />
        <StatCard
          rotulo="Exercício atual"
          valor={ex ? String(ex.ano) : "Nenhum"}
          sub={ex ? "Exercício aberto" : "Nenhum exercício aberto"}
          cor={ex ? "verde" : "amarelo"}
        />
        <StatCard
          rotulo="Parâmetros configuráveis"
          valor={String(campos.length)}
          sub="Usados pelos alertas e indicadores"
          cor="brand"
        />
      </div>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <CardTitulo>Parâmetros do sistema</CardTitulo>
          <Badge cor="blue">Seção 15</Badge>
        </div>
        <p className="mb-2 text-sm text-slate-500">
          Ajuste os limites que controlam quando os alertas são gerados. As
          alterações passam a valer imediatamente para novas análises.
        </p>
        {campos.length === 0 ? (
          <EmptyState mensagem="Nenhum parâmetro disponível para configuração." />
        ) : (
          <FormParametros campos={campos} />
        )}
      </Card>
    </div>
  );
}

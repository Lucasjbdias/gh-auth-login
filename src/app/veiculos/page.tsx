import { db } from "@/lib/db";
import { resumoFrota, custoPorVeiculo } from "@/lib/indicators";
import { moeda, moedaCompacta, numero } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { GraficoRanking } from "@/components/Charts";

export const dynamic = "force-dynamic";

type SituacaoCor = "green" | "red" | "yellow" | "slate";

function corSituacao(situacao: string): SituacaoCor {
  switch (situacao) {
    case "ATIVO":
      return "green";
    case "PARADO":
      return "red";
    case "MANUTENCAO":
      return "yellow";
    default:
      return "slate";
  }
}

/**
 * Calcula km/l a partir dos abastecimentos: distância percorrida
 * (maior - menor quilometragem registrada) dividida pelo total de litros.
 * Retorna null quando não há dados suficientes.
 */
function calcularKmPorLitro(
  abastecimentos: { litros: number; quilometragem: number | null }[]
): number | null {
  if (abastecimentos.length < 2) return null;
  const kms = abastecimentos
    .map((a) => a.quilometragem)
    .filter((k): k is number => typeof k === "number" && !Number.isNaN(k));
  if (kms.length < 2) return null;
  const distancia = Math.max(...kms) - Math.min(...kms);
  const litros = abastecimentos.reduce((acc, a) => acc + (a.litros || 0), 0);
  if (distancia <= 0 || litros <= 0) return null;
  return distancia / litros;
}

export default async function PaginaVeiculos() {
  const resumo = await resumoFrota();

  if (resumo.total === 0) {
    return (
      <div>
        <PageHeader
          titulo="Painel de Frota"
          descricao="Gestão de veículos, custos de combustível e manutenção."
        />
        <EmptyState mensagem="Nenhum veículo cadastrado. Importe os dados da frota para visualizar o painel." />
      </div>
    );
  }

  const ranking = await custoPorVeiculo(20);
  const veiculos = await db.veiculo.findMany({
    include: { secretaria: true, abastecimentos: true, manutencoes: true },
    orderBy: { placa: "asc" },
  });

  const dadosRanking = ranking
    .filter((v) => v.custoTotal > 0)
    .map((v) => ({ nome: v.placa, valor: v.custoTotal }));

  return (
    <div>
      <PageHeader
        titulo="Painel de Frota"
        descricao="Gestão de veículos, custos de combustível e manutenção."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard rotulo="Frota total" valor={numero(resumo.total, 0)} cor="brand" />
        <StatCard rotulo="Ativos" valor={numero(resumo.ativos, 0)} cor="verde" />
        <StatCard rotulo="Parados" valor={numero(resumo.parados, 0)} cor="vermelho" />
        <StatCard
          rotulo="Gasto combustível"
          valor={moedaCompacta(resumo.gastoCombustivel)}
          sub={moeda(resumo.gastoCombustivel)}
          cor="laranja"
        />
        <StatCard
          rotulo="Gasto manutenção"
          valor={moedaCompacta(resumo.gastoManutencao)}
          sub={moeda(resumo.gastoManutencao)}
          cor="amarelo"
        />
        <StatCard
          rotulo="Custo total"
          valor={moedaCompacta(resumo.custoTotal)}
          sub={moeda(resumo.custoTotal)}
          cor="brand"
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Veículos com maior custo</CardTitulo>
        {dadosRanking.length > 0 ? (
          <GraficoRanking dados={dadosRanking} />
        ) : (
          <EmptyState mensagem="Sem custos registrados para gerar o ranking." />
        )}
      </Card>

      <Card>
        <CardTitulo>Detalhamento da frota</CardTitulo>
        <Tabela
          colunas={[
            "Placa",
            "Modelo",
            "Secretaria",
            "Situação",
            "Combustível",
            "Manutenção",
            "Custo total",
            "Documentação",
            "Consumo (km/l)",
          ]}
        >
          {veiculos.map((v) => {
            const combustivel = v.abastecimentos.reduce(
              (acc, a) => acc + (a.valorTotal || 0),
              0
            );
            const manutencao = v.manutencoes.reduce(
              (acc, m) => acc + (m.valor || 0),
              0
            );
            const custoTotal = combustivel + manutencao;
            const kmL = calcularKmPorLitro(v.abastecimentos);

            return (
              <tr key={v.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{v.placa}</td>
                <td className="px-3 py-2">{v.modelo}</td>
                <td className="px-3 py-2">{v.secretaria?.nome ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge cor={corSituacao(v.situacao)}>{v.situacao}</Badge>
                </td>
                <td className="px-3 py-2">{moeda(combustivel)}</td>
                <td className="px-3 py-2">{moeda(manutencao)}</td>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {moeda(custoTotal)}
                </td>
                <td className="px-3 py-2">
                  {v.documentacaoOk ? (
                    <Badge cor="green">Em dia</Badge>
                  ) : (
                    <Badge cor="red">Pendente</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {kmL !== null ? `${numero(kmL, 1)} km/l` : "—"}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Card>
    </div>
  );
}

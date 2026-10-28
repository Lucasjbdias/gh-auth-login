import { db } from "@/lib/db";
import {
  exercicioAtual,
  resumoReceitas,
  receitaMensal,
  receitaPorOrigem,
} from "@/lib/indicators";
import { moeda, percentual } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { GraficoLinhaMensal, GraficoPizza } from "@/components/Charts";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

export default async function PaginaReceitas() {
  const ex = await exercicioAtual();
  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Painel de Receitas"
          descricao="Acompanhamento da arrecadação municipal"
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados para visualizar as receitas." />
      </div>
    );
  }

  const [resumo, mensal, porOrigem, receitas] = await Promise.all([
    resumoReceitas(ex.id),
    receitaMensal(ex.id),
    receitaPorOrigem(ex.id),
    db.receita.findMany({ where: { exercicioId: ex.id } }),
  ]);

  // Agregação por origem: previsto, arrecadado e % de realização.
  const mapaOrigem = new Map<
    string,
    { previsto: number; arrecadado: number }
  >();
  for (const r of receitas) {
    const chave = r.origem ?? "Não classificada";
    const atual = mapaOrigem.get(chave) ?? { previsto: 0, arrecadado: 0 };
    atual.previsto += r.valorPrevisto || 0;
    atual.arrecadado += r.valorArrecadado || 0;
    mapaOrigem.set(chave, atual);
  }
  const linhasOrigem = [...mapaOrigem.entries()]
    .map(([origem, v]) => ({
      origem,
      previsto: v.previsto,
      arrecadado: v.arrecadado,
      realizacao: v.previsto > 0 ? v.arrecadado / v.previsto : 0,
    }))
    .sort((a, b) => b.arrecadado - a.arrecadado);

  return (
    <div>
      <PageHeader
        titulo="Painel de Receitas"
        descricao={`Acompanhamento da arrecadação — ${ex.orgao.nome} · Exercício ${ex.ano}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard rotulo="Previsto" valor={moeda(resumo.previsto)} cor="brand" />
        <StatCard
          rotulo="Arrecadado"
          valor={moeda(resumo.arrecadado)}
          cor="verde"
        />
        <StatCard
          rotulo="% Realização"
          valor={percentual(resumo.realizacao)}
          cor={resumo.realizacao >= 0.9 ? "verde" : "vermelho"}
        />
        <StatCard
          rotulo="Receita própria"
          valor={moeda(resumo.propria)}
          cor="brand"
        />
        <StatCard
          rotulo="Transferências"
          valor={moeda(resumo.transferencias)}
          cor="laranja"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitulo>Receita mensal: previsto x arrecadado</CardTitulo>
          <GraficoLinhaMensal
            dados={mensal}
            series={[
              { chave: "previsto", nome: "Previsto", cor: "#94a3b8" },
              { chave: "arrecadado", nome: "Arrecadado", cor: "#16a34a" },
            ]}
          />
        </Card>

        <Card>
          <CardTitulo>Receita por origem</CardTitulo>
          {porOrigem.length === 0 ? (
            <EmptyState mensagem="Sem receitas classificadas por origem." />
          ) : (
            <GraficoPizza dados={porOrigem} />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <CardTitulo>Receitas por origem</CardTitulo>
          <BotaoExportar idTabela="tabela-receitas" titulo="Receitas por Origem" />
        </div>
        {linhasOrigem.length === 0 ? (
          <EmptyState mensagem="Nenhuma receita registrada neste exercício." />
        ) : (
          <Tabela
            id="tabela-receitas"
            colunas={["Origem", "Previsto", "Arrecadado", "% Realização", "", ""]}
          >
            {linhasOrigem.map((l) => {
              const abaixo = l.realizacao < 0.9;
              return (
                <tr key={l.origem}>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {l.origem}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {moeda(l.previsto)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {moeda(l.arrecadado)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {percentual(l.realizacao)}
                  </td>
                  <td className="px-3 py-2">
                    {abaixo && <Badge cor="red">Abaixo do esperado</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <BotaoComunicar
                      origemTipo="RECEITA"
                      titulo={`Receita — ${l.origem}`}
                      descricao={`Origem: ${l.origem} | Previsto: ${moeda(l.previsto)} | Arrecadado: ${moeda(l.arrecadado)} | Realização: ${percentual(l.realizacao)}`}
                      prioridade={abaixo ? "ALTA" : "NORMAL"}
                    />
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

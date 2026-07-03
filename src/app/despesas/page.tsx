import { db } from "@/lib/db";
import {
  exercicioAtual,
  resumoDespesas,
  despesaMensal,
  despesaPorSecretaria,
  despesaPorElemento,
  despesaPorFornecedor,
  despesaPorFuncao,
} from "@/lib/indicators";
import { moeda, moedaCompacta, percentual, data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
  BarraProporcao,
} from "@/components/ui";
import { GraficoBarraMensal, GraficoRanking } from "@/components/Charts";

export const dynamic = "force-dynamic";

export default async function PaginaDespesas() {
  const ex = await exercicioAtual();
  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Painel de Despesas"
          descricao="Execução orçamentária da despesa pública"
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados para visualizar as despesas." />
      </div>
    );
  }

  const [
    resumo,
    mensal,
    porSecretaria,
    porElemento,
    porFornecedor,
    porFuncao,
    maioresEmpenhos,
  ] = await Promise.all([
    resumoDespesas(ex.id),
    despesaMensal(ex.id),
    despesaPorSecretaria(ex.id),
    despesaPorElemento(ex.id),
    despesaPorFornecedor(ex.id, 10),
    despesaPorFuncao(ex.id),
    db.empenho.findMany({
      where: { exercicioId: ex.id },
      orderBy: { valorEmpenhado: "desc" },
      take: 10,
      include: { fornecedor: true, secretaria: true },
    }),
  ]);

  const totalFornecedor = porFornecedor.reduce((acc, f) => acc + f.valor, 0);

  return (
    <div>
      <PageHeader
        titulo="Painel de Despesas"
        descricao={`Execução orçamentária da despesa — ${ex.orgao.nome} · Exercício ${ex.ano}`}
      />

      {/* Indicadores principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard rotulo="Fixado" valor={moedaCompacta(resumo.fixado)} cor="brand" />
        <StatCard
          rotulo="Empenhado"
          valor={moedaCompacta(resumo.empenhado)}
          sub={`${percentual(resumo.execucao)} do fixado`}
          cor="laranja"
        />
        <StatCard
          rotulo="Liquidado"
          valor={moedaCompacta(resumo.liquidado)}
          cor="amarelo"
        />
        <StatCard rotulo="Pago" valor={moedaCompacta(resumo.pago)} cor="verde" />
        <StatCard
          rotulo="Saldo"
          valor={moedaCompacta(resumo.saldo)}
          sub="Fixado − Empenhado"
          cor={resumo.saldo < 0 ? "vermelho" : "brand"}
        />
      </div>

      {/* Execução mensal */}
      <div className="mt-6">
        <Card>
          <CardTitulo>Execução mensal da despesa</CardTitulo>
          <GraficoBarraMensal
            dados={mensal}
            series={[
              { chave: "empenhado", nome: "Empenhado", cor: "#ea580c" },
              { chave: "liquidado", nome: "Liquidado", cor: "#ca8a04" },
              { chave: "pago", nome: "Pago", cor: "#16a34a" },
            ]}
          />
        </Card>
      </div>

      {/* Rankings */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitulo>Despesa empenhada por secretaria</CardTitulo>
          {porSecretaria.length === 0 ? (
            <EmptyState mensagem="Sem despesas por secretaria neste exercício." />
          ) : (
            <GraficoRanking dados={porSecretaria.slice(0, 10)} />
          )}
        </Card>
        <Card>
          <CardTitulo>Despesa por elemento</CardTitulo>
          {porElemento.length === 0 ? (
            <EmptyState mensagem="Sem despesas por elemento neste exercício." />
          ) : (
            <GraficoRanking dados={porElemento.slice(0, 10)} />
          )}
        </Card>
      </div>

      {/* Despesa por função de governo */}
      <div className="mt-6">
        <Card>
          <CardTitulo>Despesa por função de governo</CardTitulo>
          {porFuncao.length === 0 ? (
            <EmptyState mensagem="Sem despesas por função neste exercício." />
          ) : (
            <GraficoRanking dados={porFuncao.slice(0, 12)} />
          )}
        </Card>
      </div>

      {/* Tabela: maiores fornecedores (por valor pago) */}
      <div className="mt-6">
        <Card>
          <CardTitulo>Maiores fornecedores (por valor pago)</CardTitulo>
          {porFornecedor.length === 0 ? (
            <EmptyState mensagem="Sem pagamentos a fornecedores neste exercício." />
          ) : (
            <Tabela colunas={["#", "Fornecedor", "Valor pago", "Participação"]}>
              {porFornecedor.map((f, i) => (
                <tr key={f.nome}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{f.nome}</td>
                  <td className="px-3 py-2 text-slate-700">{moeda(f.valor)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-32">
                        <BarraProporcao valor={f.valor} total={totalFornecedor} />
                      </div>
                      <span className="text-xs text-slate-500">
                        {percentual(totalFornecedor ? f.valor / totalFornecedor : 0)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      </div>

      {/* Tabela: maiores empenhos */}
      <div className="mt-6">
        <Card>
          <CardTitulo>Maiores empenhos</CardTitulo>
          {maioresEmpenhos.length === 0 ? (
            <EmptyState mensagem="Sem empenhos registrados neste exercício." />
          ) : (
            <Tabela
              colunas={[
                "Número",
                "Data",
                "Fornecedor",
                "Secretaria",
                "Elemento",
                "Empenhado",
                "Pago",
              ]}
            >
              {maioresEmpenhos.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{e.numero}</td>
                  <td className="px-3 py-2 text-slate-600">{data(e.data)}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {e.fornecedor?.nome ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {e.secretaria?.nome ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge cor="slate">{e.elemento ?? "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {moeda(e.valorEmpenhado)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{moeda(e.valorPago)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      </div>
    </div>
  );
}

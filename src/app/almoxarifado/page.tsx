import { db } from "@/lib/db";
import { resumoEstoque } from "@/lib/indicators";
import { moeda, moedaCompacta, numero, data } from "@/lib/format";
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

export default async function PaginaAlmoxarifado() {
  const estoque = await resumoEstoque();

  if (estoque.totalProdutos === 0) {
    return (
      <div>
        <PageHeader
          titulo="Almoxarifado"
          descricao="Controle de estoque e movimentações do almoxarifado."
        />
        <EmptyState mensagem="Nenhum produto cadastrado. Importe os dados do almoxarifado." />
      </div>
    );
  }

  const movimentacoes = await db.movimentacaoAlmoxarifado.findMany({
    include: { produto: true, secretaria: true },
    orderBy: { data: "desc" },
  });

  // Totais ENTRADA vs SAIDA (em valor).
  let totalEntrada = 0;
  let totalSaida = 0;
  let qtdEntrada = 0;
  let qtdSaida = 0;
  const saidaPorSecretaria = new Map<string, number>();

  for (const m of movimentacoes) {
    const valor = (m.quantidade || 0) * (m.valorUnitario || 0);
    if (m.tipo === "ENTRADA") {
      totalEntrada += valor;
      qtdEntrada += 1;
    } else if (m.tipo === "SAIDA") {
      totalSaida += valor;
      qtdSaida += 1;
      const sec = m.secretaria?.nome ?? "Sem secretaria";
      saidaPorSecretaria.set(sec, (saidaPorSecretaria.get(sec) ?? 0) + valor);
    }
  }

  const dadosSaidaSecretaria = [...saidaPorSecretaria.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  const ultimasMovimentacoes = movimentacoes.slice(0, 15);

  return (
    <div>
      <PageHeader
        titulo="Almoxarifado"
        descricao="Controle de estoque e movimentações do almoxarifado."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          rotulo="Produtos cadastrados"
          valor={numero(estoque.totalProdutos, 0)}
          cor="brand"
        />
        <StatCard
          rotulo="Valor em estoque"
          valor={moeda(estoque.valorTotal)}
          sub={moedaCompacta(estoque.valorTotal)}
          cor="verde"
        />
        <StatCard
          rotulo="Produtos críticos"
          valor={numero(estoque.produtosCriticos, 0)}
          sub="Estoque no mínimo ou abaixo"
          cor={estoque.produtosCriticos > 0 ? "vermelho" : "verde"}
        />
        <StatCard
          rotulo="Movimentações"
          valor={numero(movimentacoes.length, 0)}
          sub={`${numero(qtdEntrada, 0)} entradas / ${numero(qtdSaida, 0)} saídas`}
          cor="laranja"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatCard
          rotulo="Total de entradas"
          valor={moeda(totalEntrada)}
          sub={`${numero(qtdEntrada, 0)} movimentações`}
          cor="verde"
        />
        <StatCard
          rotulo="Total de saídas"
          valor={moeda(totalSaida)}
          sub={`${numero(qtdSaida, 0)} movimentações`}
          cor="laranja"
        />
      </div>

      <div className="mb-6">
        <Card>
          <CardTitulo>Produtos críticos</CardTitulo>
          {estoque.criticos.length === 0 ? (
            <EmptyState mensagem="Nenhum produto com estoque crítico." />
          ) : (
            <Tabela
              colunas={[
                "Código",
                "Descrição",
                "Categoria",
                "Estoque atual",
                "Estoque mínimo",
                "Custo médio",
              ]}
            >
              {estoque.criticos.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {p.codigo}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {p.descricao}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.categoria}</td>
                  <td className="px-3 py-2">
                    <Badge cor="red">
                      {numero(p.estoqueAtual, 0)} {p.unidadeMedida}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {numero(p.estoqueMinimo, 0)} {p.unidadeMedida}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {moeda(p.custoMedio)}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <Card>
          <CardTitulo>Saídas por secretaria</CardTitulo>
          {dadosSaidaSecretaria.length === 0 ? (
            <EmptyState mensagem="Nenhuma saída registrada." />
          ) : (
            <GraficoRanking dados={dadosSaidaSecretaria} />
          )}
        </Card>
      </div>

      <div>
        <Card>
          <CardTitulo>Últimas movimentações</CardTitulo>
          {ultimasMovimentacoes.length === 0 ? (
            <EmptyState mensagem="Nenhuma movimentação registrada." />
          ) : (
            <Tabela
              colunas={["Data", "Produto", "Tipo", "Quantidade", "Secretaria"]}
            >
              {ultimasMovimentacoes.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 text-slate-600">{data(m.data)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {m.produto?.descricao ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge cor={m.tipo === "ENTRADA" ? "green" : "yellow"}>
                      {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {numero(m.quantidade, 0)}{" "}
                    {m.produto?.unidadeMedida ?? ""}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {m.secretaria?.nome ?? "—"}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { moeda, moedaCompacta, numero, percentual } from "@/lib/format";
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
import { GraficoRanking } from "@/components/Charts";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

export default async function PaginaFornecedores() {
  const totalFornecedores = await db.fornecedor.count();
  if (totalFornecedores === 0) {
    return (
      <div>
        <PageHeader titulo="Painel de Fornecedores" descricao="Visão consolidada dos fornecedores do órgão." />
        <EmptyState mensagem="Nenhum fornecedor cadastrado. Importe a Relação de NAF para popular os fornecedores." />
      </div>
    );
  }

  // Compras por fornecedor a partir dos itens comprados (NAF vincula fornecedor).
  const agrupado = await db.itemComprado.groupBy({
    by: ["fornecedorId"],
    where: { fornecedorId: { not: null } },
    _sum: { valorTotal: true },
    _count: true,
  });

  const ids = agrupado.map((a) => a.fornecedorId!).filter(Boolean);
  const fornecedores = await db.fornecedor.findMany({ where: { id: { in: ids } } });
  const mapForn = new Map(fornecedores.map((f) => [f.id, f]));

  const linhas = agrupado
    .map((a) => {
      const f = mapForn.get(a.fornecedorId!);
      return {
        id: a.fornecedorId!,
        nome: f?.nome ?? "—",
        documento: f?.documento ?? null,
        itens: a._count,
        total: a._sum.valorTotal ?? 0,
      };
    })
    .sort((x, y) => y.total - x.total);

  const semDocumento = await db.fornecedor.count({ where: { OR: [{ documento: null }, { documento: "" }] } });
  const totalComprado = linhas.reduce((s, l) => s + l.total, 0);
  const ranking = linhas.slice(0, 10).map((l) => ({ nome: l.nome.slice(0, 28), valor: l.total }));

  // Concentração: maior fornecedor sobre o total.
  const concentracaoTop = totalComprado > 0 && linhas[0] ? linhas[0].total / totalComprado : 0;

  return (
    <div>
      <PageHeader titulo="Painel de Fornecedores" descricao="Visão consolidada dos fornecedores e suas compras (Relação de NAF)." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Total de fornecedores" valor={numero(totalFornecedores, 0)} cor="brand" />
        <StatCard rotulo="Com compras" valor={numero(linhas.length, 0)} sub="vinculados a NAF" cor="brand" />
        <StatCard
          rotulo="Cadastro incompleto"
          valor={numero(semDocumento, 0)}
          sub="Sem CNPJ/CPF"
          cor={semDocumento > 0 ? "amarelo" : "verde"}
        />
        <StatCard rotulo="Total comprado" valor={moedaCompacta(totalComprado)} sub="Soma dos itens" cor="verde" />
      </div>

      {linhas[0] && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Maior fornecedor: <strong>{linhas[0].nome}</strong> concentra{" "}
          <strong>{percentual(concentracaoTop)}</strong> do total comprado ({moeda(linhas[0].total)}).
        </div>
      )}

      {ranking.length > 0 && (
        <Card className="mb-6">
          <CardTitulo>Top 10 fornecedores por valor comprado</CardTitulo>
          <GraficoRanking dados={ranking} />
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <CardTitulo>Fornecedores (por valor comprado)</CardTitulo>
          <BotaoExportar idTabela="tabela-fornecedores" titulo="Fornecedores" />
        </div>
        <Tabela id="tabela-fornecedores" colunas={["Nome", "CNPJ/CPF", "Nº de itens", "Total comprado", "% do total", ""]}>
          {linhas.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">{l.nome}</td>
              <td className="px-3 py-2">
                {l.documento ? l.documento : <Badge cor="red">Sem documento</Badge>}
              </td>
              <td className="px-3 py-2 text-right text-slate-600">{numero(l.itens, 0)}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-900">{moeda(l.total)}</td>
              <td className="px-3 py-2 w-40">
                <div className="flex items-center gap-2">
                  <BarraProporcao valor={l.total} total={linhas[0]?.total ?? 1} />
                  <span className="w-12 text-right text-xs text-slate-500">
                    {percentual(totalComprado ? l.total / totalComprado : 0)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                <BotaoComunicar
                  origemTipo="FORNECEDOR"
                  origemId={l.id}
                  titulo={`Fornecedor ${l.nome}`}
                  descricao={`Fornecedor: ${l.nome} | Documento: ${l.documento ?? "—"} | Total comprado: ${moeda(l.total)}`}
                />
              </td>
            </tr>
          ))}
        </Tabela>
      </Card>
    </div>
  );
}

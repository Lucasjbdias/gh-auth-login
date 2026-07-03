import { db } from "@/lib/db";
import { moeda, numero } from "@/lib/format";
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

export const dynamic = "force-dynamic";

const LIMITE_LISTA = 100;

export default async function ProdutosPage() {
  const total = await db.produto.count();

  if (total === 0) {
    return (
      <div>
        <PageHeader titulo="Produtos" descricao="Catálogo de produtos do almoxarifado" />
        <EmptyState mensagem="Nenhum produto cadastrado. Importe o catálogo de produtos." />
      </div>
    );
  }

  // Indicadores leves (sem carregar todo o catálogo).
  const raw = await db.$queryRawUnsafe<{ v: number }[]>(
    "SELECT COALESCE(SUM(estoqueAtual*custoMedio),0) AS v FROM Produto"
  );
  const valorTotalEstoque = Number(raw[0]?.v ?? 0);
  const comMinimo = await db.produto.findMany({ where: { estoqueMinimo: { gt: 0 } } });
  const criticos = comMinimo.filter((p) => p.estoqueAtual <= p.estoqueMinimo).length;

  // Distribuição por grupo (categoria).
  const grupos = await db.produto.groupBy({
    by: ["categoria"],
    _count: true,
    orderBy: { _count: { categoria: "desc" } },
    take: 10,
  });
  const maxGrupo = grupos[0]?._count ?? 0;

  // Lista: primeiros N por descrição (a base é grande; lista paginada virá depois).
  const produtos = await db.produto.findMany({
    orderBy: { descricao: "asc" },
    take: LIMITE_LISTA,
  });

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        descricao="Catálogo de produtos do almoxarifado"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard rotulo="Total de produtos" valor={numero(total, 0)} cor="brand" />
        <StatCard
          rotulo="Valor total em estoque"
          valor={moeda(valorTotalEstoque)}
          sub="Estoque atual × custo médio"
          cor="verde"
        />
        <StatCard
          rotulo="Produtos críticos"
          valor={numero(criticos, 0)}
          sub="Com estoque mínimo definido"
          cor={criticos > 0 ? "vermelho" : "verde"}
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Produtos por grupo</CardTitulo>
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.categoria ?? "—"}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-700">{g.categoria ?? "Não classificado"}</span>
                <span className="font-medium text-slate-900">{numero(g._count, 0)}</span>
              </div>
              <BarraProporcao valor={g._count} total={maxGrupo} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitulo>Lista de produtos</CardTitulo>
        <p className="mb-3 text-xs text-slate-400">
          Mostrando os primeiros {numero(Math.min(LIMITE_LISTA, total), 0)} de {numero(total, 0)} produtos
          (ordem alfabética).
        </p>
        <Tabela colunas={["Código", "Descrição", "Categoria", "Unidade", "Estoque", "Mínimo", "Status"]}>
          {produtos.map((p) => {
            const critico = p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo;
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.codigo}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{p.descricao}</td>
                <td className="px-3 py-2 text-slate-600">{p.categoria}</td>
                <td className="px-3 py-2 text-slate-600">{p.unidadeMedida}</td>
                <td className="px-3 py-2 text-right">{numero(p.estoqueAtual, 0)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{numero(p.estoqueMinimo, 0)}</td>
                <td className="px-3 py-2">
                  {critico ? <Badge cor="red">Crítico</Badge> : <Badge cor="slate">—</Badge>}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Card>
    </div>
  );
}

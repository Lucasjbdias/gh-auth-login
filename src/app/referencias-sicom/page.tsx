import Link from "next/link";
import { PageHeader, Card, StatCard, Tabela, EmptyState } from "@/components/ui";
import { resumoSicom, amostra } from "@/lib/sicom";

export const dynamic = "force-dynamic";

const TABS: { id: "receita" | "despesa" | "fontes" | "rubricas"; label: string }[] = [
  { id: "receita", label: "Receita (Ementário)" },
  { id: "despesa", label: "Despesa (Naturezas)" },
  { id: "fontes", label: "Fontes de Recurso" },
  { id: "rubricas", label: "Rubricas da Folha" },
];

export default async function ReferenciasSicom({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tabela = (TABS.find((t) => t.id === sp.tabela)?.id ?? "receita") as
    | "receita" | "despesa" | "fontes" | "rubricas";
  const q = sp.q ?? "";
  const r = resumoSicom();
  const linhas = amostra(tabela, q, 80);

  return (
    <div>
      <PageHeader
        titulo="Referências SICOM"
        descricao="Tabelas oficiais TCE-MG 2026 embutidas no sistema (dicionários de classificação)"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Naturezas de receita" valor={String(r.receita)} sub="Ementário 2026" cor="verde" />
        <StatCard rotulo="Naturezas de despesa" valor={String(r.despesa)} sub="Tabela de Despesas 2026" cor="brand" />
        <StatCard rotulo="Fontes de recurso" valor={String(r.fontes)} sub="Tabela de Fontes 2026" cor="laranja" />
        <StatCard rotulo="Rubricas da folha" valor={String(r.rubricas)} sub="Natureza das Rubricas" cor="amarelo" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/referencias-sicom?tabela=${t.id}`}
              className={`rounded-full px-3 py-1 text-sm ${tabela === t.id ? "bg-brand-500 font-medium text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {t.label}
            </Link>
          ))}
          <form className="ml-auto flex gap-2" action="/referencias-sicom" method="get">
            <input type="hidden" name="tabela" value={tabela} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por código ou nome…"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
              Buscar
            </button>
          </form>
        </div>

        {linhas.length === 0 ? (
          <EmptyState mensagem="Nenhum registro encontrado para a busca." />
        ) : (
          <Tabela colunas={["Código", "Descrição oficial"]}>
            {linhas.map((l) => (
              <tr key={l.codigo} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.codigo}</td>
                <td className="px-3 py-2 text-slate-800">{l.nome}</td>
              </tr>
            ))}
          </Tabela>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Mostrando até 80 resultados. Estes dicionários classificam receitas, despesas, fontes e a folha
          com a nomenclatura oficial do SICOM, e validam os dados importados.
        </p>
      </Card>
    </div>
  );
}

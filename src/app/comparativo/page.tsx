import { comparativoExercicios, type LinhaDesvio } from "@/lib/comparativo";
import { moeda, moedaCompacta, percentual, nomeMes } from "@/lib/format";
import { PageHeader, Card, CardTitulo, StatCard, Tabela, EmptyState, Badge } from "@/components/ui";
import { GraficoLinhaMensal } from "@/components/Charts";

export const dynamic = "force-dynamic";

// Badge de variação. `aumentoRuim`=true → aumento é vermelho (despesa);
// false → aumento é verde (receita).
function BadgeVar({ v, aumentoRuim }: { v: number; aumentoRuim: boolean }) {
  const sobe = v >= 0;
  const cor = sobe === aumentoRuim ? "red" : "green";
  const sinal = sobe ? "+" : "";
  return <Badge cor={cor}>{sinal}{percentual(v)}</Badge>;
}

function TabelaDesvios({
  titulo,
  linhas,
  aumentoRuim,
}: {
  titulo: string;
  linhas: LinhaDesvio[];
  aumentoRuim: boolean;
}) {
  return (
    <Card>
      <CardTitulo>{titulo}</CardTitulo>
      {linhas.length === 0 ? (
        <EmptyState mensagem="Sem dados para comparar." />
      ) : (
        <Tabela colunas={["Item", "Ano anterior", "Ano atual", "Desvio (R$)", "Variação"]}>
          {linhas.map((l) => (
            <tr key={l.nome} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-800">{l.nome}</td>
              <td className="px-3 py-2 text-right text-slate-500">{moeda(l.anterior)}</td>
              <td className="px-3 py-2 text-right text-slate-800">{moeda(l.atual)}</td>
              <td className={`px-3 py-2 text-right font-medium ${l.delta >= 0 ? "text-slate-800" : "text-slate-500"}`}>
                {l.delta >= 0 ? "+" : ""}{moeda(l.delta)}
              </td>
              <td className="px-3 py-2"><BadgeVar v={l.varPct} aumentoRuim={aumentoRuim} /></td>
            </tr>
          ))}
        </Tabela>
      )}
    </Card>
  );
}

export default async function ComparativoPage() {
  const c = await comparativoExercicios();

  if (!c) {
    return (
      <div>
        <PageHeader titulo="Comparativo Anual e Desvios" />
        <EmptyState mensagem="É preciso ter ao menos dois exercícios importados (ex.: 2025 e 2026) para comparar." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Comparativo Anual e Desvios"
        descricao={`${c.orgao} — ${c.anoAnterior} × ${c.anoAtual}, período equivalente: Janeiro a ${nomeMes(c.mesCorte)}`}
      />

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">
        Comparação em <strong>período equivalente</strong> (Jan–{nomeMes(c.mesCorte)} de cada ano), para isolar
        o desvio real do efeito de meses ainda não executados em {c.anoAtual}.
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          rotulo={`Receita arrecadada ${c.anoAtual}`}
          valor={moedaCompacta(c.receita.atual)}
          sub={`${c.anoAnterior}: ${moedaCompacta(c.receita.anterior)}`}
          cor={c.receita.varPct >= 0 ? "verde" : "vermelho"}
        />
        <StatCard
          rotulo="Variação da receita"
          valor={`${c.receita.varPct >= 0 ? "+" : ""}${percentual(c.receita.varPct)}`}
          sub="vs. ano anterior"
          cor={c.receita.varPct >= 0 ? "verde" : "vermelho"}
        />
        <StatCard
          rotulo={`Despesa empenhada ${c.anoAtual}`}
          valor={moedaCompacta(c.despesa.empAtual)}
          sub={`${c.anoAnterior}: ${moedaCompacta(c.despesa.empAnterior)}`}
          cor="brand"
        />
        <StatCard
          rotulo="Variação da despesa"
          valor={`${c.despesa.varEmp >= 0 ? "+" : ""}${percentual(c.despesa.varEmp)}`}
          sub="empenhado, vs. ano anterior"
          cor={c.despesa.varEmp >= 0 ? "laranja" : "verde"}
        />
      </div>

      {/* Gráficos mensais */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitulo>Receita arrecadada por mês</CardTitulo>
          <GraficoLinhaMensal
            dados={c.receita.mensal}
            series={[
              { chave: "anterior", nome: String(c.anoAnterior), cor: "#94a3b8" },
              { chave: "atual", nome: String(c.anoAtual), cor: "#16a34a" },
            ]}
          />
        </Card>
        <Card>
          <CardTitulo>Despesa empenhada por mês</CardTitulo>
          <GraficoLinhaMensal
            dados={c.despesa.mensal}
            series={[
              { chave: "anterior", nome: String(c.anoAnterior), cor: "#94a3b8" },
              { chave: "atual", nome: String(c.anoAtual), cor: "#1d6fd6" },
            ]}
          />
        </Card>
      </div>

      {/* Desvios */}
      <div className="grid grid-cols-1 gap-6">
        <TabelaDesvios titulo="Maiores desvios de receita (por origem)" linhas={c.receita.porOrigem} aumentoRuim={false} />
        <TabelaDesvios titulo="Maiores desvios de despesa (por elemento)" linhas={c.despesa.porElemento} aumentoRuim={true} />
        <TabelaDesvios titulo="Maiores desvios de despesa (por unidade orçamentária)" linhas={c.despesa.porUnidade} aumentoRuim={true} />
      </div>
    </div>
  );
}

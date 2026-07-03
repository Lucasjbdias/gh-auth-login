import Link from "next/link";
import {
  exercicioAtual,
  resumoReceitas,
  resumoDespesas,
  despesaPorSecretaria,
  rankingFornecedores,
  contratosVencendo,
  resumoFrota,
  resumoEstoque,
  resumoAlertas,
  receitaMensal,
} from "@/lib/indicators";
import { db } from "@/lib/db";
import { moeda, moedaCompacta, percentual, data, nomeMes } from "@/lib/format";
import { PageHeader, Card, CardTitulo, StatCard, Tabela, EmptyState, BarraProporcao } from "@/components/ui";
import { GraficoLinhaMensal } from "@/components/Charts";

export const dynamic = "force-dynamic";

export default async function VisaoGeral() {
  const exercicio = await exercicioAtual();

  if (!exercicio) {
    return (
      <div>
        <PageHeader titulo="Visão Geral" />
        <Card>
          <p className="text-slate-600">
            Nenhum exercício financeiro encontrado. Rode <code className="rounded bg-slate-100 px-1">npm run setup</code> para
            criar o banco e os dados de exemplo, ou cadastre um órgão em Configurações.
          </p>
        </Card>
      </div>
    );
  }

  const exId = exercicio.id;
  const [rec, desp, porSec, forns, vencendo, frota, estoque, alertas, recMensal, alertasCriticos, maioresDespesas] =
    await Promise.all([
      resumoReceitas(exId),
      resumoDespesas(exId),
      despesaPorSecretaria(exId),
      rankingFornecedores(exId, 5),
      contratosVencendo(exId, 30),
      resumoFrota(),
      resumoEstoque(),
      resumoAlertas(),
      receitaMensal(exId),
      db.alerta.findMany({
        where: { gravidade: { in: ["VERMELHO", "LARANJA"] }, status: { notIn: ["RESOLVIDO", "ARQUIVADO", "JUSTIFICADO"] } },
        take: 5,
        orderBy: { gravidade: "asc" },
      }),
      db.empenho.findMany({ where: { exercicioId: exId }, orderBy: { valorEmpenhado: "desc" }, take: 5, include: { fornecedor: true, secretaria: true } }),
    ]);

  const totalSec = porSec.reduce((s, p) => s + p.valor, 0);

  return (
    <div>
      <PageHeader
        titulo="Visão Geral"
        descricao={`${exercicio.orgao.nome} — Exercício ${exercicio.ano}`}
        acao={
          <Link href="/consultor" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            🤖 Consultor de Dados
          </Link>
        }
      />

      {/* KPIs principais */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Receita arrecadada" valor={moedaCompacta(rec.arrecadado)} sub={`${percentual(rec.realizacao)} da previsão`} cor="verde" />
        <StatCard rotulo="Despesa empenhada" valor={moedaCompacta(desp.empenhado)} sub={`${percentual(desp.execucao)} do fixado`} cor="brand" />
        <StatCard rotulo="Despesa paga" valor={moedaCompacta(desp.pago)} sub={`Liquidado: ${moedaCompacta(desp.liquidado)}`} cor="brand" />
        <StatCard
          rotulo="Saldo orçamentário"
          valor={moedaCompacta(desp.saldo)}
          sub={desp.saldo < 0 ? "Atenção: saldo negativo" : "Disponível"}
          cor={desp.saldo < 0 ? "vermelho" : "verde"}
        />
        <StatCard rotulo="Alertas críticos" valor={String(alertas.criticos)} sub={`${alertas.pendentes} pendentes`} cor={alertas.criticos ? "vermelho" : "verde"} />
        <StatCard rotulo="Contratos vencendo" valor={String(vencendo.length)} sub="Próximos 30 dias" cor={vencendo.length ? "laranja" : "verde"} />
        <StatCard rotulo="Frota" valor={`${frota.ativos}/${frota.total}`} sub={`Custo: ${moedaCompacta(frota.custoTotal)}`} cor="brand" />
        <StatCard rotulo="Estoque crítico" valor={String(estoque.produtosCriticos)} sub={`${estoque.totalProdutos} produtos`} cor={estoque.produtosCriticos ? "amarelo" : "verde"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gráfico de receita */}
        <Card className="lg:col-span-2">
          <CardTitulo>Arrecadação x Previsão (mensal)</CardTitulo>
          <GraficoLinhaMensal
            dados={recMensal}
            series={[
              { chave: "previsto", nome: "Previsto", cor: "#94a3b8" },
              { chave: "arrecadado", nome: "Arrecadado", cor: "#16a34a" },
            ]}
          />
        </Card>

        {/* Alertas críticos */}
        <Card>
          <CardTitulo>Alertas que exigem atenção</CardTitulo>
          {alertasCriticos.length === 0 ? (
            <EmptyState mensagem="Nenhum alerta crítico." />
          ) : (
            <ul className="space-y-2">
              {alertasCriticos.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 p-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${a.gravidade === "VERMELHO" ? "bg-alerta-vermelho" : "bg-alerta-laranja"}`} />
                    <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                  </div>
                  <p className="ml-4 text-xs text-slate-500">{a.descricao}</p>
                </li>
              ))}
              <Link href="/alertas" className="block pt-1 text-center text-xs font-medium text-brand-600 hover:underline">
                Ver todos os alertas →
              </Link>
            </ul>
          )}
        </Card>

        {/* Despesa por secretaria */}
        <Card className="lg:col-span-2">
          <CardTitulo>Despesa por secretaria</CardTitulo>
          {porSec.length === 0 ? (
            <EmptyState mensagem="Sem despesas registradas." />
          ) : (
            <div className="space-y-3">
              {porSec.slice(0, 6).map((s) => (
                <div key={s.nome}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-700">{s.nome}</span>
                    <span className="font-medium text-slate-900">{moeda(s.valor)} · {percentual(totalSec ? s.valor / totalSec : 0)}</span>
                  </div>
                  <BarraProporcao valor={s.valor} total={totalSec} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Maiores fornecedores */}
        <Card>
          <CardTitulo>Maiores fornecedores</CardTitulo>
          {forns.length === 0 ? (
            <EmptyState mensagem="Sem pagamentos registrados." />
          ) : (
            <ol className="space-y-2 text-sm">
              {forns.map((f, i) => (
                <li key={f.nome} className="flex justify-between">
                  <span className="text-slate-700">{i + 1}. {f.nome}</span>
                  <span className="font-medium text-slate-900">{moedaCompacta(f.valor)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Contratos vencendo */}
        <Card className="lg:col-span-3">
          <CardTitulo>Contratos vencendo (próximos 30 dias)</CardTitulo>
          {vencendo.length === 0 ? (
            <EmptyState mensagem="Nenhum contrato vence nos próximos 30 dias." />
          ) : (
            <Tabela colunas={["Contrato", "Fornecedor", "Secretaria", "Vencimento", "Valor"]}>
              {vencendo.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.numero}</td>
                  <td className="px-3 py-2">{c.fornecedor?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{c.secretaria?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{data(c.dataFim)}</td>
                  <td className="px-3 py-2">{moeda(c.valorAtualizado || c.valorInicial)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Dados atualizados em {data(new Date())} · Período: {nomeMes(new Date().getMonth() + 1)}/{exercicio.ano}
      </p>
    </div>
  );
}

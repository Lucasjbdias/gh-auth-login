import { db } from "@/lib/db";
import {
  exercicioAtual,
  resumoReceitas,
  resumoDespesas,
  resumoAlertas,
  contratosVencendo,
  resumoFrota,
  despesaPorSecretaria,
} from "@/lib/indicators";
import { moeda, percentual, numero, data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { BotoesExportacao } from "./BotoesExportacao";

export const dynamic = "force-dynamic";

type RelatorioInfo = {
  titulo: string;
  descricao: string;
  destinatario: string;
};

const RELATORIOS: RelatorioInfo[] = [
  {
    titulo: "Executivo Mensal",
    descricao:
      "Visão consolidada do mês: receitas arrecadadas, despesas executadas, alertas e principais pendências.",
    destinatario: "Prefeito e Secretários",
  },
  {
    titulo: "Controle Interno",
    descricao:
      "Alertas por gravidade, irregularidades identificadas e providências recomendadas pelo controle.",
    destinatario: "Controladoria e Auditoria",
  },
  {
    titulo: "Por Secretaria",
    descricao:
      "Execução orçamentária detalhada por secretaria, com despesa empenhada e participação no total.",
    destinatario: "Secretários e Ordenadores",
  },
  {
    titulo: "Compras",
    descricao:
      "Licitações, compras diretas, contratos vigentes e vencimentos próximos do período.",
    destinatario: "Setor de Compras e Licitações",
  },
  {
    titulo: "Frota",
    descricao:
      "Veículos ativos e parados, gastos com combustível e manutenção e custo por veículo.",
    destinatario: "Departamento de Transportes",
  },
  {
    titulo: "Receitas",
    descricao:
      "Receita prevista x arrecadada, receita própria, transferências e realização por origem.",
    destinatario: "Secretaria de Fazenda",
  },
  {
    titulo: "Despesas",
    descricao:
      "Despesa fixada, empenhada, liquidada e paga, com saldo orçamentário e execução.",
    destinatario: "Secretaria de Fazenda",
  },
  {
    titulo: "Almoxarifado",
    descricao:
      "Posição de estoque, valor total armazenado e produtos abaixo do estoque mínimo.",
    destinatario: "Almoxarifado Central",
  },
  {
    titulo: "Alertas",
    descricao:
      "Relação completa de alertas do sistema, situação atual e prazos sugeridos de tratamento.",
    destinatario: "Gestão e Controle Interno",
  },
];

function frasesResumo(
  ano: number,
  orgao: string,
  rec: Awaited<ReturnType<typeof resumoReceitas>>,
  desp: Awaited<ReturnType<typeof resumoDespesas>>,
  alertas: Awaited<ReturnType<typeof resumoAlertas>>,
  vencendo: number,
  frota: Awaited<ReturnType<typeof resumoFrota>>,
  topSecretaria: { nome: string; valor: number } | undefined
): string[] {
  const frases: string[] = [];

  frases.push(
    `No exercício de ${ano}, o(a) ${orgao} arrecadou ${moeda(
      rec.arrecadado
    )}, o equivalente a ${percentual(rec.realizacao)} do total previsto de ${moeda(
      rec.previsto
    )}.`
  );

  frases.push(
    `Do valor arrecadado, ${moeda(
      rec.propria
    )} vieram de receitas próprias do município e ${moeda(
      rec.transferencias
    )} de transferências de outros entes.`
  );

  frases.push(
    `Em despesas, foram empenhados ${moeda(desp.empenhado)} e efetivamente pagos ${moeda(
      desp.pago
    )}, restando um saldo orçamentário de ${moeda(desp.saldo)} (execução de ${percentual(
      desp.execucao
    )}).`
  );

  if (topSecretaria) {
    frases.push(
      `A secretaria com maior despesa empenhada foi ${topSecretaria.nome}, responsável por ${moeda(
        topSecretaria.valor
      )} no período.`
    );
  }

  frases.push(
    `O sistema registra ${numero(alertas.pendentes, 0)} alerta(s) pendente(s), sendo ${numero(
      alertas.criticos,
      0
    )} crítico(s), e há ${numero(vencendo, 0)} contrato(s) vencendo nos próximos 30 dias.`
  );

  frases.push(
    `A frota possui ${numero(frota.total, 0)} veículo(s) (${numero(
      frota.ativos,
      0
    )} ativo(s)), com custo total de ${moeda(
      frota.custoTotal
    )} entre combustível e manutenção.`
  );

  return frases;
}

export default async function Pagina() {
  const ex = await exercicioAtual();

  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Relatórios"
          descricao="Geração e emissão de relatórios gerenciais do município."
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados para gerar relatórios." />
      </div>
    );
  }

  const [rec, desp, alertas, vencendo, frota, porSecretaria, emitidos] =
    await Promise.all([
      resumoReceitas(ex.id),
      resumoDespesas(ex.id),
      resumoAlertas(),
      contratosVencendo(ex.id, 30),
      resumoFrota(),
      despesaPorSecretaria(ex.id),
      db.relatorioEmitido.findMany({ orderBy: { criadoEm: "desc" }, take: 30 }),
    ]);

  const frases = frasesResumo(
    ex.ano,
    ex.orgao.nome,
    rec,
    desp,
    alertas,
    vencendo.length,
    frota,
    porSecretaria[0]
  );

  return (
    <div>
      <PageHeader
        titulo="Relatórios"
        descricao={`Geração e emissão de relatórios gerenciais — Exercício ${ex.ano}`}
      />

      {/* Resumo Executivo do Mês */}
      <Card className="mb-6">
        <CardTitulo>Resumo Executivo do Mês</CardTitulo>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          {frases.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <BotoesExportacao relatorio="Resumo Executivo do Mês" />
        </div>
      </Card>

      {/* Catálogo de relatórios */}
      <CardTitulo>Relatórios disponíveis</CardTitulo>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Card key={r.titulo} className="flex flex-col">
            <h3 className="text-base font-semibold text-slate-900">{r.titulo}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500">{r.descricao}</p>
            <p className="mt-3 text-xs text-slate-400">
              Destinatário:{" "}
              <span className="font-medium text-slate-600">{r.destinatario}</span>
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <BotoesExportacao relatorio={r.titulo} />
            </div>
          </Card>
        ))}
      </div>

      {/* Relatórios já emitidos */}
      <Card>
        <CardTitulo>Relatórios emitidos</CardTitulo>
        {emitidos.length === 0 ? (
          <EmptyState mensagem="Nenhum relatório foi emitido até o momento." />
        ) : (
          <Tabela colunas={["Tipo", "Período", "Destinatário", "Formato", "Emitido em"]}>
            {emitidos.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{r.tipo}</td>
                <td className="px-3 py-2 text-slate-600">{r.periodo}</td>
                <td className="px-3 py-2 text-slate-600">{r.destinatario}</td>
                <td className="px-3 py-2">
                  <Badge cor="blue">{r.formato}</Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{data(r.criadoEm)}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

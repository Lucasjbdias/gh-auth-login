import { db } from "@/lib/db";
import { exercicioAtual, contratosVencendo } from "@/lib/indicators";
import { moeda, data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

const DIA_MS = 1000 * 60 * 60 * 24;

function diasParaFim(dataFim: Date | null | undefined, hoje: Date): number | null {
  if (!dataFim) return null;
  return Math.ceil((dataFim.getTime() - hoje.getTime()) / DIA_MS);
}

function badgeSituacao(situacao: string) {
  const cor =
    situacao === "VIGENTE"
      ? "green"
      : situacao === "ENCERRADO"
      ? "slate"
      : situacao === "RESCINDIDO"
      ? "red"
      : "blue";
  return <Badge cor={cor as "slate" | "green" | "red" | "yellow" | "blue"}>{situacao}</Badge>;
}

export default async function Pagina() {
  const ex = await exercicioAtual();
  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Painel de Contratos"
          descricao="Acompanhamento de contratos administrativos"
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados para visualizar os contratos." />
      </div>
    );
  }

  const hoje = new Date();

  const [contratos, vencendo60] = await Promise.all([
    db.contrato.findMany({
      where: { exercicioId: ex.id },
      include: { fornecedor: true, secretaria: true, aditivos: true },
      orderBy: { numero: "asc" },
    }),
    contratosVencendo(ex.id, 60),
  ]);

  const vigentes = contratos.filter((c) => c.situacao === "VIGENTE");
  const vencidos = contratos.filter(
    (c) => c.situacao === "VIGENTE" && c.dataFim && c.dataFim < hoje
  );
  const vencendo30 = vencendo60.filter((c) => {
    const d = diasParaFim(c.dataFim, hoje);
    return d !== null && d >= 0 && d <= 30;
  });
  const vencendo60Futuro = vencendo60.filter((c) => {
    const d = diasParaFim(c.dataFim, hoje);
    return d !== null && d > 30 && d <= 60;
  });

  const vencendoOrdenado = [...vencendo60].sort((a, b) => {
    const da = a.dataFim ? a.dataFim.getTime() : Infinity;
    const db2 = b.dataFim ? b.dataFim.getTime() : Infinity;
    return da - db2;
  });

  return (
    <div>
      <PageHeader
        titulo="Painel de Contratos"
        descricao={`Contratos administrativos do exercício ${ex.ano} — ${ex.orgao.nome}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          rotulo="Contratos vigentes"
          valor={String(vigentes.length)}
          sub={`de ${contratos.length} no exercício`}
          cor="verde"
        />
        <StatCard
          rotulo="Vencidos"
          valor={String(vencidos.length)}
          sub="vigentes com data fim ultrapassada"
          cor="vermelho"
        />
        <StatCard
          rotulo="Vencem em até 30 dias"
          valor={String(vencendo30.length)}
          sub="atenção para renovação"
          cor="laranja"
        />
        <StatCard
          rotulo="Vencem em 31 a 60 dias"
          valor={String(vencendo60Futuro.length)}
          sub="planejamento antecipado"
          cor="amarelo"
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Vencendo em breve (próximos 60 dias)</CardTitulo>
        {vencendoOrdenado.length === 0 ? (
          <EmptyState mensagem="Nenhum contrato vigente vencendo nos próximos 60 dias." />
        ) : (
          <Tabela
            colunas={[
              "Número",
              "Objeto",
              "Fornecedor",
              "Secretaria",
              "Valor atualizado",
              "Fim",
              "Dias restantes",
            ]}
          >
            {vencendoOrdenado.map((c) => {
              const d = diasParaFim(c.dataFim, hoje);
              const corDias =
                d === null
                  ? "slate"
                  : d < 0
                  ? "red"
                  : d <= 15
                  ? "red"
                  : d <= 30
                  ? "yellow"
                  : "blue";
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{c.numero}</td>
                  <td className="px-3 py-2 text-slate-600">{c.objeto}</td>
                  <td className="px-3 py-2 text-slate-600">{c.fornecedor?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.secretaria?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{moeda(c.valorAtualizado)}</td>
                  <td className="px-3 py-2 text-slate-600">{data(c.dataFim)}</td>
                  <td className="px-3 py-2">
                    <Badge cor={corDias as "slate" | "green" | "red" | "yellow" | "blue"}>
                      {d === null ? "—" : d < 0 ? `${Math.abs(d)}d vencido` : `${d}d`}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitulo>Todos os contratos do exercício</CardTitulo>
          <BotaoExportar idTabela="tabela-contratos" titulo="Contratos" />
        </div>
        {contratos.length === 0 ? (
          <EmptyState mensagem="Nenhum contrato cadastrado neste exercício." />
        ) : (
          <Tabela
            id="tabela-contratos"
            colunas={[
              "Número",
              "Objeto",
              "Fornecedor",
              "Secretaria",
              "Valor atualizado",
              "Início",
              "Fim",
              "Situação",
              "Nº aditivos",
              "",
            ]}
          >
            {contratos.map((c) => {
              const d = diasParaFim(c.dataFim, hoje);
              const venceLogo = c.situacao === "VIGENTE";
              const corFim =
                !venceLogo || d === null
                  ? null
                  : d < 0
                  ? "red"
                  : d <= 15
                  ? "red"
                  : d <= 30
                  ? "yellow"
                  : null;
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{c.numero}</td>
                  <td className="px-3 py-2 text-slate-600">{c.objeto}</td>
                  <td className="px-3 py-2 text-slate-600">{c.fornecedor?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.secretaria?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{moeda(c.valorAtualizado)}</td>
                  <td className="px-3 py-2 text-slate-600">{data(c.dataInicio)}</td>
                  <td className="px-3 py-2">
                    {corFim ? (
                      <Badge cor={corFim as "slate" | "green" | "red" | "yellow" | "blue"}>
                        {data(c.dataFim)}
                      </Badge>
                    ) : (
                      <span className="text-slate-600">{data(c.dataFim)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{badgeSituacao(c.situacao)}</td>
                  <td className="px-3 py-2 text-slate-700">{c.aditivos.length}</td>
                  <td className="px-3 py-2">
                    <BotaoComunicar
                      origemTipo="CONTRATO"
                      origemId={c.id}
                      titulo={`Contrato ${c.numero} — ${c.fornecedor?.nome ?? "—"}`}
                      descricao={`Contrato nº ${c.numero} | Objeto: ${c.objeto} | Fornecedor: ${c.fornecedor?.nome ?? "—"} | Valor: ${moeda(c.valorAtualizado)} | Situação: ${c.situacao}`}
                      prioridade={d !== null && d < 0 ? "ALTA" : "NORMAL"}
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

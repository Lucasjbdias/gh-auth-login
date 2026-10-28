import { db } from "@/lib/db";
import { resumoAlertas } from "@/lib/indicators";
import { moeda, data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
  BadgeGravidade,
} from "@/components/ui";
import { AcoesAlerta } from "./AcoesAlerta";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  AGUARDANDO_SECRETARIA: "Aguardando secretaria",
  JUSTIFICADO: "Justificado",
  CORRIGIDO: "Corrigido",
  RESOLVIDO: "Resolvido",
  ESCALADO: "Escalado",
  ARQUIVADO: "Arquivado",
};

const STATUS_COR: Record<string, "slate" | "green" | "red" | "yellow" | "blue"> = {
  NOVO: "blue",
  EM_ANALISE: "yellow",
  AGUARDANDO_SECRETARIA: "yellow",
  JUSTIFICADO: "slate",
  CORRIGIDO: "green",
  RESOLVIDO: "green",
  ESCALADO: "red",
  ARQUIVADO: "slate",
};

export default async function PaginaAlertas() {
  const resumo = await resumoAlertas();
  const alertas = await db.alerta.findMany({
    include: { secretaria: true },
    orderBy: [{ gravidade: "asc" }, { dataIdentificacao: "desc" }],
  });

  return (
    <div>
      <PageHeader
        titulo="Painel de Alertas"
        descricao="Acompanhamento e tratamento dos alertas de risco identificados pelo sistema."
      />

      {alertas.length === 0 ? (
        <EmptyState mensagem="Nenhum alerta identificado. Importe dados para que o sistema gere alertas." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              rotulo="Total de alertas"
              valor={String(resumo.total)}
              sub={`${resumo.pendentes} pendentes`}
              cor="brand"
            />
            <StatCard
              rotulo="Críticos"
              valor={String(resumo.criticos)}
              sub="Gravidade vermelha"
              cor="vermelho"
            />
            <StatCard
              rotulo="Risco médio"
              valor={String(resumo.laranja)}
              sub="Gravidade laranja"
              cor="laranja"
            />
            <StatCard
              rotulo="Resolvidos"
              valor={String(resumo.resolvidos)}
              sub={`${resumo.amarelo} em atenção`}
              cor="verde"
            />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitulo>Alertas identificados</CardTitulo>
              <BotaoExportar idTabela="tabela-alertas" titulo="Alertas" />
            </div>
            <Tabela
              id="tabela-alertas"
              colunas={[
                "Código",
                "Tipo",
                "Gravidade",
                "Título",
                "Secretaria",
                "Valor envolvido",
                "Status",
                "Identificado em",
                "Ações",
              ]}
            >
              {alertas.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {a.codigo}
                  </td>
                  <td className="px-3 py-2">{a.tipo}</td>
                  <td className="px-3 py-2">
                    <BadgeGravidade
                      gravidade={
                        a.gravidade as "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO"
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{a.titulo}</p>
                    <p className="text-xs text-slate-500">{a.descricao}</p>
                  </td>
                  <td className="px-3 py-2">{a.secretaria?.nome ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.valorEnvolvido != null ? moeda(a.valorEnvolvido) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge cor={STATUS_COR[a.status] ?? "slate"}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {data(a.dataIdentificacao)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <AcoesAlerta
                        id={a.id}
                        statusAtual={a.status}
                        providenciaAtual={a.providencia ?? ""}
                      />
                      <BotaoComunicar
                        origemTipo="ALERTA"
                        origemId={a.id}
                        titulo={`Alerta ${a.codigo} — ${a.titulo}`}
                        descricao={a.descricao ?? `Alerta ${a.tipo} identificado em ${a.secretaria?.nome ?? "—"}`}
                        prioridade={a.gravidade === "VERMELHO" ? "URGENTE" : a.gravidade === "LARANJA" ? "ALTA" : "NORMAL"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </Card>
        </>
      )}
    </div>
  );
}

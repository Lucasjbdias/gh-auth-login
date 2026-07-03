import { db } from "@/lib/db";
import { exercicioAtual } from "@/lib/indicators";
import { moeda } from "@/lib/format";
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

export const dynamic = "force-dynamic";

// Status que indicam dados ainda não validados pelo controle interno.
const STATUS_PENDENTES = ["IMPORTADO", "EM_VALIDACAO", "COM_INCONSISTENCIA"];

// Tipos de alerta tratados como inconsistências e riscos relevantes.
const TIPOS_RISCO = [
  "INCONSISTENCIA_EXECUCAO",
  "PAGAMENTO_CONTRATO_VENCIDO",
  "PRECO_FORA_MEDIA",
  "CONCENTRACAO_FORNECEDOR",
];

// Cores das badges por tipo de ação registrada na trilha de auditoria.
function corAcao(acao: string): "slate" | "green" | "red" | "yellow" | "blue" {
  const a = acao.toUpperCase();
  if (a.includes("CRIA") || a.includes("INSER") || a.includes("IMPORT")) return "green";
  if (a.includes("EXCLU") || a.includes("REMOV") || a.includes("DELET")) return "red";
  if (a.includes("ATUALIZ") || a.includes("EDIT") || a.includes("ALTER")) return "yellow";
  if (a.includes("LOGIN") || a.includes("ACESSO") || a.includes("CONSULT")) return "blue";
  return "slate";
}

function dataHora(d: Date): string {
  return new Date(d).toLocaleString("pt-BR");
}

export default async function PaginaAuditoria() {
  const ex = await exercicioAtual();

  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Trilha de Auditoria"
          descricao="Controle interno, rastreabilidade e riscos."
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados para habilitar a trilha de auditoria." />
      </div>
    );
  }

  const hoje = new Date();

  const [
    logs,
    criticosPendentes,
    contratosVencidos,
    empenhosPendentes,
    receitasPendentes,
    importacoesErro,
    riscos,
  ] = await Promise.all([
    db.logAuditoria.findMany({
      orderBy: { criadoEm: "desc" },
      take: 200,
      include: { usuario: true },
    }),
    db.alerta.count({
      where: {
        gravidade: "VERMELHO",
        status: { notIn: ["RESOLVIDO", "ARQUIVADO", "JUSTIFICADO"] },
      },
    }),
    db.contrato.count({
      where: { situacao: "VIGENTE", dataFim: { lt: hoje } },
    }),
    db.empenho.count({
      where: { exercicioId: ex.id, statusValidacao: { in: STATUS_PENDENTES } },
    }),
    db.receita.count({
      where: { exercicioId: ex.id, statusValidacao: { in: STATUS_PENDENTES } },
    }),
    db.importacao.count({ where: { status: "ERRO" } }),
    db.alerta.findMany({
      where: { tipo: { in: TIPOS_RISCO } },
      orderBy: { dataIdentificacao: "desc" },
      include: { secretaria: true },
    }),
  ]);

  const dadosPendentes = empenhosPendentes + receitasPendentes;

  return (
    <div>
      <PageHeader
        titulo="Trilha de Auditoria"
        descricao={`Controle interno e rastreabilidade — Exercício ${ex.ano} · ${ex.orgao.nome}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          rotulo="Alertas críticos pendentes"
          valor={String(criticosPendentes)}
          sub="Gravidade vermelha em aberto"
          cor={criticosPendentes > 0 ? "vermelho" : "verde"}
        />
        <StatCard
          rotulo="Contratos vencidos"
          valor={String(contratosVencidos)}
          sub="Vigentes com data fim ultrapassada"
          cor={contratosVencidos > 0 ? "laranja" : "verde"}
        />
        <StatCard
          rotulo="Dados pendentes de validação"
          valor={String(dadosPendentes)}
          sub={`${empenhosPendentes} empenhos · ${receitasPendentes} receitas`}
          cor={dadosPendentes > 0 ? "amarelo" : "verde"}
        />
        <StatCard
          rotulo="Importações com erro"
          valor={String(importacoesErro)}
          sub="Cargas que falharam"
          cor={importacoesErro > 0 ? "vermelho" : "verde"}
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Inconsistências e riscos</CardTitulo>
        {riscos.length === 0 ? (
          <EmptyState mensagem="Nenhuma inconsistência ou risco identificado." />
        ) : (
          <Tabela
            colunas={[
              "Gravidade",
              "Tipo",
              "Título",
              "Secretaria",
              "Valor envolvido",
              "Status",
              "Identificado em",
            ]}
          >
            {riscos.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <BadgeGravidade gravidade={r.gravidade as "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO"} />
                </td>
                <td className="px-3 py-2 text-slate-500">{r.tipo}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{r.titulo}</td>
                <td className="px-3 py-2 text-slate-600">{r.secretaria?.nome ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{moeda(r.valorEnvolvido)}</td>
                <td className="px-3 py-2">
                  <Badge>{r.status}</Badge>
                </td>
                <td className="px-3 py-2 text-slate-500">{dataHora(r.dataIdentificacao)}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      <Card>
        <CardTitulo>Registro de atividades (últimos 200 eventos)</CardTitulo>
        {logs.length === 0 ? (
          <EmptyState mensagem="Nenhum registro de auditoria encontrado." />
        ) : (
          <Tabela colunas={["Data/hora", "Usuário", "Ação", "Entidade", "Detalhes"]}>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                  {dataHora(log.criadoEm)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {log.usuario?.nome ?? "Sistema"}
                </td>
                <td className="px-3 py-2">
                  <Badge cor={corAcao(log.acao)}>{log.acao}</Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{log.entidade ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">{log.detalhes ?? "—"}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

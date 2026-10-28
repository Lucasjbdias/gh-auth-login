import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card, CardTitulo, Badge } from "@/components/ui";
import { data } from "@/lib/format";
import { AcoesProtocolo } from "./AcoesProtocolo";

export const dynamic = "force-dynamic";

const STATUS_COR: Record<string, "slate" | "blue" | "yellow" | "red" | "green"> = {
  ABERTO: "blue", AGUARDANDO_RESPOSTA: "yellow", EM_PRAZO: "yellow",
  VENCIDO: "red", RESOLVIDO: "green", ARQUIVADO: "slate",
};
const STATUS_LABEL: Record<string, string> = {
  ABERTO: "Aberto", AGUARDANDO_RESPOSTA: "Aguardando resposta",
  EM_PRAZO: "Em prazo", VENCIDO: "Vencido", RESOLVIDO: "Resolvido", ARQUIVADO: "Arquivado",
};
const ACAO_ICONE: Record<string, string> = {
  CRIADO: "🆕", EMAIL_ENVIADO: "📧", EMAIL_FALHOU: "❌", LEMBRETE_ENVIADO: "🔔",
  ESCALONADO: "⬆️", PRAZO_ALTERADO: "📅", STATUS_ALTERADO: "🔄",
  RESOLVIDO: "✅", ARQUIVADO: "🗄️", NOTA: "📝",
};

export default async function DetalheProtocolo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const protocolo = await db.comunicacaoProtocolo.findUnique({
    where: { id },
    include: {
      destinatarios: { include: { destinatario: true } },
      emails: { orderBy: { criadoEm: "asc" } },
      tramitacoes: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!protocolo) notFound();

  const todosDestinatarios = await db.destinatario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  const emailsResponsaveis = protocolo.destinatarios.map((d) => d.destinatario.email);

  const hoje = new Date();
  const prazoVencido = protocolo.prazo && new Date(protocolo.prazo) < hoje && !["RESOLVIDO", "ARQUIVADO"].includes(protocolo.status);
  const diasRestantes = protocolo.prazo
    ? Math.ceil((new Date(protocolo.prazo).getTime() - hoje.getTime()) / 86400000)
    : null;

  return (
    <div>
      <PageHeader
        titulo={protocolo.titulo}
        descricao={`Protocolo ${protocolo.numero}${protocolo.municipio ? ` · ${protocolo.municipio}` : ""}`}
        acao={
          <div className="flex items-center gap-2">
            <Badge cor={STATUS_COR[protocolo.status] ?? "slate"}>{STATUS_LABEL[protocolo.status] ?? protocolo.status}</Badge>
          </div>
        }
      />

      {/* Banner de prazo vencido */}
      {prazoVencido && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>⏰ Prazo vencido!</strong> O prazo era {data(protocolo.prazo)} e não houve resolução. Use o botão
          <strong> &quot;Solicitar novamente&quot;</strong> para reencaminhar.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal — timeline + ações */}
        <div className="space-y-4 lg:col-span-2">
          {/* Ações interativas (client component) */}
          <AcoesProtocolo
            protocoloId={id}
            status={protocolo.status}
            prazoVencido={!!prazoVencido}
            emailsResponsaveis={emailsResponsaveis}
            todosDestinatarios={todosDestinatarios.map((d) => ({ id: d.id, nome: d.nome, email: d.email }))}
            destinatariosAtuais={protocolo.destinatarios.map((d) => ({ id: d.destinatarioId, papel: d.papel, nome: d.destinatario.nome, email: d.destinatario.email }))}
          />

          {/* Timeline de tramitações */}
          <Card>
            <CardTitulo>Linha do tempo</CardTitulo>
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
              {protocolo.tramitacoes.map((t) => (
                <div key={t.id} className="relative mb-4">
                  <span className="absolute -left-4 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm ring-1 ring-slate-200">
                    {ACAO_ICONE[t.acao] ?? "•"}
                  </span>
                  <div className="ml-2">
                    <p className="text-sm font-medium text-slate-800">{t.descricao}</p>
                    <p className="text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(t.criadoEm))}</p>
                  </div>
                </div>
              ))}
              {protocolo.tramitacoes.length === 0 && <p className="text-sm text-slate-400">Sem registros ainda.</p>}
            </div>
          </Card>

          {/* Emails enviados */}
          {protocolo.emails.length > 0 && (
            <Card>
              <CardTitulo>Emails registrados</CardTitulo>
              <div className="space-y-3">
                {protocolo.emails.map((e) => {
                  const para = JSON.parse(e.paraEmails) as string[];
                  return (
                    <div key={e.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{e.assunto}</span>
                        <span className={`text-xs font-medium ${e.status === "ENVIADO" ? "text-green-600" : e.status === "FALHOU" ? "text-red-600" : "text-slate-400"}`}>
                          {e.status === "ENVIADO" ? "✓ Enviado" : e.status === "FALHOU" ? "✗ Falhou" : "Rascunho"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Para: {para.join(", ")}</p>
                      {e.enviadoEm && <p className="text-xs text-slate-400">{data(e.enviadoEm)}</p>}
                      {e.erro && <p className="mt-1 text-xs text-red-600">{e.erro}</p>}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Ver conteúdo</summary>
                        <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700" dangerouslySetInnerHTML={{ __html: e.corpo }} />
                      </details>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Coluna lateral — info */}
        <div className="space-y-4">
          <Card>
            <CardTitulo>Informações</CardTitulo>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Número</dt>
                <dd className="font-mono font-semibold text-slate-800">{protocolo.numero}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Tipo</dt>
                <dd className="text-slate-700">{protocolo.tipo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Prioridade</dt>
                <dd><Badge cor={({ BAIXA: "slate", NORMAL: "blue", ALTA: "yellow", URGENTE: "red" }[protocolo.prioridade] ?? "slate") as "slate" | "green" | "red" | "yellow" | "blue"}>{protocolo.prioridade}</Badge></dd>
              </div>
              {protocolo.prazo && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Prazo</dt>
                  <dd className={prazoVencido ? "font-semibold text-red-600" : "text-slate-700"}>
                    {data(protocolo.prazo)}
                    {diasRestantes !== null && (
                      <span className="ml-1 text-xs">
                        {diasRestantes < 0 ? `(${Math.abs(diasRestantes)}d atraso)` : diasRestantes === 0 ? "(hoje)" : `(${diasRestantes}d)`}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {protocolo.origemTipo && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Origem</dt>
                  <dd className="text-slate-700">{protocolo.origemTipo}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Criado em</dt>
                <dd className="text-slate-600">{data(protocolo.criadoEm)}</dd>
              </div>
              {protocolo.resolvidoEm && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Resolvido em</dt>
                  <dd className="text-green-700">{data(protocolo.resolvidoEm)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardTitulo>Destinatários</CardTitulo>
            {protocolo.destinatarios.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum destinatário vinculado.</p>
            ) : (
              <div className="space-y-2">
                {protocolo.destinatarios.map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-100 p-2">
                    <p className="text-sm font-medium text-slate-800">{d.destinatario.nome}</p>
                    <p className="text-xs text-slate-500">{d.destinatario.email}</p>
                    {d.destinatario.cargo && <p className="text-xs text-slate-400">{d.destinatario.cargo}</p>}
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{d.papel}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {protocolo.descricao && (
            <Card>
              <CardTitulo>Descrição</CardTitulo>
              <p className="text-sm text-slate-700 whitespace-pre-line">{protocolo.descricao}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

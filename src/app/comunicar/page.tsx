import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, CardTitulo, StatCard, EmptyState, Badge } from "@/components/ui";
import { data } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  AGUARDANDO_RESPOSTA: "Aguardando resposta",
  EM_PRAZO: "Em prazo",
  VENCIDO: "Vencido",
  RESOLVIDO: "Resolvido",
  ARQUIVADO: "Arquivado",
};

const STATUS_COR: Record<string, "slate" | "blue" | "yellow" | "red" | "green"> = {
  ABERTO: "blue",
  AGUARDANDO_RESPOSTA: "yellow",
  EM_PRAZO: "yellow",
  VENCIDO: "red",
  RESOLVIDO: "green",
  ARQUIVADO: "slate",
};

const PRIORIDADE_COR: Record<string, "slate" | "blue" | "yellow" | "red" | "green"> = {
  BAIXA: "slate",
  NORMAL: "blue",
  ALTA: "yellow",
  URGENTE: "red",
};

const ORIGEM_LABEL: Record<string, string> = {
  CAUC: "CAUC",
  ALERTA: "Alerta",
  MANUAL: "Manual",
};

function prazoLabel(prazo: Date | null, status: string): { texto: string; cor: string } {
  if (!prazo || status === "RESOLVIDO" || status === "ARQUIVADO") return { texto: "—", cor: "text-slate-400" };
  const hoje = new Date();
  const diff = Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { texto: `Vencido há ${Math.abs(diff)}d`, cor: "text-red-600 font-semibold" };
  if (diff === 0) return { texto: "Vence hoje", cor: "text-red-500 font-semibold" };
  if (diff <= 2) return { texto: `${diff}d restantes`, cor: "text-orange-500 font-semibold" };
  return { texto: `${diff}d restantes`, cor: "text-slate-500" };
}

export default async function PaginaComunicar() {
  const protocolos = await db.comunicacaoProtocolo.findMany({
    include: {
      destinatarios: { include: { destinatario: true } },
      _count: { select: { emails: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  const abertos = protocolos.filter((p) => !["RESOLVIDO", "ARQUIVADO"].includes(p.status)).length;
  const vencidos = protocolos.filter((p) => p.prazo && new Date(p.prazo) < new Date() && !["RESOLVIDO", "ARQUIVADO"].includes(p.status)).length;
  const resolvidos = protocolos.filter((p) => p.status === "RESOLVIDO").length;
  const urgentes = protocolos.filter((p) => p.prioridade === "URGENTE" && !["RESOLVIDO", "ARQUIVADO"].includes(p.status)).length;

  return (
    <div>
      <PageHeader
        titulo="Comunicar — Protocolos"
        descricao="Gestão de comunicações, notificações e acompanhamento de prazos."
        acao={
          <Link
            href="/comunicar/novo"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Novo protocolo
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard rotulo="Em aberto" valor={String(abertos)} cor="brand" />
        <StatCard rotulo="Prazos vencidos" valor={String(vencidos)} cor={vencidos > 0 ? "vermelho" : "verde"} />
        <StatCard rotulo="Urgentes" valor={String(urgentes)} cor={urgentes > 0 ? "laranja" : "verde"} />
        <StatCard rotulo="Resolvidos" valor={String(resolvidos)} cor="verde" />
      </div>

      <Card>
        <CardTitulo>Todos os protocolos</CardTitulo>
        {protocolos.length === 0 ? (
          <EmptyState mensagem="Nenhum protocolo criado ainda. Clique em «Novo protocolo» para começar." />
        ) : (
          <div className="divide-y divide-slate-100">
            {protocolos.map((p) => {
              const prazo = prazoLabel(p.prazo, p.status);
              const responsavel = p.destinatarios.find((d) => d.papel === "RESPONSAVEL")?.destinatario;
              return (
                <Link
                  key={p.id}
                  href={`/comunicar/${p.id}`}
                  className="flex items-start justify-between gap-4 px-2 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{p.numero}</span>
                      {p.origemTipo && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {ORIGEM_LABEL[p.origemTipo] ?? p.origemTipo}
                        </span>
                      )}
                      <Badge cor={PRIORIDADE_COR[p.prioridade] ?? "slate"}>{p.prioridade}</Badge>
                    </div>
                    <p className="mt-0.5 font-medium text-slate-800">{p.titulo}</p>
                    {p.municipio && <p className="text-xs text-slate-500">{p.municipio}</p>}
                    {responsavel && (
                      <p className="text-xs text-slate-400">
                        Responsável: <span className="font-medium text-slate-600">{responsavel.nome}</span>
                        {responsavel.email && ` · ${responsavel.email}`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                    <Badge cor={STATUS_COR[p.status] ?? "slate"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    <span className={`text-xs ${prazo.cor}`}>{prazo.texto}</span>
                    <span className="text-xs text-slate-400">{data(p.criadoEm)} · {p._count.emails} email(s)</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

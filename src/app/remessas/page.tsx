import { db } from "@/lib/db";
import { data as fmtData, nomeMes } from "@/lib/format";
import { PageHeader, Card, CardTitulo, Tabela, EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const ORGAOS: Record<string, string> = { "01": "Prefeitura", "02": "Câmara" };

interface ArqInfo { nome?: string; linhas?: number; tiposRegistro?: Record<string, number>; amostra?: string[] }
interface Detalhe { modulo?: string; municipio?: string; orgaoCodigo?: string; ano?: number; mes?: number; arquivos?: ArqInfo[] }

export default async function RemessasPage() {
  const remessas = await db.importacao.findMany({
    where: { tipoDado: { startsWith: "REMESSA" } },
    orderBy: { criadoEm: "desc" },
    take: 40,
  });

  if (remessas.length === 0) {
    return (
      <div>
        <PageHeader titulo="Remessas SICOM" descricao="Pacotes de remessa importados (qualquer módulo)." />
        <EmptyState mensagem="Nenhuma remessa importada. Solte um ZIP de remessa SICOM em Importações." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Remessas SICOM"
        descricao="Pacotes importados de qualquer módulo — catalogados (arquivos, tipos de registro, amostras)."
      />
      <div className="space-y-4">
        {remessas.map((r) => {
          let d: Detalhe = {};
          try { d = JSON.parse(r.detalhes ?? "{}"); } catch { d = {}; }
          const orgaoLabel = ORGAOS[d.orgaoCodigo ?? ""] ?? d.orgaoCodigo ?? "—";
          const especializado = !r.tipoDado.startsWith("REMESSA_") || r.tipoDado === "REMESSA_BALANCETE";
          return (
            <Card key={r.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge cor="blue">{d.modulo ?? r.tipoDado.replace("REMESSA_", "")}</Badge>
                <span className="text-sm font-medium text-slate-800">{d.municipio ?? "—"}</span>
                <span className="text-sm text-slate-500">· {orgaoLabel}</span>
                {d.mes ? <span className="text-sm text-slate-500">· {nomeMes(d.mes)}/{d.ano}</span> : null}
                {r.tipoDado === "REMESSA_BALANCETE" ? <Badge cor="green">análise em /contabil</Badge> : <Badge cor="slate">catalogado</Badge>}
                <span className="ml-auto text-xs text-slate-400">{fmtData(r.criadoEm)} · {r.nomeArquivo}</span>
              </div>
              {d.arquivos && d.arquivos.length > 0 ? (
                <Tabela colunas={["Arquivo", "Registros", "Tipos de registro (qtd)"]}>
                  {d.arquivos.map((a, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{a.nome}</td>
                      <td className="px-3 py-2 text-right">{a.linhas}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {a.tiposRegistro ? Object.entries(a.tiposRegistro).map(([t, n]) => `${t}:${n}`).join("  ") : "—"}
                      </td>
                    </tr>
                  ))}
                </Tabela>
              ) : (
                <p className="text-sm text-slate-500">Importação registrada ({r.registrosOk} registros).</p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Módulos catalogados aqui já estão prontos para ganhar uma análise especializada (como o Balancete em /contabil).
      </p>
    </div>
  );
}

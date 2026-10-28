import { db } from "@/lib/db";
import { moeda, moedaCompacta, numero, nomeMes } from "@/lib/format";
import { classeContabil } from "@/lib/sicom";
import { PageHeader, Card, CardTitulo, StatCard, Tabela, EmptyState, BarraProporcao } from "@/components/ui";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

const ORGAO: Record<string, string> = { "01": "Prefeitura", "02": "Câmara", "1": "Prefeitura", "2": "Câmara" };

export default async function ContabilPage() {
  const ultimo = await db.saldoContabil.findFirst({ orderBy: { importadoEm: "desc" } });
  if (!ultimo) {
    return (
      <div>
        <PageHeader titulo="Contabilidade (Balancete SICOM)" descricao="Saldos contábeis por conta PCASP, a partir das remessas do SICOM." />
        <EmptyState mensagem="Nenhum balancete importado. Importe uma remessa de Balancete (ZIP) em Importações." />
      </div>
    );
  }

  const rows = await db.saldoContabil.findMany({
    where: { exercicioId: ultimo.exercicioId, mes: ultimo.mes, orgaoCodigo: ultimo.orgaoCodigo },
  });

  // Soma do saldo atual por classe PCASP.
  const porClasse = new Map<string, number>();
  for (const r of rows) porClasse.set(r.classe, (porClasse.get(r.classe) ?? 0) + r.saldoAtual);
  const classe = (c: string) => porClasse.get(c) ?? 0;
  const vpa = classe("4");
  const vpd = classe("3");
  const resultado = vpa - vpd;
  const maxClasse = Math.max(1, ...[...porClasse.values()]);

  const topContas = [...rows].sort((a, b) => b.saldoAtual - a.saldoAtual).slice(0, 15);
  const orgaoLabel = ORGAO[ultimo.orgaoCodigo ?? ""] ?? ultimo.orgaoCodigo ?? "—";

  const linhasClasse = [...porClasse.entries()]
    .map(([c, v]) => ({ c, nome: classeContabil(c + "00000000").nome, v }))
    .sort((a, b) => a.c.localeCompare(b.c));

  return (
    <div>
      <PageHeader
        titulo="Contabilidade (Balancete SICOM)"
        descricao="Saldos contábeis por conta PCASP, a partir das remessas do SICOM."
      />
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">
        Fonte: remessa SICOM (Balancete) — {rows.length} contas PCASP. Município <strong>{ultimo.municipio}</strong>, órgão <strong>{orgaoLabel}</strong>, competência <strong>{nomeMes(ultimo.mes)}</strong>.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard rotulo="Ativo" valor={moedaCompacta(classe("1"))} cor="brand" />
        <StatCard rotulo="Passivo + PL" valor={moedaCompacta(classe("2"))} cor="brand" />
        <StatCard rotulo="Receita (VPA)" valor={moedaCompacta(vpa)} cor="verde" />
        <StatCard rotulo="Despesa (VPD)" valor={moedaCompacta(vpd)} cor="laranja" />
        <StatCard
          rotulo={resultado >= 0 ? "Superávit" : "Déficit"}
          valor={moedaCompacta(Math.abs(resultado))}
          sub="VPA − VPD no período"
          cor={resultado >= 0 ? "verde" : "vermelho"}
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Saldos por classe PCASP</CardTitulo>
        <div className="space-y-3">
          {linhasClasse.map((l) => (
            <div key={l.c}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-700">{l.c} — {l.nome}</span>
                <span className="font-medium text-slate-900">{moeda(l.v)}</span>
              </div>
              <BarraProporcao valor={l.v} total={maxClasse} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitulo>Maiores contas (por saldo atual)</CardTitulo>
          <BotaoExportar idTabela="tabela-contabil" titulo="Contabilidade — Saldos" />
        </div>
        <Tabela id="tabela-contabil" colunas={["Conta", "Descrição", "Classe", "Saldo atual", "Nat.", ""]}>
          {topContas.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.conta}</td>
              <td className="px-3 py-2 text-slate-800">{r.contaNome ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{r.classe}</td>
              <td className="px-3 py-2 text-right font-medium">{moeda(r.saldoAtual)}</td>
              <td className="px-3 py-2 text-center text-slate-500">{r.naturezaAtual}</td>
              <td className="px-3 py-2">
                <BotaoComunicar
                  origemTipo="CONTABIL"
                  origemId={r.id}
                  titulo={`Conta ${r.conta} — ${r.contaNome ?? "—"}`}
                  descricao={`Conta PCASP ${r.conta} | Classe: ${r.classe} | Saldo atual: ${moeda(r.saldoAtual)} | Natureza: ${r.naturezaAtual ?? "—"}`}
                />
              </td>
            </tr>
          ))}
        </Tabela>
        <p className="mt-3 text-xs text-slate-400">{numero(rows.length, 0)} contas no total nesta competência.</p>
      </Card>
    </div>
  );
}

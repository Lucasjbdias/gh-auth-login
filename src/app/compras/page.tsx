import { db } from "@/lib/db";
import { exercicioAtual, resumoCompras } from "@/lib/indicators";
import { moeda, moedaCompacta, percentual, data, numero } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
  BarraProporcao,
} from "@/components/ui";
import { BotaoExportar } from "@/components/BotaoExportar";
import { BotaoComunicar } from "@/components/BotaoComunicar";

export const dynamic = "force-dynamic";

// Mapeia situação textual da licitação/ata para a cor do Badge.
function corSituacao(
  situacao: string | null | undefined
): "slate" | "green" | "red" | "yellow" | "blue" {
  const s = (situacao ?? "").toUpperCase();
  if (["HOMOLOGADA", "ADJUDICADA", "CONCLUIDA", "VIGENTE"].includes(s))
    return "green";
  if (["EM_ANDAMENTO", "ABERTA", "PUBLICADA", "EM_DISPUTA"].includes(s))
    return "blue";
  if (["SUSPENSA", "DESERTA"].includes(s)) return "yellow";
  if (["FRACASSADA", "CANCELADA", "REVOGADA", "ANULADA", "ENCERRADA"].includes(s))
    return "red";
  return "slate";
}

// Formata o rótulo da situação (substitui "_" por espaço).
function rotuloSituacao(situacao: string | null | undefined): string {
  if (!situacao) return "—";
  return situacao
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export default async function PaginaCompras() {
  const ex = await exercicioAtual();
  if (!ex) {
    return (
      <div>
        <PageHeader
          titulo="Compras e Licitações"
          descricao="Acompanhamento de processos licitatórios, contratos e atas de registro de preços."
        />
        <EmptyState mensagem="Cadastre um exercício e importe dados de compras para visualizar o painel." />
      </div>
    );
  }

  const resumo = await resumoCompras(ex.id);

  const licitacoes = await db.licitacao.findMany({
    where: { exercicioId: ex.id },
    include: { secretaria: true, fornecedorVenc: true },
    orderBy: { dataAbertura: "desc" },
  });

  const atas = await db.ataRegistroPreco.findMany({
    orderBy: { dataInicio: "desc" },
  });

  // ----- Itens com maior variação de preço -----
  // Parte dos itens comprados (poucos milhares), agrupando por produto.
  const itensCompra = await db.itemComprado.findMany({
    where: { produtoId: { not: null }, valorUnitario: { gt: 0 } },
    include: { produto: true },
  });

  const porProduto = new Map<
    string,
    { descricao: string; categoria: string; unidade: string; precos: number[] }
  >();
  for (const it of itensCompra) {
    const id = it.produtoId!;
    const e =
      porProduto.get(id) ?? {
        descricao: it.produto?.descricao ?? it.descricao,
        categoria: it.produto?.categoria ?? "—",
        unidade: it.produto?.unidadeMedida ?? "—",
        precos: [],
      };
    e.precos.push(it.valorUnitario);
    porProduto.set(id, e);
  }

  const variacoes = [...porProduto.entries()]
    .map(([id, e]) => {
      if (e.precos.length < 2) return null;
      const media = e.precos.reduce((a, b) => a + b, 0) / e.precos.length;
      const maior = Math.max(...e.precos);
      const menor = Math.min(...e.precos);
      const variacao = media > 0 ? (maior - media) / media : 0;
      return {
        id,
        descricao: e.descricao,
        categoria: e.categoria,
        unidade: e.unidade,
        compras: e.precos.length,
        media,
        maior,
        menor,
        variacao,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.variacao - a.variacao)
    .slice(0, 12);

  const maxVariacao = variacoes.length > 0 ? variacoes[0].variacao : 0;

  return (
    <div>
      <PageHeader
        titulo="Compras e Licitações"
        descricao={`Painel de processos licitatórios, contratos e atas — Exercício ${ex.ano} · ${ex.orgao.nome}`}
      />

      {/* Indicadores principais */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          rotulo="Total de licitações"
          valor={numero(resumo.totalLicitacoes, 0)}
          cor="brand"
        />
        <StatCard
          rotulo="Em andamento"
          valor={numero(resumo.emAndamento, 0)}
          cor="amarelo"
        />
        <StatCard
          rotulo="Compras diretas"
          valor={numero(resumo.comprasDiretas, 0)}
          cor="laranja"
        />
        <StatCard
          rotulo="Valor contratado"
          valor={moedaCompacta(resumo.valorContratado)}
          sub="Soma das licitações"
          cor="verde"
        />
        <StatCard
          rotulo="Contratos vigentes"
          valor={numero(resumo.contratosVigentes, 0)}
          cor="brand"
        />
        <StatCard
          rotulo="Contratos vencidos"
          valor={numero(resumo.contratosVencidos, 0)}
          sub="Vigentes com prazo expirado"
          cor="vermelho"
        />
      </div>

      {/* Licitações */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <CardTitulo>Processos licitatórios</CardTitulo>
          <BotaoExportar idTabela="tabela-licitacoes" titulo="Processos Licitatórios" />
        </div>
        {licitacoes.length === 0 ? (
          <EmptyState mensagem="Nenhuma licitação registrada para este exercício." />
        ) : (
          <Tabela
            id="tabela-licitacoes"
            colunas={[
              "Processo",
              "Modalidade",
              "Objeto",
              "Secretaria",
              "Vencedor",
              "Valor estimado",
              "Valor contratado",
              "Situação",
              "",
            ]}
          >
            {licitacoes.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {l.numeroProcesso}
                  {l.compraDireta && (
                    <span className="ml-2">
                      <Badge cor="slate">Compra direta</Badge>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{l.modalidade ?? "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate" title={l.objeto ?? ""}>
                  {l.objeto ?? "—"}
                </td>
                <td className="px-3 py-2">{l.secretaria?.nome ?? "—"}</td>
                <td className="px-3 py-2">{l.fornecedorVenc?.nome ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {moeda(l.valorEstimado)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {moeda(l.valorContratado)}
                </td>
                <td className="px-3 py-2">
                  <Badge cor={corSituacao(l.situacao)}>
                    {rotuloSituacao(l.situacao)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <BotaoComunicar
                    origemTipo="LICITACAO"
                    origemId={l.id}
                    titulo={`Licitação ${l.numeroProcesso} — ${l.objeto?.slice(0, 60) ?? "—"}`}
                    descricao={`Processo nº ${l.numeroProcesso} | Modalidade: ${l.modalidade ?? "—"} | Secretaria: ${l.secretaria?.nome ?? "—"} | Valor contratado: ${moeda(l.valorContratado)}`}
                  />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {/* Atas de Registro de Preços */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <CardTitulo>Atas de registro de preços</CardTitulo>
          <BotaoExportar idTabela="tabela-atas" titulo="Atas de Registro de Preços" />
        </div>
        {atas.length === 0 ? (
          <EmptyState mensagem="Nenhuma ata de registro de preços cadastrada." />
        ) : (
          <Tabela
            id="tabela-atas"
            colunas={[
              "Número",
              "Objeto",
              "Fornecedor",
              "Valor total",
              "Início",
              "Fim",
              "Situação",
              "",
            ]}
          >
            {atas.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {a.numero}
                </td>
                <td className="px-3 py-2 max-w-xs truncate" title={a.objeto ?? ""}>
                  {a.objeto ?? "—"}
                </td>
                <td className="px-3 py-2">{a.fornecedor ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {moeda(a.valorTotal)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{data(a.dataInicio)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{data(a.dataFim)}</td>
                <td className="px-3 py-2">
                  <Badge cor={corSituacao(a.situacao)}>
                    {rotuloSituacao(a.situacao)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <BotaoComunicar
                    origemTipo="LICITACAO"
                    origemId={a.id}
                    titulo={`Ata ${a.numero} — ${a.objeto?.slice(0, 60) ?? "—"}`}
                    descricao={`Ata de Registro de Preços nº ${a.numero} | Fornecedor: ${a.fornecedor ?? "—"} | Valor total: ${moeda(a.valorTotal)}`}
                  />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {/* Itens com maior variação de preço */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitulo>Itens com maior variação de preço</CardTitulo>
          <BotaoExportar idTabela="tabela-variacoes" titulo="Variação de Preços" />
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Produtos com 2 ou mais compras registradas. A variação compara o maior
          preço unitário pago com a média histórica do item.
        </p>
        {variacoes.length === 0 ? (
          <EmptyState mensagem="Não há produtos com histórico suficiente (mínimo de 2 compras) para análise de variação." />
        ) : (
          <Tabela
            id="tabela-variacoes"
            colunas={[
              "Produto",
              "Categoria",
              "Unid.",
              "Compras",
              "Preço médio",
              "Menor",
              "Maior",
              "Variação",
              "",
              "",
            ]}
          >
            {variacoes.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  {v.descricao}
                </td>
                <td className="px-3 py-2">{v.categoria}</td>
                <td className="px-3 py-2">{v.unidade}</td>
                <td className="px-3 py-2">{numero(v.compras, 0)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{moeda(v.media)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                  {moeda(v.menor)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{moeda(v.maior)}</td>
                <td className="px-3 py-2">
                  <Badge
                    cor={
                      v.variacao >= 0.5
                        ? "red"
                        : v.variacao >= 0.2
                        ? "yellow"
                        : "green"
                    }
                  >
                    +{percentual(v.variacao)}
                  </Badge>
                </td>
                <td className="px-3 py-2 w-32">
                  <BarraProporcao
                    valor={v.variacao}
                    total={maxVariacao}
                    cor={
                      v.variacao >= 0.5
                        ? "bg-alerta-vermelho"
                        : v.variacao >= 0.2
                        ? "bg-alerta-amarelo"
                        : "bg-alerta-verde"
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <BotaoComunicar
                    origemTipo="PRODUTO"
                    origemId={v.id}
                    titulo={`Variação de preço — ${v.descricao}`}
                    descricao={`Produto: ${v.descricao} | Categoria: ${v.categoria} | Variação: +${percentual(v.variacao)} acima da média | Menor: ${moeda(v.menor)} / Maior: ${moeda(v.maior)} / Média: ${moeda(v.media)}`}
                    prioridade={v.variacao >= 0.5 ? "ALTA" : "NORMAL"}
                  />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

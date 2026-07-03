import { db } from "@/lib/db";
import { moeda } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { GraficoRanking } from "@/components/Charts";

export const dynamic = "force-dynamic";

type EstadoConservacao = string | null | undefined;

function corEstado(estado: EstadoConservacao): "slate" | "green" | "red" | "yellow" | "blue" {
  const e = (estado ?? "").toUpperCase();
  if (e.includes("OTIM") || e.includes("ÓTIM") || e.includes("NOVO") || e.includes("BOM"))
    return "green";
  if (e.includes("REGULAR")) return "yellow";
  if (e.includes("RUIM") || e.includes("PESSIM") || e.includes("PÉSSIM") || e.includes("INSERV"))
    return "red";
  return "slate";
}

function corSituacao(baixado: boolean): "slate" | "green" | "red" | "yellow" | "blue" {
  return baixado ? "red" : "green";
}

export default async function PatrimonioPagina() {
  const bens = await db.patrimonio.findMany({
    include: { secretaria: true },
    orderBy: { numero: "asc" },
  });

  if (bens.length === 0) {
    return (
      <div>
        <PageHeader
          titulo="Patrimônio"
          descricao="Bens patrimoniais do órgão público"
        />
        <EmptyState mensagem="Nenhum bem patrimonial cadastrado. Importe dados de patrimônio." />
      </div>
    );
  }

  const total = bens.length;
  const valorTotal = bens.reduce((acc, b) => acc + (b.valorAquisicao ?? 0), 0);
  const semLocalizacao = bens.filter(
    (b) => !b.localizacao || b.localizacao.trim() === ""
  );
  const baixados = bens.filter((b) => b.baixado);

  // Ranking de valor por categoria
  const porCategoria = new Map<string, number>();
  for (const b of bens) {
    const cat = b.categoria && b.categoria.trim() !== "" ? b.categoria : "Sem categoria";
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + (b.valorAquisicao ?? 0));
  }
  const rankingCategoria = Array.from(porCategoria.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  return (
    <div>
      <PageHeader
        titulo="Patrimônio"
        descricao="Bens patrimoniais do órgão público"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard rotulo="Total de bens" valor={String(total)} cor="brand" />
        <StatCard
          rotulo="Valor total"
          valor={moeda(valorTotal)}
          sub="Soma do valor de aquisição"
          cor="verde"
        />
        <StatCard
          rotulo="Sem localização"
          valor={String(semLocalizacao.length)}
          sub="Bens sem local definido"
          cor="amarelo"
        />
        <StatCard
          rotulo="Baixados"
          valor={String(baixados.length)}
          sub="Bens já baixados"
          cor="vermelho"
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Valor por categoria</CardTitulo>
        {rankingCategoria.length > 0 ? (
          <GraficoRanking dados={rankingCategoria} />
        ) : (
          <EmptyState mensagem="Sem dados de categoria." />
        )}
      </Card>

      <Card className="mb-6">
        <CardTitulo>Bens patrimoniais</CardTitulo>
        <Tabela
          colunas={[
            "Nº",
            "Descrição",
            "Categoria",
            "Localização",
            "Responsável",
            "Estado",
            "Valor",
            "Secretaria",
            "Situação",
          ]}
        >
          {bens.map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-2 font-medium text-slate-700">{b.numero}</td>
              <td className="px-3 py-2">{b.descricao}</td>
              <td className="px-3 py-2">{b.categoria ?? "—"}</td>
              <td className="px-3 py-2">
                {b.localizacao && b.localizacao.trim() !== "" ? (
                  b.localizacao
                ) : (
                  <Badge cor="yellow">Sem localização</Badge>
                )}
              </td>
              <td className="px-3 py-2">{b.responsavel ?? "—"}</td>
              <td className="px-3 py-2">
                {b.estadoConservacao ? (
                  <Badge cor={corEstado(b.estadoConservacao)}>
                    {b.estadoConservacao}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">{moeda(b.valorAquisicao)}</td>
              <td className="px-3 py-2">{b.secretaria?.nome ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge cor={corSituacao(b.baixado)}>
                  {b.baixado ? "Baixado" : "Ativo"}
                </Badge>
              </td>
            </tr>
          ))}
        </Tabela>
      </Card>

      <Card>
        <CardTitulo>Bens sem localização</CardTitulo>
        {semLocalizacao.length === 0 ? (
          <EmptyState mensagem="Todos os bens possuem localização definida." />
        ) : (
          <Tabela
            colunas={[
              "Nº",
              "Descrição",
              "Categoria",
              "Responsável",
              "Valor",
              "Secretaria",
              "Situação",
            ]}
          >
            {semLocalizacao.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 font-medium text-slate-700">
                  {b.numero}
                </td>
                <td className="px-3 py-2">{b.descricao}</td>
                <td className="px-3 py-2">{b.categoria ?? "—"}</td>
                <td className="px-3 py-2">{b.responsavel ?? "—"}</td>
                <td className="px-3 py-2">{moeda(b.valorAquisicao)}</td>
                <td className="px-3 py-2">{b.secretaria?.nome ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge cor="yellow">Sem localização</Badge>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

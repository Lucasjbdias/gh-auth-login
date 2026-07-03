import { db } from "@/lib/db";
import { data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

type CorBadge = "slate" | "green" | "red" | "yellow" | "blue";

function corStatus(status: string): CorBadge {
  switch (status) {
    case "PROCESSADO":
      return "green";
    case "COM_ERROS":
      return "yellow";
    case "FALHOU":
      return "red";
    default:
      return "slate";
  }
}

function rotuloStatus(status: string): string {
  const mapa: Record<string, string> = {
    PROCESSADO: "Processado",
    COM_ERROS: "Com erros",
    FALHOU: "Falhou",
    PENDENTE: "Pendente",
  };
  return mapa[status] ?? status;
}

export default async function Pagina() {
  const importacoes = await db.importacao.findMany({
    orderBy: { criadoEm: "desc" },
    include: { fonte: true },
  });

  return (
    <div>
      <PageHeader
        titulo="Importações"
        descricao="Validação e registro de arquivos de dados para o sistema."
      />

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Nesta versão a importação <strong>valida e registra</strong> o arquivo
        enviado (contagem de linhas e detecção de colunas faltando). A
        persistência dos dados de negócio por tipo virá em uma próxima versão.
      </div>

      <Card className="mb-6">
        <CardTitulo>Nova importação</CardTitulo>
        <UploadForm />
      </Card>

      <Card>
        <CardTitulo>Histórico de importações</CardTitulo>
        {importacoes.length === 0 ? (
          <EmptyState mensagem="Nenhuma importação registrada até o momento." />
        ) : (
          <Tabela
            colunas={[
              "Arquivo",
              "Tipo",
              "Responsável",
              "Total",
              "OK",
              "Erros",
              "Status",
              "Data",
            ]}
          >
            {importacoes.map((imp) => (
              <tr key={imp.id}>
                <td className="px-3 py-2 font-medium text-slate-800">
                  {imp.nomeArquivo}
                </td>
                <td className="px-3 py-2">{imp.tipoDado}</td>
                <td className="px-3 py-2">{imp.usuarioResponsavel || "—"}</td>
                <td className="px-3 py-2">{imp.totalRegistros}</td>
                <td className="px-3 py-2 text-green-700">{imp.registrosOk}</td>
                <td className="px-3 py-2 text-red-700">{imp.registrosErro}</td>
                <td className="px-3 py-2">
                  <Badge cor={corStatus(imp.status)}>
                    {rotuloStatus(imp.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {data(imp.criadoEm)}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  );
}

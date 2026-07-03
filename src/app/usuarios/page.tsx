import { db } from "@/lib/db";
import { data } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardTitulo,
  StatCard,
  Tabela,
  EmptyState,
  Badge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

// Mapeamento dos 9 perfis do sistema (Seção 8).
const PERFIS: {
  chave: string;
  nome: string;
  descricao: string;
}[] = [
  {
    chave: "ADMINISTRADOR",
    nome: "Administrador",
    descricao:
      "Acesso total ao sistema: configurações, parâmetros, gestão de usuários, importações e auditoria.",
  },
  {
    chave: "GESTOR_PRINCIPAL",
    nome: "Gestor Principal",
    descricao:
      "Visão executiva 360 do órgão (prefeito/gestor máximo): todos os painéis e indicadores consolidados.",
  },
  {
    chave: "SECRETARIO",
    nome: "Secretário",
    descricao:
      "Gestor de uma secretaria: acompanha receitas, despesas, contratos e alertas da sua pasta.",
  },
  {
    chave: "CONTROLE_INTERNO",
    nome: "Controle Interno",
    descricao:
      "Auditoria preventiva: análise de alertas, conformidade, riscos e providências.",
  },
  {
    chave: "CONTABILIDADE",
    nome: "Contabilidade",
    descricao:
      "Execução orçamentária e financeira: receitas, despesas, dotações, empenhos e liquidações.",
  },
  {
    chave: "COMPRAS",
    nome: "Compras",
    descricao:
      "Licitações, contratos, fornecedores, atas de registro de preço e compras diretas.",
  },
  {
    chave: "ALMOXARIFADO",
    nome: "Almoxarifado",
    descricao:
      "Gestão de estoque: produtos, movimentações, níveis críticos e custo médio.",
  },
  {
    chave: "FROTA",
    nome: "Frota",
    descricao:
      "Gestão de veículos: abastecimentos, manutenções, custos por veículo e documentação.",
  },
  {
    chave: "CONSULTA",
    nome: "Consulta",
    descricao:
      "Acesso somente leitura aos painéis e relatórios, sem permissão de edição ou configuração.",
  },
];

// Rótulo amigável a partir do valor armazenado no perfil.
function rotuloPerfil(perfil: string): string {
  const encontrado = PERFIS.find(
    (p) =>
      p.chave === perfil ||
      p.nome.toLowerCase() === perfil.toLowerCase() ||
      p.chave.replace(/_/g, " ").toLowerCase() === perfil.toLowerCase()
  );
  return encontrado ? encontrado.nome : perfil;
}

// Cor do Badge por perfil.
function corPerfil(perfil: string): "slate" | "green" | "red" | "yellow" | "blue" {
  const p = perfil.toUpperCase();
  if (p.includes("ADMIN")) return "red";
  if (p.includes("GESTOR")) return "blue";
  if (p.includes("CONTROLE")) return "yellow";
  if (p.includes("CONSULTA")) return "slate";
  return "green";
}

export default async function PaginaUsuarios() {
  const usuarios = await db.usuario.findMany({ orderBy: { nome: "asc" } });

  if (usuarios.length === 0) {
    return (
      <div>
        <PageHeader
          titulo="Usuários e Perfis"
          descricao="Gestão de acessos e níveis de permissão do sistema."
        />
        <EmptyState mensagem="Nenhum usuário cadastrado. Cadastre usuários e atribua perfis de acesso." />
      </div>
    );
  }

  const total = usuarios.length;
  const ativos = usuarios.filter((u) => u.ativo).length;
  const inativos = total - ativos;

  // Contagem por perfil.
  const contagem = new Map<string, number>();
  for (const u of usuarios) {
    contagem.set(u.nivel, (contagem.get(u.nivel) ?? 0) + 1);
  }
  const perfilMaisComum = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader
        titulo="Usuários e Perfis"
        descricao="Gestão de acessos e níveis de permissão do sistema (Seção 8)."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard rotulo="Total de usuários" valor={String(total)} cor="brand" />
        <StatCard
          rotulo="Usuários ativos"
          valor={String(ativos)}
          sub={`${inativos} inativo(s)`}
          cor="verde"
        />
        <StatCard
          rotulo="Perfis em uso"
          valor={String(contagem.size)}
          sub="tipos de perfil distintos"
          cor="laranja"
        />
        <StatCard
          rotulo="Perfil mais comum"
          valor={perfilMaisComum ? rotuloPerfil(perfilMaisComum[0]) : "—"}
          sub={
            perfilMaisComum ? `${perfilMaisComum[1]} usuário(s)` : undefined
          }
          cor="amarelo"
        />
      </div>

      <Card className="mb-6">
        <CardTitulo>Usuários cadastrados</CardTitulo>
        <Tabela colunas={["Nome", "E-mail", "Perfil", "Situação", "Criado em"]}>
          {usuarios.map((u) => {
            const criadoEm = (u as { criadoEm?: Date | string | null })
              .criadoEm;
            return (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {u.nome}
                </td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <Badge cor={corPerfil(u.nivel)}>
                    {rotuloPerfil(u.nivel)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge cor={u.ativo ? "green" : "slate"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {criadoEm ? data(criadoEm) : "—"}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </Card>

      <Card>
        <CardTitulo>Os 9 perfis de acesso (Seção 8)</CardTitulo>
        <p className="mb-4 text-sm text-slate-500">
          Cada usuário recebe um perfil que define quais módulos e ações ficam
          disponíveis. Os perfis seguem a separação de funções recomendada para
          a gestão pública municipal.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PERFIS.map((p) => (
            <div
              key={p.chave}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-2">
                <Badge cor={corPerfil(p.chave)}>{p.nome}</Badge>
              </div>
              <p className="text-sm text-slate-600">{p.descricao}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

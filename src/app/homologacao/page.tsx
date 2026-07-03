import { PageHeader, Card, CardTitulo, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

// Plano e fluxo de homologação (aceite) do sistema — visível dentro do app.

type Status = "ok" | "andamento" | "pendente";
interface Item { t: string; s: Status }
interface Fase { n: number; titulo: string; objetivo: string; itens: Item[] }

const FASES: Fase[] = [
  {
    n: 1,
    titulo: "Preparação do ambiente",
    objetivo: "Garantir que o sistema sobe e está acessível.",
    itens: [
      { t: "Build de produção sem erros (npm run build)", s: "ok" },
      { t: "Servidor no ar na porta 3003 (npm run start)", s: "ok" },
      { t: "Banco criado e migrações aplicadas", s: "ok" },
      { t: "Pasta .next fora da sincronização do OneDrive", s: "pendente" },
    ],
  },
  {
    n: 2,
    titulo: "Importação e qualidade dos dados",
    objetivo: "Validar que cada importador lê e grava corretamente.",
    itens: [
      { t: "Execução Orçamentária 2025 e 2026", s: "ok" },
      { t: "Catálogo de produtos", s: "ok" },
      { t: "Controle de compras, NAF e Compras Diretas", s: "ok" },
      { t: "Demonstrativo de Despesa (nomes de unidades/funções)", s: "ok" },
      { t: "Compras 2026", s: "pendente" },
      { t: "Folha de pagamento (verba a verba, lotações)", s: "pendente" },
      { t: "Conferência de totais (importado × fonte oficial)", s: "andamento" },
    ],
  },
  {
    n: 3,
    titulo: "Testes funcionais por módulo",
    objetivo: "Cada painel abre, mostra dados corretos e navega.",
    itens: [
      { t: "Visão Geral, Receitas, Despesas", s: "ok" },
      { t: "Compras, Contratos, Fornecedores", s: "ok" },
      { t: "Produtos, Almoxarifado, Veículos, Patrimônio", s: "ok" },
      { t: "Comparativo Anual (desvios)", s: "ok" },
      { t: "Relatórios e exportações", s: "andamento" },
    ],
  },
  {
    n: 4,
    titulo: "Regras e alertas",
    objetivo: "Motor de alertas gera achados corretos, sem falso-positivo.",
    itens: [
      { t: "Contratos vencendo / vencidos", s: "ok" },
      { t: "Inconsistência de execução (dotação)", s: "ok" },
      { t: "Preço fora da média / cadastro incompleto", s: "ok" },
      { t: "Concentração de fornecedor (NAF/compras)", s: "pendente" },
      { t: "Revisão dos parâmetros configuráveis", s: "andamento" },
    ],
  },
  {
    n: 5,
    titulo: "Desempenho",
    objetivo: "Telas respondem rápido mesmo com volume real.",
    itens: [
      { t: "Páginas pesadas otimizadas (produtos ~40k)", s: "ok" },
      { t: "Consultas por agregação/índices", s: "ok" },
      { t: "Tempo de resposta < 2s nas telas principais", s: "ok" },
      { t: "Teste de carga com dados completos", s: "pendente" },
    ],
  },
  {
    n: 6,
    titulo: "Segurança e perfis",
    objetivo: "Acesso por perfil e trilha de auditoria.",
    itens: [
      { t: "Trilha de auditoria registrando ações", s: "ok" },
      { t: "Perfis de acesso (9 perfis definidos)", s: "andamento" },
      { t: "Login individual e permissões por módulo", s: "pendente" },
      { t: "Backup e proteção de dados", s: "pendente" },
    ],
  },
  {
    n: 7,
    titulo: "Aceite final",
    objetivo: "Validação pelo gestor e liberação para uso.",
    itens: [
      { t: "Manual disponível no sistema", s: "ok" },
      { t: "Vídeo de treinamento", s: "andamento" },
      { t: "Validação do gestor (homologação assistida)", s: "pendente" },
      { t: "Termo de aceite", s: "pendente" },
    ],
  },
];

function Marca({ s }: { s: Status }) {
  if (s === "ok") return <Badge cor="green">Concluído</Badge>;
  if (s === "andamento") return <Badge cor="yellow">Em andamento</Badge>;
  return <Badge cor="slate">Pendente</Badge>;
}

export default function HomologacaoPage() {
  const total = FASES.flatMap((f) => f.itens).length;
  const ok = FASES.flatMap((f) => f.itens).filter((i) => i.s === "ok").length;
  const pct = Math.round((ok / total) * 100);

  return (
    <div>
      <PageHeader
        titulo="Plano de Homologação"
        descricao="Fluxo de aceite do GesIA — França Dias Group"
        acao={
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-700">{pct}%</p>
            <p className="text-xs text-slate-500">{ok} de {total} itens concluídos</p>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-fd-dourado" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Legenda: <Badge cor="green">Concluído</Badge> validado · <Badge cor="yellow">Em andamento</Badge> em execução ·{" "}
          <Badge cor="slate">Pendente</Badge> aguardando dados ou ação.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {FASES.map((f) => (
          <Card key={f.n}>
            <CardTitulo>Fase {f.n} — {f.titulo}</CardTitulo>
            <p className="mb-3 text-xs text-slate-500">{f.objetivo}</p>
            <ul className="space-y-2">
              {f.itens.map((i, k) => (
                <li key={k} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <span className={i.s === "ok" ? "text-green-600" : i.s === "andamento" ? "text-yellow-600" : "text-slate-300"}>
                      {i.s === "ok" ? "✔" : i.s === "andamento" ? "◐" : "○"}
                    </span>
                    {i.t}
                  </span>
                  <Marca s={i.s} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Plano de homologação versionado — atualize os status conforme a validação avança. Detalhe técnico em HOMOLOGACAO.md.
      </p>
    </div>
  );
}

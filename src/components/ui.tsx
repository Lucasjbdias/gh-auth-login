import { ReactNode } from "react";

// Componentes de UI compartilhados por todos os painéis (Camada 7).
// Sem dependências externas além do Tailwind.

export function PageHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

/** Cartão de indicador (KPI) para a tela inicial e painéis. */
export function StatCard({
  rotulo,
  valor,
  sub,
  cor = "brand",
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  cor?: "brand" | "verde" | "amarelo" | "laranja" | "vermelho";
}) {
  const barra: Record<string, string> = {
    brand: "bg-brand-500",
    verde: "bg-alerta-verde",
    amarelo: "bg-alerta-amarelo",
    laranja: "bg-alerta-laranja",
    vermelho: "bg-alerta-vermelho",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1 ${barra[cor]}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

/** Etiqueta de gravidade de alerta. */
export function BadgeGravidade({
  gravidade,
}: {
  gravidade: "VERDE" | "AMARELO" | "LARANJA" | "VERMELHO";
}) {
  const estilo: Record<string, string> = {
    VERDE: "bg-green-100 text-green-800",
    AMARELO: "bg-yellow-100 text-yellow-800",
    LARANJA: "bg-orange-100 text-orange-800",
    VERMELHO: "bg-red-100 text-red-800",
  };
  const label: Record<string, string> = {
    VERDE: "Normal",
    AMARELO: "Atenção",
    LARANJA: "Risco médio",
    VERMELHO: "Crítico",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estilo[gravidade]}`}
    >
      {label[gravidade]}
    </span>
  );
}

export function Badge({
  children,
  cor = "slate",
}: {
  children: ReactNode;
  cor?: "slate" | "green" | "red" | "yellow" | "blue";
}) {
  const estilo: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estilo[cor]}`}>
      {children}
    </span>
  );
}

/** Tabela simples e responsiva. */
export function Tabela({
  colunas,
  children,
  id,
}: {
  colunas: string[];
  children: ReactNode;
  id?: string;
}) {
  return (
    <div className="overflow-x-auto" id={id}>
      <table className="w-full text-sm" data-export-table>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {colunas.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
      {mensagem}
    </div>
  );
}

/** Barra horizontal proporcional (para rankings). */
export function BarraProporcao({
  valor,
  total,
  cor = "bg-brand-500",
}: {
  valor: number;
  total: number;
  cor?: string;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

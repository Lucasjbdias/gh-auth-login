"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Wrappers de gráficos (Recharts). São client components; as páginas server
// passam apenas os dados já calculados pelo motor de indicadores.

const CORES = ["#1d6fd6", "#16a34a", "#ea580c", "#9333ea", "#dc2626", "#0891b2", "#ca8a04", "#4f46e5"];

const fmtCompacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const fmtTooltip = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface SerieMensal {
  mes: number;
  [k: string]: number;
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Gráfico de linhas mensal (ex.: receita prevista x arrecadada). */
export function GraficoLinhaMensal({
  dados,
  series,
}: {
  dados: SerieMensal[];
  series: { chave: string; nome: string; cor?: string }[];
}) {
  const data = dados.map((d) => ({ ...d, mesLabel: MESES_ABREV[d.mes - 1] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mesLabel" fontSize={12} stroke="#94a3b8" />
        <YAxis tickFormatter={fmtCompacto} fontSize={12} stroke="#94a3b8" width={50} />
        <Tooltip formatter={(v: number) => fmtTooltip(v)} />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={s.cor ?? CORES[i % CORES.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de barras mensal. */
export function GraficoBarraMensal({
  dados,
  series,
}: {
  dados: SerieMensal[];
  series: { chave: string; nome: string; cor?: string }[];
}) {
  const data = dados.map((d) => ({ ...d, mesLabel: MESES_ABREV[d.mes - 1] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mesLabel" fontSize={12} stroke="#94a3b8" />
        <YAxis tickFormatter={fmtCompacto} fontSize={12} stroke="#94a3b8" width={50} />
        <Tooltip formatter={(v: number) => fmtTooltip(v)} />
        <Legend />
        {series.map((s, i) => (
          <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={s.cor ?? CORES[i % CORES.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontais para rankings (categoria x valor). */
export function GraficoRanking({
  dados,
}: {
  dados: { nome: string; valor: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 38)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompacto} fontSize={12} stroke="#94a3b8" />
        <YAxis type="category" dataKey="nome" width={140} fontSize={12} stroke="#64748b" />
        <Tooltip formatter={(v: number) => fmtTooltip(v)} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de pizza (ex.: receita por origem). */
export function GraficoPizza({
  dados,
}: {
  dados: { nome: string; valor: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(e) => e.nome}
          fontSize={11}
        >
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => fmtTooltip(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

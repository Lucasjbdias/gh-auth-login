"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPCOES: { valor: string; rotulo: string }[] = [
  { valor: "NOVO", rotulo: "Novo" },
  { valor: "EM_ANALISE", rotulo: "Em análise" },
  { valor: "AGUARDANDO_SECRETARIA", rotulo: "Aguardando secretaria" },
  { valor: "JUSTIFICADO", rotulo: "Justificado" },
  { valor: "CORRIGIDO", rotulo: "Corrigido" },
  { valor: "RESOLVIDO", rotulo: "Resolvido" },
  { valor: "ESCALADO", rotulo: "Escalado" },
  { valor: "ARQUIVADO", rotulo: "Arquivado" },
];

export function AcoesAlerta({
  id,
  statusAtual,
  providenciaAtual,
}: {
  id: string;
  statusAtual: string;
  providenciaAtual: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(statusAtual);
  const [providencia, setProvidencia] = useState(providenciaAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/alertas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, providencia }),
      });
      if (!resp.ok) throw new Error("Falha ao salvar");
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex w-56 flex-col gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
      >
        {STATUS_OPCOES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <textarea
        value={providencia}
        onChange={(e) => setProvidencia(e.target.value)}
        placeholder="Providência adotada..."
        rows={2}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={salvar}
        disabled={salvando}
        className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

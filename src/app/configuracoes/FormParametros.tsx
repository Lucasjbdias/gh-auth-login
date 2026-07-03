"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CampoParametro = {
  chave: string;
  descricao: string;
  unidade: string;
  valor: string;
};

export default function FormParametros({
  campos,
}: {
  campos: CampoParametro[];
}) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const c of campos) inicial[c.chave] = c.valor;
    return inicial;
  });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  function atualizar(chave: string, valor: string) {
    setValores((v) => ({ ...v, [chave]: valor }));
    setMensagem(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const resp = await fetch("/api/parametros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros: valores }),
      });
      if (!resp.ok) throw new Error("Falha ao salvar.");
      setMensagem({ tipo: "ok", texto: "Parâmetros salvos com sucesso." });
      router.refresh();
    } catch {
      setMensagem({
        tipo: "erro",
        texto: "Não foi possível salvar os parâmetros. Tente novamente.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="divide-y divide-slate-100">
        {campos.map((c) => (
          <div
            key={c.chave}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="sm:max-w-md">
              <p className="text-sm font-medium text-slate-900">{c.descricao}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-400">{c.chave}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={valores[c.chave] ?? ""}
                onChange={(e) => atualizar(c.chave, e.target.value)}
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {c.unidade && (
                <span className="text-xs text-slate-500">{c.unidade}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar parâmetros"}
        </button>
        {mensagem && (
          <span
            className={`text-sm ${
              mensagem.tipo === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {mensagem.texto}
          </span>
        )}
      </div>
    </form>
  );
}

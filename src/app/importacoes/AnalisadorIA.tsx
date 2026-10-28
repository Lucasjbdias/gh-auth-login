"use client";

import { useState } from "react";

interface AnaliseIA {
  formato?: string;
  descricao?: string;
  importadorSugerido?: string | null;
  totalLinhas?: number;
  camposIdentificados?: string[];
  qualidade?: "BOA" | "MEDIA" | "BAIXA";
  observacoes?: string;
  insights?: string;
}

const COR_QUALIDADE: Record<string, string> = {
  BOA: "bg-green-100 text-green-800 border-green-300",
  MEDIA: "bg-yellow-100 text-yellow-800 border-yellow-300",
  BAIXA: "bg-red-100 text-red-800 border-red-300",
};

export function AnalisadorIA() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [textoLivre, setTextoLivre] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semIA, setSemIA] = useState(false);

  async function analisar() {
    if (!arquivo) return;
    setAnalisando(true);
    setAnalise(null);
    setTextoLivre(null);
    setErro(null);

    try {
      // Para análise IA, envia no máximo 500 KB como amostra (evita limite de FormData
      // e custo desnecessário de tokens — o endpoint já extrai amostra do buffer).
      const AMOSTRA_MAX = 500 * 1024;
      const blob = arquivo.size > AMOSTRA_MAX ? arquivo.slice(0, AMOSTRA_MAX) : arquivo;
      const amostra = new File([blob], arquivo.name, { type: arquivo.type });

      const fd = new FormData();
      fd.append("file", amostra);
      const res = await fetch("/api/importacao/analisar", { method: "POST", body: fd });
      const dados = await res.json();

      if (!dados.ok) {
        setSemIA(!!dados.semIA);
        setErro(dados.erro ?? "Erro ao analisar.");
        return;
      }

      setAnalise(dados.analise ?? null);
      setTextoLivre(dados.textoLivre ?? null);
    } catch {
      setErro("Falha ao comunicar com o servidor.");
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Arquivo para análise
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.zip"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setAnalise(null);
              setTextoLivre(null);
              setErro(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-purple-100 file:px-3 file:py-1 file:text-sm file:text-purple-700"
          />
        </div>
        <button
          onClick={analisar}
          disabled={!arquivo || analisando}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analisando ? "Analisando…" : "🤖 Analisar com IA"}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${semIA ? "border-yellow-300 bg-yellow-50 text-yellow-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {semIA ? "⚙️ " : "❌ "}
          {erro}
          {semIA && (
            <p className="mt-1 text-xs">
              Adicione <code className="rounded bg-yellow-100 px-1">ANTHROPIC_API_KEY=sua-chave</code> no arquivo <code className="rounded bg-yellow-100 px-1">.env</code> para habilitar a análise por IA.
            </p>
          )}
        </div>
      )}

      {/* Texto livre (fallback quando IA não retorna JSON) */}
      {textoLivre && !analise && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
          <p className="mb-1 font-semibold">Análise da IA:</p>
          <p className="whitespace-pre-wrap">{textoLivre}</p>
        </div>
      )}

      {/* Resultado estruturado */}
      {analise && (
        <div className="space-y-4 rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-800">
                {analise.formato ?? "Formato identificado"}
              </p>
              {analise.descricao && (
                <p className="text-sm text-slate-600">{analise.descricao}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {analise.qualidade && (
                <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${COR_QUALIDADE[analise.qualidade]}`}>
                  Qualidade: {analise.qualidade}
                </span>
              )}
              {analise.totalLinhas !== undefined && (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs text-slate-600">
                  ~{analise.totalLinhas.toLocaleString("pt-BR")} registros
                </span>
              )}
            </div>
          </div>

          {/* Importador sugerido */}
          {analise.importadorSugerido && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm">
              <span className="font-semibold text-green-800">✅ Importador sugerido: </span>
              <code className="text-green-700">{analise.importadorSugerido}</code>
              <p className="mt-0.5 text-xs text-green-700">
                Selecione esse importador no formulário acima e envie o arquivo.
              </p>
            </div>
          )}

          {/* Campos identificados */}
          {analise.camposIdentificados?.length ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                Campos identificados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analise.camposIdentificados.map((c, i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Insights */}
          {analise.insights && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p className="mb-0.5 font-semibold text-blue-800">💡 Insights</p>
              <p className="text-blue-700 whitespace-pre-line">{analise.insights}</p>
            </div>
          )}

          {/* Observações */}
          {analise.observacoes && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm">
              <p className="mb-0.5 font-semibold text-amber-800">⚠️ Observações</p>
              <p className="text-amber-700 whitespace-pre-line">{analise.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardTitulo,
  Badge,
  EmptyState,
} from "@/components/ui";
import { PERGUNTAS_SUGERIDAS } from "@/lib/perguntas";

interface RespostaConsultor {
  resposta: string;
  indicador: string;
  fonte: string;
  periodo: string;
  alerta?: string;
  recomendacao?: string;
  link?: string;
}

interface ItemHistorico {
  pergunta: string;
  resposta: RespostaConsultor;
}

export function Chat({ periodo }: { periodo: string }) {
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);

  async function perguntar(texto: string) {
    const q = texto.trim();
    if (!q || carregando) return;
    setCarregando(true);
    try {
      const res = await fetch("/api/consultor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q }),
      });
      const resposta: RespostaConsultor = await res.json();
      setHistorico((h) => [{ pergunta: q, resposta }, ...h]);
      setPergunta("");
    } catch {
      setHistorico((h) => [
        {
          pergunta: q,
          resposta: {
            resposta:
              "Não foi possível consultar agora. Tente novamente em instantes.",
            indicador: "—",
            fonte: "—",
            periodo: "—",
          },
        },
        ...h,
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    perguntar(pergunta);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitulo>Pergunte ao consultor</CardTitulo>
        <p className="mb-3 text-xs text-slate-400">{periodo}</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: Como está a despesa? Quais contratos vencem este mês?"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={carregando || !pergunta.trim()}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Consultando..." : "Perguntar"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {PERGUNTAS_SUGERIDAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPergunta(p)}
              disabled={carregando}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      {historico.length === 0 ? (
        <EmptyState mensagem="Faça uma pergunta ou escolha uma das sugestões acima para ver a resposta do consultor." />
      ) : (
        <div className="space-y-4">
          {historico.map((item, i) => (
            <Card key={historico.length - i}>
              <p className="mb-3 text-sm font-medium text-slate-500">
                <span className="text-slate-400">Pergunta:</span> {item.pergunta}
              </p>

              <p className="text-lg font-semibold text-slate-900">
                {item.resposta.resposta}
              </p>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Indicador
                  </span>
                  <p className="text-slate-700">{item.resposta.indicador}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Fonte
                  </span>
                  <p className="text-slate-700">{item.resposta.fonte}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Período
                  </span>
                  <p className="text-slate-700">{item.resposta.periodo}</p>
                </div>
              </div>

              {item.resposta.alerta && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge cor="red">Alerta</Badge>
                  </div>
                  <p className="text-sm text-red-800">{item.resposta.alerta}</p>
                </div>
              )}

              {item.resposta.recomendacao && (
                <div className="mt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recomendação
                  </span>
                  <p className="text-sm text-slate-700">
                    {item.resposta.recomendacao}
                  </p>
                </div>
              )}

              {item.resposta.link && (
                <div className="mt-4">
                  <Link
                    href={item.resposta.link}
                    className="inline-flex items-center text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Ver detalhe →
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

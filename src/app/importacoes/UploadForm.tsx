"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ImportadorInfo {
  id: string;
  nome: string;
  descricao: string;
  formatos: string[];
}

export function UploadForm() {
  const router = useRouter();
  const [importadores, setImportadores] = useState<ImportadorInfo[]>([]);
  const [tipoDado, setTipoDado] = useState<string>(""); // "" = detecção automática
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega o catálogo de importadores disponíveis.
  useEffect(() => {
    fetch("/api/importacao")
      .then((r) => r.json())
      .then((d) => setImportadores(d.importadores ?? []))
      .catch(() => setImportadores([]));
  }, []);

  const accept = [
    ...new Set(importadores.flatMap((i) => i.formatos)),
  ].join(",") || ".csv,.xlsx,.xls";

  const selecionado = importadores.find((i) => i.id === tipoDado);

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    setErro(null);
    setAvisos([]);

    if (!arquivo) {
      setErro("Selecione um arquivo para importar.");
      return;
    }

    setEnviando(true);
    try {
      // Arquivos > 3 MB usam Content-Type: application/octet-stream para contornar
      // o limite de 4 MB do req.formData() no Next.js App Router.
      const LIMITE_FORM_DATA = 3 * 1024 * 1024;
      let resp: Response;

      if (arquivo.size > LIMITE_FORM_DATA) {
        const params = new URLSearchParams({ filename: arquivo.name, tipoDado });
        resp = await fetch(`/api/importacao?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: arquivo,
        });
      } else {
        const fd = new FormData();
        fd.append("file", arquivo);
        fd.append("tipoDado", tipoDado);
        resp = await fetch("/api/importacao", { method: "POST", body: fd });
      }

      const dados = await resp.json().catch(() => null);

      if (!resp.ok) {
        setErro((dados && dados.erro) || "Falha ao processar a importação.");
      } else {
        setMensagem(
          `${dados.nomeImportador ? `[${dados.nomeImportador}] ` : ""}${dados.resumo ?? "Importação concluída."}`
        );
        setAvisos(dados.avisos ?? []);
        setArquivo(null);
        const input = document.getElementById("arquivo-import") as HTMLInputElement | null;
        if (input) input.value = "";
        router.refresh();
      }
    } catch {
      setErro("Erro de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="tipo-dado" className="text-xs font-medium text-slate-600">
            Importador
          </label>
          <select
            id="tipo-dado"
            value={tipoDado}
            onChange={(e) => setTipoDado(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
          >
            <option value="">Detecção automática (recomendado)</option>
            {importadores.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="arquivo-import" className="text-xs font-medium text-slate-600">
            Arquivo
          </label>
          <input
            id="arquivo-import"
            type="file"
            accept={accept}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Importando…" : "Importar"}
        </button>
      </div>

      {selecionado && (
        <p className="text-xs text-slate-500">{selecionado.descricao}</p>
      )}
      {mensagem && <p className="text-sm text-green-700">{mensagem}</p>}
      {avisos.length > 0 && (
        <ul className="list-inside list-disc text-xs text-amber-700">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </form>
  );
}

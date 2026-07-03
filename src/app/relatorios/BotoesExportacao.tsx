"use client";

import { useState } from "react";

/**
 * Botões de exportação meramente visuais.
 * A geração efetiva dos arquivos ainda não está implementada;
 * ao clicar, exibe um aviso informativo ao usuário.
 */
export function BotoesExportacao({ relatorio }: { relatorio: string }) {
  const [aviso, setAviso] = useState<string | null>(null);

  const formatos: { rotulo: string; cor: string }[] = [
    { rotulo: "PDF", cor: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" },
    { rotulo: "Word", cor: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
    { rotulo: "Excel", cor: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {formatos.map((f) => (
          <button
            key={f.rotulo}
            type="button"
            onClick={() =>
              setAviso(
                `A geração do relatório "${relatorio}" em ${f.rotulo} estará disponível em breve.`
              )
            }
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${f.cor}`}
          >
            Gerar {f.rotulo}
          </button>
        ))}
      </div>
      {aviso && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {aviso}
        </p>
      )}
    </div>
  );
}

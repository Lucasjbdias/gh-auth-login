'use client'

import { useState, useRef } from 'react'
import { lerTabelaDOM, exportarExcel, exportarPDF, exportarWord, exportarTxt, type DadosExport } from '@/lib/exportar'

interface Props {
  /** id do elemento que contém a <table> a ser exportada */
  idTabela: string
  titulo: string
  subtitulo?: string
  nomeArquivo?: string
  /** Variante visual do botão */
  variante?: 'primario' | 'secundario'
}

type Formato = 'excel' | 'pdf' | 'word' | 'txt'

const FORMATOS: { id: Formato; icone: string; label: string; ext: string }[] = [
  { id: 'excel', icone: '📊', label: 'Excel', ext: '.xlsx' },
  { id: 'pdf',   icone: '📄', label: 'PDF',   ext: '.pdf'  },
  { id: 'word',  icone: '📝', label: 'Word',  ext: '.doc'  },
  { id: 'txt',   icone: '🗒️', label: 'TXT',   ext: '.txt'  },
]

export function BotaoExportar({ idTabela, titulo, subtitulo, nomeArquivo, variante = 'secundario' }: Props) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState<Formato | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  async function exportar(formato: Formato) {
    const lido = lerTabelaDOM(idTabela)
    if (!lido || lido.linhas.length === 0) {
      alert('Nenhum dado encontrado na tabela para exportar.')
      setAberto(false)
      return
    }

    const dados: DadosExport = {
      ...lido,
      titulo,
      subtitulo,
      nomeArquivo: nomeArquivo ?? titulo,
    }

    setCarregando(formato)
    setAberto(false)
    try {
      if (formato === 'excel') await exportarExcel(dados)
      else if (formato === 'pdf') await exportarPDF(dados)
      else if (formato === 'word') exportarWord(dados)
      else exportarTxt(dados)
    } catch (e) {
      console.error('Erro ao exportar:', e)
      alert('Erro ao gerar o arquivo. Verifique o console para detalhes.')
    } finally {
      setCarregando(null)
    }
  }

  const btnBase =
    variante === 'primario'
      ? 'rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600'
      : 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(!aberto)}
        disabled={!!carregando}
        className={`${btnBase} flex items-center gap-1.5 disabled:opacity-50`}
        title="Exportar dados"
      >
        {carregando ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          '⬇'
        )}
        {carregando ? 'Gerando...' : 'Exportar'}
        {!carregando && <span className="opacity-60">▾</span>}
      </button>

      {aberto && (
        <>
          {/* overlay para fechar ao clicar fora */}
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {FORMATOS.map((f) => (
              <button
                key={f.id}
                onClick={() => exportar(f.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="text-base leading-none">{f.icone}</span>
                <span className="font-medium">{f.label}</span>
                <span className="ml-auto text-xs text-slate-400">{f.ext}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

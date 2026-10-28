'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextoComunicar {
  origemTipo: string
  origemId?: string
  titulo: string
  descricao?: string
  prioridade?: 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  municipio?: string
}

interface Dest { id: string; nome: string; email: string; cargo?: string | null; setor?: string | null }

interface Props extends ContextoComunicar {
  label?: string
  variante?: 'icone' | 'texto' | 'completo'
}

const TIPOS = [
  { v: 'COMUNICACAO', l: 'Comunicação' },
  { v: 'SOLICITACAO', l: 'Solicitação de diligência' },
  { v: 'NOTIFICACAO', l: 'Notificação' },
  { v: 'ADVERTENCIA', l: 'Advertência' },
  { v: 'OFICIO', l: 'Ofício' },
]

const PRIO_COR: Record<string, string> = {
  BAIXA: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  ALTA: 'bg-yellow-100 text-yellow-700',
  URGENTE: 'bg-red-100 text-red-700',
}

export function BotaoComunicar({
  origemTipo, origemId, titulo, descricao, prioridade = 'NORMAL', municipio,
  label, variante = 'icone',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [destinatarios, setDestinatarios] = useState<Dest[]>([])
  const [destSel, setDestSel] = useState<string[]>([])
  const [form, setForm] = useState({
    titulo, descricao: descricao ?? '', tipo: 'SOLICITACAO',
    prioridade: prioridade ?? 'NORMAL', prazo: '', nota: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState<{ id: string; numero: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    setSucesso(null)
    setForm({ titulo, descricao: descricao ?? '', tipo: 'SOLICITACAO', prioridade: prioridade ?? 'NORMAL', prazo: '', nota: '' })
    setDestSel([])
    fetch('/api/comunicar/destinatarios')
      .then((r) => r.json())
      .then((j) => setDestinatarios((j.destinatarios ?? []).filter((d: Dest & { ativo?: boolean }) => d.ativo !== false)))
  }, [aberto, titulo, descricao, prioridade])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  async function criar() {
    if (!form.titulo) return
    setSalvando(true)

    const descFinal = [form.descricao, form.nota ? `\n\nNota: ${form.nota}` : ''].join('').trim()

    const res = await fetch('/api/comunicar/protocolos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: form.titulo,
        descricao: descFinal,
        tipo: form.tipo,
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        municipio,
        origemTipo,
        origemId,
        destinatarioIds: destSel,
      }),
    })
    const json = await res.json()
    setSalvando(false)
    if (json.ok) setSucesso({ id: json.protocolo.id, numero: json.protocolo.numero })
  }

  const btnCls = {
    icone: 'rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors',
    texto: 'rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-brand-300 hover:text-brand-700 transition-colors',
    completo: 'rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors',
  }[variante]

  const ORIGEM_LABEL: Record<string, string> = {
    EMPENHO: '💸 Empenho', CONTRATO: '📑 Contrato', LICITACAO: '🛒 Licitação',
    ALERTA: '🚨 Alerta', CAUC: '🔒 CAUC', FORNECEDOR: '🏢 Fornecedor',
    VEICULO: '🚗 Veículo', PATRIMONIO: '🏛️ Patrimônio', PRODUTO: '📦 Produto',
    RECEITA: '💰 Receita', CONTABIL: '📒 Conta', MANUAL: '✏️ Manual',
  }

  const campo = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none bg-white'

  const painel = aberto ? (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-end p-4">
      <div className="absolute inset-0 bg-black/20" onClick={() => setAberto(false)} />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-800 text-sm">Solicitar diligência / Comunicar</p>
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs ${PRIO_COR[form.prioridade] ?? ''}`}>
              {ORIGEM_LABEL[origemTipo] ?? origemTipo}
            </span>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        {sucesso ? (
          <div className="p-5 text-center space-y-3">
            <p className="text-3xl">✅</p>
            <p className="font-semibold text-slate-800">Protocolo {sucesso.numero} criado!</p>
            <div className="flex gap-2 justify-center">
              <a href={`/comunicar/${sucesso.id}`} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                Abrir protocolo →
              </a>
              <button onClick={() => setAberto(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
              <input className={campo} value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                <select className={campo} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade</label>
                <select className={campo} value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE' }))}>
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Nota / Dúvida específica</label>
              <textarea
                className={`${campo} h-20 resize-none`}
                value={form.nota}
                onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Descreva o que precisa ser verificado ou esclarecido..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Prazo para resposta</label>
              <input type="date" className={campo} value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Encaminhar para ({destSel.length} selecionado{destSel.length !== 1 ? 's' : ''})
              </label>
              {destinatarios.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Sem destinatários cadastrados.{' '}
                  <a href="/comunicar/destinatarios" target="_blank" className="text-brand-600 underline">Cadastrar →</a>
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {destinatarios.map((d) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={destSel.includes(d.id)}
                        onChange={() => setDestSel((s) => s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id])}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-700 truncate">{d.nome}</span>
                        <span className="block text-xs text-slate-400 truncate">{d.email}{d.cargo ? ` · ${d.cargo}` : ''}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={criar}
              disabled={salvando || !form.titulo}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {salvando ? 'Criando protocolo…' : '📨 Criar protocolo'}
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setAberto(true) }}
        className={btnCls}
        title="Comunicar / Solicitar diligência"
      >
        {variante === 'icone' ? '📨' : label ?? '📨 Comunicar'}
      </button>
      {typeof document !== 'undefined' && aberto && createPortal(painel, document.body)}
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader, Card, CardTitulo } from '@/components/ui'

interface Destinatario { id: string; nome: string; email: string; cargo?: string | null; setor?: string | null }

const TIPOS = [
  { value: 'COMUNICACAO', label: 'Comunicação' },
  { value: 'NOTIFICACAO', label: 'Notificação' },
  { value: 'ADVERTENCIA', label: 'Advertência' },
  { value: 'OFICIO', label: 'Ofício' },
  { value: 'SOLICITACAO', label: 'Solicitação' },
]

const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

export default function NovoProtocolo() {
  const router = useRouter()
  const sp = useSearchParams()
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    titulo: sp.get('titulo') ?? '',
    descricao: sp.get('descricao') ?? '',
    tipo: 'COMUNICACAO',
    prioridade: sp.get('prioridade') ?? 'NORMAL',
    municipio: sp.get('municipio') ?? '',
    prazo: '',
    origemTipo: sp.get('origemTipo') ?? '',
    origemId: sp.get('origemId') ?? '',
    destinatarioIds: [] as string[],
  })

  useEffect(() => {
    fetch('/api/comunicar/destinatarios')
      .then((r) => r.json())
      .then((j) => setDestinatarios(j.destinatarios ?? []))
  }, [])

  function toggle(id: string) {
    setForm((f) => ({
      ...f,
      destinatarioIds: f.destinatarioIds.includes(id)
        ? f.destinatarioIds.filter((x) => x !== id)
        : [...f.destinatarioIds, id],
    }))
  }

  async function salvar() {
    if (!form.titulo) { setErro('Informe o título.'); return }
    setSalvando(true); setErro(null)
    const res = await fetch('/api/comunicar/protocolos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (json.ok) router.push(`/comunicar/${json.protocolo.id}`)
    else { setErro(json.error ?? 'Erro ao salvar.'); setSalvando(false) }
  }

  const campo = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

  return (
    <div>
      <PageHeader titulo="Novo protocolo" descricao="Registrar comunicação com destinatário e prazo." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardTitulo>Dados do protocolo</CardTitulo>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Título *</label>
                <input className={campo} value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Irregularidade CAUC — Caetanópolis" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
                <textarea className={`${campo} h-24 resize-none`} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o problema ou contexto..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
                  <select className={campo} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Prioridade</label>
                  <select className={campo} value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}>
                    {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Município</label>
                  <input className={campo} value={form.municipio} onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))} placeholder="Ex: Caetanópolis" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Prazo</label>
                  <input type="date" className={campo} value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} />
                </div>
              </div>
              {form.origemTipo && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Originado de: <strong>{form.origemTipo}</strong>{form.origemId ? ` (ID: ${form.origemId.slice(0, 8)}…)` : ''}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo>Destinatários responsáveis</CardTitulo>
            {destinatarios.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum destinatário cadastrado ainda. <a href="/comunicar/destinatarios" className="text-brand-600 underline">Cadastrar agora →</a></p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {destinatarios.filter((d) => d).map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                    <input type="checkbox" checked={form.destinatarioIds.includes(d.id)} onChange={() => toggle(d.id)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.nome}</p>
                      <p className="text-xs text-slate-500">{d.email}</p>
                      {d.cargo && <p className="text-xs text-slate-400">{d.cargo}{d.setor ? ` · ${d.setor}` : ''}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Criar protocolo →'}
          </button>
          <button onClick={() => router.back()} className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

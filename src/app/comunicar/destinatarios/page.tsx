'use client'

import { useState, useEffect } from 'react'
import { PageHeader, Card, CardTitulo } from '@/components/ui'

interface Destinatario { id: string; nome: string; email: string; cargo?: string | null; setor?: string | null; telefone?: string | null; ativo: boolean }

export default function DestinatariosPage() {
  const [lista, setLista] = useState<Destinatario[]>([])
  const [form, setForm] = useState({ nome: '', email: '', cargo: '', setor: '', telefone: '' })
  const [editando, setEditando] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function carregar() {
    const r = await fetch('/api/comunicar/destinatarios')
    const j = await r.json()
    setLista(j.destinatarios ?? [])
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!form.nome || !form.email) { setMsg({ tipo: 'erro', texto: 'Nome e email são obrigatórios.' }); return }
    setSalvando(true); setMsg(null)
    const url = editando ? `/api/comunicar/destinatarios/${editando}` : '/api/comunicar/destinatarios'
    const method = editando ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    setSalvando(false)
    if (json.ok) {
      setMsg({ tipo: 'ok', texto: editando ? 'Atualizado.' : 'Destinatário cadastrado.' })
      setForm({ nome: '', email: '', cargo: '', setor: '', telefone: '' }); setEditando(null)
      carregar()
    } else {
      setMsg({ tipo: 'erro', texto: json.error ?? 'Erro.' })
    }
  }

  async function desativar(id: string) {
    await fetch(`/api/comunicar/destinatarios/${id}`, { method: 'DELETE' })
    carregar()
  }

  function editar(d: Destinatario) {
    setEditando(d.id)
    setForm({ nome: d.nome, email: d.email, cargo: d.cargo ?? '', setor: d.setor ?? '', telefone: d.telefone ?? '' })
  }

  const campo = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

  return (
    <div>
      <PageHeader titulo="Destinatários" descricao="Pessoas que recebem comunicações e notificações dos protocolos." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitulo>{editando ? 'Editar destinatário' : 'Novo destinatário'}</CardTitulo>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome *</label>
              <input className={campo} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
              <input type="email" className={campo} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@municipio.mg.gov.br" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Cargo</label>
                <input className={campo} value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Secretário de Finanças" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Setor</label>
                <input className={campo} value={form.setor} onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} placeholder="Ex: Secretaria de Fazenda" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Telefone</label>
              <input className={campo} value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(31) 9 9999-9999" />
            </div>

            {msg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
            )}

            <div className="flex gap-2">
              <button onClick={salvar} disabled={salvando} className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {salvando ? 'Salvando…' : editando ? 'Atualizar' : 'Cadastrar'}
              </button>
              {editando && (
                <button onClick={() => { setEditando(null); setForm({ nome: '', email: '', cargo: '', setor: '', telefone: '' }) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitulo>Cadastrados ({lista.filter((d) => d.ativo).length})</CardTitulo>
          {lista.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum destinatário cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {lista.filter((d) => d.ativo).map((d) => (
                <div key={d.id} className="flex items-start justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="font-medium text-slate-800">{d.nome}</p>
                    <p className="text-sm text-slate-500">{d.email}</p>
                    {(d.cargo || d.setor) && (
                      <p className="text-xs text-slate-400">{[d.cargo, d.setor].filter(Boolean).join(' · ')}</p>
                    )}
                    {d.telefone && <p className="text-xs text-slate-400">{d.telefone}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => editar(d)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Editar</button>
                    <button onClick={() => desativar(d.id)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

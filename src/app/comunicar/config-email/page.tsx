'use client'

import { useState, useEffect } from 'react'
import { PageHeader, Card, CardTitulo } from '@/components/ui'

export default function ConfigEmailPage() {
  const [form, setForm] = useState({
    host: '', porta: '587', seguro: false,
    usuario: '', senha: '',
    nomeRemetente: '', emailRemetente: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [configurado, setConfigurado] = useState(false)

  useEffect(() => {
    fetch('/api/comunicar/config-email').then((r) => r.json()).then((j) => {
      if (j.config) {
        setConfigurado(true)
        setForm((f) => ({ ...f, ...j.config, senha: '' }))
      }
    })
  }, [])

  async function salvar() {
    if (!form.host || !form.usuario || !form.nomeRemetente || !form.emailRemetente) {
      setMsg({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios.' }); return
    }
    setSalvando(true); setMsg(null)
    const res = await fetch('/api/comunicar/config-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSalvando(false)
    if (json.ok) { setMsg({ tipo: 'ok', texto: 'Configuração salva.' }); setConfigurado(true) }
    else setMsg({ tipo: 'erro', texto: json.error ?? 'Erro ao salvar.' })
  }

  async function testar() {
    setTestando(true); setMsg(null)
    const res = await fetch('/api/comunicar/config-email/testar', { method: 'POST' })
    const json = await res.json()
    setTestando(false)
    setMsg({ tipo: json.ok ? 'ok' : 'erro', texto: json.ok ? '✓ Conexão SMTP verificada com sucesso!' : `Falha: ${json.erro}` })
  }

  const campo = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

  const provedores = [
    { nome: 'Gmail', host: 'smtp.gmail.com', porta: '587', seguro: false },
    { nome: 'Outlook/Hotmail', host: 'smtp-mail.outlook.com', porta: '587', seguro: false },
    { nome: 'Brevo (Sendinblue)', host: 'smtp-relay.brevo.com', porta: '587', seguro: false },
    { nome: 'Servidor próprio (SSL)', host: '', porta: '465', seguro: true },
  ]

  return (
    <div>
      <PageHeader titulo="Configuração de Email" descricao="Servidor SMTP para envio automático de comunicações e notificações." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardTitulo>Servidor SMTP</CardTitulo>

            {/* Atalhos de provedor */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Presets rápidos:</p>
              <div className="flex flex-wrap gap-2">
                {provedores.map((p) => (
                  <button
                    key={p.nome}
                    onClick={() => setForm((f) => ({ ...f, host: p.host, porta: p.porta, seguro: p.seguro }))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Host SMTP *</label>
                  <input className={campo} value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Porta</label>
                  <input className={campo} value={form.porta} onChange={(e) => setForm((f) => ({ ...f, porta: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.seguro} onChange={(e) => setForm((f) => ({ ...f, seguro: e.target.checked }))} />
                Usar SSL/TLS (porta 465)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Usuário / Email *</label>
                  <input className={campo} value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} placeholder="seuemail@gmail.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Senha / App Password *</label>
                  <input type="password" className={campo} value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} placeholder={configurado ? '(inalterada)' : 'Senha de aplicativo'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nome do remetente *</label>
                  <input className={campo} value={form.nomeRemetente} onChange={(e) => setForm((f) => ({ ...f, nomeRemetente: e.target.value }))} placeholder="Gestão Municipal" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email remetente *</label>
                  <input type="email" className={campo} value={form.emailRemetente} onChange={(e) => setForm((f) => ({ ...f, emailRemetente: e.target.value }))} placeholder="gestao@municipio.mg.gov.br" />
                </div>
              </div>

              {msg && (
                <p className={`rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
              )}

              <div className="flex gap-2">
                <button onClick={salvar} disabled={salvando} className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                  {salvando ? 'Salvando…' : 'Salvar configuração'}
                </button>
                {configurado && (
                  <button onClick={testar} disabled={testando} className="rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
                    {testando ? 'Testando…' : '⚡ Testar conexão'}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitulo>Como configurar o Gmail</CardTitulo>
            <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4">
              <li>Acesse sua conta Google → Segurança</li>
              <li>Ative a verificação em duas etapas</li>
              <li>Vá em <strong>Senhas de app</strong> → crie uma para &quot;Outro (nome personalizado)&quot;</li>
              <li>Use a senha de 16 caracteres gerada no campo Senha acima</li>
              <li>Host: <code className="bg-slate-100 px-1 rounded">smtp.gmail.com</code>, Porta: 587</li>
            </ol>
          </Card>
          <Card>
            <CardTitulo>Sem SMTP disponível?</CardTitulo>
            <p className="text-xs text-slate-600">O sistema funciona normalmente sem SMTP. Os emails são <strong>registrados e armazenados</strong> no protocolo, com o conteúdo disponível para envio manual ou cópia.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

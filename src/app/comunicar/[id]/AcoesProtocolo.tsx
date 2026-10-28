'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardTitulo } from '@/components/ui'

interface Dest { id: string; nome: string; email: string }
interface DestAtual extends Dest { papel: string }

interface Props {
  protocoloId: string
  status: string
  prazoVencido: boolean
  emailsResponsaveis: string[]
  todosDestinatarios: Dest[]
  destinatariosAtuais: DestAtual[]
}

const MODELOS = {
  INICIAL: (titulo: string, prazo?: string) =>
    `<p>Prezado(a),</p><p>Comunicamos que foi identificada a seguinte ocorrência: <strong>${titulo}</strong>.</p><p>Solicitamos que as providências necessárias sejam adotadas${prazo ? ` até <strong>${prazo}</strong>` : ' com brevidade'}.</p><p>Em caso de dúvidas, entre em contato.</p><br><p>Atenciosamente,<br>Gestão Municipal</p>`,
  LEMBRETE: (titulo: string, prazo?: string) =>
    `<p>Prezado(a),</p><p>Lembramos que o prazo para resolução de <strong>${titulo}</strong> ${prazo ? `vence em <strong>${prazo}</strong>` : 'está próximo'}.</p><p>Aguardamos seu retorno.</p><br><p>Atenciosamente,<br>Gestão Municipal</p>`,
  ESCALONAMENTO: (titulo: string) =>
    `<p>Prezado(a),</p><p>O prazo para resolução de <strong>${titulo}</strong> foi <strong>ultrapassado</strong> sem manifestação.</p><p>Esta é uma notificação formal de escalonamento. Solicitamos resolução imediata sob pena de medidas administrativas.</p><br><p>Atenciosamente,<br>Gestão Municipal</p>`,
}

export function AcoesProtocolo({ protocoloId, status, prazoVencido, emailsResponsaveis, todosDestinatarios, destinatariosAtuais }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState<'acoes' | 'email' | 'prazo' | 'destinatarios' | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Email form
  const [emailForm, setEmailForm] = useState({
    tipo: 'INICIAL' as keyof typeof MODELOS,
    assunto: '',
    corpo: '',
    paraEmails: emailsResponsaveis,
    emailExtra: '',
  })

  // Prazo form
  const [novoPrazo, setNovoPrazo] = useState('')

  // Destinatários
  const [destSelecionados, setDestSelecionados] = useState<string[]>(destinatariosAtuais.map((d) => d.id))

  function abrirEmail(tipo: keyof typeof MODELOS, titulo: string, prazo?: string) {
    const assuntos = { INICIAL: `Comunicado: ${titulo}`, LEMBRETE: `Lembrete: ${titulo}`, ESCALONAMENTO: `URGENTE — Escalonamento: ${titulo}` }
    setEmailForm((f) => ({
      ...f,
      tipo,
      assunto: assuntos[tipo],
      corpo: MODELOS[tipo](titulo, prazo),
    }))
    setAba('email')
  }

  async function enviarEmail(titulo: string) {
    if (!emailForm.assunto || !emailForm.corpo) { setMsg({ tipo: 'erro', texto: 'Preencha assunto e corpo.' }); return }
    const para = [...emailForm.paraEmails]
    if (emailForm.emailExtra.trim()) para.push(...emailForm.emailExtra.split(',').map((e) => e.trim()).filter(Boolean))
    if (!para.length) { setMsg({ tipo: 'erro', texto: 'Adicione ao menos um destinatário.' }); return }

    setCarregando(true); setMsg(null)
    const res = await fetch(`/api/comunicar/protocolos/${protocoloId}/comunicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: emailForm.tipo, assunto: emailForm.assunto, corpo: emailForm.corpo, paraEmails: para }),
    })
    const json = await res.json()
    setCarregando(false)
    if (json.ok) {
      setMsg({ tipo: 'ok', texto: json.simulado ? '✓ Email registrado (SMTP não configurado — conteúdo disponível para envio manual).' : '✓ Email enviado com sucesso!' })
      setTimeout(() => { setAba(null); router.refresh() }, 2000)
    } else {
      setMsg({ tipo: 'erro', texto: json.erro ?? 'Erro ao enviar email.' })
    }
  }

  async function alterarStatus(novoStatus: string) {
    setCarregando(true); setMsg(null)
    await fetch(`/api/comunicar/protocolos/${protocoloId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    })
    setCarregando(false)
    router.refresh()
  }

  async function salvarPrazo() {
    if (!novoPrazo) { setMsg({ tipo: 'erro', texto: 'Selecione uma data.' }); return }
    setCarregando(true); setMsg(null)
    await fetch(`/api/comunicar/protocolos/${protocoloId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prazo: novoPrazo }),
    })
    setCarregando(false); setAba(null); router.refresh()
  }

  async function salvarDestinatarios() {
    setCarregando(true); setMsg(null)
    await fetch(`/api/comunicar/protocolos/${protocoloId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatarioIds: destSelecionados }),
    })
    setCarregando(false); setAba(null); router.refresh()
  }

  const isResolvido = ['RESOLVIDO', 'ARQUIVADO'].includes(status)

  const btn = 'rounded-lg border px-3 py-2 text-sm font-medium transition-colors'
  const btnPrimary = `${btn} border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100`
  const btnDanger = `${btn} border-red-300 bg-red-50 text-red-700 hover:bg-red-100`
  const btnGreen = `${btn} border-green-300 bg-green-50 text-green-700 hover:bg-green-100`
  const btnSlate = `${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`

  return (
    <Card>
      <CardTitulo>Ações</CardTitulo>

      {/* Botões principais */}
      {!isResolvido && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button className={btnPrimary} onClick={() => abrirEmail('INICIAL', 'Protocolo')}>
            📧 Enviar comunicação
          </button>
          {status === 'AGUARDANDO_RESPOSTA' && (
            <button className={btnPrimary} onClick={() => abrirEmail('LEMBRETE', 'Protocolo')}>
              🔔 Enviar lembrete
            </button>
          )}
          {prazoVencido && (
            <button className={btnDanger} onClick={() => abrirEmail('ESCALONAMENTO', 'Protocolo')}>
              ⬆️ Solicitar novamente
            </button>
          )}
          <button className={btnSlate} onClick={() => setAba(aba === 'prazo' ? null : 'prazo')}>
            📅 Definir prazo
          </button>
          <button className={btnSlate} onClick={() => setAba(aba === 'destinatarios' ? null : 'destinatarios')}>
            👥 Destinatários
          </button>
          <button className={btnGreen} onClick={() => alterarStatus('RESOLVIDO')}>
            ✅ Marcar resolvido
          </button>
          <button className={btnSlate} onClick={() => alterarStatus('ARQUIVADO')}>
            🗄️ Arquivar
          </button>
        </div>
      )}

      {isResolvido && (
        <div className="flex gap-2 mb-4">
          <button className={btnSlate} onClick={() => alterarStatus('ABERTO')}>↩ Reabrir protocolo</button>
        </div>
      )}

      {/* Painel de email */}
      {aba === 'email' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Compor e-mail</p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Modelo</label>
            <select
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={emailForm.tipo}
              onChange={(e) => {
                const t = e.target.value as keyof typeof MODELOS
                setEmailForm((f) => ({ ...f, tipo: t, corpo: MODELOS[t](emailForm.assunto, '') }))
              }}
            >
              <option value="INICIAL">Comunicação inicial</option>
              <option value="LEMBRETE">Lembrete de prazo</option>
              <option value="ESCALONAMENTO">Escalonamento (prazo vencido)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Assunto</label>
            <input className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={emailForm.assunto} onChange={(e) => setEmailForm((f) => ({ ...f, assunto: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Destinatários vinculados</label>
            <div className="space-y-1">
              {emailsResponsaveis.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum responsável vinculado.</p>
              ) : emailsResponsaveis.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={emailForm.paraEmails.includes(e)}
                    onChange={() => setEmailForm((f) => ({
                      ...f,
                      paraEmails: f.paraEmails.includes(e) ? f.paraEmails.filter((x) => x !== e) : [...f.paraEmails, e],
                    }))}
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Emails adicionais (separados por vírgula)</label>
            <input className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="email@exemplo.com, outro@ex.com" value={emailForm.emailExtra} onChange={(e) => setEmailForm((f) => ({ ...f, emailExtra: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Corpo (HTML)</label>
            <textarea className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono h-32 resize-none" value={emailForm.corpo} onChange={(e) => setEmailForm((f) => ({ ...f, corpo: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => enviarEmail(emailForm.assunto)}
              disabled={carregando}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {carregando ? 'Enviando…' : '📧 Enviar'}
            </button>
            <button onClick={() => setAba(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Painel de prazo */}
      {aba === 'prazo' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Definir prazo</p>
          <input
            type="date"
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={novoPrazo}
            onChange={(e) => setNovoPrazo(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <div className="flex gap-2">
            <button onClick={salvarPrazo} disabled={carregando} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {carregando ? 'Salvando…' : 'Salvar prazo'}
            </button>
            <button onClick={() => setAba(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
          </div>
        </div>
      )}

      {/* Painel de destinatários */}
      {aba === 'destinatarios' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Selecionar responsáveis</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {todosDestinatarios.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={destSelecionados.includes(d.id)}
                  onChange={() => setDestSelecionados((s) => s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id])}
                />
                <span className="font-medium text-slate-700">{d.nome}</span>
                <span className="text-slate-400">{d.email}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={salvarDestinatarios} disabled={carregando} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              {carregando ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={() => setAba(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.texto}
        </p>
      )}
    </Card>
  )
}

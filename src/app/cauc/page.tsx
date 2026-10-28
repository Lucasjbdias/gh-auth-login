'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader, Card, CardTitulo, EmptyState } from '@/components/ui'
import { BotaoExportar } from '@/components/BotaoExportar'
import { BotaoComunicar } from '@/components/BotaoComunicar'

interface CaucCheck {
  id: string
  municipio: string
  nomeEnte: string | null
  cnpj: string | null
  status: string
  situacao: number | null
  erro: string | null
  verificadoEm: string
}

const LABEL: Record<string, string> = {
  REGULAR: 'Regular',
  IRREGULAR: 'IRREGULAR',
  NAO_ENCONTRADO: 'Não encontrado',
  ERRO: 'Erro',
}

const COR: Record<string, string> = {
  REGULAR: 'bg-green-100 text-green-800 border border-green-200',
  IRREGULAR: 'bg-red-100 text-red-800 border border-red-200',
  NAO_ENCONTRADO: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  ERRO: 'bg-slate-100 text-slate-600 border border-slate-200',
}

const DOT: Record<string, string> = {
  REGULAR: 'bg-green-500',
  IRREGULAR: 'bg-red-500 animate-pulse',
  NAO_ENCONTRADO: 'bg-yellow-400',
  ERRO: 'bg-slate-400',
}

function dataHora(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function urlExtrato(cnpj?: string | null): string {
  const base = 'https://cauc.tesouro.gov.br/ng/#/extrato/ente/filtro'
  return cnpj ? `${base}?cnpj=${encodeURIComponent(cnpj)}` : base
}

function CopiarBtn({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(texto)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }}
      className="ml-1 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      title="Copiar"
    >
      {copiado ? '✓' : '⎘'}
    </button>
  )
}

function ExtratoIrregular({ check }: { check: CaucCheck }) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50">
      {/* Cabeçalho do card irregular */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-2xl">🚨</span>
          <div>
            <p className="font-bold text-red-900">
              {check.municipio} — IRREGULAR no CAUC
            </p>
            {check.nomeEnte && (
              <p className="text-sm text-red-700">{check.nomeEnte}</p>
            )}
            {check.cnpj && (
              <p className="mt-1 font-mono text-sm text-red-700">
                CNPJ: <span className="select-all font-semibold">{check.cnpj}</span>
                <CopiarBtn texto={check.cnpj} />
              </p>
            )}
            <p className="mt-1 text-xs text-red-600">
              Transferências constitucionais podem estar bloqueadas.
              Verificado em {dataHora(check.verificadoEm)}.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <a
            href={urlExtrato(check.cnpj)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Abrir no CAUC ↗
          </a>
          <a
            href={`/comunicar/novo?origemTipo=CAUC&origemId=${check.id}&municipio=${encodeURIComponent(check.municipio)}&titulo=${encodeURIComponent(`Irregularidade CAUC — ${check.municipio}`)}&descricao=${encodeURIComponent(`Município ${check.municipio} está IRREGULAR no CAUC (CNPJ ${check.cnpj ?? '—'}). Verificado em ${check.verificadoEm}. Transferências constitucionais podem estar bloqueadas.`)}&prioridade=ALTA`}
            className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
          >
            📨 Gerar protocolo
          </a>
          <button
            onClick={() => setAberto(!aberto)}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            {aberto ? '▲ Ocultar extrato' : '▼ Ver extrato incorporado'}
          </button>
        </div>
      </div>

      {/* Instruções + iframe do extrato CAUC */}
      {aberto && (
        <div className="border-t border-red-200 px-4 pb-4 pt-3">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Como consultar o extrato completo com subitens:</strong>
            <ol className="mt-1 list-decimal pl-4 space-y-0.5">
              <li>No campo de busca abaixo, digite o CNPJ: <strong className="select-all font-mono">{check.cnpj}</strong></li>
              <li>Clique em <strong>Consultar</strong></li>
              <li>Resolva o captcha quando solicitado</li>
              <li>Veja quais subitens estão com ✗ (irregular)</li>
            </ol>
          </div>
          <iframe
            src="https://cauc.tesouro.gov.br/ng/#/extrato/ente/filtro"
            className="h-[600px] w-full rounded-lg border border-red-200"
            title={`Extrato CAUC — ${check.municipio}`}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

export default function PaginaCauc() {
  const [checks, setChecks] = useState<CaucCheck[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const carregarStatus = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/integracoes/cauc?action=todos')
      const json = await res.json()
      if (json.ok) setChecks(json.checks ?? [])
    } catch {
      // sem dados ainda
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarStatus()
  }, [carregarStatus])

  async function sincronizar() {
    setSincronizando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/integracoes/cauc', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setResultado(
          `Sync concluído: ${json.total} município(s) verificado(s). ${json.irregulares} irregular(es).`,
        )
        await carregarStatus()
      } else {
        setResultado(`Erro: ${json.error}`)
      }
    } catch (err: unknown) {
      setResultado(`Erro de rede: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSincronizando(false)
    }
  }

  const irregulares = checks.filter((c) => c.status === 'IRREGULAR')
  const regulares = checks.filter((c) => c.status === 'REGULAR')

  return (
    <div>
      <PageHeader
        titulo="CAUC — Monitoramento"
        descricao="Sistema de Informações sobre Requisitos Fiscais (STN) — atualização diária automática"
        acao={
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {sincronizando ? 'Verificando...' : '↻ Verificar agora'}
          </button>
        }
      />

      {resultado && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${resultado.startsWith('Erro') ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}
        >
          {resultado}
        </div>
      )}

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{regulares.length}</p>
          <p className="text-sm text-green-600">Regular</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{irregulares.length}</p>
          <p className="text-sm text-red-600">Irregular</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-3xl font-bold text-slate-700">{checks.length}</p>
          <p className="text-sm text-slate-600">Total monitorado</p>
        </div>
      </div>

      {/* Extrato incorporado por município irregular */}
      {!carregando && irregulares.length > 0 && (
        <div className="mb-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
            Municípios com situação irregular
          </h2>
          {irregulares.map((c) => (
            <ExtratoIrregular key={c.id} check={c} />
          ))}
        </div>
      )}

      {/* Tabela de status todos os municípios */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitulo>Status por Município</CardTitulo>
          {checks.length > 0 && (
            <BotaoExportar idTabela="tabela-cauc" titulo="CAUC — Status Municípios" />
          )}
        </div>
        {carregando ? (
          <p className="py-8 text-center text-sm text-slate-500">Carregando...</p>
        ) : checks.length === 0 ? (
          <EmptyState mensagem="Nenhuma verificação realizada ainda. Clique em «Verificar agora» para iniciar." />
        ) : (
          <div id="tabela-cauc" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Município</th>
                  <th className="px-3 py-2">Nome no CAUC</th>
                  <th className="px-3 py-2">CNPJ</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Última verificação</th>
                  <th className="px-3 py-2">Extrato</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{c.municipio}</td>
                    <td className="px-3 py-2 text-slate-600">{c.nomeEnte ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {c.cnpj ?? '—'}
                      {c.cnpj && <CopiarBtn texto={c.cnpj} />}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${COR[c.status] ?? COR.ERRO}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[c.status] ?? DOT.ERRO}`} />
                        {LABEL[c.status] ?? c.status}
                      </span>
                      {c.erro && <p className="mt-0.5 text-xs text-red-600">{c.erro}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{dataHora(c.verificadoEm)}</td>
                    <td className="px-3 py-2">
                      <a
                        href={urlExtrato(c.cnpj)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs font-medium hover:underline ${c.status === 'IRREGULAR' ? 'text-red-600' : 'text-brand-600'}`}
                      >
                        Ver extrato ↗
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <BotaoComunicar
                        origemTipo="CAUC"
                        origemId={c.id}
                        municipio={c.municipio}
                        titulo={`CAUC ${c.municipio} — ${LABEL[c.status] ?? c.status}`}
                        descricao={`Município ${c.municipio} | Status CAUC: ${LABEL[c.status] ?? c.status} | CNPJ: ${c.cnpj ?? '—'} | Verificado: ${dataHora(c.verificadoEm)}`}
                        prioridade={c.status === 'IRREGULAR' ? 'ALTA' : 'NORMAL'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        Fonte: CAUC / Tesouro Nacional · Monitoramento automático diário às 07h
      </p>
    </div>
  )
}

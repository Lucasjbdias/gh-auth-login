// Teto de Gastos – Painel do Teto dos Gastos do Governo Federal (STN)
// Retorna dados em formato CSV; esta biblioteca converte para objetos JS
// Base URL: https://apidatalake.tesouro.gov.br/ords/cdwhprd/teto_gastos/cesef/
// Endpoint: /baseclassificada  Params: Mes_Inicial, Mes_Final, Ano
const BASE = 'https://apidatalake.tesouro.gov.br/ords/cdwhprd/teto_gastos/cesef'

export interface RegistroTeto {
  ano: number
  mes: number
  orgao: string
  acao: string
  funcao: string
  subfuncao: string
  programa: string
  naturezaDespesa: string
  valorTeto: number
  valorExecutado: number
  percentualExecutado: number | null
}

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function toNumber(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(',', '.')) || 0
}

export async function buscarTetoGastos(
  ano: number,
  mesInicial = 1,
  mesFinal = 12,
): Promise<RegistroTeto[]> {
  const url = new URL(`${BASE}/baseclassificada`)
  url.searchParams.set('Ano', String(ano))
  url.searchParams.set('Mes_Inicial', String(mesInicial))
  url.searchParams.set('Mes_Final', String(mesFinal))

  const res = await fetch(url.toString(), {
    headers: { Accept: 'text/csv,application/json,*/*' },
    next: { revalidate: 3600 },
  })
  if (res.status === 404) {
    // Endpoint beta da STN — indisponível temporariamente
    throw new Error('TETO_GASTOS: endpoint /baseclassificada indisponível (beta STN). Tente novamente mais tarde.')
  }
  if (!res.ok) throw new Error(`TETO_GASTOS /baseclassificada: HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()

  // API may return JSON or CSV depending on content negotiation
  if (contentType.includes('application/json')) {
    const json = JSON.parse(text)
    return (json.items ?? json) as RegistroTeto[]
  }

  const rows = parseCSV(text)
  return rows.map(r => ({
    ano: toNumber(r['ano'] ?? r['Ano'] ?? r['ANO'] ?? ''),
    mes: toNumber(r['mes'] ?? r['Mes'] ?? r['MES'] ?? ''),
    orgao: r['orgao'] ?? r['Orgao'] ?? r['ORGAO'] ?? '',
    acao: r['acao'] ?? r['Acao'] ?? '',
    funcao: r['funcao'] ?? r['Funcao'] ?? '',
    subfuncao: r['subfuncao'] ?? r['Subfuncao'] ?? '',
    programa: r['programa'] ?? r['Programa'] ?? '',
    naturezaDespesa: r['natureza_despesa'] ?? r['NaturezaDespesa'] ?? '',
    valorTeto: toNumber(r['valor_teto'] ?? r['ValorTeto'] ?? ''),
    valorExecutado: toNumber(r['valor_executado'] ?? r['ValorExecutado'] ?? ''),
    percentualExecutado: null,
  })).map(r => ({
    ...r,
    percentualExecutado: r.valorTeto > 0 ? (r.valorExecutado / r.valorTeto) * 100 : null,
  }))
}

const BASE = 'https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt'

export interface RegistroRREO {
  exercicio: number
  demonstrativo: string
  periodo: number
  periodicidade: string
  instituicao: string
  cod_ibge: number
  uf: string
  populacao: number
  anexo: string
  esfera: string
  rotulo: string
  coluna: string
  cod_conta: string
  conta: string
  valor: number
}

export interface RegistroRGF {
  exercicio: number
  demonstrativo: string
  periodo: number
  periodicidade: string
  instituicao: string
  cod_ibge: number
  uf: string
  populacao: number
  anexo: string
  esfera: string
  poder: string
  cargo: string
  rotulo: string
  coluna: string
  cod_conta: string
  conta: string
  valor: number
}

export interface RegistroMSC {
  exercicio: number
  mes: number
  instituicao: string
  cod_ibge: number
  uf: string
  populacao: number
  tipo_demonstrativo: string
  esfera: string
  poder: string
  cod_conta_contabil: string
  conta_contabil: string
  tipo_conta: string
  coluna: string
  saldo_atual: number
  saldo_anterior: number
}

export interface EntregaItem {
  exercicio: number
  cod_ibge: number
  populacao: number
  instituicao: string
  entregavel: string
  periodo: number
  periodicidade: string
  status_relatorio: string | null
  data_status: string | null
  forma_envio: string | null
  tipo_relatorio: string | null
}

export interface Ente {
  id_ente: number
  co_ibge: number
  no_ente: string
  sg_uf: string
  co_tipo_esfera: string
  no_tipo_esfera: string
  esfera: string
  exercicio: number
  populacao: number
}

async function fetchSiconfi<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<{ items: T[]; count: number }> {
  const url = new URL(`${BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`SICONFI /${endpoint}: HTTP ${res.status}`)
  const json = await res.json()
  return { items: json.items ?? [], count: json.count ?? 0 }
}

// Municipalities with population < 50k submit simplified reports
export function tipoRREO(populacao: number): 'RREO Simplificado' | 'RREO' {
  return populacao < 50000 ? 'RREO Simplificado' : 'RREO'
}

export function tipoRGF(populacao: number): 'RGF Simplificado' | 'RGF' {
  return populacao < 50000 ? 'RGF Simplificado' : 'RGF'
}

// Simplified municipalities submit RGF semestrally (2 periods/year)
// Regular municipalities submit quadrimestrally (3 periods/year)
function periodicidadeRGF(populacao: number): 'S' | 'Q' {
  return populacao < 50000 ? 'S' : 'Q'
}

export async function buscarRREO(
  ibge: number,
  exercicio: number,
  periodo: number,
  populacao: number,
): Promise<RegistroRREO[]> {
  const { items } = await fetchSiconfi<RegistroRREO>('rreo', {
    an_exercicio: exercicio,
    nr_periodo: periodo,
    co_tipo_demonstrativo: tipoRREO(populacao),
    id_ente: ibge,
  })
  return items
}

export async function buscarRGF(
  ibge: number,
  exercicio: number,
  periodo: number,
  populacao: number,
  poder: 'E' | 'L' | 'J' = 'E',
): Promise<RegistroRGF[]> {
  const { items } = await fetchSiconfi<RegistroRGF>('rgf', {
    an_exercicio: exercicio,
    nr_periodo: periodo,
    co_tipo_demonstrativo: tipoRGF(populacao),
    id_ente: ibge,
    in_periodicidade: periodicidadeRGF(populacao),
    co_poder: poder,
  })
  return items
}

export async function buscarMSC(
  ibge: number,
  exercicio: number,
  mes: number,
): Promise<RegistroMSC[]> {
  const { items } = await fetchSiconfi<RegistroMSC>('msc', {
    an_exercicio: exercicio,
    nr_mes: mes,
    id_ente: ibge,
    co_tipo_demonstrativo: 'MSC',
  })
  return items
}

export async function buscarExtratoEntregas(
  ibge: number,
  exercicio: number,
): Promise<EntregaItem[]> {
  const { items } = await fetchSiconfi<EntregaItem>('extrato_entregas', {
    an_referencia: exercicio,
    id_ente: ibge,
  })
  return items
}

export async function buscarEnte(ibge: number): Promise<Ente | null> {
  // Oracle ORDS filter — the entes endpoint doesn't support co_ibge as a plain param
  const { items } = await fetchSiconfi<Ente>('entes', {
    q: JSON.stringify({ cod_ibge: { $eq: ibge } }),
  })
  return items[0] ?? null
}

// Extract valor for a specific conta/coluna from RREO records
export function extrairValor(
  registros: RegistroRREO[],
  contaSubstring: string,
  coluna: string,
  anexo?: string,
): number {
  return registros
    .filter(
      r =>
        r.conta.toUpperCase().includes(contaSubstring.toUpperCase()) &&
        r.coluna === coluna &&
        (!anexo || r.anexo === anexo),
    )
    .reduce((sum, r) => sum + (r.valor ?? 0), 0)
}

// Compute constitutional indices from RREO data (simplified version)
export function calcularIndicesRREO(registros: RegistroRREO[]): {
  receitaLiquidaRealizadaAcumulada: number
  despesaSaude: number
  despesaEducacao: number
  percentualSaude: number | null
  percentualEducacao: number | null
} {
  const colRealizadaAcum = 'RECEITAS REALIZADAS'
  const colDespSaude = 'DESPESAS LIQUIDADAS'

  const receitaLiquidaRealizadaAcumulada = extrairValor(
    registros,
    'RECEITA LÍQUIDA REALIZADA',
    colRealizadaAcum,
  )

  const despesaSaude = extrairValor(
    registros,
    'SAÚDE',
    colDespSaude,
    'RREO-Anexo 08',
  )

  const despesaEducacao = extrairValor(
    registros,
    'EDUCAÇÃO',
    colDespSaude,
    'RREO-Anexo 08',
  )

  return {
    receitaLiquidaRealizadaAcumulada,
    despesaSaude,
    despesaEducacao,
    percentualSaude:
      receitaLiquidaRealizadaAcumulada > 0
        ? (despesaSaude / receitaLiquidaRealizadaAcumulada) * 100
        : null,
    percentualEducacao:
      receitaLiquidaRealizadaAcumulada > 0
        ? (despesaEducacao / receitaLiquidaRealizadaAcumulada) * 100
        : null,
  }
}

// SADIPEM – Pedidos de Verificação de Limites (PVL) para operações de crédito municipal
// Base URL: https://apidatalake.tesouro.gov.br/ords/cdwhprd/sadipem/tt/
const BASE = 'https://apidatalake.tesouro.gov.br/ords/cdwhprd/sadipem/tt'

export interface PVL {
  id_pleito: number
  tipo_interessado: string
  interessado: string
  cod_ibge: number
  uf: string
  num_pvl: string | null
  status: string
  num_processo: string
  data_protocolo: string | null
  tipo_operacao: string
  finalidade: string
  tipo_credor: string
  credor: string
  moeda: string
  valor: number
  pvl_assoc_divida: number
  pvl_contradado_credor: number
  data_status: string
}

export interface CronogramaPagamento {
  id_pleito: number
  data_inicio: string
  data_vencimento: string
  numero_parcela: number
  valor_parcela: number
  tipo_encargo: string
  taxa_encargo: number
}

export interface CronogramaLiberacao {
  id_pleito: number
  data_liberacao: string
  valor_liberacao: number
}

async function fetchSadipem<T>(
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
  if (!res.ok) throw new Error(`SADIPEM /${endpoint}: HTTP ${res.status}`)
  const json = await res.json()
  return { items: json.items ?? [], count: json.count ?? 0 }
}

// List PVL requests for a municipality filtered by IBGE code
export async function buscarPVL(
  ibge: number,
  uf?: string,
): Promise<PVL[]> {
  const params: Record<string, string | number> = {
    tipo_interessado: 'Município',
    id_ente: ibge,
  }
  if (uf) params.uf = uf
  const { items } = await fetchSadipem<PVL>('pvl', params)
  return items
}

export async function buscarCronogramaPagamentos(
  idPleito: number,
): Promise<CronogramaPagamento[]> {
  const { items } = await fetchSadipem<CronogramaPagamento>(
    'opc-cronograma-pagamentos',
    { id_pleito: idPleito },
  )
  return items
}

export async function buscarCronogramaLiberacoes(
  idPleito: number,
): Promise<CronogramaLiberacao[]> {
  const { items } = await fetchSadipem<CronogramaLiberacao>(
    'opc-cronograma-liberacoes',
    { id_pleito: idPleito },
  )
  return items
}

// Group PVL list by status for dashboard summary
export function resumoPVL(pvls: PVL[]): Record<string, number> {
  const contagem: Record<string, number> = {}
  for (const p of pvls) {
    contagem[p.status] = (contagem[p.status] ?? 0) + 1
  }
  return contagem
}

// Total contracted value for active/approved PVLs
export function valorContratado(pvls: PVL[]): number {
  return pvls
    .filter(p => p.status === 'Deferido' || p.status === 'Deferido (PVL-IF)')
    .reduce((sum, p) => sum + (p.valor ?? 0), 0)
}

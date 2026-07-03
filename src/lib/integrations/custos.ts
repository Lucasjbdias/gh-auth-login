// Custos – Portal de Custos do Governo Federal (STN)
// Dados de custo federal por função/organização – referência para análise comparativa
// Base URL: https://apidatalake.tesouro.gov.br/ords/cdwhprd/custos/tt/
// Parâmetros: ano, mes, natureza_juridica, organizacao_n1, organizacao_n2, organizacao_n3
const BASE = 'https://apidatalake.tesouro.gov.br/ords/cdwhprd/custos/tt'

export type EndpointCustos =
  | 'depreciacao'
  | 'pensionistas'
  | 'pessoal_ativo'
  | 'pessoal_inativo'
  | 'transferencias'
  | 'demais'

export interface RegistroCusto {
  co_natureza_juridica: number
  ds_natureza_juridica: string
  co_organizacao_n0: string
  ds_organizacao_n0: string
  co_organizacao_n1: string
  ds_organizacao_n1: string
  co_organizacao_n2: string
  ds_organizacao_n2: string
  co_organizacao_n3: string
  ds_organizacao_n3: string
  co_organizacao_n4: string
  ds_organizacao_n4: string
  co_organizacao_n5: string
  ds_organizacao_n5: string
  co_organizacao_n6: string
  ds_organizacao_n6: string
  an_lanc: number
  me_lanc: number
  in_area_atuacao: number
  ds_area_atuacao: string
  in_escolaridade: string
  ds_escolaridade: string
  in_faixa_etaria: string
  ds_faixa_etaria: string
  in_sexo: string
  in_forca_trabalho: number
  va_custo_de_pessoal: number
}

export interface FiltroCustos {
  ano: number
  mes?: number
  naturezaJuridica?: string
  organizacaoN1?: string
  organizacaoN2?: string
  organizacaoN3?: string
}

async function fetchCustos<T>(
  endpoint: EndpointCustos,
  filtro: FiltroCustos,
): Promise<{ items: T[]; count: number }> {
  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set('ano', String(filtro.ano))
  if (filtro.mes) url.searchParams.set('mes', String(filtro.mes))
  if (filtro.naturezaJuridica) url.searchParams.set('natureza_juridica', filtro.naturezaJuridica)
  if (filtro.organizacaoN1) url.searchParams.set('organizacao_n1', filtro.organizacaoN1)
  if (filtro.organizacaoN2) url.searchParams.set('organizacao_n2', filtro.organizacaoN2)
  if (filtro.organizacaoN3) url.searchParams.set('organizacao_n3', filtro.organizacaoN3)
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`CUSTOS /${endpoint}: HTTP ${res.status}`)
  const json = await res.json()
  return { items: json.items ?? [], count: json.count ?? 0 }
}

export async function buscarCustosPessoalAtivo(filtro: FiltroCustos): Promise<RegistroCusto[]> {
  const { items } = await fetchCustos<RegistroCusto>('pessoal_ativo', filtro)
  return items
}

export async function buscarCustosTransferencias(filtro: FiltroCustos): Promise<RegistroCusto[]> {
  const { items } = await fetchCustos<RegistroCusto>('transferencias', filtro)
  return items
}

export async function buscarCustosDemais(filtro: FiltroCustos): Promise<RegistroCusto[]> {
  const { items } = await fetchCustos<RegistroCusto>('demais', filtro)
  return items
}

export async function buscarCustosEndpoint(
  endpoint: EndpointCustos,
  filtro: FiltroCustos,
): Promise<RegistroCusto[]> {
  const { items } = await fetchCustos<RegistroCusto>(endpoint, filtro)
  return items
}

// CAUC – Sistema de Informações sobre Requisitos Fiscais (STN)
// API: https://cauc.tesouro.gov.br/ng/
// Endpoints descobertos por engenharia reversa do Angular app (chunk-EHVLPRIH.js)
// obter-situacao: não exige captcha; retorna {dados:[1]}=Regular ou {dados:[0]}=Irregular
const BASE = 'https://cauc.tesouro.gov.br/ng'

// idExtrato por tipo de estabelecimento
export const ID_EXTRATO = {
  ENTE_FEDERATIVO: 1,
  ORGAO: 2,
  ENTIDADE: 3,
  CONSORCIO: 4,
  EPSFL: 5,
} as const

export type StatusCAUC = 'REGULAR' | 'IRREGULAR' | 'NAO_ENCONTRADO' | 'ERRO'

export interface EnteCauc {
  id: number
  nome: string
  cnpj: string
  sigla?: string
}

export interface StatusCheckResult {
  enteCaucId: number
  nomeEnte: string
  cnpj: string
  situacao: number // 1=Regular, 0=Irregular
  status: StatusCAUC
  verificadoEm: string
}

export interface CaucMonitoramento {
  municipio: string
  tenantId?: string
  ibge?: number
  enteCauc: EnteCauc | null
  status: StatusCAUC
  situacao: number | null
  verificadoEm: string
  erro?: string
}

// Formato da API CAUC: "XX.XXX.XXX/XXXX-XX - NomeMunicipio/UF"
const extrairNomeMunicipio = (nomeCauc: string): string => {
  const partes = nomeCauc.split(' - ')
  if (partes.length < 2) return nomeCauc
  const nomeSigla = partes.slice(1).join(' - ')
  const lastSlash = nomeSigla.lastIndexOf('/')
  return lastSlash >= 0 ? nomeSigla.substring(0, lastSlash).trim() : nomeSigla.trim()
}

const extrairCnpj = (nomeCauc: string): string => {
  const m = nomeCauc.match(/^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
  return m ? m[1] : ''
}

// Busca o ente CAUC pelo nome do município
export async function buscarEnteCauc(nomeMunicipio: string): Promise<EnteCauc | null> {
  const url = new URL(`${BASE}/ente/obter-por-texto`)
  url.searchParams.set('texto', nomeMunicipio)

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CAUC /ente/obter-por-texto: HTTP ${res.status}`)

  const json = await res.json()
  const dados: Array<{ id: number; nome: string; sigla: string }> = json.dados ?? []
  if (!dados.length) return null

  const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const nomeNorm = normalizar(nomeMunicipio)

  const mgEntries = dados.filter((d) => d.sigla === 'MG')

  // 1. Match exato: nome extraído do campo (sem CNPJ e UF) === busca
  const matchExato = mgEntries.find((d) => normalizar(extrairNomeMunicipio(d.nome)) === nomeNorm)

  // 2. Fallback: match parcial, preferindo nome mais curto (evita "Alto Jequitibá" vs "Jequitibá")
  const matchParcial = mgEntries
    .filter((d) => normalizar(extrairNomeMunicipio(d.nome)).includes(nomeNorm))
    .sort((a, b) => a.nome.length - b.nome.length)[0]

  const match = matchExato ?? matchParcial ?? dados[0]

  return {
    id: match.id,
    nome: extrairNomeMunicipio(match.nome),
    cnpj: extrairCnpj(match.nome),
    sigla: match.sigla,
  }
}

// Consulta o status de conformidade de um ente (sem captcha)
export async function consultarSituacaoCauc(
  idEnte: number,
  idExtrato = ID_EXTRATO.ENTE_FEDERATIVO,
): Promise<number | null> {
  const url = new URL(`${BASE}/extrato-cauc/obter-situacao`)
  url.searchParams.set('idExtrato', String(idExtrato))
  url.searchParams.set('idEnte', String(idEnte))

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CAUC /extrato-cauc/obter-situacao: HTTP ${res.status}`)

  const json = await res.json()
  if (!json.sucesso) return null
  return json.dados?.[0] ?? null
}

// Monitoramento completo para um município (busca + status)
export async function monitorarCauc(
  nomeMunicipio: string,
  tenantId?: string,
  ibge?: number,
): Promise<CaucMonitoramento> {
  const verificadoEm = new Date().toISOString()

  try {
    const ente = await buscarEnteCauc(nomeMunicipio)
    if (!ente) {
      return {
        municipio: nomeMunicipio,
        tenantId,
        ibge,
        enteCauc: null,
        status: 'NAO_ENCONTRADO',
        situacao: null,
        verificadoEm,
        erro: `Município "${nomeMunicipio}" não encontrado no CAUC`,
      }
    }

    const situacao = await consultarSituacaoCauc(ente.id)

    return {
      municipio: nomeMunicipio,
      tenantId,
      ibge,
      enteCauc: ente,
      status: situacao === 1 ? 'REGULAR' : situacao === 0 ? 'IRREGULAR' : 'ERRO',
      situacao,
      verificadoEm,
    }
  } catch (err) {
    return {
      municipio: nomeMunicipio,
      tenantId,
      ibge,
      enteCauc: null,
      status: 'ERRO',
      situacao: null,
      verificadoEm,
      erro: err instanceof Error ? err.message : String(err),
    }
  }
}

// Converte resultado para texto de status legível
export function labelStatus(status: StatusCAUC): string {
  switch (status) {
    case 'REGULAR':
      return 'Regular'
    case 'IRREGULAR':
      return 'Irregular — transferências bloqueadas'
    case 'NAO_ENCONTRADO':
      return 'Não encontrado no CAUC'
    case 'ERRO':
      return 'Erro na consulta'
  }
}

// URL para abrir o extrato completo no CAUC (abre o SPA com o município pré-selecionado)
export function urlExtratoCauc(cnpj?: string): string {
  const base = 'https://cauc.tesouro.gov.br/ng/#/extrato/ente/filtro'
  return cnpj ? `${base}?cnpj=${encodeURIComponent(cnpj)}` : base
}

import { NextRequest, NextResponse } from 'next/server'
import { buscarCustosEndpoint, type EndpointCustos } from '@/lib/integrations/custos'
import { getUsuarioLogado } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/integracoes/custos?endpoint=pessoal_ativo&ano=2023&mes=6
// GET /api/integracoes/custos?endpoint=transferencias&ano=2023
// Endpoints disponíveis: depreciacao | pensionistas | pessoal_ativo | pessoal_inativo | transferencias | demais
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const endpoint = (sp.get('endpoint') ?? 'pessoal_ativo') as EndpointCustos

  const ENDPOINTS_VALIDOS: EndpointCustos[] = [
    'depreciacao',
    'pensionistas',
    'pessoal_ativo',
    'pessoal_inativo',
    'transferencias',
    'demais',
  ]
  if (!ENDPOINTS_VALIDOS.includes(endpoint)) {
    return NextResponse.json(
      { error: `endpoint inválido. Use: ${ENDPOINTS_VALIDOS.join(', ')}` },
      { status: 400 },
    )
  }

  const anoParam = sp.get('ano')
  if (!anoParam) {
    return NextResponse.json({ error: 'ano obrigatório' }, { status: 400 })
  }

  const filtro = {
    ano: parseInt(anoParam),
    mes: sp.get('mes') ? parseInt(sp.get('mes')!) : undefined,
    naturezaJuridica: sp.get('natureza_juridica') ?? undefined,
    organizacaoN1: sp.get('organizacao_n1') ?? undefined,
    organizacaoN2: sp.get('organizacao_n2') ?? undefined,
    organizacaoN3: sp.get('organizacao_n3') ?? undefined,
  }

  try {
    const items = await buscarCustosEndpoint(endpoint, filtro)
    return NextResponse.json({ ok: true, count: items.length, endpoint, filtro, items })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

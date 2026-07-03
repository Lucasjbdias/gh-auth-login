import { NextRequest, NextResponse } from 'next/server'
import { buscarTetoGastos } from '@/lib/integrations/teto-gastos'
import { getUsuarioLogado } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/integracoes/teto-gastos?ano=2024&mes_inicial=1&mes_final=12
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const anoParam = sp.get('ano')
  if (!anoParam) {
    return NextResponse.json({ error: 'ano obrigatório' }, { status: 400 })
  }

  const ano = parseInt(anoParam)
  const mesInicial = parseInt(sp.get('mes_inicial') ?? '1')
  const mesFinal = parseInt(sp.get('mes_final') ?? '12')

  try {
    const items = await buscarTetoGastos(ano, mesInicial, mesFinal)
    return NextResponse.json({ ok: true, count: items.length, ano, mesInicial, mesFinal, items })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

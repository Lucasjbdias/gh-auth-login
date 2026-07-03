import { NextRequest, NextResponse } from 'next/server'
import {
  buscarRREO,
  buscarRGF,
  buscarMSC,
  buscarExtratoEntregas,
  buscarEnte,
} from '@/lib/integrations/siconfi'
import { getUsuarioLogado } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/integracoes/siconfi?action=rreo&ibge=3141108&exercicio=2023&periodo=6&populacao=37200
// GET /api/integracoes/siconfi?action=rgf&ibge=3141108&exercicio=2023&periodo=2&populacao=37200
// GET /api/integracoes/siconfi?action=msc&ibge=3141108&exercicio=2023&mes=6
// GET /api/integracoes/siconfi?action=extrato&ibge=3141108&exercicio=2023
// GET /api/integracoes/siconfi?action=ente&ibge=3141108
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const action = sp.get('action') ?? 'extrato'

  // Resolve IBGE: from param or from tenant
  const ibgeParam = sp.get('ibge')
  const ibge = ibgeParam
    ? parseInt(ibgeParam)
    : usuario.tenant?.codigoIBGE
      ? parseInt(usuario.tenant.codigoIBGE)
      : null

  if (!ibge) {
    return NextResponse.json(
      { error: 'ibge obrigatório (parâmetro ou tenant sem codigoIBGE)' },
      { status: 400 },
    )
  }

  const exercicio = parseInt(sp.get('exercicio') ?? String(new Date().getFullYear() - 1))
  const periodo = parseInt(sp.get('periodo') ?? '6')
  const mes = parseInt(sp.get('mes') ?? '6')
  const populacao = parseInt(sp.get('populacao') ?? String(usuario.tenant?.populacao ?? 50000))

  try {
    switch (action) {
      case 'rreo': {
        const items = await buscarRREO(ibge, exercicio, periodo, populacao)
        return NextResponse.json({ ok: true, count: items.length, ibge, exercicio, periodo, items })
      }
      case 'rgf': {
        const poder = (sp.get('poder') as 'E' | 'L' | 'J') ?? 'E'
        const items = await buscarRGF(ibge, exercicio, periodo, populacao, poder)
        return NextResponse.json({ ok: true, count: items.length, ibge, exercicio, periodo, items })
      }
      case 'msc': {
        const items = await buscarMSC(ibge, exercicio, mes)
        return NextResponse.json({ ok: true, count: items.length, ibge, exercicio, mes, items })
      }
      case 'extrato': {
        const items = await buscarExtratoEntregas(ibge, exercicio)
        const entregaveis = [...new Set(items.map(i => i.entregavel))]
        return NextResponse.json({ ok: true, count: items.length, ibge, exercicio, entregaveis, items })
      }
      case 'ente': {
        const data = await buscarEnte(ibge)
        return NextResponse.json({ ok: true, ibge, data })
      }
      default:
        return NextResponse.json(
          { error: `action inválida: ${action}. Use: rreo, rgf, msc, extrato, ente` },
          { status: 400 },
        )
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

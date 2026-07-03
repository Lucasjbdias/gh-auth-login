import { NextRequest, NextResponse } from 'next/server'
import {
  buscarPVL,
  buscarCronogramaPagamentos,
  buscarCronogramaLiberacoes,
  resumoPVL,
  valorContratado,
} from '@/lib/integrations/sadipem'
import { getUsuarioLogado } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/integracoes/sadipem?action=pvl&ibge=3141108&uf=MG
// GET /api/integracoes/sadipem?action=pvl-resumo&ibge=3141108
// GET /api/integracoes/sadipem?action=cronograma-pagamentos&id_pleito=12345
// GET /api/integracoes/sadipem?action=cronograma-liberacoes&id_pleito=12345
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const action = sp.get('action') ?? 'pvl'

  const ibgeParam = sp.get('ibge')
  const ibge = ibgeParam
    ? parseInt(ibgeParam)
    : usuario.tenant?.codigoIBGE
      ? parseInt(usuario.tenant.codigoIBGE)
      : null

  try {
    switch (action) {
      case 'pvl': {
        if (!ibge)
          return NextResponse.json({ error: 'ibge obrigatório' }, { status: 400 })
        const uf = sp.get('uf') ?? undefined
        const items = await buscarPVL(ibge, uf)
        return NextResponse.json({ ok: true, count: items.length, ibge, items })
      }
      case 'pvl-resumo': {
        if (!ibge)
          return NextResponse.json({ error: 'ibge obrigatório' }, { status: 400 })
        const uf = sp.get('uf') ?? undefined
        const items = await buscarPVL(ibge, uf)
        return NextResponse.json({
          ok: true,
          ibge,
          total: items.length,
          porStatus: resumoPVL(items),
          valorContratadoTotal: valorContratado(items),
        })
      }
      case 'cronograma-pagamentos': {
        const idPleito = parseInt(sp.get('id_pleito') ?? '')
        if (!idPleito)
          return NextResponse.json({ error: 'id_pleito obrigatório' }, { status: 400 })
        const items = await buscarCronogramaPagamentos(idPleito)
        return NextResponse.json({ ok: true, count: items.length, idPleito, items })
      }
      case 'cronograma-liberacoes': {
        const idPleito = parseInt(sp.get('id_pleito') ?? '')
        if (!idPleito)
          return NextResponse.json({ error: 'id_pleito obrigatório' }, { status: 400 })
        const items = await buscarCronogramaLiberacoes(idPleito)
        return NextResponse.json({ ok: true, count: items.length, idPleito, items })
      }
      default:
        return NextResponse.json(
          { error: `action inválida: ${action}. Use: pvl, pvl-resumo, cronograma-pagamentos, cronograma-liberacoes` },
          { status: 400 },
        )
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

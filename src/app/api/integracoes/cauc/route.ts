import { NextRequest, NextResponse } from 'next/server'
import { monitorarCauc, buscarEnteCauc, consultarSituacaoCauc } from '@/lib/integrations/cauc'
import { getUsuarioLogado } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/integracoes/cauc?action=status&municipio=Matozinhos
// GET /api/integracoes/cauc?action=status&idEnte=2744
// GET /api/integracoes/cauc?action=todos          — consulta todos os tenants ativos
// GET /api/integracoes/cauc?action=historico      — últimos 30 checks do tenant atual
// POST /api/integracoes/cauc                      — sync diário: checa todos os tenants e grava alertas

export async function GET(req: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const action = sp.get('action') ?? 'status'

  try {
    if (action === 'historico') {
      const checks = await db.caucStatusCheck.findMany({
        where: { tenantId: usuario.tenantId ?? undefined },
        orderBy: { verificadoEm: 'desc' },
        take: 30,
      })
      return NextResponse.json({ ok: true, count: checks.length, checks })
    }

    if (action === 'todos') {
      // SQLite não suporta distinct+orderBy bem no Prisma — busca todos e deduplica em JS
      const todos = await db.caucStatusCheck.findMany({
        orderBy: { verificadoEm: 'desc' },
      })
      // Mantém apenas o registro mais recente por tenantId
      const vistos = new Set<string>()
      const checks = todos.filter((c) => {
        const key = c.tenantId ?? c.municipio
        if (vistos.has(key)) return false
        vistos.add(key)
        return true
      })
      return NextResponse.json({ ok: true, count: checks.length, checks })
    }

    // action === 'status' — consulta pontual (não persiste)
    const municipio = sp.get('municipio')
    const idEnteParam = sp.get('idEnte')

    if (idEnteParam) {
      const idEnte = parseInt(idEnteParam)
      const situacao = await consultarSituacaoCauc(idEnte)
      return NextResponse.json({
        ok: true,
        idEnte,
        situacao,
        status: situacao === 1 ? 'REGULAR' : situacao === 0 ? 'IRREGULAR' : 'DESCONHECIDO',
      })
    }

    if (!municipio) {
      return NextResponse.json(
        { error: 'municipio ou idEnte obrigatório para action=status' },
        { status: 400 },
      )
    }

    const resultado = await monitorarCauc(
      municipio,
      usuario.tenantId ?? undefined,
    )
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// POST — sync diário: consulta todos os tenants ativos e persiste resultados + alertas
// Aceita autenticação via cookie de sessão OU Bearer token (CAUC_SYNC_SECRET)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const syncSecret = process.env.CAUC_SYNC_SECRET
  const bearerOk = syncSecret && authHeader === `Bearer ${syncSecret}`

  if (!bearerOk) {
    const usuario = await getUsuarioLogado()
    if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!['DEV', 'TENANT_ADMIN'].includes(usuario.nivel ?? '')) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }
  }

  const tenants = await db.tenant.findMany({
    where: { ativo: true },
    select: { id: true, municipio: true, codigoIBGE: true },
  })

  const resultados = []
  for (const tenant of tenants) {
    const resultado = await monitorarCauc(
      tenant.municipio,
      tenant.id,
      tenant.codigoIBGE ? parseInt(tenant.codigoIBGE) : undefined,
    )

    // Persiste o resultado
    const check = await db.caucStatusCheck.create({
      data: {
        tenantId: tenant.id,
        municipio: resultado.municipio,
        idEnte: resultado.enteCauc?.id ?? null,
        nomeEnte: resultado.enteCauc?.nome ?? null,
        cnpj: resultado.enteCauc?.cnpj ?? null,
        status: resultado.status,
        situacao: resultado.situacao,
        erro: resultado.erro ?? null,
        verificadoEm: new Date(resultado.verificadoEm),
      },
    })

    // Se IRREGULAR, cria alerta (upsert por código único)
    if (resultado.status === 'IRREGULAR') {
      const codigo = `CAUC_IRREGULAR_${tenant.id}`
      const existing = await db.alerta.findFirst({ where: { codigo } })
      if (!existing) {
        await db.alerta.create({
          data: {
            tenantId: tenant.id,
            codigo,
            tipo: 'CAUC',
            gravidade: 'VERMELHO',
            titulo: `CAUC Irregular — ${tenant.municipio}`,
            descricao: `O município de ${tenant.municipio} está com situação IRREGULAR no CAUC. Transferências constitucionais podem estar bloqueadas.`,
            recomendacao:
              'Acesse o CAUC em https://cauc.tesouro.gov.br/ng/#/extrato/ente/filtro para verificar quais requisitos estão pendentes e regularize a situação imediatamente.',
            status: 'NOVO',
            dataIdentificacao: new Date(),
          },
        })
      }
    }

    // Se voltou a REGULAR, resolve alertas CAUC abertos
    if (resultado.status === 'REGULAR') {
      const codigo = `CAUC_IRREGULAR_${tenant.id}`
      await db.alerta.updateMany({
        where: {
          codigo,
          status: { notIn: ['RESOLVIDO', 'ARQUIVADO'] },
        },
        data: { status: 'RESOLVIDO', dataResolucao: new Date() },
      })
    }

    resultados.push({ tenantId: tenant.id, municipio: tenant.municipio, status: resultado.status, checkId: check.id })
  }

  return NextResponse.json({
    ok: true,
    sincronizadoEm: new Date().toISOString(),
    total: resultados.length,
    irregulares: resultados.filter((r) => r.status === 'IRREGULAR').length,
    resultados,
  })
}

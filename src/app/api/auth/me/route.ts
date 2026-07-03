import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth'

export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  return NextResponse.json({
    id:        usuario.id,
    nome:      usuario.nome,
    email:     usuario.email,
    nivel:     usuario.nivel,
    tenantId:  usuario.tenantId,
    municipio: (usuario as any).tenant?.municipio ?? null,
  })
}

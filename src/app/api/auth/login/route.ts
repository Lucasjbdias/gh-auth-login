import { NextRequest, NextResponse } from 'next/server'
import { login, setCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}))

  if (!email || !senha) {
    return NextResponse.json({ erro: 'Email e senha obrigatórios.' }, { status: 400 })
  }

  const result = await login(email, senha)
  if (!result) {
    return NextResponse.json({ erro: 'Credenciais inválidas.' }, { status: 401 })
  }

  const { sessao, usuario } = result
  const cookieOpts = setCookie(sessao.token, sessao.expiresAt)

  const res = NextResponse.json({
    ok: true,
    usuario: {
      id:       usuario.id,
      nome:     usuario.nome,
      email:    usuario.email,
      nivel:    usuario.nivel,
      tenantId: usuario.tenantId,
    },
  })

  res.cookies.set(cookieOpts)
  return res
}

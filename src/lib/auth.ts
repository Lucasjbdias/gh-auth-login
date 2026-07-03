import { db } from './db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const COOKIE = 'gesia_sessao'
const EXPIRY_DAYS = 7

export async function login(email: string, senha: string) {
  const usuario = await db.usuario.findUnique({ where: { email } })
  if (!usuario || !usuario.ativo) return null

  const ok = await bcrypt.compare(senha, usuario.senhaHash)
  if (!ok) return null

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86400_000)

  const sessao = await db.sessao.create({
    data: { usuarioId: usuario.id, expiresAt },
  })

  await db.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  })

  return { sessao, usuario }
}

export async function logout(token: string) {
  await db.sessao.deleteMany({ where: { token } }).catch(() => null)
}

export async function getUsuarioFromToken(token: string) {
  const sessao = await db.sessao.findUnique({
    where: { token },
    include: { usuario: { include: { tenant: true } } },
  })
  if (!sessao || sessao.expiresAt < new Date()) return null
  return sessao.usuario
}

export async function getUsuarioLogado() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  return getUsuarioFromToken(token)
}

export function setCookie(token: string, expiresAt: Date) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    path: '/',
    expires: expiresAt,
    sameSite: 'lax' as const,
  }
}

export function clearCookie() {
  return { name: COOKIE, value: '', maxAge: 0, path: '/' }
}

// Para uso no middleware (Edge runtime — sem Prisma, só lê o cookie)
export function getTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE)?.value
}

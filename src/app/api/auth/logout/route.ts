import { NextRequest, NextResponse } from 'next/server'
import { logout, clearCookie, getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (token) await logout(token)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(clearCookie())
  return res
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE = 'gesia_sessao'
const PUBLIC = ['/login', '/teaser', '/_next', '/favicon.ico']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas (login, estáticos, teaser)
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // API de autenticação é pública
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE)?.value

  // Sem token → redireciona para login
  if (!token) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token presente → deixa passar (validação completa acontece nas Server Actions/API Routes via db)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

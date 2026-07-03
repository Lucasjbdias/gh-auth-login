'use client'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

const SEM_SIDEBAR = ['/login', '/teaser']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const semSidebar = SEM_SIDEBAR.some(p => pathname.startsWith(p))

  if (semSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  )
}

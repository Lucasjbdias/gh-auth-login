"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU, GRUPOS } from "@/lib/navegacao";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-brand-900 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        {/* Monograma FD — identidade França Dias Group */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-fd-dourado/40 bg-brand-800 font-bold tracking-tight text-white shadow-marca">
          <span className="text-fd-douradoClaro">F</span>
          <span>D</span>
        </div>
        <div className="leading-tight">
          <p className="text-lg font-bold">
            Ges<span className="text-fd-douradoClaro">IA</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-brand-100/70">
            França Dias Group
          </p>
        </div>
      </div>
      <div className="mx-5 mb-1 h-px bg-gradient-to-r from-fd-dourado/60 to-transparent" />

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {GRUPOS.map((grupo) => (
          <div key={grupo} className="mb-4">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-100/50">
              {grupo}
            </p>
            {MENU.filter((m) => m.grupo === grupo).map((item) => {
              const ativo =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    ativo
                      ? "bg-brand-500 font-medium text-white"
                      : "text-brand-100/80 hover:bg-brand-700"
                  }`}
                >
                  <span className="w-5 text-center">{item.icone}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-700 px-5 py-3 text-[11px] text-brand-100/60">
        Versão 1 — dados por importação
      </div>
    </aside>
  );
}

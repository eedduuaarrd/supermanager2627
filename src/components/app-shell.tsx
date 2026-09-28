"use client";

import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Home,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/jornada", label: "Inici", icon: Home },
  { href: "/equip", label: "Equip", icon: ClipboardList },
  { href: "/classificacio", label: "Classificació", icon: Trophy },
  { href: "/compte", label: "Compte", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEquip = pathname === "/equip" || pathname.startsWith("/equip/");
  const isJugador = pathname.startsWith("/jugador/");

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <header className="z-30 shrink-0 border-b border-line bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-lg items-center px-4">
          <Link href="/jornada" className="font-display text-lg text-bone">
            Supermanager
            <span className="text-grana-bright"> Balaguer</span>
          </Link>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col px-4",
          "pb-[calc(3.5rem+env(safe-area-inset-bottom))]",
          isEquip
            ? "overflow-y-auto overscroll-contain pt-3"
            : "overflow-y-auto overscroll-contain pt-2",
        )}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 shrink-0 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        aria-label="Navegació principal"
      >
        <ul className="mx-auto grid h-14 max-w-lg grid-cols-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/equip" && isJugador);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "text-grana-bright"
                      : "text-mute hover:text-bone",
                  )}
                >
                  <Icon
                    className={cn("size-5", active && "stroke-[2.25]")}
                    aria-hidden
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

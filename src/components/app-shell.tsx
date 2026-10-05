"use client";

import { BrandLogo } from "@/components/brand-logo";
import { InstallAppModal } from "@/components/install-app-modal";
import { PushPrompt } from "@/components/push-prompt";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Home,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

const NAV = [
  { href: "/jornada", label: "Inici", icon: Home },
  { href: "/equip", label: "Equip", icon: ClipboardList },
  { href: "/classificacio", label: "Classificació", icon: Trophy },
  { href: "/jugadors", label: "Jugadors", icon: Users },
  { href: "/compte", label: "Compte", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEquip = pathname === "/equip" || pathname.startsWith("/equip/");
  const isJugador = pathname.startsWith("/jugador/");
  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (main) main.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="flex h-app min-h-0 w-full flex-col overflow-x-hidden overflow-y-hidden">
      <header
        className="z-30 shrink-0 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-md"
      >
        <div
          className={cn(
            "mx-auto flex h-12 min-h-12 w-full items-center px-4",
            "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
            isEquip
              ? "max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl"
              : "max-w-lg md:max-w-xl",
          )}
        >
          <BrandLogo href="/jornada" size="sm" priority />
        </div>
      </header>

      <main
        ref={mainRef}
        className={cn(
          "mx-auto flex w-full min-h-0 flex-1 flex-col",
          "px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
          "pb-[calc(3.75rem+env(safe-area-inset-bottom))]",
          isEquip
            ? "max-w-lg overflow-y-auto overscroll-contain pt-3 md:max-w-xl lg:max-w-2xl xl:max-w-3xl"
            : "max-w-lg overflow-y-auto overscroll-contain pt-2 md:max-w-xl",
        )}
      >
        {children}
      </main>

      <InstallAppModal />
      <PushPrompt />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 shrink-0 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        aria-label="Navegació principal"
      >
        <ul
          className={cn(
            "mx-auto grid h-[3.75rem] min-h-[3.75rem] grid-cols-5",
            "max-w-lg md:max-w-xl",
            isEquip && "lg:max-w-2xl xl:max-w-3xl",
          )}
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/equip" && isJugador);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full min-h-11 items-center justify-center px-1 transition-colors",
                    "touch-manipulation",
                    active
                      ? "text-grana-bright"
                      : "text-mute hover:text-bone",
                  )}
                >
                  <Icon
                    className={cn("size-6 shrink-0", active && "stroke-[2.25]")}
                    aria-hidden
                  />
                  <span className="sr-only">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

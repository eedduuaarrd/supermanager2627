import { AppShell } from "@/components/app-shell";
import { ManagerProvider } from "@/components/manager-provider";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

/** Pages behind login: never index them (robots.txt also disallows them). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await readSession();
  if (!user) redirect("/login");

  return (
    <ManagerProvider user={user} initialRound={getCurrentRound()}>
      <AppShell>{children}</AppShell>
    </ManagerProvider>
  );
}

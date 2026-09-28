import { AppShell } from "@/components/app-shell";
import { ManagerProvider } from "@/components/manager-provider";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { redirect } from "next/navigation";

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

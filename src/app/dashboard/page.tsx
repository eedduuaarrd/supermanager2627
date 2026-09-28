import { ManagerApp } from "@/components/manager-app";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await readSession();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div>
            <Link href="/dashboard" className="font-display text-2xl text-bone">
              Supermanager
              <span className="text-grana-bright"> Balaguer</span>
            </Link>
            <p className="text-xs uppercase tracking-[0.2em] text-mute">
              Jornada {getCurrentRound()}
            </p>
          </div>
        </div>
      </header>
      <ManagerApp user={user} initialRound={getCurrentRound()} />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, teamName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No s'ha pogut registrar.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <Link href="/" className="mb-8 font-display text-xl text-bone">
        Supermanager Balaguer
      </Link>
      <h1 className="font-display text-4xl text-bone">Registre</h1>
      <p className="mt-2 text-sm text-mute">
        El primer compte creat al servidor és administrador (pot tancar jornades).
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-mute">
            Nom de mànager
          </label>
          <Input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 border-line bg-panel text-bone"
            placeholder="Ex. Oriol"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-mute">
            Nom de l&apos;equip fantasy
          </label>
          <Input
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="h-11 border-line bg-panel text-bone"
            placeholder="Ex. Grana FC"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-mute">
            Correu
          </label>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-line bg-panel text-bone"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-mute">
            Contrasenya (mín. 8)
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-line bg-panel text-bone"
          />
        </div>
        {error && (
          <p className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
        >
          {pending ? "Creant compte…" : "Crear compte"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-mute">
        Ja tens compte?{" "}
        <Link href="/login" className="text-bone underline underline-offset-4">
          Entra
        </Link>
      </p>
    </main>
  );
}

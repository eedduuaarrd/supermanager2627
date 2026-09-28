"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error d'accés.");
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
      <h1 className="font-display text-4xl text-bone">Entra</h1>
      <p className="mt-2 text-sm text-mute">
        Accedeix al mercat i a la teva alineació de jornada.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
            Contrasenya
          </label>
          <Input
            type="password"
            autoComplete="current-password"
            required
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
          {pending ? "Entrant…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-mute">
        Encara no tens compte?{" "}
        <Link href="/register" className="text-bone underline underline-offset-4">
          Registra&apos;t
        </Link>
      </p>
    </main>
  );
}

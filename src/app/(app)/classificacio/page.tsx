"use client";

import { StandingsPanel } from "@/components/standings-panel";

export default function ClassificacioPage() {
  return (
    <div className="view-enter space-y-3">
      <h1 className="font-display text-3xl tracking-wide text-bone">
        Classificació
      </h1>
      <p className="mb-4 text-sm text-mute">
        Canvia entre jornada i general quan vulguis.
      </p>
      <StandingsPanel />
    </div>
  );
}

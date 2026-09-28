"use client";

import { StandingsPanel } from "@/components/standings-panel";
import { useManager } from "@/components/manager-provider";

export default function ClassificacioPage() {
  const { user, reload } = useManager();

  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl tracking-wide text-bone">
        Classificació
      </h1>
      <p className="mb-4 text-sm text-mute">
        Canvia entre jornada i general quan vulguis.
      </p>
      <StandingsPanel
        isAdmin={user.isAdmin}
        onSimulated={() => {
          void reload();
        }}
      />
    </div>
  );
}

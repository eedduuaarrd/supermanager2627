"use client";

import { useManager } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

/** Full create / switch / rename / delete for fantasy teams (Inici). */
export function TeamManager() {
  const {
    teams,
    activeTeamId,
    maxTeams,
    switchTeam,
    createTeam,
    renameTeam,
    deleteTeam,
  } = useManager();
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pending, start] = useTransition();

  const atLimit = teams.length >= maxTeams;

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createTeam(newName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewName("");
      setCreateOpen(false);
    });
  }

  function onRename(teamId: string) {
    setError(null);
    start(async () => {
      const result = await renameTeam(teamId, renameValue);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRenamingId(null);
      setRenameValue("");
    });
  }

  function onDelete(teamId: string) {
    if (!confirm("Eliminar aquest equip i la seva alineació?")) return;
    setError(null);
    start(async () => {
      const result = await deleteTeam(teamId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="border border-line bg-panel/80 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
            Equips fantasy
          </p>
          <p className="mt-1 text-sm text-mute">
            {teams.length}/{maxTeams} equips · màxim {maxTeams}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {teams.map((t) => {
          const active = t.id === activeTeamId;
          const isRenaming = renamingId === t.id;
          return (
            <li
              key={t.id}
              className={`border border-line px-3 py-2.5 ${
                active ? "bg-grana/10" : "bg-panel-2/40"
              }`}
            >
              {isRenaming ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(t.id);
                  }}
                >
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-9 border-line bg-panel text-bone"
                    autoFocus
                    maxLength={40}
                  />
                  <Button
                    type="submit"
                    disabled={pending}
                    className="h-9 bg-grana text-bone hover:bg-grana-bright"
                  >
                    Desa
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameValue("");
                    }}
                    className="h-9 border border-line bg-transparent text-mute hover:bg-white/5"
                  >
                    Cancel·la
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void switchTeam(t.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium text-bone">
                      {t.name}
                      {active ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-grana-bright">
                          actiu
                        </span>
                      ) : null}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Canviar nom"
                    onClick={() => {
                      setRenamingId(t.id);
                      setRenameValue(t.name);
                    }}
                    className="rounded-sm p-1.5 text-mute hover:bg-white/5 hover:text-bone"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {teams.length > 1 && (
                    <button
                      type="button"
                      aria-label="Eliminar equip"
                      onClick={() => onDelete(t.id)}
                      className="rounded-sm p-1.5 text-mute hover:bg-white/5 hover:text-red-300"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {createOpen ? (
        <form onSubmit={onCreate} className="mt-4 space-y-3 border-t border-line pt-4">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-mute">
            Nom de l&apos;equip
          </label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-10 border-line bg-panel text-bone"
            placeholder="Ex. Grana B"
            required
            minLength={2}
            maxLength={40}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={pending || atLimit}
              className="h-10 flex-1 bg-grana text-bone hover:bg-grana-bright"
            >
              Crear equip
            </Button>
            <Button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setNewName("");
                setError(null);
              }}
              className="h-10 border border-line bg-transparent text-mute hover:bg-white/5"
            >
              Cancel·la
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          disabled={atLimit}
          onClick={() => setCreateOpen(true)}
          className="mt-4 h-10 w-full border border-line bg-panel-2 text-bone hover:bg-white/10 disabled:opacity-50"
        >
          <Plus className="size-4" /> Nou equip
        </Button>
      )}

      {atLimit && (
        <p className="mt-2 text-xs text-mute">
          Has arribat al màxim de {maxTeams} equips.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </section>
  );
}

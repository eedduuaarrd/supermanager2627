"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PlayerAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim =
    size === "sm" ? "h-9 w-9 text-[10px]" : size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-xs";

  if (photoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        onError={() => setBroken(true)}
        className={cn(
          "shrink-0 rounded-sm object-cover object-top ring-1 ring-white/15",
          dim,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm bg-gradient-to-b from-panel-2 to-ink font-display tracking-wider text-bone ring-1 ring-white/15",
        dim,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** 1–2 uppercase initials from a player name (first + last word). */
export function playerInitials(name: string): string {
  const parts = name
    .normalize("NFC")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const word = parts[0];
    const chars = Array.from(word);
    if (chars.length === 0) return "?";
    if (chars.length === 1) return chars[0]!.toLocaleUpperCase("ca");
    return `${chars[0]}${chars[1]}`.toLocaleUpperCase("ca");
  }
  const first = Array.from(parts[0]!)[0];
  const last = Array.from(parts[parts.length - 1]!)[0];
  if (!first || !last) return "?";
  return `${first}${last}`.toLocaleUpperCase("ca");
}

const SIZE = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs",
  lg: "h-14 w-14 text-sm",
} as const;

const INITIALS_SURFACE =
  "bg-[linear-gradient(145deg,var(--panel-2)_0%,var(--ink-soft)_52%,color-mix(in_srgb,var(--grana)_42%,var(--ink))_100%)] text-bone ring-1 ring-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]";

function InitialsFallback({
  name,
  letters,
  dim,
  className,
}: {
  name: string;
  letters: string;
  dim: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "font-display font-semibold leading-none tracking-[0.06em]",
        INITIALS_SURFACE,
        dim,
        className,
      )}
    >
      <span className="translate-y-[0.5px] select-none">{letters}</span>
    </div>
  );
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
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dim = SIZE[size];
  const letters = playerInitials(name);
  const src = photoUrl?.trim() || null;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  // Cached/failed loads can finish before React attaches onError.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;
    if (img.complete && img.naturalWidth === 0) {
      setBroken(true);
    }
  }, [src, broken]);

  if (!src || broken) {
    return (
      <InitialsFallback
        name={name}
        letters={letters}
        dim={dim}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      className={cn(
        "shrink-0 rounded-full object-cover object-top ring-1 ring-white/15",
        dim,
        className,
      )}
    />
  );
}

import { cn } from "@/lib/utils";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md";
  priority?: boolean;
};

export function BrandLogo({
  href = "/jornada",
  className,
  size = "sm",
  priority,
}: BrandLogoProps) {
  const heightClass = size === "md" ? "h-10" : "h-8";

  const img = (
    <img
      src="/brand/logo.svg"
      alt="Supermanager Balaguer"
      width={size === "md" ? 180 : 144}
      height={size === "md" ? 40 : 32}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={cn(
        heightClass,
        "w-auto max-w-[min(100%,14rem)] object-contain object-left",
        size === "md" && "max-w-[16rem]",
        className,
      )}
    />
  );

  if (!href) return img;
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright"
      aria-label="Supermanager Balaguer — Inici"
    >
      {img}
    </Link>
  );
}

export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/brand/mark.svg"
      alt=""
      width={size}
      height={size}
      className={cn("rounded-lg object-contain", className)}
      aria-hidden
      decoding="async"
    />
  );
}

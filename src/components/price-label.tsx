import { formatPrice } from "@/data/roster";
import { priceTrend } from "@/lib/market-price";
import { cn } from "@/lib/utils";

interface PriceLabelProps {
  price: number;
  prevPrice?: number | null;
  className?: string;
  /** Compact: drop currency spacing (court chips). */
  compact?: boolean;
  showArrow?: boolean;
}

export function PriceLabel({
  price,
  prevPrice,
  className,
  compact,
  showArrow = true,
}: PriceLabelProps) {
  const trend = priceTrend(price, prevPrice);
  const text = compact
    ? formatPrice(price).replace(/\s/g, "")
    : formatPrice(price);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        trend === "up" && "text-emerald-400",
        trend === "down" && "text-red-400",
        className,
      )}
    >
      {showArrow && trend === "up" && (
        <span aria-hidden className="text-[0.85em] leading-none">
          ↑
        </span>
      )}
      {showArrow && trend === "down" && (
        <span aria-hidden className="text-[0.85em] leading-none">
          ↓
        </span>
      )}
      <span>{text}</span>
    </span>
  );
}

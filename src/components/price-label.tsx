import { formatPrice } from "@/data/roster";
import { priceDelta, priceTrend } from "@/lib/market-price";
import { cn } from "@/lib/utils";

interface PriceLabelProps {
  price: number;
  prevPrice?: number | null;
  className?: string;
  /** Compact: drop currency spacing (court chips). */
  compact?: boolean;
  showArrow?: boolean;
  /**
   * Show short € delta next to the quote (market picker / player page).
   * With `variacioLabel`, appends “variació” when there is room.
   */
  showDelta?: boolean;
  variacioLabel?: boolean;
}

export function PriceLabel({
  price,
  prevPrice,
  className,
  compact,
  showArrow = true,
  showDelta = false,
  variacioLabel = false,
}: PriceLabelProps) {
  const trend = priceTrend(price, prevPrice);
  const delta = showDelta ? priceDelta(price, prevPrice) : null;
  const text = compact
    ? formatPrice(price).replace(/\s/g, "")
    : formatPrice(price);

  const deltaText =
    delta == null
      ? null
      : `${delta > 0 ? "+" : "−"}${formatPrice(Math.abs(delta))}${
          variacioLabel ? " variació" : ""
        }`;

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
      {deltaText && (
        <span
          className={cn(
            "ml-1 text-[0.8em] font-normal leading-none opacity-90",
            compact && "ml-0.5",
          )}
        >
          {deltaText}
        </span>
      )}
    </span>
  );
}

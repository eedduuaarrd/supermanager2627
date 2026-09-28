import { formatPrice } from "@/data/roster";
import { nextValThresholds, priceDelta, priceTrend } from "@/lib/market-price";
import { cn } from "@/lib/utils";

function fmtVal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

interface ValorBlockProps {
  price: number;
  prevPrice?: number | null;
  className?: string;
}

/**
 * Player-page market block: current quote + ↑↓ + three VAL thresholds
 * for the next price tick (+15% / hold / −15%). Inspiration only — no ACB copy.
 */
export function ValorBlock({ price, prevPrice, className }: ValorBlockProps) {
  const t = nextValThresholds(price);
  const trend = priceTrend(price, prevPrice);
  const delta = priceDelta(price, prevPrice);

  return (
    <section
      className={cn(
        "border border-line bg-panel/80 px-4 py-5 text-center",
        className,
      )}
      aria-label="Valor de mercat"
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-mute">
        Valor de mercat
      </p>
      <p
        className={cn(
          "mt-2 font-display text-4xl tabular-nums tracking-wide text-bone sm:text-5xl",
          trend === "up" && "text-emerald-400",
          trend === "down" && "text-red-400",
        )}
      >
        {trend === "up" && (
          <span aria-hidden className="mr-1 text-[0.55em] align-middle">
            ↑
          </span>
        )}
        {trend === "down" && (
          <span aria-hidden className="mr-1 text-[0.55em] align-middle">
            ↓
          </span>
        )}
        {formatPrice(price)}
      </p>
      {delta != null && (
        <p
          className={cn(
            "mt-1 text-sm tabular-nums",
            trend === "up" && "text-emerald-400",
            trend === "down" && "text-red-400",
            trend === "flat" && "text-mute",
          )}
        >
          {delta > 0 ? "+" : "−"}
          {formatPrice(Math.abs(delta))} variació
        </p>
      )}

      <p className="mt-5 text-[10px] uppercase tracking-[0.14em] text-mute">
        Proper moviment · VAL del partit
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ThresholdCol
          label="Per pujar al màxim"
          val={t.valUp}
          relation="≥"
          nextPrice={t.priceUp}
          accent="up"
        />
        <ThresholdCol
          label="Per mantenir"
          val={t.valHold}
          relation="≈"
          nextPrice={t.priceHold}
          accent="hold"
        />
        <ThresholdCol
          label="Per baixar al màxim"
          val={t.valDown}
          relation="≤"
          nextPrice={t.priceDown}
          accent="down"
        />
      </div>
    </section>
  );
}

function ThresholdCol({
  label,
  val,
  relation,
  nextPrice,
  accent,
}: {
  label: string;
  val: number;
  relation: "≥" | "≈" | "≤";
  nextPrice: number;
  accent: "up" | "hold" | "down";
}) {
  return (
    <div className="min-w-0 px-1">
      <p className="text-[10px] leading-snug text-mute">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl tabular-nums text-bone sm:text-3xl",
          accent === "up" && "text-emerald-400/90",
          accent === "down" && "text-red-400/90",
        )}
      >
        <span className="mr-0.5 text-sm font-sans text-mute">{relation}</span>
        {fmtVal(val)}
      </p>
      <p className="mt-1 text-[11px] tabular-nums text-mute">
        → {formatPrice(nextPrice)}
      </p>
    </div>
  );
}

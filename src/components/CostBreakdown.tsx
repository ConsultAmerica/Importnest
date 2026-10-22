import {
  costBreakdownValue,
  formatCostBreakdownLine,
  type CostBreakdownInput,
} from "@/lib/cost-breakdown";

function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.25v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.9" fill="currentColor" />
    </svg>
  );
}

function Row({
  label,
  value,
  signed,
  strong,
}: {
  label: string;
  value: CostBreakdownInput;
  signed?: boolean;
  strong?: boolean;
}) {
  const { text, isMissing, isEstimated } = formatCostBreakdownLine(value, { signed });

  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        strong ? "mt-1.5 border-t border-border pt-1.5" : ""
      }`}
    >
      <dt className={strong ? "text-sm font-semibold text-foreground" : "text-sm text-muted"}>
        {label}
      </dt>
      <dd
        className={`flex items-center gap-1.5 tabular-nums ${
          strong ? "text-base price-text" : "text-sm text-foreground/80"
        } ${isMissing ? "font-normal italic text-muted" : ""}`}
      >
        {text}
        {isEstimated ? (
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted ring-1 ring-border">
            Estimated
          </span>
        ) : null}
      </dd>
    </div>
  );
}

const BAR_SEGMENTS = [
  { key: "item", label: "Item price", swatch: "bg-navy-800", dot: "bg-navy-800" },
  { key: "shipping", label: "Shipping", swatch: "bg-sky-500", dot: "bg-sky-500" },
  { key: "fees", label: "Fees / taxes", swatch: "bg-amber-400", dot: "bg-amber-400" },
] as const;

/**
 * Stacked proportion bar showing how Item + Shipping + Fees make up the
 * total — a quick visual of where the cost comes from. Uses only real
 * numeric values; missing components are simply omitted (never treated as 0),
 * and the bar hides entirely when there isn't enough data to be meaningful.
 */
function CostStackBar({
  itemPrice,
  shipping,
  mandatoryFees,
}: {
  itemPrice: CostBreakdownInput;
  shipping: CostBreakdownInput;
  mandatoryFees: CostBreakdownInput;
}) {
  const values: Record<string, number | null> = {
    item: costBreakdownValue(itemPrice),
    shipping: costBreakdownValue(shipping),
    fees: costBreakdownValue(mandatoryFees),
  };
  const sum = BAR_SEGMENTS.reduce((acc, s) => acc + (values[s.key] ?? 0), 0);
  // Need a real item price and a positive denominator, otherwise the bar
  // would be misleading rather than informative.
  if (values.item == null || sum <= 0) return null;
  const present = BAR_SEGMENTS.filter((s) => (values[s.key] ?? 0) > 0);

  return (
    <div className="mt-2" aria-hidden="true">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface ring-1 ring-border">
        {present.map((s) => (
          <div
            key={s.key}
            className={s.swatch}
            style={{ width: `${((values[s.key] as number) / sum) * 100}%` }}
            title={`${s.label}: $${(values[s.key] as number).toFixed(2)}`}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {present.map((s) => (
          <li key={s.key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact, reusable cost breakdown for an offer. Renders real stored values
 * only — missing or invalid amounts read as "Not provided", never a
 * fabricated "$0.00" — and highlights total known cost more strongly than
 * the individual line items.
 */
export function CostBreakdown({
  itemPrice,
  shipping,
  mandatoryFees,
  verifiedDiscount,
  totalKnownCost,
  className = "",
}: {
  itemPrice: CostBreakdownInput;
  shipping: CostBreakdownInput;
  mandatoryFees: CostBreakdownInput;
  verifiedDiscount: CostBreakdownInput;
  totalKnownCost: CostBreakdownInput;
  className?: string;
}) {
  const shippingLine = formatCostBreakdownLine(shipping);
  const totalLine = formatCostBreakdownLine(totalKnownCost);
  const totalText =
    shippingLine.isMissing && !totalLine.isMissing
      ? `from ${totalLine.text}, shipping not disclosed`
      : totalLine.text;

  return (
    <dl className={`w-full min-w-[11rem] space-y-1 ${className}`}>
      <Row label="Item price" value={itemPrice} />
      <Row label="Shipping" value={shipping} />
      <Row label="Mandatory fees" value={mandatoryFees} />
      <Row label="Verified discount" value={verifiedDiscount} signed />
      <CostStackBar itemPrice={itemPrice} shipping={shipping} mandatoryFees={mandatoryFees} />
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
        <dt className="text-sm font-semibold text-foreground">Total known cost</dt>
        <dd className="text-base price-text tabular-nums">{totalText}</dd>
      </div>
      <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-muted">
        <InfoIcon />
        <span>Taxes may be calculated at checkout if not available here.</span>
      </p>
    </dl>
  );
}

import { describePriceHistoryForScreenReaders, type ProductPriceHistorySummary } from "@/lib/compare-data";
import { PriceSparkline } from "@/components/PriceSparkline";
import { formatPriceChange } from "@/lib/price-change";

function PriceTrendChart({
  points,
  stroke = "#00b8d4",
}: {
  points: { day: string; total: number }[];
  stroke?: string;
}) {
  const width = 480;
  const height = 140;
  const padX = 12;
  const padY = 16;
  const totals = points.map((p) => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const range = max - min || 1;
  const firstDay = points[0]?.day;
  const lastDay = points[points.length - 1]?.day;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((p.total - min) / range) * (height - padY * 2);
    return { x, y };
  });
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface/70 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>Lowest known total · last {points.length} checks</span>
        {firstDay && lastDay ? (
          <span className="tabular-nums">
            {firstDay} → {lastDay}
          </span>
        ) : null}
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mt-1 max-w-full"
        role="img"
        aria-label={`Price trend from $${totals[0]!.toFixed(2)} to $${totals[totals.length - 1]!.toFixed(2)}`}
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={height - padY}
          y2={height - padY}
          stroke="currentColor"
          className="text-border"
          strokeWidth="1"
        />
        <polygon fill={`${stroke}18`} points={area} />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
        {coords.map((c, i) =>
          i === coords.length - 1 || i === 0 ? (
            <circle key={i} cx={c.x} cy={c.y} r="3.5" fill={stroke} />
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
        <span>${min.toFixed(2)}</span>
        <span>${max.toFixed(2)}</span>
      </div>
    </div>
  );
}

/**
 * Price history for the comparison page — real PriceHistory records only.
 * A product with fewer than two valid, in-window daily prices shows the
 * honest "not enough checks yet" message instead of a chart; nothing here is
 * ever interpolated or invented to fill the gap.
 */
export function PriceHistorySection({
  summary,
  /** When true, render nothing until at least two recorded checks exist (side panel). */
  hideWhenEmpty = false,
  className = "",
}: {
  summary: ProductPriceHistorySummary;
  hideWhenEmpty?: boolean;
  className?: string;
}) {
  const hasChart = summary.points.length >= 2;
  const change = formatPriceChange(summary.lastChange);

  if (hideWhenEmpty && !hasChart) return null;

  return (
    <section className={`panel p-4 sm:p-5 ${className}`.trim()}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">Price history</h2>
          <p className="mt-1 text-sm text-muted">
            Lowest known Total Known Cost from approved sources — not a live stock ticker.
          </p>
        </div>
        <span className="rounded-full bg-navy-100 px-2.5 py-1 text-[11px] font-bold text-navy-900">
          Recorded checks only
        </span>
      </div>
      {!hasChart ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted">
          Not enough recorded price checks yet. History appears after Importnest stores multiple
          Total Known Cost snapshots from approved sources — it is never invented.
        </p>
      ) : (
        <>
          <p className="sr-only">{describePriceHistoryForScreenReaders(summary)}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.currentLowest != null ? (
              <div className="rounded-xl border border-border bg-surface/80 px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">Current lowest</dt>
                <dd className="mt-0.5 text-lg price-text">${summary.currentLowest.toFixed(2)}</dd>
              </div>
            ) : null}
            {summary.previousLowest != null ? (
              <div className="rounded-xl border border-border bg-surface/80 px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">Previous lowest</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy-900">
                  ${summary.previousLowest.toFixed(2)}
                </dd>
              </div>
            ) : null}
            {summary.thirtyDayLow != null ? (
              <div className="rounded-xl border border-border bg-surface/80 px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">30-day low</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy-900">
                  ${summary.thirtyDayLow.toFixed(2)}
                </dd>
              </div>
            ) : null}
            {change ? (
              <div className="rounded-xl border border-border bg-surface/80 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-muted">Last price change</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy-900">
                      {change.text}
                      {summary.lastChangeAt ? (
                        <span className="mt-0.5 block text-xs font-normal text-muted">
                          {summary.lastChangeAt}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <PriceSparkline points={summary.points} width={88} height={32} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface/80 px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">Trend</dt>
                <dd className="mt-1">
                  <PriceSparkline points={summary.points} width={120} height={36} />
                </dd>
              </div>
            )}
          </dl>
          <PriceTrendChart points={summary.points} />
        </>
      )}
    </section>
  );
}

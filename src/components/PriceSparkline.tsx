/**
 * Compact SVG sparkline for recorded Total Known Cost points.
 * Never invents points — caller must pass real history (≥2 checks).
 */
export function PriceSparkline({
  points,
  width = 120,
  height = 36,
  className = "",
}: {
  points: { day: string; total: number }[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const pad = 2;
  const totals = points.map((p) => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.total - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const dropped = totals[totals.length - 1]! <= totals[0]!;
  const stroke = dropped ? "#166534" : "#9a3412";
  const trend = dropped ? "trending down" : "trending up";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 ${className}`.trim()}
      role="img"
      aria-label={`Price history sparkline, ${trend}, from $${totals[0]!.toFixed(2)} to $${totals[totals.length - 1]!.toFixed(2)}`}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

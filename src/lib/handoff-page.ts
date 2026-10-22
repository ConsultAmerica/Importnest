import { hasDisclosedShipping } from "@/lib/compare-view";

/**
 * The short "Taking you to {retailer}…" screen served by /go/[listingId] before
 * the shopper lands on a retailer's site. Self-contained HTML (no app shell) so
 * it renders instantly; redirects after HANDOFF_DELAY_MS, with a meta-refresh
 * fallback when JavaScript is off.
 */
export const HANDOFF_DELAY_MS = 1500;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** "item $220.00 + $14.50 shipping" — undisclosed shipping is said out loud, never shown as free. */
function makeup(item: number, shipping: number | null, fees: number): string {
  const parts = [`item ${money(item)}`];
  if (!hasDisclosedShipping(shipping)) parts.push("shipping not disclosed");
  else if (shipping <= 0.009) parts.push("free shipping");
  else parts.push(`${money(shipping)} shipping`);
  if (fees > 0.009) parts.push(`${money(fees)} fees`);
  return parts.join(" + ");
}

export function handoffHtml(o: {
  merchant: string;
  url: string;
  total: number;
  item: number;
  shipping: number | null;
  fees: number;
}): string {
  const merchant = escapeHtml(o.merchant);
  const href = escapeHtml(o.url);
  const seconds = (HANDOFF_DELAY_MS / 1000).toString();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="${seconds};url=${href}">
<title>Taking you to ${merchant} · Importnest</title>
<style>
  :root { color-scheme: light dark; --navy:#053f71; --gold:#f2b01e; --muted:#5b6b7d; --bg:#eef2f7; --panel:#fff; }
  @media (prefers-color-scheme: dark) { :root { --navy:#e8eef6; --muted:#9fb0c3; --bg:#0a1c30; --panel:#0d2136; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--navy); }
  main { width:min(26rem,100%); background:var(--panel); border-radius:20px; padding:28px 24px;
    box-shadow:0 12px 40px rgb(15 42 74 / .14); text-align:center; }
  .brand { font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
  h1 { font-size:20px; margin:14px 0 6px; }
  .total { font-size:30px; font-weight:800; margin:14px 0 2px; }
  .makeup, p { font-size:14px; line-height:1.5; color:var(--muted); margin:6px 0; }
  .bar { height:4px; border-radius:99px; background:rgb(127 127 127 / .2); overflow:hidden; margin:20px 0 16px; }
  .bar > span { display:block; height:100%; width:100%; background:var(--gold); transform-origin:left;
    animation: fill ${seconds}s linear forwards; }
  @keyframes fill { from { transform:scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { .bar > span { animation:none; } }
  a.btn { display:inline-block; margin-top:6px; padding:10px 18px; border-radius:999px; background:var(--gold);
    color:#0b2748; font-weight:700; text-decoration:none; }
</style>
</head>
<body>
<main>
  <div class="brand">Importnest</div>
  <h1>Taking you to ${merchant}…</h1>
  <p>Total Known Cost we compared</p>
  <div class="total">${money(o.total)}</div>
  <div class="makeup">${escapeHtml(makeup(o.item, o.shipping, o.fees))}</div>
  <div class="bar" aria-hidden="true"><span></span></div>
  <p>Checkout happens on ${merchant}’s site — Importnest never takes payment. Prices are set by the retailer and can change, so check the total before you pay.</p>
  <a class="btn" href="${href}" rel="noopener noreferrer sponsored">Continue to ${merchant} now</a>
</main>
<script>setTimeout(function(){ location.replace(${JSON.stringify(o.url).replace(/</g, "\\u003c")}); }, ${HANDOFF_DELAY_MS});</script>
</body>
</html>`;
}

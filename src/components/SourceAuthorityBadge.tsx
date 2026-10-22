import { retailerTrustFor } from "@/lib/approved-sources";

export type SourceAuthorityKind = "manufacturer" | "verified" | "partner" | "marketplace" | "approved";

/** Map connector/sourceType (+ trust badge) to a short authority tier. */
export function sourceAuthorityKind(
  sourceType: string,
  sourceId?: string,
  fallbackName = "Retailer",
): SourceAuthorityKind {
  const type = sourceType.toLowerCase();
  if (type.includes("manufacturer") || type.includes("official")) return "manufacturer";
  if (type.includes("licensed") || type.includes("authorized")) return "verified";
  if (type.includes("partner")) return "partner";
  if (type.includes("affiliate") || type.includes("marketplace") || type.includes("web")) {
    return "marketplace";
  }
  if (sourceId) {
    const badge = retailerTrustFor(sourceId, fallbackName).badge.toLowerCase();
    if (badge.includes("manufacturer")) return "manufacturer";
    if (badge.includes("verified") || badge.includes("authorized")) return "verified";
    if (badge.includes("partner")) return "partner";
    if (badge.includes("marketplace")) return "marketplace";
  }
  return "approved";
}

const KIND_META: Record<
  SourceAuthorityKind,
  { label: string; className: string; icon: "factory" | "shield" | "handshake" | "store" | "check" }
> = {
  manufacturer: {
    label: "Manufacturer",
    className: "bg-navy-100 text-navy-900 ring-navy-200",
    icon: "factory",
  },
  verified: {
    label: "Verified merchant",
    className: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    icon: "shield",
  },
  partner: {
    label: "Partner retailer",
    className: "bg-sky-50 text-sky-900 ring-sky-200",
    icon: "handshake",
  },
  marketplace: {
    label: "Marketplace",
    className: "bg-violet-50 text-violet-900 ring-violet-200",
    icon: "store",
  },
  approved: {
    label: "Approved source",
    className: "bg-surface text-navy-900 ring-border",
    icon: "check",
  },
};

function AuthorityIcon({
  kind,
}: {
  kind: (typeof KIND_META)[SourceAuthorityKind]["icon"];
}) {
  const common = {
    width: 11,
    height: 11,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    "aria-hidden": true as const,
    className: "shrink-0",
  };
  switch (kind) {
    case "factory":
      return (
        <svg {...common}>
          <path
            d="M2 13V7l3 2V5l4 2.5V4h5v9H2z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M8 2.5 3.5 4.5v3.2c0 2.8 1.9 4.8 4.5 5.8 2.6-1 4.5-3 4.5-5.8V4.5L8 2.5z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6.2 8.1 7.4 9.3 9.9 6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "handshake":
      return (
        <svg {...common}>
          <path
            d="M2.5 8.5 5 6l2 1.5L9.5 5.5 13.5 8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M5 11.5v-2M11 11.5v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "store":
      return (
        <svg {...common}>
          <path
            d="M2.5 6.5 4 3.5h8l1.5 3v1.5H2.5V6.5zM3.5 8v4.5h9V8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.5 8.2 7.2 9.8 10.6 6.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
  }
}

/** Distinct Manufacturer / Verified / Partner / Marketplace chip for offer cards. */
export function SourceAuthorityBadge({
  sourceType,
  sourceId,
  sourceName,
}: {
  sourceType: string;
  sourceId?: string;
  sourceName?: string;
}) {
  const kind = sourceAuthorityKind(sourceType, sourceId, sourceName ?? "Retailer");
  const meta = KIND_META[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.className}`}
    >
      <AuthorityIcon kind={meta.icon} />
      {meta.label}
    </span>
  );
}

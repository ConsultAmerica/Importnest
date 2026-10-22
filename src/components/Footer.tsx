import Link from "next/link";
import { AskAiNavButton } from "@/components/AskAiAgent";
import { BrandLink } from "@/components/BrandMark";
import { topNavLinks } from "@/lib/nav-menu";

/** Departments that read well as a footer list; Today's deals keeps its featured slot last. */
const SHOP_LINKS = topNavLinks.filter((l) =>
  ["Electronics", "Appliances", "Kitchen", "Home", "Footwear", "Today's deals"].includes(l.label),
);

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Shop", links: SHOP_LINKS },
  {
    title: "Your account",
    links: [
      { label: "Sign in or create account", href: "/login" },
      { label: "Saved products & alerts", href: "/saved" },
      { label: "Compare list", href: "/compare/list" },
      { label: "Cart", href: "/cart" },
    ],
  },
  {
    title: "How it works",
    links: [
      { label: "Using Importnest", href: "/how-to-use" },
      { label: "How ranking works", href: "/how-ranking-works" },
      { label: "Data freshness policy", href: "/data-freshness" },
      { label: "Report incorrect information", href: "/report-incorrect-information" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Affiliate disclosure", href: "/affiliate-disclosure" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-navy-900 text-white">
      <div className="footer-inner">
        <div className="footer-brand">
          <BrandLink onDark size="footer" className="footer-logo" />
          <p className="text-sm leading-relaxed text-white/70">
            Compare the real Total Known Cost — item, shipping and fees — across approved
            retailers before you buy.
          </p>
          <ul className="footer-trust" aria-label="What we promise">
            <li>Approved retailers only</li>
            <li>Sponsored results labeled</li>
            <li>No invented prices</li>
          </ul>
          <div className="footer-ask-ai">
            <AskAiNavButton />
            <span className="text-xs text-white/60">Questions about a product? Ask our assistant.</span>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">{col.title}</p>
              <ul className="space-y-2.5 text-sm text-white/80">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-cta">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Importnest · AI-powered shopping comparison</p>
        <p className="footer-disclosure">
          We may earn a commission when you buy through links. It never changes ranking.
        </p>
        <ul className="footer-legal">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="transition hover:text-cta">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

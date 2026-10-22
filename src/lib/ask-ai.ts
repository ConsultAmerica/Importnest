import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getBestDeals } from "@/lib/best-deals";
import { getSearchResults } from "@/lib/search-results";
import { productTypeFromQuery } from "@/lib/search-pills";

const MODEL = "claude-haiku-5-5";
export const ASK_AI_TIMEOUT_MS = 20_000;
/** Haiku 5.5 thinks by default and thinking counts toward max_tokens — leave headroom. */
export const ASK_AI_MAX_TOKENS = 2_000;
/** Older turns add cost without helping a shopping chat; the client may send more. */
export const ASK_AI_HISTORY_LIMIT = 12;

export const askAiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const askAiRequestSchema = z.object({
  messages: z.array(askAiMessageSchema).min(1).max(60),
  /** Optional page context — compare product id or category slug. */
  context: z
    .object({
      productId: z.string().optional(),
      productName: z.string().optional(),
      categorySlug: z.string().optional(),
      searchQuery: z.string().optional(),
    })
    .optional(),
});

export type AskAiMessage = z.infer<typeof askAiMessageSchema>;
export type AskAiProductHit = {
  id: string;
  brandName: string;
  productName: string;
  lowestTotalCost: number | null;
  offerCount: number;
  href: string;
};

export type AskAiReply = {
  answer: string;
  products: AskAiProductHit[];
  suggestedSearches: { label: string; href: string }[];
  /** claude = Anthropic; guided = local FAQ + catalog (no API key). */
  mode?: "claude" | "guided";
};

const SYSTEM_PROMPT = `You are Ask AI for Importnest — a transparent price-comparison site.

Rules (non-negotiable):
- Never invent prices, shipping, fees, warranties, stock, or retailer claims.
- Only cite Total Known Cost (item + disclosed shipping + fees − discounts) when it appears in CATALOG CONTEXT.
- If shipping is not disclosed in context, say so — never treat missing shipping as $0.
- Prefer helping shoppers search, compare, or understand Total Known Cost / filters.
- Keep answers concise (2–5 short paragraphs or bullets). Use plain language.
- When suggesting next steps, prefer Importnest paths like /search/results?q=… or /compare/{id}.
- If the catalog context is empty, explain how to search and do not fabricate products.

You may explain Importnest concepts: Total Known Cost, approved sources, price alerts, compare cart.`;

function lastUserText(messages: AskAiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content.trim();
  }
  return "";
}

/** Most recent turns only, starting on a user turn as the API requires. */
export function trimAskAiHistory(messages: AskAiMessage[]): AskAiMessage[] {
  const recent = messages.slice(-ASK_AI_HISTORY_LIMIT);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? recent : recent.slice(firstUser);
}

/** Catalog names often already start with the brand ("Aura Pure HEPA…") — don't print it twice. */
export function askAiProductLabel(p: { brandName: string; productName: string }): string {
  const brand = p.brandName.trim();
  const name = p.productName.trim();
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

type AskAiContext = {
  productId?: string;
  productName?: string;
  categorySlug?: string;
  searchQuery?: string;
};

/**
 * Follow-ups ("which one is quietest?") don't name a product, so searching the
 * last message alone finds nothing. Try the latest turn, then earlier shopper
 * turns, then whatever the page is showing.
 */
export function catalogQueryCandidates(messages: AskAiMessage[], context?: AskAiContext): string[] {
  const userTurns = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .reverse();
  const candidates = [
    ...userTurns.slice(0, 4),
    context?.searchQuery?.trim() ?? "",
    context?.productName?.trim() ?? "",
  ];
  const seen = new Set<string>();
  return candidates.filter((q) => {
    const key = q.toLowerCase();
    if (q.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function loadConversationCatalog(
  messages: AskAiMessage[],
  context?: AskAiContext,
): Promise<{ products: AskAiProductHit[]; query: string; fromEarlierContext: boolean }> {
  const candidates = catalogQueryCandidates(messages, context);
  const latest = lastUserText(messages);
  for (const query of candidates) {
    let products = await loadAskAiCatalogContext(query, context?.categorySlug);
    // Catalog search matches terms, not sentences — "Running shoes with free shipping"
    // finds nothing, but its product type ("running shoes") does.
    const type = products.length === 0 ? productTypeFromQuery(query) : null;
    if (type) products = await loadAskAiCatalogContext(type.q, context?.categorySlug);
    if (type && products.length === 0 && type.label.toLowerCase() !== type.q) {
      products = await loadAskAiCatalogContext(type.label, context?.categorySlug);
    }
    if (products.length > 0) {
      return {
        products,
        // Report the term that actually matched so follow-up links read "air purifier",
        // not the shopper's whole sentence.
        query: type ? type.q : query,
        fromEarlierContext: query.toLowerCase() !== latest.toLowerCase(),
      };
    }
  }
  if (context?.categorySlug) {
    const products = await loadAskAiCatalogContext("", context.categorySlug);
    return { products, query: latest, fromEarlierContext: products.length > 0 };
  }
  return { products: [], query: latest, fromEarlierContext: false };
}

/** Pull a few catalog rows so the model can cite real TKC — never invents. */
export async function loadAskAiCatalogContext(
  query: string,
  categorySlug?: string,
): Promise<AskAiProductHit[]> {
  const q = query.trim().slice(0, 120);
  if (q.length < 2 && !categorySlug) return [];

  try {
    const results = await getSearchResults({
      query: q || undefined,
      categorySlug: categorySlug || undefined,
      availableOnly: true,
      sort: "best_overall",
    });
    return results.products.slice(0, 5).map((p) => ({
      id: p.id,
      brandName: p.brandName,
      productName: p.productName,
      lowestTotalCost: p.lowestTotalCost,
      offerCount: p.offerCount,
      href: `/compare/${p.id}`,
    }));
  } catch (err) {
    console.warn("[ask-ai] catalog lookup failed:", err);
    return [];
  }
}

function formatCatalogBlock(products: AskAiProductHit[]): string {
  if (products.length === 0) {
    return "CATALOG CONTEXT: (no matching approved products found for this query)";
  }
  const lines = products.map((p, i) => {
    const tkc =
      p.lowestTotalCost != null
        ? `lowest Total Known Cost $${p.lowestTotalCost.toFixed(2)}`
        : "Total Known Cost unavailable";
    return `${i + 1}. ${askAiProductLabel(p)} — ${tkc}, ${p.offerCount} offer(s), link ${p.href}`;
  });
  return `CATALOG CONTEXT (approved sources only):\n${lines.join("\n")}`;
}

export function suggestedSearchesFromQuery(query: string): { label: string; href: string }[] {
  const q = query.trim();
  if (!q) {
    return [
      {
        label: "Best air purifiers under $250",
        href: `/search/results?q=${encodeURIComponent("Best air purifiers under $250")}`,
      },
      {
        label: "Quiet bedroom humidifiers",
        href: `/search/results?q=${encodeURIComponent("Quiet bedroom humidifiers")}`,
      },
      { label: "Open search", href: "/search" },
    ];
  }
  return [
    { label: `Search “${q.slice(0, 48)}”`, href: `/search/results?q=${encodeURIComponent(q)}` },
    {
      label: "Lowest total cost first",
      href: `/search/results?q=${encodeURIComponent(q)}&sort=lowest_cost`,
    },
    { label: "Open search", href: "/search" },
  ];
}

type SuggestedSearch = { label: string; href: string };

const FAQ_REPLIES: {
  test: RegExp;
  answer: string;
  /** Links that reuse the shopper's earlier product search, when there is one. */
  searches?: (earlierQuery: string) => SuggestedSearch[];
}[] = [
  {
    test: /\b(good (price|deal)|worth (it|buying)|fair price|price history|should i (buy|wait)|wait for)\b/i,
    answer:
      "Open the product’s compare page and check the price history chart — it plots stored Total Known Cost over time, so you can see whether today’s price is low for that product.\n\nNot ready to buy? Save it and set a price alert; we’ll tell you when the total drops.",
  },
  {
    test: /\bsave money\b|\bhow\b.*\b(lowest|cheapest|best price)\b/i,
    answer:
      "Sort results by “Total cost: Low to high”. That ranks by item + disclosed shipping + fees, so a cheap sticker price with expensive shipping doesn’t win.\n\nAdd the Free shipping filter, and set a price alert on anything you’re watching.",
    searches: (q) => [
      { label: "Lowest total cost first", href: `/search/results?${q ? `q=${encodeURIComponent(q)}&` : ""}sort=lowest_cost` },
      { label: "Free shipping only", href: `/search/results?${q ? `q=${encodeURIComponent(q)}&` : ""}freeShipping=1` },
    ],
  },
  {
    test: /\b(returns?|refunds?|warrant(y|ies)|guarantee)\b/i,
    answer:
      "Returns, refunds and warranties are handled by the retailer you buy from. Importnest shows condition and protection details only when the listing discloses them.\n\nCheck the retailer’s policy on their site before checkout.",
  },
  {
    test: /\b(buy (here|directly|from you|on importnest)|checkout|check out|how (do i|to|can i) (buy|order|purchase)|place an order)\b/i,
    answer:
      "Importnest compares offers; checkout happens on the retailer’s own site. Pick an offer on the compare page and we send you to that retailer through a tracked link.\n\nYour cart here is a shortlist to compare totals before you go.",
  },
  {
    test: /\b(sponsored|advert|ads?|paid placement|affiliate|commission)\b/i,
    answer:
      "Sponsored offers are labeled and shown separately — they never change organic ranking.\n\nWe may earn a commission when you buy through a link, which also doesn’t affect ranking. Details are on the affiliate disclosure page.",
  },
  {
    test: /\b(how (often|recent)|up to date|fresh(ness)?|last (checked|updated)|stale)\b/i,
    answer:
      "Every product card shows when its prices were last checked. Prices are refreshed from approved sources on a schedule, and older data gets a visible warning plus a refresh button.\n\nSee the data freshness policy for the full schedule.",
  },
  {
    test: /\b(total known cost|tkc|what.*(cost|price).*include|item \+ shipping)\b/i,
    answer:
      "Total Known Cost (TKC) is the amount Importnest can verify from approved listings: item price + disclosed shipping + fees − discounts.\n\nIf shipping isn’t disclosed, we leave it blank — we never treat missing shipping as $0. Open any compare page to see the breakdown per retailer.",
  },
  {
    test: /\b(price alert|track(ing)? (price|cost)|notify|notification)\b/i,
    answer:
      "Price alerts watch Total Known Cost on products you save. Sign in, open a compare page or Saved, then set an alert for a target TKC or % drop.\n\nAlerts use real stored prices from approved sources — not invented estimates.",
  },
  {
    test: /\b(approved (source|retailer)|which (stores|retailers)|trust(ed)? source)\b/i,
    answer:
      "Importnest only ranks offers from approved retailers. That keeps Total Known Cost honest and avoids open-web marketplace noise.\n\nYou’ll see the approved-sources strip on the homepage; every compare page lists which sources contributed offers.",
  },
  {
    test: /\b(how (do )?you rank|ranking|best overall|sort)\b/i,
    answer:
      "Default ranking favors lower Total Known Cost among available approved offers, with penalties when shipping or fees are incomplete.\n\nOn results you can sort by lowest TKC, best overall, and other filters — none invent prices.",
  },
  {
    test: /\b(how (do i |to |can i )?compare|compare (cart|list|these|them)|comparison works?)\b/i,
    answer:
      "Use + Compare on product cards to build a shortlist, then open Compare to stack Total Known Cost side by side.\n\nEach offer shows item vs shipping when disclosed, and links out only through Importnest’s referral path.",
  },
  {
    // Only shipping *questions* — "Running shoes with free shipping" is a product search.
    test: /^(?=.*\b(shipping|delivery)\b)(?=.*\b(is|are|does|do|how|what|any|which)\b)/i,
    answer:
      "Shipping only counts in Total Known Cost when the approved source discloses it. Missing shipping stays unknown — never assumed free or $0.\n\nFilter results for free shipping when retailers mark it explicitly.",
    searches: (q) => [
      {
        label: q ? `Free shipping: “${q.slice(0, 40)}”` : "Free shipping only",
        href: `/search/results?${q ? `q=${encodeURIComponent(q)}&` : ""}freeShipping=1`,
      },
    ],
  },
];

function matchFaq(query: string) {
  return FAQ_REPLIES.find((faq) => faq.test.test(query)) ?? null;
}

/** "What are today's deals?" — answered from real price-drop history, not search text. */
const DEALS_QUERY =
  /\b(today['’]?s|best|top|latest|any|current|biggest)\s+(deals?|discounts?|price drops?|savings)\b|^\s*(deals?|price drops?)\s*\??\s*$/i;

/** Follow-ups asking to re-rank what we already found by price. */
const CHEAPER_QUERY =
  /\b(cheaper|cheapest|lowest price|less expensive|lower (price|cost)|on a budget)\b/i;

const SMALL_TALK: { test: RegExp; answer: string }[] = [
  {
    test: /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b[\s!.,]*$/i,
    answer:
      "Hi! Tell me what you’re shopping for — a product type, brand, or budget (e.g. “air purifiers under $250”) — and I’ll pull matching approved offers with their Total Known Cost.",
  },
  {
    test: /^\s*(thanks|thank you|thx|cheers|great|perfect|ok(ay)?)\b[\s!.,]*$/i,
    answer:
      "You’re welcome! Open any product to compare retailers side by side, or set a price alert to hear when Total Known Cost drops.",
  },
];

/** Questions that ask us to rank on a spec we may not store (noise, battery, size…). */
const SPEC_FOLLOW_UP =
  /\b(which|what)\b.*\b(one|best|quiet(est)?|loud|cheapest|biggest|smallest|lightest|fastest|better|recommend)\b|\b(quiet(est)?|noise|battery|coverage|size|weight)\b/i;

/**
 * Local Ask AI when Anthropic isn’t configured: FAQs + real catalog hits only.
 * Never invents prices.
 */
export async function askAiGuided(input: {
  messages: AskAiMessage[];
  context?: AskAiContext;
}): Promise<AskAiReply> {
  const userText = lastUserText(input.messages);

  const smallTalk = SMALL_TALK.find((t) => t.test.test(userText));
  if (smallTalk) {
    return {
      answer: smallTalk.answer,
      products: [],
      suggestedSearches: suggestedSearchesFromQuery(input.context?.searchQuery ?? ""),
      mode: "guided",
    };
  }

  // The shopper's most recent product search before this message, for follow-up links.
  const earlierQuery =
    catalogQueryCandidates(input.messages, input.context).find(
      (q) => q.toLowerCase() !== userText.toLowerCase(),
    ) ?? "";

  const faq = matchFaq(userText);
  if (faq) {
    return {
      answer: faq.answer,
      products: [],
      suggestedSearches:
        faq.searches?.(earlierQuery) ??
        suggestedSearchesFromQuery(
          /air purifier|humidifier|shoe|laptop|phone/i.test(userText) ? userText : "",
        ),
      mode: "guided",
    };
  }

  if (DEALS_QUERY.test(userText)) {
    const deals = await getBestDeals(3, new Set(), input.context?.categorySlug);
    if (deals.length > 0) {
      const products: AskAiProductHit[] = deals.map((d) => ({
        id: d.productId,
        brandName: d.brandName,
        productName: d.productName,
        lowestTotalCost: d.currentTotal,
        offerCount: d.offerCount,
        href: `/compare/${d.productId}`,
      }));
      const lines = deals.map(
        (d) =>
          `• ${askAiProductLabel(d)} — $${d.currentTotal.toFixed(2)} TKC${
            d.discountPercent ? `, ${d.discountPercent}% below its previous tracked total` : ""
          }`,
      );
      return {
        answer: `Today’s best deals from approved retailers:\n\n${lines.join("\n")}\n\nDrops are measured against stored price history, never invented “was” prices.`,
        products,
        suggestedSearches: [
          { label: "All deals, lowest total first", href: "/search/results?sort=lowest_cost" },
          { label: "Free shipping deals", href: "/search/results?freeShipping=1&sort=lowest_cost" },
        ],
        mode: "guided",
      };
    }
  }

  const { products: found, query, fromEarlierContext } = await loadConversationCatalog(
    input.messages,
    input.context,
  );
  const wantsCheaper = CHEAPER_QUERY.test(userText);
  // "Cheapest options for “X”" can match the catalog as a whole sentence — show X, not the sentence.
  const shownQuery =
    wantsCheaper && query.toLowerCase() === userText.toLowerCase()
      ? input.context?.searchQuery?.trim() || earlierQuery || query
      : query;
  const products = wantsCheaper
    ? [...found].sort(
        (a, b) => (a.lowestTotalCost ?? Infinity) - (b.lowestTotalCost ?? Infinity),
      )
    : found;

  if (products.length > 0) {
    const lines = products.slice(0, 3).map((p) => {
      const tkc =
        p.lowestTotalCost != null
          ? `from $${p.lowestTotalCost.toFixed(2)} TKC`
          : "TKC unavailable";
      return `• ${askAiProductLabel(p)} — ${tkc}, ${p.offerCount} offer${p.offerCount === 1 ? "" : "s"}`;
    });
    const intro = wantsCheaper
      ? `Lowest Total Known Cost first for “${shownQuery.slice(0, 80)}”:`
      : fromEarlierContext
        ? `Going by “${query.slice(0, 80)}”, here’s what the approved catalog has:`
        : `Here are approved-catalog matches for “${query.slice(0, 80)}”:`;
    const outro =
      fromEarlierContext && !wantsCheaper && SPEC_FOLLOW_UP.test(userText)
        ? "I can only compare details that retailers disclose, so I won’t guess at specs. Open a product to see its listed specs and every retailer’s Total Known Cost side by side."
        : "Open a product to compare Total Known Cost by retailer. Prices are from stored listings, not estimates.";
    return {
      answer: `${intro}\n\n${lines.join("\n")}\n\n${outro}`,
      products,
      suggestedSearches: suggestedSearchesFromQuery(shownQuery),
      mode: "guided",
    };
  }

  if (input.context?.productId) {
    return {
      answer: `You’re on a compare page${
        input.context.productName ? ` for ${input.context.productName}` : ""
      }. Use the offer table for Total Known Cost by retailer, or search for a similar product below.`,
      products: [],
      suggestedSearches: suggestedSearchesFromQuery(
        input.context.productName ?? input.context.searchQuery ?? "",
      ),
      mode: "guided",
    };
  }

  return {
    answer:
      "I couldn’t find matching approved offers for that yet. Try a product type, brand, or budget (e.g. “air purifiers under $250”). Search uses the same catalog prices as comparison pages.",
    products: [],
    suggestedSearches: suggestedSearchesFromQuery(""),
    mode: "guided",
  };
}

export type AskAiOutcome =
  | { status: "ok"; reply: AskAiReply }
  | {
      status: "unavailable";
      reason: "missing_key" | "service_error" | "invalid_request";
      message: string;
      /** Dev-only setup note — never shown as the primary shopper-facing copy. */
      setupHint?: string;
    };

export function isAskAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Always true — Claude when keyed, otherwise guided catalog mode. */
export function isAskAiAvailable(): boolean {
  return true;
}

export type AskAiMode = "claude" | "guided";

export function getAskAiMode(): AskAiMode {
  return isAskAiConfigured() ? "claude" : "guided";
}

/** Shopper-facing copy when Claude is not wired up (legacy; guided mode supersedes). */
export const ASK_AI_UNAVAILABLE_MESSAGE =
  "Chat is unavailable right now. Try a natural-language search below — same approved catalog prices.";

export const ASK_AI_SETUP_HINT =
  "Dev: add ANTHROPIC_API_KEY to .env and restart the server for full Claude answers.";

export const ASK_AI_GUIDED_WELCOME =
  "Hi — I’m Ask AI for Importnest. Ask about Total Known Cost, alerts, or products to compare. I’ll only cite prices from approved catalog offers.";

/**
 * Catalog-grounded Ask AI turn. Never throws. Never invents listing prices.
 * Uses Claude when ANTHROPIC_API_KEY is set; otherwise guided local answers.
 */
export async function askAi(input: {
  messages: AskAiMessage[];
  context?: {
    productId?: string;
    productName?: string;
    categorySlug?: string;
    searchQuery?: string;
  };
}): Promise<AskAiOutcome> {
  const parsed = askAiRequestSchema.safeParse({
    messages: input.messages,
    context: input.context,
  });
  if (!parsed.success) {
    return {
      status: "unavailable",
      reason: "invalid_request",
      message: "That message could not be processed. Try a shorter shopping question.",
    };
  }

  const history = trimAskAiHistory(parsed.data.messages);

  if (!isAskAiConfigured()) {
    const reply = await askAiGuided({ messages: history, context: parsed.data.context });
    return { status: "ok", reply };
  }

  const userText = lastUserText(history);
  const { products, query: catalogQuery } = await loadConversationCatalog(
    history,
    parsed.data.context,
  );
  const pageHint = parsed.data.context?.productName
    ? `Page context: viewing ${parsed.data.context.productName}${
        parsed.data.context.productId ? ` (/compare/${parsed.data.context.productId})` : ""
      }.`
    : parsed.data.context?.categorySlug
      ? `Page context: browsing category ${parsed.data.context.categorySlug}.`
      : parsed.data.context?.searchQuery
        ? `Page context: search query “${parsed.data.context.searchQuery}”.`
        : "";

  try {
    const client = new Anthropic();
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: ASK_AI_MAX_TOKENS,
        // Short shopping answers — low effort keeps the chat responsive.
        output_config: { effort: "low" },
        // Stable rules first (cacheable), per-turn catalog grounding after.
        system: [
          { type: "text", text: SYSTEM_PROMPT },
          { type: "text", text: [pageHint, formatCatalogBlock(products)].filter(Boolean).join("\n\n") },
        ],
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      },
      { timeout: ASK_AI_TIMEOUT_MS, maxRetries: 1 },
    );

    if (response.stop_reason === "refusal") {
      return {
        status: "unavailable",
        reason: "service_error",
        message: "Ask AI declined that request. Try a product or shopping question.",
      };
    }

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!answer) {
      console.warn("[ask-ai] empty answer, stop_reason:", response.stop_reason);
      const reply = await askAiGuided({ messages: history, context: parsed.data.context });
      return { status: "ok", reply };
    }

    return {
      status: "ok",
      reply: {
        answer,
        products,
        suggestedSearches: suggestedSearchesFromQuery(catalogQuery || userText),
        mode: "claude",
      },
    };
  } catch (err) {
    console.warn("[ask-ai] Claude failed; falling back to guided mode:", err);
    const reply = await askAiGuided({ messages: history, context: parsed.data.context });
    return { status: "ok", reply };
  }
}

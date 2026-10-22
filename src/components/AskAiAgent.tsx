"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  setupHint?: string;
  /** Transport/service failures stay visible but are never sent back as chat history. */
  isError?: boolean;
  products?: {
    id: string;
    brandName: string;
    productName: string;
    lowestTotalCost: number | null;
    offerCount: number;
    href: string;
  }[];
  suggestedSearches?: { label: string; href: string }[];
};

type QuestionGroup = { title: string; questions: string[] };

const STARTER_GROUPS: QuestionGroup[] = [
  {
    title: "Find a product",
    questions: [
      "Best air purifiers under $250",
      "Quiet bedroom humidifiers",
      "Running shoes with free shipping",
      "Best laptop for university",
    ],
  },
  {
    title: "Save money",
    questions: [
      "What are today’s best deals?",
      "How do I find the lowest total cost?",
      "Is shipping included in prices?",
    ],
  },
  {
    title: "How Importnest works",
    questions: [
      "What is Total Known Cost?",
      "How do price alerts work?",
      "How do you rank results?",
      "Which retailers do you use?",
      "Can I buy directly on Importnest?",
    ],
  },
];

/** Questions tied to what the shopper is looking at right now. */
function pageQuestions(pathname: string, searchParams: URLSearchParams): string[] {
  const q = searchParams.get("q")?.trim();
  if (pathname.startsWith("/compare/") && pathname !== "/compare/list") {
    return [
      "Is this a good price right now?",
      "What does the total cost include?",
      "How do I set a price alert?",
      "Who handles returns and warranty?",
    ];
  }
  if (pathname.startsWith("/search") && q) {
    const short = q.length > 40 ? `${q.slice(0, 40)}…` : q;
    return [`Cheapest options for “${short}”`, "Any with free shipping?", "Which one is the best value?"];
  }
  if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) {
    return ["Can I buy directly on Importnest?", "Is shipping included in prices?"];
  }
  if (pathname.startsWith("/saved")) {
    return ["How do price alerts work?", "Is this a good price right now?"];
  }
  return [];
}

/** Next questions after an answer — product answers get product follow-ups. */
function followUpQuestions(last: ChatMessage, lastUserText: string): string[] {
  const options =
    last.products && last.products.length > 0
      ? [
          "Show cheaper options",
          "Any with free shipping?",
          "Which one is the best value?",
          "Is this a good price right now?",
        ]
      : ["What are today’s best deals?", "How do I find the lowest total cost?", "Which retailers do you use?"];
  return options.filter((q) => q.toLowerCase() !== lastUserText.toLowerCase()).slice(0, 3);
}

const FALLBACK_SEARCHES = [
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

export const ASK_AI_OPEN_EVENT = "importnest:ask-ai-open";

/** Mirrors the server's ASK_AI_HISTORY_LIMIT so long chats never fail validation. */
const HISTORY_LIMIT = 12;

const WELCOME_TEXT =
  "Hi — I’m Ask AI for Importnest. Ask about Total Known Cost, alerts, or products to compare. I’ll only cite prices from approved catalog offers.";

/** Catalog names often already include the brand — avoid "Aura Pure Aura Pure …". */
function productLabel(p: { brandName: string; productName: string }) {
  return p.productName.toLowerCase().startsWith(p.brandName.toLowerCase())
    ? p.productName
    : `${p.brandName} ${p.productName}`;
}

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.5l1.4 5.2L18.5 9 13.4 10.3 12 15.5l-1.4-5.2L5.5 9l5.1-1.3L12 2.5z" />
      <path d="M18.5 14.5l.7 2.5 2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7.7-2.5z" opacity=".85" />
    </svg>
  );
}

function pageContextFromLocation(pathname: string, searchParams: URLSearchParams) {
  const compareMatch = pathname.match(/^\/compare\/([^/]+)/);
  const searchQuery = searchParams.get("q")?.trim() || undefined;
  const category = searchParams.get("category") ?? undefined;

  if (compareMatch) {
    return {
      productId: compareMatch[1],
      searchQuery,
      categorySlug: category,
    };
  }
  if (pathname.startsWith("/search")) {
    return { categorySlug: category, searchQuery };
  }
  return searchQuery ? { searchQuery } : {};
}

function AskAiAgentInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"claude" | "guided" | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: WELCOME_TEXT },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const statusLoaded = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ask-ai");
      const data = (await res.json()) as {
        mode?: "claude" | "guided";
        welcome?: string;
        setupHint?: string | null;
        suggestedSearches?: { label: string; href: string }[];
      };
      setMode(data.mode === "claude" ? "claude" : "guided");
      if (data.welcome) {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: data.welcome,
            setupHint: data.setupHint ?? undefined,
            suggestedSearches: data.suggestedSearches,
          },
        ]);
      }
    } catch {
      setMode("guided");
    } finally {
      statusLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(ASK_AI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASK_AI_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open || statusLoaded.current) return;
    void loadStatus();
  }, [open, loadStatus]);

  useEffect(() => {
    // Keep the welcome message in view until the conversation actually starts.
    if (!open || (messages.length <= 1 && !busy)) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy, showMore]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setShowMore(false);
      setBusy(true);
      setOpen(true);

      try {
        const turns = [...messages, userMsg].filter((m) => m.id !== "welcome" && !m.isError);
        let history = turns.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }));
        const firstUser = history.findIndex((m) => m.role === "user");
        history = firstUser > 0 ? history.slice(firstUser) : history;

        const res = await fetch("/api/ask-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.length > 0 ? history : [{ role: "user", content: trimmed }],
            context: pageContextFromLocation(pathname, searchParams),
          }),
        });

        const data = (await res.json()) as {
          answer?: string;
          error?: string;
          setupHint?: string | null;
          mode?: "claude" | "guided";
          products?: ChatMessage["products"];
          suggestedSearches?: ChatMessage["suggestedSearches"];
        };

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: data.error ?? "Ask AI couldn’t answer that. Try search instead.",
              setupHint: data.setupHint ?? undefined,
              isError: true,
              suggestedSearches: data.suggestedSearches ?? FALLBACK_SEARCHES,
            },
          ]);
          return;
        }

        if (data.mode === "claude" || data.mode === "guided") setMode(data.mode);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.answer ?? "No answer returned.",
            products: data.products,
            suggestedSearches: data.suggestedSearches,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Couldn’t reach Ask AI. You can still search Importnest from the header.",
            suggestedSearches: FALLBACK_SEARCHES,
            isError: true,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, pathname, searchParams],
  );

  const showStarters = messages.length === 1 && !busy;
  const canReset = messages.length > 1 && !busy;
  const pageGroup: QuestionGroup[] = (() => {
    const questions = pageQuestions(pathname, searchParams);
    return questions.length > 0 ? [{ title: "Suggested for this page", questions }] : [];
  })();
  const questionGroups = [...pageGroup, ...STARTER_GROUPS];
  const lastMessage = messages[messages.length - 1];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const followUps =
    !busy && messages.length > 1 && lastMessage?.role === "assistant"
      ? followUpQuestions(lastMessage, lastUser)
      : [];

  return (
    <>
      <button
        type="button"
        className="ask-ai-fab"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        aria-label={open ? "Close Ask AI" : "Ask AI"}
        title="Ask AI"
        onClick={() => setOpen((v) => !v)}
      >
        <SparkleIcon />
        <span className="sr-only">Ask AI</span>
      </button>

      {open ? (
        <section className="ask-ai-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header className="ask-ai-panel-header">
            <div>
              <h2 id={titleId} className="text-sm font-bold text-navy-900">
                Ask AI
              </h2>
              <p className="text-[11px] text-muted">
                {mode ? "Answers from approved catalog prices" : "Loading…"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {canReset ? (
                <button
                  type="button"
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-surface"
                  onClick={() => {
                    setMessages([{ id: "welcome", role: "assistant", content: WELCOME_TEXT }]);
                    inputRef.current?.focus();
                  }}
                >
                  New chat
                </button>
              ) : null}
              <button
                type="button"
                className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </header>

          <div ref={listRef} className="ask-ai-messages" aria-live="polite">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`ask-ai-bubble ${m.role === "user" ? "ask-ai-bubble-user" : "ask-ai-bubble-assistant"}`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                {m.setupHint ? <p className="ask-ai-setup-hint mt-2">{m.setupHint}</p> : null}
                {m.products && m.products.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {m.products.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={p.href}
                          className="block rounded-xl border border-border bg-white/80 px-2.5 py-2 text-xs hover:border-accent"
                          onClick={() => setOpen(false)}
                        >
                          <span className="font-semibold text-navy-900">{productLabel(p)}</span>
                          <span className="mt-0.5 block text-muted">
                            {p.lowestTotalCost != null
                              ? `From $${p.lowestTotalCost.toFixed(2)} TKC · ${p.offerCount} offer${p.offerCount === 1 ? "" : "s"}`
                              : `${p.offerCount} offer${p.offerCount === 1 ? "" : "s"} · TKC unavailable`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.suggestedSearches && m.suggestedSearches.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestedSearches.map((s) => (
                      <li key={s.href + s.label}>
                        <Link href={s.href} className="ask-ai-chip" onClick={() => setOpen(false)}>
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}

            {followUps.length > 0 && !showMore ? (
              <div className="ask-ai-followups">
                <p className="ask-ai-group-title">Ask next</p>
                <ul className="flex flex-wrap gap-1.5">
                  {followUps.map((label) => (
                    <li key={label}>
                      <button type="button" className="ask-ai-chip ask-ai-chip-question" onClick={() => void send(label)}>
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showStarters || showMore ? (
              <div className="ask-ai-question-groups">
                {questionGroups.map((group) => (
                  <section key={group.title} aria-label={group.title}>
                    <p className="ask-ai-group-title">{group.title}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.questions.map((label) => (
                        <li key={label}>
                          <button
                            type="button"
                            className="ask-ai-chip ask-ai-chip-question"
                            disabled={busy}
                            onClick={() => void send(label)}
                          >
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}

            {busy ? (
              <p className="ask-ai-bubble ask-ai-bubble-assistant ask-ai-typing text-sm text-muted" role="status">
                <span className="ask-ai-typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                Checking approved offers…
              </p>
            ) : null}
          </div>

          {!showStarters ? (
            <button
              type="button"
              className="ask-ai-more-toggle"
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
            >
              {showMore ? "Hide question ideas" : "More questions"}
            </button>
          ) : null}

          <form
            className="ask-ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Ask Importnest AI
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about TKC, alerts, or a product…"
              className="ask-ai-input"
              disabled={busy}
              autoComplete="off"
            />
            <button type="submit" className="btn-cta shrink-0 px-4 py-2 text-sm" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

/** Suspense boundary required for useSearchParams in the app router. */
export function AskAiAgent() {
  return (
    <Suspense fallback={null}>
      <AskAiAgentInner />
    </Suspense>
  );
}

/** Companion CTA beside the search bar — opens the Ask AI panel. */
export function AskAiNavButton() {
  return (
    <button
      type="button"
      className="ask-ai-header-cta"
      onClick={() => window.dispatchEvent(new Event(ASK_AI_OPEN_EVENT))}
      aria-label="Ask AI shopping assistant"
    >
      <SparkleIcon />
      <span className="ask-ai-header-cta-label">Ask AI</span>
    </button>
  );
}

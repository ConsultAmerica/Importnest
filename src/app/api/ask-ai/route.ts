import { NextRequest, NextResponse } from "next/server";
import {
  askAi,
  askAiRequestSchema,
  getAskAiMode,
  ASK_AI_GUIDED_WELCOME,
  ASK_AI_SETUP_HINT,
  suggestedSearchesFromQuery,
} from "@/lib/ask-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Lightweight status for the Ask AI panel. */
export async function GET() {
  const mode = getAskAiMode();
  return NextResponse.json({
    configured: true,
    mode,
    welcome: ASK_AI_GUIDED_WELCOME,
    setupHint: mode === "guided" && process.env.NODE_ENV === "development" ? ASK_AI_SETUP_HINT : null,
    suggestedSearches: suggestedSearchesFromQuery(""),
  });
}

/**
 * Ask AI agent — catalog-grounded shopping help.
 * POST { messages: [{ role, content }], context?: { productId, productName, categorySlug, searchQuery } }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = askAiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const outcome = await askAi(parsed.data);
  if (outcome.status !== "ok") {
    const status =
      outcome.reason === "missing_key" ? 503 : outcome.reason === "invalid_request" ? 400 : 502;
    return NextResponse.json(
      {
        error: outcome.message,
        reason: outcome.reason,
        setupHint: outcome.setupHint ?? null,
        suggestedSearches: suggestedSearchesFromQuery(""),
      },
      { status },
    );
  }

  return NextResponse.json(outcome.reply);
}

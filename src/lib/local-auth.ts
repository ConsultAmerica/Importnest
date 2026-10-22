import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const LOCAL_SESSION_COOKIE = "importnest_session";

type SessionPayload = {
  id: string;
  email: string;
  exp: number;
};

function secret() {
  return process.env.AUTH_SECRET || "importnest-local-session";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function signSession(payload: Omit<SessionPayload, "exp">, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const body: SessionPayload = { ...payload, exp: Date.now() + maxAgeSeconds * 1000 };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function readSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.email || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isAuthOffline(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /fetch|network|enotfound|failed to fetch|authretryable|timeout/i.test(message);
}

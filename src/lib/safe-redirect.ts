/**
 * Post-login destinations must stay on this site. A bare `startsWith("/")`
 * check lets `//evil.example` or `/\evil.example` through — browsers treat both
 * as protocol-relative URLs to another host.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/saved"): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  // Control characters (tabs/newlines) are stripped by URL parsers and can smuggle "//".
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  return trimmed;
}

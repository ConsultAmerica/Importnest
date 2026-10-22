import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/compare/abc?x=1")).toBe("/compare/abc?x=1");
  });

  it("falls back for missing or relative values", () => {
    expect(safeNextPath(null)).toBe("/saved");
    expect(safeNextPath("saved")).toBe("/saved");
    expect(safeNextPath("https://evil.example")).toBe("/saved");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNextPath("//evil.example")).toBe("/saved");
    expect(safeNextPath("/\\evil.example")).toBe("/saved");
    expect(safeNextPath("/\t/evil.example")).toBe("/saved");
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE SPEND LAW (Andy, 2026-09-02): any spend of coins requires confirmation.
 * The only code that lowers the wallet is the confirm gate in ui/spend.ts.
 * Anything else that writes `coins -=`, `coins = `, or `coins--` is a spend
 * that skipped the sheet, and this test is how it gets caught.
 */
const SRC = new URL("../", import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });

describe("the spend law", () => {
  const files = walk(SRC);
  it("has sources to check", () => { expect(files.length).toBeGreaterThan(20); });

  it("lowers the wallet in ui/spend.ts and nowhere else", () => {
    const lowering = /\.coins\s*(-=|--|=\s*[^=])/;
    for (const f of files) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      if (f.endsWith("/ui/spend.ts")) { expect(src).toMatch(lowering); continue; }
      expect(src, `${f} lowers coins outside the confirm gate`).not.toMatch(lowering);
    }
  });

  it("only ever takes coins from inside the sheet's confirm", () => {
    const src = readFileSync(join(SRC, "ui/spend.ts"), "utf8");
    const at = src.indexOf("coins -=");
    expect(at).toBeGreaterThan(0);
    // The deduction sits inside onConfirm, after the affordability re-check.
    const before = src.slice(0, at);
    expect(before.lastIndexOf("onConfirm")).toBeGreaterThan(before.lastIndexOf("cancel:"));
    expect(before.slice(before.lastIndexOf("onConfirm"))).toContain("< opts.cost) return");
  });
});

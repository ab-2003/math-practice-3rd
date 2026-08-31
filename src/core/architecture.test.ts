import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE = new URL("./", import.meta.url).pathname;
const sources = readdirSync(CORE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("the dependency rule", () => {
  it("has core files to check", () => {
    // A spec with a silent skip guard can assert nothing forever.
    expect(sources.length).toBeGreaterThan(4);
  });

  it("never lets the model import the view", () => {
    // The moment core/ can touch the DOM, core/ stops being testable, and the
    // scheduler is the part that has to be provably right.
    for (const f of sources) {
      const src = readFileSync(join(CORE, f), "utf8");
      expect(src, f).not.toMatch(/from\s+["']\.\.\/ui/);
    }
  });

  it("keeps the browser out of core, except the one sanctioned clock", () => {
    for (const f of sources) {
      if (f === "clock.ts") continue; // the single sanctioned use of Date
      const src = readFileSync(join(CORE, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      for (const banned of ["document", "window", "localStorage", "indexedDB", "new Date"]) {
        expect(src, `${f} must not reference ${banned}`).not.toContain(banned);
      }
    }
  });
});

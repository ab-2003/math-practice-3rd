import { describe, expect, it } from "vitest";
import { buildDeck } from "./facts";
import { DEFAULT_MISSING, presentFact, type MissingCfg } from "./present";

const deck = buildDeck();
const facts = [...deck.values()];
const allOn: MissingCfg = { add: true, sub: true, mul: true, div: true, pct: 100 };

describe("presentation", () => {
  it("is standard for every fact when missing number is off (the default)", () => {
    for (const f of facts) {
      for (const salt of [0, 1, 17, 999]) {
        expect(presentFact(f, salt, DEFAULT_MISSING).format).toBe("standard");
      }
    }
  });

  it("is deterministic: the same fact and salt always present the same way", () => {
    for (const f of facts.slice(0, 40)) {
      const x = presentFact(f, 12, allOn);
      const y = presentFact(f, 12, allOn);
      expect(y).toEqual(x);
    }
  });

  it("keeps the displayed operands equal to the fact's own operands", () => {
    for (const f of facts) {
      const p = presentFact(f, 3, allOn);
      expect([p.a, p.b].sort((m, n) => m - n)).toEqual([f.a, f.b].sort((m, n) => m - n));
    }
  });

  it("never reorders subtraction or division, which are not commutative", () => {
    for (const f of facts) {
      if (f.kind !== "sub" && f.kind !== "div") continue;
      for (const salt of [0, 1, 2, 3, 9]) {
        const p = presentFact(f, salt, allOn);
        expect(p.a).toBe(f.a);
        expect(p.b).toBe(f.b);
      }
    }
  });

  it("at 100 percent, an enabled kind always presents as missing", () => {
    for (const f of facts.slice(0, 60)) {
      expect(presentFact(f, 5, allOn).format).toBe("missing");
    }
  });

  it("blanks an operand and expects exactly that operand, never the result", () => {
    for (const f of facts) {
      const p = presentFact(f, 7, allOn);
      expect(p.blank === "a" || p.blank === "b").toBe(true);
      expect(p.expected).toBe(p.blank === "a" ? p.a : p.b);
      expect(p.result).toBe(f.answer);
    }
  });

  it("the revealed equation is still true with the expected value in the blank", () => {
    // The whole feature is wrong if this ever fails: what he types must make
    // the equation on the screen a true sentence.
    for (const f of facts) {
      for (const salt of [1, 8, 33]) {
        const p = presentFact(f, salt, allOn);
        if (p.format !== "missing") continue;
        const a = p.blank === "a" ? p.expected : p.a;
        const b = p.blank === "b" ? p.expected : p.b;
        const lhs = f.kind === "add" ? a + b : f.kind === "sub" ? a - b : f.kind === "mul" ? a * b : a / b;
        expect(lhs, `${f.id} salt ${salt}`).toBe(p.result);
      }
    }
  });

  it("respects the kind switches independently", () => {
    const onlyMul: MissingCfg = { add: false, sub: false, mul: true, div: false, pct: 100 };
    for (const f of facts.slice(0, 200)) {
      const p = presentFact(f, 4, onlyMul);
      expect(p.format).toBe(f.kind === "mul" ? "missing" : "standard");
    }
  });

  it("mixes at roughly the configured percentage", () => {
    const cfg: MissingCfg = { ...allOn, pct: 20 };
    let missing = 0;
    const N = 4000;
    const f = deck.get("add:7+8")!;
    for (let salt = 0; salt < N; salt++) {
      if (presentFact(f, salt, cfg).format === "missing") missing += 1;
    }
    const share = missing / N;
    expect(share).toBeGreaterThan(0.12);
    expect(share).toBeLessThan(0.30);
  });
});

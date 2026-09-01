/**
 * HOW A FACT APPEARS ON THE GLASS.
 *
 * Two formats. STANDARD asks `a + b = ?`. MISSING NUMBER blanks one operand
 * instead: `7 + _ = 15`, and he types the operand. Missing number was chosen
 * over Andy's floated multiple-choice (DESIGN.md 3b) because it is still
 * TYPED PRODUCTION: the first-digit clock, the classification, and the
 * teacher evidence all stay honest, and working a fact family backwards is
 * the exact shape of his bridge strategy.
 *
 * Per Andy (2026-09-01): missing number is OFF for all four operations by
 * default, switched on per operation in parent settings, and mixes in at an
 * editable percentage (default 20) when on.
 *
 * Deterministic in (fact, salt), so a probe can ask twice and get the same
 * presentation, and no Math.random ever decides what a test cannot repeat.
 */

import type { Fact, FactKind } from "./types";

export interface MissingCfg {
  add: boolean;
  sub: boolean;
  mul: boolean;
  div: boolean;
  /** Percent of items presented as missing-number, when on for that kind. */
  pct: number;
}

export const DEFAULT_MISSING: MissingCfg = { add: false, sub: false, mul: false, div: false, pct: 20 };

export interface Presented {
  format: "standard" | "missing";
  op: string;
  /** Displayed operand VALUES, after commutative orientation. */
  a: number;
  b: number;
  /** Which slot is blanked. "none" for standard. */
  blank: "none" | "a" | "b";
  /** The right-hand side shown for a missing item; equals the fact's answer. */
  result: number;
  /** What he must type. The fact's answer, or the blanked operand. */
  expected: number;
}

const OP: Record<FactKind, string> = { add: "+", sub: "−", mul: "×", div: "÷" };

export const presentFact = (f: Fact, salt: number, missing: MissingCfg = DEFAULT_MISSING): Presented => {
  // One hash feeds all three choices so they cannot drift apart between calls.
  let h = (Math.imul(salt + 0x9e3779b9, 2654435761) ^ Math.imul(f.a + 1, 40503) ^ Math.imul(f.b + 7, 30011)) >>> 0;
  h = (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0);

  // A commutative pair is ONE fact with two presentations.
  const flip = (f.kind === "add" || f.kind === "mul") && h % 2 === 1;
  const a = flip ? f.b : f.a;
  const b = flip ? f.a : f.b;
  const op = OP[f.kind];

  const roll = (h >>> 3) % 100;
  const wantMissing = missing[f.kind] && roll < Math.max(0, Math.min(100, missing.pct));
  if (!wantMissing) {
    return { format: "standard", op, a, b, blank: "none", result: f.answer, expected: f.answer };
  }

  // Blank one OPERAND, never the result: blanking the result is just the
  // standard question wearing a costume.
  const blank = ((h >>> 9) % 2 === 0 ? "a" : "b") as "a" | "b";
  return {
    format: "missing", op, a, b, blank, result: f.answer,
    expected: blank === "a" ? a : b,
  };
};

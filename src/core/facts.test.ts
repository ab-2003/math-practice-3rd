import { describe, expect, it } from "vitest";
import { buildDeck, deckInIntroOrder, isBridgeAdd, isBridgeSub, mulPartnerId } from "./facts";

const deck = buildDeck();

describe("the deck", () => {
  it("gives every fact a unique stable id and a correct answer", () => {
    for (const f of deck.values()) {
      const expected =
        f.kind === "add" ? f.a + f.b
        : f.kind === "sub" ? f.a - f.b
        : f.kind === "mul" ? f.a * f.b
        : f.a / f.b;
      expect(f.answer, f.id).toBe(expected);
      expect(Number.isInteger(f.answer), f.id).toBe(true);
    }
  });

  it("treats a commutative pair as one fact, not two", () => {
    expect(deck.has("add:7+8")).toBe(true);
    expect(deck.has("add:8+7")).toBe(false);
    expect(deck.has("mul:6x7")).toBe(true);
    expect(deck.has("mul:7x6")).toBe(false);
  });

  it("keeps every answer and operand inside the stated scope", () => {
    for (const f of deck.values()) {
      if (f.kind === "add" || f.kind === "sub") expect(f.a, f.id).toBeLessThanOrEqual(20);
      if (f.kind === "mul") expect(f.answer, f.id).toBeLessThanOrEqual(100);
      if (f.kind === "div") expect(f.b, f.id).toBeGreaterThan(0);
    }
  });

  it("flags the bridge-through-ten cases the spec names by name", () => {
    expect(deck.get("sub:11-8")?.bridge).toBe(true);
    expect(deck.get("sub:13-5")?.bridge).toBe(true);
    expect(deck.get("add:7+8")?.bridge).toBe(true);
    // 15-3 does not bridge: three is smaller than the units digit.
    expect(isBridgeSub(15, 3)).toBe(false);
    expect(isBridgeAdd(3, 4)).toBe(false);
  });

  it("puts the bridge cases in the priority tiers", () => {
    expect(deck.get("sub:11-8")?.tier).toBe(60);
    expect(deck.get("add:7+8")?.tier).toBe(30);
  });

  it("opens multiplication early rather than after all of addition", () => {
    const mulStart = Math.min(...[...deck.values()].filter((f) => f.kind === "mul").map((f) => f.tier));
    const addEnd = Math.max(...[...deck.values()].filter((f) => f.kind === "add").map((f) => f.tier));
    expect(mulStart).toBeLessThan(addEnd);
  });

  it("puts the hard middles last among the multiplication facts", () => {
    expect(deck.get("mul:7x8")?.tier).toBe(70);
    expect(deck.get("mul:2x9")?.tier).toBe(20);
    expect(deck.get("mul:3x9")?.tier).toBe(50);
  });

  it("points every division fact at its multiplication partner", () => {
    expect(mulPartnerId(deck.get("div:56/8")!)).toBe("mul:7x8");
    expect(mulPartnerId(deck.get("div:56/7")!)).toBe("mul:7x8");
    expect(mulPartnerId(deck.get("add:7+8")!)).toBeNull();
    for (const f of deck.values()) {
      if (f.kind !== "div") continue;
      const p = mulPartnerId(f);
      expect(p, f.id).not.toBeNull();
      expect(deck.has(p!), `${f.id} -> ${p}`).toBe(true);
    }
  });

  it("orders introduction by tier and never leaves a fact unreachable", () => {
    const ordered = deckInIntroOrder(deck);
    expect(ordered.length).toBe(deck.size);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]!.tier).toBeGreaterThanOrEqual(ordered[i - 1]!.tier);
    }
  });
});

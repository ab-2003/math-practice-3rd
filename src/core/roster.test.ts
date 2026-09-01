import { describe, expect, it } from "vitest";
import { canAffordAny, cheapestLocked, ROSTER } from "./creatures";
import { HELMETS, helmetById } from "./gear";

describe("the open shop", () => {
  it("holds exactly twenty-one monsters, seven of them dragons", () => {
    expect(ROSTER.length).toBe(21);
    expect(ROSTER.filter((c) => c.silhouette === "dragon").length).toBe(7);
  });

  it("keeps VOIDWYRM last, because he is Kallen's", () => {
    expect(ROSTER[ROSTER.length - 1]!.id).toBe("voidwyrm");
    expect(ROSTER[ROSTER.length - 1]!.cost).toBe(500);
  });

  it("keeps every id and name unique, and every price positive", () => {
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(21);
    expect(new Set(ROSTER.map((c) => c.name)).size).toBe(21);
    for (const c of ROSTER) expect(c.cost).toBeGreaterThan(0);
  });

  it("gives the seven dragons seven different colours", () => {
    const bodies = ROSTER.filter((c) => c.silhouette === "dragon").map((c) => c.palette[0]);
    expect(new Set(bodies).size).toBe(7);
  });

  it("still knows the cheapest target and affordability", () => {
    expect(cheapestLocked([])!.id).toBe("grindjaw");
    expect(cheapestLocked(ROSTER.map((c) => c.id))).toBeNull();
    expect(canAffordAny([], 59)).toBe(false);
    expect(canAffordAny([], 60)).toBe(true);
    expect(canAffordAny(["grindjaw"], 60)).toBe(false);
  });
});

describe("the gear rack", () => {
  it("holds exactly twenty helmets with unique ids and names", () => {
    expect(HELMETS.length).toBe(20);
    expect(new Set(HELMETS.map((h) => h.id)).size).toBe(20);
    expect(new Set(HELMETS.map((h) => h.name)).size).toBe(20);
  });

  it("prices every helmet and resolves lookups", () => {
    for (const h of HELMETS) {
      expect(h.cost).toBeGreaterThan(0);
      expect(helmetById(h.id)).toBe(h);
    }
    expect(helmetById("nope")).toBeUndefined();
  });

  it("covers ten shapes twice each, so the rack has real variety", () => {
    const byShape = new Map();
    for (const h of HELMETS) byShape.set(h.shape, (byShape.get(h.shape) ?? 0) + 1);
    expect(byShape.size).toBe(10);
    for (const n of byShape.values()) expect(n).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { canAffordAny, canLevelUp, cheapestLocked, levelBrings, levelCost, MAX_LEVEL, riderVoice, ROSTER } from "./creatures";
import { HELMETS, helmetById } from "./gear";

describe("the open shop", () => {
  it("holds exactly thirty-two monsters, seven of them dragons, eight of them kaiju", () => {
    expect(ROSTER.length).toBe(32);
    expect(ROSTER.filter((c) => c.silhouette === "dragon").length).toBe(7);
    expect(ROSTER.filter((c) => c.kaiju === true).length).toBe(8);
  });

  it("prices SKYHOOK at 150 and every other kaiju above it, each its own form", () => {
    const kaiju = ROSTER.filter((c) => c.kaiju === true);
    const hoops = kaiju.find((c) => c.id === "skyhook")!;
    expect(hoops.cost).toBe(150);
    expect(hoops.silhouette).toBe("hoops");
    for (const k of kaiju) if (k.id !== "skyhook") expect(k.cost, k.id).toBeGreaterThan(150);
    expect(kaiju.find((c) => c.id === "pantheraclaw")!.cost).toBe(250);
    expect(kaiju.find((c) => c.id === "wreckarm")!.cost).toBe(600);
    expect(new Set(kaiju.map((k) => k.silhouette)).size).toBe(8);
    // Their forms are their own: none shares a silhouette with the old crew.
    const old = new Set(ROSTER.filter((c) => c.kaiju !== true).map((c) => c.silhouette));
    for (const k of kaiju) expect(old.has(k.silhouette), k.id).toBe(false);
  });

  it("keeps VOIDWYRM last, because that one is Kallen's", () => {
    expect(ROSTER[ROSTER.length - 1]!.id).toBe("voidwyrm");
    expect(ROSTER[ROSTER.length - 1]!.cost).toBe(500);
  });

  it("keeps every id and name unique, and every price positive", () => {
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(32);
    expect(new Set(ROSTER.map((c) => c.name)).size).toBe(32);
    expect(ROSTER.find((c) => c.id === "hattrick")!.cost).toBe(190);
    expect(ROSTER.find((c) => c.id === "scoopjaw")!.silhouette).toBe("digger");
    for (const c of ROSTER) expect(c.cost).toBeGreaterThan(0);
  });

  it("gives the seven dragons seven different colours", () => {
    const bodies = ROSTER.filter((c) => c.silhouette === "dragon").map((c) => c.palette[0]);
    expect(new Set(bodies).size).toBe(7);
  });

  it("gives every monster two lines of its own, with no em-dashes", () => {
    const all = ROSTER.flatMap((c) => c.voice);
    expect(all.length).toBe(64);
    expect(new Set(all).size).toBe(64);
    for (const line of all) expect(line).not.toContain("—");
    expect(riderVoice(ROSTER[0]!, 0)).toBe(ROSTER[0]!.voice[0]);
    expect(riderVoice(ROSTER[0]!, 1)).toBe(ROSTER[0]!.voice[1]);
  });

  it("still knows the cheapest target and affordability, KOMODUSTER third in line", () => {
    expect(cheapestLocked([])!.id).toBe("grindjaw");
    expect(cheapestLocked(["grindjaw", "skathorn"])!.id).toBe("komoduster");
    expect(cheapestLocked(["grindjaw", "skathorn"])!.cost).toBe(125);
    expect(cheapestLocked(ROSTER.map((c) => c.id))).toBeNull();
    expect(canAffordAny([], 59)).toBe(false);
    expect(canAffordAny([], 60)).toBe(true);
    expect(canAffordAny(["grindjaw"], 60)).toBe(false);
  });
});

describe("levelling", () => {
  it("is affordable exactly when the wallet covers the next level, and never past the top", () => {
    expect(levelCost(1)).toBe(40);
    expect(canLevelUp(1, 39)).toBe(false);
    expect(canLevelUp(1, 40)).toBe(true);
    expect(canLevelUp(MAX_LEVEL, 100_000)).toBe(false);
  });

  it("says what every level brings, in words, with a gold star for the hornless at 7", () => {
    const horned = ROSTER.find((c) => c.horns > 0)!;
    const hornless = ROSTER.find((c) => c.horns === 0)!;
    for (let lv = 2; lv <= MAX_LEVEL; lv++) {
      expect(levelBrings(horned, lv).length).toBeGreaterThan(4);
      expect(levelBrings(horned, lv)).not.toContain("—");
    }
    expect(levelBrings(horned, 2)).toContain("star");
    expect(levelBrings(horned, 4)).toContain("glow");
    expect(levelBrings(horned, 7)).toContain("gold horns");
    expect(levelBrings(hornless, 7)).toBe("a gold star");
    expect(levelBrings(horned, 10)).toContain("aura");
    expect(levelBrings(horned, 5)).toContain("5");
  });
});

describe("the gear rack", () => {
  it("holds exactly thirty helmets with unique ids and names, the sports lids and the hard hat among them", () => {
    expect(HELMETS.length).toBe(30);
    expect(new Set(HELMETS.map((h) => h.id)).size).toBe(30);
    expect(new Set(HELMETS.map((h) => h.name)).size).toBe(30);
    for (const shape of ["pilot", "soccer", "basketball", "hockey", "hardhat"]) expect(HELMETS.filter((h) => h.shape === shape).length, shape).toBe(2);
  });

  it("prices every helmet and resolves lookups", () => {
    for (const h of HELMETS) {
      expect(h.cost).toBeGreaterThan(0);
      expect(helmetById(h.id)).toBe(h);
    }
    expect(helmetById("nope")).toBeUndefined();
  });

  it("covers fifteen shapes twice each, so the rack has real variety", () => {
    const byShape = new Map();
    for (const h of HELMETS) byShape.set(h.shape, (byShape.get(h.shape) ?? 0) + 1);
    expect(byShape.size).toBe(15);
    for (const n of byShape.values()) expect(n).toBe(2);
  });
});

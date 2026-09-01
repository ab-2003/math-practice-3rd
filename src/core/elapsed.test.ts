import { describe, expect, it } from "vitest";
import { makeElapsed } from "./elapsed";

const hourOf = (l: string): number => Number(l.split(":")[0]);

describe("elapsed time levels", () => {
  it("level 1, the default, never leaves the clock hour and never passes 60", () => {
    for (let seed = 0; seed < 3000; seed++) {
      const p = makeElapsed(seed, 1);
      expect(p.level).toBe(1);
      expect(p.answer, p.text).toBeLessThanOrEqual(60);
      expect(hourOf(p.endLabel), p.text).toBe(hourOf(p.startLabel));
    }
  });

  it("up to level 2 keeps every answer at 60 or under, and the crossing appears", () => {
    let crossings = 0;
    let sameHour = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const p = makeElapsed(seed, 2);
      expect(p.answer, p.text).toBeLessThanOrEqual(60);
      if (p.level === 2) {
        // A level 2 problem is not a level 1 problem wearing a badge: the
        // hour boundary is genuinely inside it.
        expect(hourOf(p.endLabel), p.text).not.toBe(hourOf(p.startLabel));
        crossings += 1;
      } else {
        sameHour += 1;
      }
    }
    // "Allowed up to" means a MIX, not only the top level.
    expect(crossings).toBeGreaterThan(800);
    expect(sameHour).toBeGreaterThan(800);
  });

  it("level 3 goes past the hour but NEVER past two hours", () => {
    let big = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const p = makeElapsed(seed, 3);
      expect(p.answer, p.text).toBeLessThanOrEqual(120);
      if (p.level === 3) {
        expect(p.answer, p.text).toBeGreaterThan(60);
        big += 1;
      }
    }
    expect(big).toBeGreaterThan(500);
  });

  it("every time in every level sits on a five minute mark, for the analog face", () => {
    for (let seed = 0; seed < 2000; seed++) {
      for (const lvl of [1, 2, 3] as const) {
        const p = makeElapsed(seed, lvl);
        expect(p.startMinutes % 5).toBe(0);
        expect(p.endMinutes % 5).toBe(0);
        expect(p.answer % 5).toBe(0);
        expect(p.answer).toBeGreaterThanOrEqual(10);
        expect(p.endMinutes - p.startMinutes).toBe(p.answer);
      }
    }
  });

  it("is deterministic", () => {
    for (let seed = 0; seed < 300; seed++) {
      expect(makeElapsed(seed, 3)).toEqual(makeElapsed(seed, 3));
    }
  });
});

import { describe, expect, it } from "vitest";
import { makeElapsed } from "./elapsed";

describe("elapsed time difficulty", () => {
  it("by default never crosses the hour and never answers past 60 minutes", () => {
    // The bonus round is a reward. 2:10 to 3:45 at the end of a good run is a
    // reward that bites, and Andy watched it almost happen.
    for (let seed = 0; seed < 3000; seed++) {
      const p = makeElapsed(seed, false);
      expect(p.answer, p.text).toBeLessThanOrEqual(60);
      const [sh] = p.startLabel.split(":").map(Number);
      const [eh] = p.endLabel.split(":").map(Number);
      expect(eh, p.text).toBe(sh);
    }
  });

  it("with the parent toggle on, the crossing becomes the skill", () => {
    let crossings = 0;
    let past60 = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const p = makeElapsed(seed, true);
      const [sh] = p.startLabel.split(":").map(Number);
      const [eh] = p.endLabel.split(":").map(Number);
      if (eh !== sh) crossings += 1;
      if (p.answer > 60) past60 += 1;
    }
    expect(crossings).toBeGreaterThan(500);
    expect(past60).toBeGreaterThan(200);
  });

  it("is deterministic and always a five minute answer", () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const hard of [false, true]) {
        const a = makeElapsed(seed, hard);
        expect(makeElapsed(seed, hard)).toEqual(a);
        expect(a.answer % 5).toBe(0);
        expect(a.answer).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

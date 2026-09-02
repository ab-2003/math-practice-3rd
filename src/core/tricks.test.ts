import { describe, expect, it } from "vitest";
import {
  BASE_TRICKS, lineTricks, seasonalSpots, SPOTS, spotForDay, spotUnlockedBetween,
  trickUnlockedBetween, UNLOCKABLE_TRICKS, unlockedTricks,
} from "./tricks";

describe("the trick vocabulary", () => {
  it("ships five and grows to nine", () => {
    expect(unlockedTricks(0).length).toBe(5);
    expect(unlockedTricks(9999).length).toBe(9);
  });

  it("unlocks in threshold order, and announces exactly one crossing", () => {
    expect(trickUnlockedBetween(24, 25)?.name).toBe("720");
    expect(trickUnlockedBetween(25, 40)).toBeNull();
    expect(trickUnlockedBetween(0, 24)).toBeNull();
    for (const t of UNLOCKABLE_TRICKS) {
      expect(unlockedTricks(t.atLines).map((x) => x.name)).toContain(t.name);
      expect(unlockedTricks(t.atLines - 1).map((x) => x.name)).not.toContain(t.name);
    }
  });

  it("every line is five distinct tricks with valid animations", () => {
    for (let line = 0; line < 300; line++) {
      for (const landed of [0, 25, 60, 110, 175, 400]) {
        const tricks = lineTricks(line, landed);
        expect(tricks.length).toBe(5);
        expect(new Set(tricks.map((t) => t.name)).size).toBe(5);
        for (const t of tricks) {
          expect(t.anim).toBeGreaterThanOrEqual(0);
          expect(t.anim).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("is deterministic, and the day-one line is the classic five", () => {
    expect(lineTricks(7, 60)).toEqual(lineTricks(7, 60));
    expect(lineTricks(0, 0).map((t) => t.name)).toEqual(BASE_TRICKS.map((t) => t.name));
  });

  it("the showcase slot cycles the flashy pool once tricks unlock", () => {
    const finals = new Set<string>();
    for (let line = 0; line < 10; line++) finals.add(lineTricks(line, 60)[4]!.name);
    // BACKFLIP, 720 and DARKSLIDE are all unlocked at 60 lines; the fifth
    // slot must actually rotate through them rather than pinning one.
    expect(finals.size).toBeGreaterThanOrEqual(3);
  });
});

describe("the spots", () => {
  it("open with the street and earn the rest", () => {
    expect(spotForDay(0, 0).id).toBe("street");
    expect(spotUnlockedBetween(14, 15)?.id).toBe("halfpipe");
    expect(spotUnlockedBetween(15, 16)).toBeNull();
  });

  it("rotates every unlocked spot across days", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 10; day++) seen.add(spotForDay(999, day).id);
    expect(seen.size).toBe(SPOTS.length);
  });

  it("opens the seasonal spots in their season only, to everyone", () => {
    expect(seasonalSpots(0).map((s) => s.id)).toEqual(["frostpark"]);
    expect(seasonalSpots(6).map((s) => s.id)).toEqual(["boardwalk"]);
    expect(seasonalSpots(3)).toEqual([]);
    expect(seasonalSpots(undefined)).toEqual([]);
    const winter = new Set<string>();
    for (let day = 0; day < 10; day++) winter.add(spotForDay(0, day, 0).id);
    expect(winter.has("frostpark")).toBe(true);
    expect(winter.has("street")).toBe(true);
    for (let day = 0; day < 10; day++) expect(spotForDay(0, day, 3).id).toBe("street");
  });
});

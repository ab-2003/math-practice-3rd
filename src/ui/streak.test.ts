import { describe, expect, it } from "vitest";
import { STREAK_COINS } from "../core/config";
import { freshMeta, type Meta } from "./store";
import { catchUpStreak, claimStreak, creditDayDone } from "./streak";

const meta = (over: Partial<Meta> = {}): Meta => ({ ...freshMeta(), ...over });

describe("the daily streak", () => {
  it("counts a day when its WORK is finished, and only once", () => {
    const m = meta();
    expect(creditDayDone(m, 10)).toBe(true);
    expect(m.streak).toBe(1);
    expect(m.streakDay).toBe(10);
    // The same day again changes nothing: no second credit, no second purse.
    expect(creditDayDone(m, 10)).toBe(false);
    expect(m.streak).toBe(1);
  });

  it("extends over consecutive days and starts again after a gap", () => {
    const m = meta();
    creditDayDone(m, 10);
    creditDayDone(m, 11);
    creditDayDone(m, 12);
    expect(m.streak).toBe(3);
    creditDayDone(m, 14); // a day missed
    expect(m.streak).toBe(1);
  });

  it("owes a ceremony from the second day on, never the first", () => {
    const m = meta();
    creditDayDone(m, 10);
    expect(m.streakOwed).toBe(0);
    expect(claimStreak(m)).toBeNull();
    expect(m.coins).toBe(0);
    creditDayDone(m, 11);
    expect(m.streakOwed).toBe(2);
  });

  it("pays twenty coins at home, once, however often it is claimed", () => {
    const m = meta({ coins: 5 });
    creditDayDone(m, 10);
    creditDayDone(m, 11);
    const won = claimStreak(m);
    expect(won).toEqual({ days: 2, coins: STREAK_COINS });
    expect(m.coins).toBe(5 + STREAK_COINS);
    expect(claimStreak(m)).toBeNull();
    expect(m.coins).toBe(5 + STREAK_COINS);
  });

  it("holds the purse until it is claimed, however long the ride home", () => {
    const m = meta();
    creditDayDone(m, 10);
    creditDayDone(m, 11);
    // A whole session, a shop visit, a park run: nothing else claims it.
    expect(m.streakOwed).toBe(2);
    expect(claimStreak(m)!.days).toBe(2);
  });
});

describe("catching up at launch", () => {
  it("gives today's finished work its ceremony on a save that never had one", () => {
    // The update lands mid-day on a rider who already finished today under
    // the old build: the old streak had counted today, so the day is his.
    const m = meta({ dailyGoal: 40, doseDay: 7, doseCount: 40, lastSessionDay: 7, streak: 3 });
    catchUpStreak(m, 7);
    expect(m.streakDay).toBe(7);
    expect(m.streakOwed).toBe(3);
    expect(claimStreak(m)).toEqual({ days: 3, coins: STREAK_COINS });
  });

  it("never backfills a day that is not today", () => {
    const m = meta({ dailyGoal: 40, doseDay: 5, doseCount: 40, lastSessionDay: 5, streak: 3 });
    catchUpStreak(m, 7); // two days later, nothing owed for the days between
    expect(m.streakOwed).toBe(0);
    expect(m.streakDay).toBe(5);
    expect(claimStreak(m)).toBeNull();
  });

  it("keeps an old streak's number, and yesterday still extends it", () => {
    const m = meta({ dailyGoal: 40, doseDay: 6, doseCount: 40, lastSessionDay: 6, streak: 4 });
    catchUpStreak(m, 7); // opened the next day, before today's work
    expect(m.streak).toBe(4);
    expect(m.streakOwed).toBe(0);
    creditDayDone(m, 7);
    expect(m.streak).toBe(5);
    expect(m.streakOwed).toBe(5);
  });

  it("owes nothing on day one, and nothing when today's work is unfinished", () => {
    const first = meta({ dailyGoal: 40, doseDay: 7, doseCount: 40, lastSessionDay: 7, streak: 1 });
    catchUpStreak(first, 7);
    expect(first.streakOwed).toBe(0);
    const partway = meta({ dailyGoal: 40, doseDay: 7, doseCount: 22, lastSessionDay: 7, streak: 2 });
    catchUpStreak(partway, 7);
    expect(partway.streakOwed).toBe(0);
    expect(partway.streakDay).toBe(7);
  });

  it("counts today when a finished day was never credited at all", () => {
    const m = meta({ dailyGoal: 40, doseDay: 7, doseCount: 40, streakDay: 6, streak: 2 });
    catchUpStreak(m, 7);
    expect(m.streak).toBe(3);
    expect(m.streakOwed).toBe(3);
  });
});

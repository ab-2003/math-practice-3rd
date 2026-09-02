import { describe, expect, it } from "vitest";
import type { App } from "./appstate";
import { canSpeedRun, doseDone, speedAttemptsToday, speedKey } from "./day";
import { freshMeta } from "./store";

/** day.ts reads only meta and day, so a bare object is a whole App to it. */
const appWith = (over: Partial<ReturnType<typeof freshMeta>>, day = 100): App =>
  ({ meta: { ...freshMeta(), ...over }, day } as unknown as App);

describe("the day's work", () => {
  it("is done when today's count reaches the goal, and only today", () => {
    expect(doseDone(appWith({ doseDay: 100, doseCount: 40, dailyGoal: 40 }))).toBe(true);
    expect(doseDone(appWith({ doseDay: 100, doseCount: 39, dailyGoal: 40 }))).toBe(false);
    expect(doseDone(appWith({ doseDay: 99, doseCount: 80, dailyGoal: 40 }))).toBe(false);
    expect(doseDone(appWith({ doseDay: null, doseCount: 0 }))).toBe(false);
  });
});

describe("the speed run's scoreboard key", () => {
  it("names the operations that are on, starred where missing-number is", () => {
    expect(speedKey(appWith({}))).toBe("add+sub");
    expect(speedKey(appWith({ strands: { add: true, sub: false, mul: true, div: true }, missing: { add: true, sub: false, mul: false, div: true, pct: 20 } })))
      .toBe("add*+mul+div*");
    expect(speedKey(appWith({ strands: { add: false, sub: false, mul: false, div: false } }))).toBe("none");
  });
});

describe("the speed run budget", () => {
  it("counts only today's attempts", () => {
    expect(speedAttemptsToday(appWith({ speedDay: 100, speedCount: 3 }))).toBe(3);
    expect(speedAttemptsToday(appWith({ speedDay: 99, speedCount: 3 }))).toBe(0);
  });

  it("allows exactly one run before the day's work", () => {
    expect(canSpeedRun(appWith({ speedDay: 100, speedCount: 0 })).ok).toBe(true);
    const second = canSpeedRun(appWith({ speedDay: 100, speedCount: 1 }));
    expect(second.ok).toBe(false);
    expect(second.why).toContain("before the day's work");
  });

  it("opens the parent-set budget once the dose is met, and closes at its end", () => {
    const done = { doseDay: 100, doseCount: 40, dailyGoal: 40, speedDay: 100, speedLimit: 10 };
    expect(canSpeedRun(appWith({ ...done, speedCount: 5 })).ok).toBe(true);
    const spent = canSpeedRun(appWith({ ...done, speedCount: 10 }));
    expect(spent.ok).toBe(false);
    expect(spent.why).toContain("10");
  });
});

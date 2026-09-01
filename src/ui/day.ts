/**
 * The day's pure truths, in a module with NO ui imports, because screens.ts
 * and speed-screen.ts both need them and a circular import between those two
 * minified into a "cannot access before initialization" crash.
 */

import type { App } from "./appstate";

/** The day's work is DONE when today's answered items reach the parent-set
 *  goal. The badge, the jingle, the extra-practice label, the shop and the
 *  speed-run budget all key off this one truth. */
export const doseDone = (app: App): boolean =>
  app.meta.doseDay === app.day && app.meta.doseCount >= app.meta.dailyGoal;

/** The speed-run scoreboard key: which ops are on, starred where
 *  missing-number is. A x-and-/ minute is a different sport from a + minute. */
export const speedKey = (app: App): string =>
  (["add", "sub", "mul", "div"] as const)
    .filter((o) => app.meta.strands[o])
    .map((o) => `${o}${app.meta.missing[o] ? "*" : ""}`)
    .join("+") || "none";

export const speedAttemptsToday = (app: App): number =>
  app.meta.speedDay === app.day ? app.meta.speedCount : 0;

/** One free run before the day's work; the parent-set budget after. */
export const canSpeedRun = (app: App): { ok: boolean; why: string } => {
  const used = speedAttemptsToday(app);
  if (!doseDone(app)) {
    return used === 0
      ? { ok: true, why: "" }
      : { ok: false, why: "One speed run before the day's work. Finish today's tricks to unlock the rest." };
  }
  if (used >= app.meta.speedLimit) return { ok: false, why: `That is all ${app.meta.speedLimit} speed runs for today. Back tomorrow!` };
  return { ok: true, why: "" };
};

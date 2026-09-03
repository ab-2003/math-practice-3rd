/**
 * THE DAY'S GAME TIME (Andy, 2026-09-03): "a parent can limit overall
 * number of minutes in the game. It warns the kid at 3 minutes remaining
 * and 1 minute remaining, and after they finish a line it boots them to
 * main title and says come back tomorrow (or if in shop or skate park,
 * etc. it boots you to title). Parent settings still accessible and not
 * subject to limit nor counted against the limit. Minimum 15 minutes."
 *
 * The tally is per rider, per day, in ms, and grows only while the page
 * is visible and the route counts. Pure rules here; the ticker in app.ts
 * feeds it and the screens ask it.
 */

import type { App, Route } from "./appstate";

export const WARN_MINUTES = [3, 1] as const;

/** The grown-ups' screen and the rider picker are outside the game. */
export const routeCounts = (r: Route): boolean => r !== "dashboard" && r !== "profiles";

export const limitOn = (app: App): boolean => app.meta.dayLimitMinutes > 0;

export const playedMs = (app: App): number => (app.meta.playDay === app.day ? app.meta.playMs : 0);

export const remainingMs = (app: App): number =>
  limitOn(app) ? Math.max(0, app.meta.dayLimitMinutes * 60_000 - playedMs(app)) : Number.POSITIVE_INFINITY;

/** The day's game is over: nothing but the grown-ups' screen from here. */
export const dayOver = (app: App): boolean => limitOn(app) && remainingMs(app) <= 0;

export type LimitEvent = "warn3" | "warn1" | "over";

/**
 * Count `ms` of game against today. Returns the one thing worth saying,
 * if anything: a warning at three minutes, one at one, or that the day is
 * over. Each warning fires once a day, reload or not.
 */
export const advancePlay = (app: App, ms: number): LimitEvent | null => {
  if (!limitOn(app)) return null;
  if (app.meta.playDay !== app.day) { app.meta.playDay = app.day; app.meta.playMs = 0; app.meta.playWarned = 0; }
  const wasOver = remainingMs(app) <= 0;
  app.meta.playMs += ms;
  const left = remainingMs(app);
  if (left <= 0) return wasOver ? null : "over";
  for (const w of WARN_MINUTES) {
    if (left <= w * 60_000 && (app.meta.playWarned === 0 || app.meta.playWarned > w)) {
      app.meta.playWarned = w;
      return w === 3 ? "warn3" : "warn1";
    }
  }
  return null;
};

export const leftWords = (app: App): string => {
  const m = Math.ceil(remainingMs(app) / 60_000);
  return `${m} ${m === 1 ? "minute" : "minutes"} of game time left today`;
};

/**
 * THE DAILY STREAK (Andy, 2026-09-03).
 *
 * A day joins the streak by having its WORK FINISHED, not by being practised:
 * "that's how you earn the next day in the streak". Every day of a streak
 * after the first pays STREAK_COINS.
 *
 * The purse is not paid where it is earned. Finishing the day's work happens
 * mid-session, and the ceremony would land on top of a problem or follow him
 * into the shop; so the finished day is OWED here and claimed by the home
 * screen, whenever he finally comes back to it.
 */
import { STREAK_COINS } from "../core/config";
import type { Meta } from "./store";

export { STREAK_COINS };

/**
 * The day's work is finished: count it. Consecutive with yesterday extends
 * the streak, a gap starts a new one, and a day already counted does
 * nothing. Returns true only on the call that counted the day.
 */
export const creditDayDone = (meta: Meta, day: number): boolean => {
  if (meta.streakDay === day) return false;
  meta.streak = meta.streakDay === day - 1 ? meta.streak + 1 : 1;
  meta.streakDay = day;
  // Day one is its own reward: the day's own fanfare already played.
  if (meta.streak > 1) meta.streakOwed = meta.streak;
  return true;
};

/**
 * He is home and a streak day is owed: pay it. Returns what to celebrate, or
 * null when nothing is owed. Claiming twice pays once.
 */
export const claimStreak = (meta: Meta): { days: number; coins: number } | null => {
  const days = meta.streakOwed;
  meta.streakOwed = 0;
  if (days < 2) return null;
  meta.coins += STREAK_COINS;
  return { days, coins: STREAK_COINS };
};

/**
 * AT LAUNCH, with today in hand.
 *
 * Two jobs, both once. A save from before the streak counted finished days
 * keeps the number the rider already sees: the old streak counted days
 * PRACTISED, and it had already counted today if today's run happened, so
 * that day seeds the new field and, when today's work is finished, owes its
 * ceremony (Andy, 2026-09-03: "anyone who has completed a daily streak today
 * and did not receive the ceremony ... will be surprised to see it happen
 * when they open up the app"). And any day whose work is finished but was
 * never counted is counted now. Only ever TODAY: missed days do not backfill.
 */
export const catchUpStreak = (meta: Meta, day: number): void => {
  const doneToday = meta.doseDay === day && meta.doseCount >= meta.dailyGoal;
  if (meta.streakDay === null) {
    meta.streakDay = meta.lastSessionDay;
    if (doneToday && meta.streakDay === day && meta.streak > 1) meta.streakOwed = meta.streak;
  }
  if (doneToday) creditDayDone(meta, day);
};

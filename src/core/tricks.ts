/**
 * THE TRICK VOCABULARY, AND HOW IT GROWS.
 *
 * Five tricks shipped and never changed, which meant the same line in the
 * same order every sitting for a school year. Skate culture IS progression,
 * so new tricks now unlock as total lines land, and each line is composed
 * from the unlocked pool: four working tricks and a SHOWCASE slot at the end
 * that cycles the flashy ones.
 *
 * Pure model, no DOM: the anim index maps to a CSS keyframe in the UI.
 * Deterministic in (lineIndex), so a probe can predict a line's tricks.
 */

export interface Trick {
  readonly name: string;
  /** Which ride animation the UI plays. 0..8. */
  readonly anim: number;
}

export const BASE_TRICKS: readonly Trick[] = [
  { name: "OLLIE", anim: 0 },
  { name: "KICKFLIP", anim: 1 },
  { name: "GRIND", anim: 2 },
  { name: "360 SPIN", anim: 3 },
  { name: "BACKFLIP", anim: 4 },
];

/** Earned by LINES LANDED, ever, across all sessions. Thresholds are spaced
 *  so something new arrives roughly every few weeks at one run a day. */
export const UNLOCKABLE_TRICKS: ReadonlyArray<Trick & { atLines: number }> = [
  { name: "720", anim: 5, atLines: 25 },
  { name: "DARKSLIDE", anim: 6, atLines: 60 },
  { name: "MCTWIST", anim: 7, atLines: 110 },
  { name: "LASER FLIP", anim: 8, atLines: 175 },
];

export const unlockedTricks = (linesLanded: number): Trick[] => [
  ...BASE_TRICKS,
  ...UNLOCKABLE_TRICKS.filter((t) => linesLanded >= t.atLines),
];

/** The trick that unlocks by crossing from `before` lines to `after`, if any. */
export const trickUnlockedBetween = (before: number, after: number): Trick | null =>
  UNLOCKABLE_TRICKS.find((t) => before < t.atLines && after >= t.atLines) ?? null;

/**
 * Compose line number `lineIndex` (his lifetime line count) from the pool:
 * slots 1-4 rotate through the working tricks, slot 5 is the showcase and
 * cycles the flashy end of the pool, newest unlocks included.
 */
export const lineTricks = (lineIndex: number, linesLanded: number): Trick[] => {
  const pool = unlockedTricks(linesLanded);
  const showcasePool = pool.slice(4);
  const showcase = showcasePool[lineIndex % showcasePool.length] ?? pool[4]!;
  const rest = pool.filter((t) => t.name !== showcase.name);
  const slots = [0, 1, 2, 3].map((i) => rest[(lineIndex + i) % rest.length]!);
  return [...slots, showcase];
};

// ---------------------------------------------------------------------------
// SKATE SPOTS: where the line happens. Scenery earned the same way, so the
// world visibly changes as mastery accumulates. Names only here; the drawing
// lives in the UI.
// ---------------------------------------------------------------------------

export const SPOTS: ReadonlyArray<{ id: string; name: string; atLines: number }> = [
  { id: "street", name: "THE STREET", atLines: 0 },
  { id: "halfpipe", name: "THE HALFPIPE", atLines: 15 },
  { id: "rooftop", name: "THE ROOFTOP", atLines: 40 },
  { id: "bowl", name: "SUNSET BOWL", atLines: 80 },
  { id: "megaramp", name: "THE MEGA RAMP", atLines: 140 },
];

export const unlockedSpots = (linesLanded: number): typeof SPOTS[number][] =>
  SPOTS.filter((s) => linesLanded >= s.atLines);

export const spotUnlockedBetween = (before: number, after: number): typeof SPOTS[number] | null =>
  SPOTS.find((s) => s.atLines > 0 && before < s.atLines && after >= s.atLines) ?? null;

/** Today's spot: rotate the unlocked set by day so sessions vary without a
 *  picker. Deterministic, so two sessions the same day match. */
export const spotForDay = (linesLanded: number, day: number): typeof SPOTS[number] => {
  const open = unlockedSpots(linesLanded);
  return open[day % open.length] ?? SPOTS[0]!;
};

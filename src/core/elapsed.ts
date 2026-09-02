/**
 * ELAPSED TIME, THE BONUS ROUND.
 *
 * Virginia SOL 3.MG.4 covers elapsed time, and he is genuinely good at it, so
 * it is used as a confidence and reward mechanic rather than as drill.
 *
 * LAW: this never touches the Leitner scheduler and never enters the parent
 * dashboard's retrieval percentage. The answer is always a WHOLE NUMBER OF
 * MINUTES on the same keypad as everything else, and every time in every
 * level sits on a FIVE MINUTE MARK, which is also what makes the analog
 * clock view readable practice rather than a squint.
 *
 * THREE LEVELS, Andy 2026-09-01, because "don't want it to become
 * discouraging" deserves structure rather than one blunt switch:
 *
 *   1  the whole problem lives inside one clock hour        2:10 -> 2:45
 *   2  it crosses into the next hour, still <= 60 minutes   2:50 -> 3:10
 *   3  more than an hour, never more than two               2:10 -> 3:45
 *
 * The parent picks the level he is ALLOWED UP TO, and problems mix everything
 * at or below it. Default is level 1 only; 2 and 3 are opt-in.
 */

export interface ElapsedProblem {
  id: string;
  /** The digital sentence. Short: he reads it unaided. */
  text: string;
  answer: number;
  level: 1 | 2 | 3;
  startLabel: string;
  endLabel: string;
  /** Raw clock positions, for the analog view. Minutes since midnight. */
  startMinutes: number;
  endMinutes: number;
  /** One-word captions for under the analog faces: ["opens", "closes"]. */
  caps: readonly [string, string];
}

const pad = (n: number): string => String(n).padStart(2, "0");

const label = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)}`;
};

const SCENES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["The skate park opens at", "It closes at", "opens", "closes"],
  ["Hockey practice starts at", "It ends at", "starts", "ends"],
  ["The bus leaves at", "It gets there at", "leaves", "arrives"],
  ["The movie starts at", "It finishes at", "starts", "finishes"],
  ["The rider drops in at", "The rider rolls out at", "drops in", "rolls out"],
  ["Recess starts at", "Recess ends at", "starts", "ends"],
];

/** Deterministic in the seed, so a probe can ask twice and get the same one. */
export const makeElapsed = (seed: number, maxLevel: 1 | 2 | 3 = 1): ElapsedProblem => {
  let h = (seed * 2654435761) >>> 0;
  const next = (n: number): number => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h % n;
  };

  const level = (1 + next(Math.max(1, Math.min(3, maxLevel)))) as 1 | 2 | 3;
  const startHour = 8 + next(11);
  let startMin: number;
  let duration: number;

  if (level === 1) {
    // Inside one hour: 10 to 50 minutes, and the start is chosen so the end
    // never leaves the clock face it began on.
    duration = (2 + next(9)) * 5;
    startMin = next((55 - duration) / 5 + 1) * 5;
  } else if (level === 2) {
    // Crosses into the next hour but stays a small span: 10 to 60 minutes,
    // start late enough that the hour boundary is inside it.
    duration = (2 + next(11)) * 5;
    const lowest = Math.max(0, 60 - duration + 5);
    startMin = lowest + next((55 - lowest) / 5 + 1) * 5;
  } else {
    // The big spans: 65 to 120 minutes, per Andy never beyond two hours.
    duration = (13 + next(12)) * 5;
    startMin = next(12) * 5;
  }

  const start = startHour * 60 + startMin;
  const scene = SCENES[next(SCENES.length)] ?? SCENES[0]!;
  const startLabel = label(start);
  const endLabel = label(start + duration);
  return {
    id: `elapsed:${start}:${duration}`,
    text: `${scene[0]} ${startLabel}. ${scene[1]} ${endLabel}. How many minutes is that?`,
    answer: duration,
    level,
    startLabel,
    endLabel,
    startMinutes: start,
    endMinutes: start + duration,
    caps: [scene[2], scene[3]],
  };
};

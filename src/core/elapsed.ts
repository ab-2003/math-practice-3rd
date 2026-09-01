/**
 * ELAPSED TIME, THE BONUS ROUND.
 *
 * Virginia SOL 3.MG.4 covers elapsed time, and he is genuinely good at it, so
 * it is used here as a confidence and reward mechanic rather than as drill.
 *
 * LAW: this never touches the Leitner scheduler and never enters the parent
 * dashboard's retrieval percentage. Mixing problems he is already good at into
 * the automaticity evidence would inflate the headline number and quietly
 * corrupt the thing that goes to his teacher.
 *
 * The answer is always a WHOLE NUMBER OF MINUTES, so it fits the same numeric
 * keypad as everything else. No second input mode, no clock widget to mis-tap.
 */

export interface ElapsedProblem {
  id: string;
  /** Rendered question text. Short: he reads it unaided. */
  text: string;
  answer: number;
  startLabel: string;
  endLabel: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");

const label = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)}`;
};

const SCENES: ReadonlyArray<readonly [string, string]> = [
  ["The skate park opens at", "It closes at"],
  ["Hockey practice starts at", "It ends at"],
  ["The bus leaves at", "It gets there at"],
  ["The movie starts at", "It finishes at"],
  ["He drops in at", "He rolls out at"],
  ["Recess starts at", "Recess ends at"],
];

/**
 * Deterministic from the seed, so a probe or a test can ask for the same
 * problem twice and get the same one.
 *
 * TWO DIFFICULTIES, Andy 2026-09-01: "don't want it to become discouraging."
 * By default a problem stays INSIDE one clock hour and its answer never
 * passes 60 minutes; 2:10 to 3:45 at the end of a good run is a reward that
 * bites. Crossing the hour is a parent toggle, switched on when he is ready
 * for the crossing to BE the skill.
 */
export const makeElapsed = (seed: number, crossHour = false): ElapsedProblem => {
  let h = (seed * 2654435761) >>> 0;
  const next = (n: number): number => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h % n;
  };
  const startHour = 8 + next(11);
  let startMin: number;
  let duration: number;
  if (crossHour) {
    // 10 to 95 minutes on five minute marks; crossings arrive often.
    startMin = next(12) * 5;
    duration = (2 + next(18)) * 5;
  } else {
    // 10 to 50 minutes, and the start minute is chosen so the end stays
    // inside the same hour: the whole problem lives on one clock face.
    duration = (2 + next(9)) * 5;
    startMin = next((55 - duration) / 5 + 1) * 5;
  }
  const start = startHour * 60 + startMin;
  const scene = SCENES[next(SCENES.length)] ?? SCENES[0]!;
  const startLabel = label(start);
  const endLabel = label(start + duration);
  return {
    id: `elapsed:${start}:${duration}`,
    text: `${scene[0]} ${startLabel}. ${scene[1]} ${endLabel}. How many minutes is that?`,
    answer: duration,
    startLabel,
    endLabel,
  };
};

/**
 * WHERE HE STANDS AGAINST VIRGINIA'S STANDARDS.
 *
 * Loudoun County follows the Virginia Standards of Learning, not Common Core.
 * Two standards define this year's job, and they are not the same year:
 *
 *   2.CE.1  recall with automaticity ADDITION AND SUBTRACTION facts within 20
 *           -> a GRADE TWO standard. He is carrying this gap into third grade.
 *
 *   3.CE.2  recall with automaticity MULTIPLICATION facts through 10 x 10 and
 *           the corresponding DIVISION facts
 *           -> due by the END OF GRADE THREE, and the direct prerequisite for
 *              the multi-digit multiplication and long division of grade four.
 *
 * So the year has to close a prior-year gap and hit a current-year standard at
 * the same time. That is the number the dashboard reports, because it is the
 * number his teacher actually needs.
 */

import type { Deck, Fact, States } from "./types";

export interface StandardProgress {
  code: string;
  grade: number;
  title: string;
  /** Facts counted toward this standard. */
  total: number;
  mastered: number;
  /** Introduced but not yet mastered. */
  inProgress: number;
  pct: number;
}

const inStandard = (code: string, f: Fact): boolean =>
  code === "2.CE.1"
    ? f.kind === "add" || f.kind === "sub"
    : f.kind === "mul" || f.kind === "div";

export const STANDARDS: ReadonlyArray<{ code: string; grade: number; title: string }> = [
  { code: "2.CE.1", grade: 2, title: "Addition and subtraction facts within 20, from memory" },
  { code: "3.CE.2", grade: 3, title: "Multiplication and division facts through 10 x 10, from memory" },
];

export const standardProgress = (deck: Deck, states: States): StandardProgress[] =>
  STANDARDS.map((s) => {
    const facts = [...deck.values()].filter((f) => inStandard(s.code, f));
    const mastered = facts.filter((f) => states.get(f.id)?.mastered === true).length;
    const inProgress = facts.filter((f) => {
      const st = states.get(f.id);
      return st !== undefined && st.introduced && !st.mastered;
    }).length;
    return {
      code: s.code, grade: s.grade, title: s.title,
      total: facts.length, mastered, inProgress,
      pct: facts.length === 0 ? 0 : Math.round((mastered / facts.length) * 100),
    };
  });

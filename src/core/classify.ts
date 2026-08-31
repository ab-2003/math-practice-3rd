import { DERIVED_MAX_MS, RETRIEVED_MAX_MS } from "./config";
import type { ResponseClass } from "./types";

/**
 * THE CLOCK STARTS AT PAINT AND STOPS AT THE FIRST DIGIT.
 *
 * Not at submit. This is the single most important measurement decision in
 * the app, and getting it wrong would corrupt the evidence that goes to his
 * teacher.
 *
 * On free numeric entry, time-to-submit includes MOTOR time, and motor time
 * scales with the number of digits. 2+3=5 is one tap; 8+7=15 is two taps and
 * a submit. A boy who retrieves in 400ms but taps deliberately can land past
 * three seconds on a two-digit answer and never promote, while the dashboard
 * reports to his teacher that automaticity is not building when in fact it is.
 * Time-to-first-digit is the retrieval measurement. Everything after it is
 * his hands.
 *
 * Both numbers are stored on every response regardless; submitMs is kept for
 * diagnosis, never for classification.
 *
 * A wrong answer is effortful by definition, however fast it arrived. Speed
 * on a wrong answer is a guess, not a retrieval.
 */
export const classify = (correct: boolean, firstKeyMs: number | null): ResponseClass => {
  if (!correct) return "effortful";
  // No digit was ever pressed, so there is nothing to measure. Refusing to
  // guess is the point: a failed measurement must never read as a verdict.
  if (firstKeyMs === null) return "effortful";
  if (firstKeyMs < RETRIEVED_MAX_MS) return "retrieved";
  if (firstKeyMs < DERIVED_MAX_MS) return "derived";
  return "effortful";
};

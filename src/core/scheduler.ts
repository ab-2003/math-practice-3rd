import {
  BOX_INTERVAL_DAYS, DEMOTE_BOXES_ON_WRONG, DIVISION_UNLOCK_BOX,
  MASTERY_STREAK, MAX_BOX, MIN_BOX,
} from "./config";
import { mulPartnerId } from "./facts";
import type { Deck, Fact, FactKind, FactState, Response, States } from "./types";

export const freshState = (): FactState => ({
  introduced: false, box: MIN_BOX, dueOn: 0, masteryStreak: 0,
  lastRetrievedDay: null, mastered: false, seen: 0, correct: 0,
});

export const boxInterval = (box: number): number =>
  BOX_INTERVAL_DAYS[Math.min(Math.max(box, MIN_BOX), MAX_BOX)] ?? 1;

export const isDue = (s: FactState, day: number): boolean =>
  s.introduced && s.dueOn <= day;

/**
 * THE LEITNER TRANSITION. The whole retrieval-vs-derivation mechanic is here.
 *
 * Two ledgers that never touch. The learner's ledger is correctness: a derived
 * answer earns the same points, the same trick, the same everything, and the
 * UI is forbidden from distinguishing it. The scheduler's ledger is latency:
 * only a retrieved answer moves a fact forward.
 *
 * He experiences a generous system. The scheduler runs a strict one. The
 * strictness never surfaces as judgement, only as "this one keeps coming
 * back", which reads as perfectly ordinary.
 *
 *   retrieved  promote a box, and count toward mastery if it is a NEW day
 *   derived    hold. correct, credited, but not yet automatic
 *   effortful  hold, but break the mastery streak, and ask again this session
 *   wrong      demote two boxes, due tomorrow, and ask again this session
 *
 * A derived answer HOLDS the streak rather than resetting it. He was right.
 * Resetting would punish a correct answer and put mastery out of reach for a
 * boy whose entire strength is derivation.
 */
export const applyResponse = (prev: FactState, r: Response): FactState => {
  // The forced re-entry after a wrong answer is a typing exercise: he has
  // just been shown the answer. It must never touch the schedule.
  if (r.isRetry) return prev;

  const s: FactState = { ...prev, introduced: true, seen: prev.seen + 1 };
  if (r.correct) s.correct += 1;

  if (!r.correct) {
    s.box = Math.max(MIN_BOX, s.box - DEMOTE_BOXES_ON_WRONG);
    s.masteryStreak = 0;
    s.mastered = false;
    s.dueOn = r.day + 1;
    return s;
  }

  if (r.cls === "retrieved") {
    s.box = Math.min(MAX_BOX, s.box + 1);
    // DISTINCT DAYS is load bearing. Three fast answers inside one session
    // are partly priming from having just seen the fact; only a new day is
    // evidence that it survived sleep. A second retrieved response the same
    // day neither counts nor resets.
    if (s.lastRetrievedDay === null || r.day > s.lastRetrievedDay) {
      s.masteryStreak += 1;
      s.lastRetrievedDay = r.day;
    }
    if (s.masteryStreak >= MASTERY_STREAK) s.mastered = true;
  } else if (r.cls === "effortful") {
    s.masteryStreak = 0;
  }
  // "derived" falls through: box held, streak held, credited in full.

  s.dueOn = r.day + boxInterval(s.box);
  return s;
};

/**
 * MASTERY IS A LABEL, NOT AN EXIT.
 *
 * A mastered fact keeps circulating at the box-5 interval and can lose the
 * label. If mastery removed a fact from rotation, automaticity would decay
 * silently, the heat map would go stale, and the parent dashboard's "trending
 * the wrong way" list would be permanently empty because nothing could ever
 * trend anywhere.
 */
export const isMastered = (s: FactState): boolean => s.mastered;

/**
 * Can this fact be introduced yet? Only division is gated, on its own
 * multiplication family rather than on the whole tier.
 */
export const canIntroduce = (f: Fact, states: States): boolean => {
  const partnerId = mulPartnerId(f);
  if (partnerId === null) return true;
  const partner = states.get(partnerId);
  if (!partner || !partner.introduced) return false;
  return partner.box >= DIVISION_UNLOCK_BOX;
};

export const allStates = (deck: Deck): Map<string, FactState> => {
  const m = new Map<string, FactState>();
  for (const id of deck.keys()) m.set(id, freshState());
  return m;
};

/**
 * SWITCHING A STRAND BACK ON.
 *
 * While an operation is off its facts still carry a dueOn, so after a term
 * away every one of them is overdue by ninety days. Turning multiplication
 * back on would then dump the whole backlog into one session, ordered by an
 * overdue-ness that only measures how long the switch was off, which is the
 * exact drowning the new-fact gate exists to prevent.
 *
 * So on revival, anything already overdue is simply due TODAY. The boxes and
 * the mastery streaks are untouched: progress is preserved, and if the time
 * away really did cost him a fact, his next wrong answer says so and the
 * scheduler demotes it. That is honest; presuming decay is not.
 */
export const reviveStrand = (
  deck: Deck, states: States, kind: FactKind, day: number,
): Map<string, FactState> => {
  const out = new Map(states);
  for (const f of deck.values()) {
    if (f.kind !== kind) continue;
    const s = out.get(f.id);
    if (!s || !s.introduced || s.dueOn >= day) continue;
    out.set(f.id, { ...s, dueOn: day });
  }
  return out;
};

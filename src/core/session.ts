import {
  CLOSER_ITEMS, NEW_FACT_GATE, NEW_PER_SESSION, REQUEUE_GAP,
  SESSION_HARD_CAP, SESSION_MAX_ITEMS, SESSION_TARGET_ITEMS, STRUGGLE_THRESHOLD,
  STRUGGLE_WINDOW, TOPUP_MAX_BOX,
} from "./config";
import { deckInIntroOrder } from "./facts";
import { applyResponse, canIntroduce, isDue } from "./scheduler";
import type { Deck, Fact, FactState, Response, SessionState, States } from "./types";

/**
 * SESSION ASSEMBLY.
 *
 * Order: everything due, then new facts only if the due queue leaves room.
 * The gate is the anti-drowning rule: a heavy review day simply has no space
 * for anything new, so a bad day cannot compound into a worse one.
 */
export const planQueue = (deck: Deck, states: States, day: number): string[] => {
  const due = [...deck.values()]
    .filter((f) => {
      const s = states.get(f.id);
      return s !== undefined && isDue(s, day);
    })
    // Most overdue first, then weakest box: the things he is shakiest on get
    // seen while he still has attention to spend on them.
    .sort((x, y) => {
      const sx = states.get(x.id)!;
      const sy = states.get(y.id)!;
      return sx.dueOn - sy.dueOn || sx.box - sy.box;
    })
    .map((f) => f.id);

  const queue = due.slice(0, SESSION_MAX_ITEMS);

  if (due.length < NEW_FACT_GATE) {
    const room = Math.min(NEW_PER_SESSION, SESSION_MAX_ITEMS - queue.length);
    for (const id of nextNewFacts(deck, states, room)) queue.push(id);
  }

  // TOP UP to a workable session length.
  //
  // Leitner naturally produces a small due queue, and the new-fact gate is
  // deliberately stingy, so a plain due+new session runs three minutes rather
  // than the eight to ten we want. Top up with the WEAKEST introduced facts
  // he has, never the strong ones: extra reps on a box-1 fact are pure gain,
  // while dragging a box-5 fact forward would just undo its spacing.
  if (queue.length < SESSION_TARGET_ITEMS) {
    const inQueue = new Set(queue);
    const spare = [...deck.values()]
      .filter((f) => {
        const s = states.get(f.id);
        return s !== undefined && s.introduced && !inQueue.has(f.id) && s.box <= TOPUP_MAX_BOX;
      })
      .sort((x, y) => states.get(x.id)!.box - states.get(y.id)!.box || states.get(x.id)!.dueOn - states.get(y.id)!.dueOn);
    for (const f of spare) {
      if (queue.length >= SESSION_TARGET_ITEMS) break;
      queue.push(f.id);
    }
  }

  return queue;
};

/**
 * Pick the next new facts, ROUND ROBIN ACROSS STRANDS.
 *
 * Strict global tier order starves whole strands: with 363 facts and four new
 * per session, a pure tier walk had addition finished and subtraction at
 * 21 of 121 after ten simulated weeks, because every subtraction tier sits
 * behind an addition tier. Rotating across add/sub/mul/div keeps all four
 * moving. Order WITHIN a strand is still strictly by tier, which is where the
 * pedagogy lives.
 */
export const nextNewFacts = (deck: Deck, states: States, room: number): string[] => {
  const strands = new Map<string, Fact[]>();
  for (const f of deckInIntroOrder(deck)) {
    const s = states.get(f.id);
    if (!s || s.introduced) continue;
    if (!canIntroduce(f, states)) continue;
    const list = strands.get(f.kind);
    if (list) list.push(f);
    else strands.set(f.kind, [f]);
  }
  const out: string[] = [];
  const kinds = [...strands.keys()];
  for (let round = 0; out.length < room; round++) {
    let progressed = false;
    for (const k of kinds) {
      if (out.length >= room) break;
      const f = strands.get(k)![round];
      if (!f) continue;
      out.push(f.id);
      progressed = true;
    }
    if (!progressed) break;
  }
  return out;
};

export const startSession = (deck: Deck, states: States, day: number): SessionState => ({
  day,
  queue: planQueue(deck, states, day),
  cursor: 0,
  responses: [],
  closerAdded: false,
  status: "active",
  succeeded: [],
});

export const currentFactId = (s: SessionState): string | null =>
  s.cursor < s.queue.length ? (s.queue[s.cursor] ?? null) : null;

/**
 * THE CLOSER CASCADE.
 *
 * The spec says the last three items come from mastered facts. On day one
 * there are no mastered facts, and by the mastery definition there will be
 * none for two to three weeks: three retrieved responses on distinct days is
 * a slow bar by design. So a literal reading leaves the most important moment
 * in the app, the ending of his very first session, with an empty pool.
 *
 * Cascade instead, and there is always a pool: facts he has mastered, else
 * the strongest boxes he has, else whatever he got right earlier today. Every
 * branch is something he has already succeeded at, which is the actual point.
 */
export const closerIds = (deck: Deck, states: States, s: SessionState): string[] => {
  const asked = new Set(s.queue);
  const pick = (ids: string[]): string[] => ids.slice(0, CLOSER_ITEMS);

  const mastered = [...deck.keys()].filter((id) => states.get(id)?.mastered === true);
  if (mastered.length >= CLOSER_ITEMS) return pick(shuffleStable(mastered, s.day));

  const strong = [...deck.keys()]
    .filter((id) => {
      const st = states.get(id);
      return st !== undefined && st.introduced && st.box >= 3;
    })
    .sort((x, y) => (states.get(y)!.box) - (states.get(x)!.box));
  const fromStrong = [...mastered, ...strong.filter((id) => !mastered.includes(id))];
  if (fromStrong.length >= CLOSER_ITEMS) return pick(fromStrong);

  // Last resort, and the day-one path: things he got right in this very
  // session. Prefer ones already in the queue only if nothing else exists.
  const won = s.succeeded.filter((id) => !fromStrong.includes(id));
  const pool = [...fromStrong, ...won];
  if (pool.length > 0) return pick(pool);

  // He got nothing right at all. End on the easiest thing in the deck rather
  // than on nothing: an empty ending is worse than a gentle one.
  return pick([...asked].slice(0, CLOSER_ITEMS));
};

/** Deterministic shuffle so a session is reproducible in tests and probes. */
const shuffleStable = (ids: string[], seed: number): string[] => {
  const out = [...ids];
  let h = (seed * 2654435761) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
};

/**
 * Is he struggling badly enough that the session should stop?
 *
 * Ending early is a FEATURE, not a failure, and it is logged distinctly so
 * the dashboard can tell "the app protected him" from "he walked away".
 * Given a boy who has already rapid-guessed his way out of a standardised
 * test, this is the most important engagement control in the app.
 */
export const isStruggling = (s: SessionState): boolean => {
  const real = s.responses.filter((r) => !r.isRetry);
  if (real.length < STRUGGLE_WINDOW) return false;
  const recent = real.slice(-STRUGGLE_WINDOW);
  const bad = recent.filter((r) => !r.correct || r.cls === "effortful").length;
  return bad >= STRUGGLE_THRESHOLD;
};

export interface StepResult {
  session: SessionState;
  states: Map<string, FactState>;
}

/**
 * Record one response and advance. Pure: hand it state, get new state.
 *
 * A wrong or effortful answer puts the fact back in the queue REQUEUE_GAP
 * items later, never immediately. Asking again right away tests short-term
 * echo, not memory, and it also reads as nagging.
 */
export const recordResponse = (
  deck: Deck, states: States, session: SessionState, r: Response,
): StepResult => {
  const nextStates = new Map(states);
  const prev = nextStates.get(r.factId);
  if (prev) nextStates.set(r.factId, applyResponse(prev, r));

  const s: SessionState = {
    ...session,
    responses: [...session.responses, r],
    queue: [...session.queue],
    succeeded: [...session.succeeded],
  };

  if (r.isRetry) {
    // The re-entry closed the loop on a wrong answer. Advance, but the fact
    // was already requeued when the wrong answer landed.
    s.cursor += 1;
    return finish(deck, nextStates, s);
  }

  if (r.correct && !s.succeeded.includes(r.factId)) s.succeeded.push(r.factId);

  const needsAnother = !r.correct || r.cls === "effortful";
  if (needsAnother && s.queue.length < SESSION_HARD_CAP) {
    const at = Math.min(s.cursor + REQUEUE_GAP, s.queue.length);
    s.queue.splice(at, 0, r.factId);
  }

  // A wrong answer does not advance the cursor here: the UI must collect the
  // forced re-entry first, and that arrives as a separate isRetry response.
  if (r.correct) s.cursor += 1;

  return finish(deck, nextStates, s);
};

/** Append the closer and settle the status once the main queue is spent. */
const finish = (
  deck: Deck, states: Map<string, FactState>, s: SessionState,
): StepResult => {
  if (s.closerAdded) {
    if (s.cursor >= s.queue.length && s.status === "active") s.status = "complete";
    return { session: s, states };
  }

  const spent = s.cursor >= s.queue.length;
  const capped = s.responses.filter((r) => !r.isRetry).length >= SESSION_HARD_CAP;
  const struggling = isStruggling(s);

  if (spent || capped || struggling) {
    const closer = closerIds(deck, states, s);
    s.queue = [...s.queue.slice(0, s.cursor), ...closer];
    s.closerAdded = true;
    s.status = struggling && !spent ? "endedEarly" : "active";
    if (s.cursor >= s.queue.length) s.status = struggling ? "endedEarly" : "complete";
  }

  return { session: s, states };
};

export const sessionIsOver = (s: SessionState): boolean =>
  s.closerAdded && s.cursor >= s.queue.length;

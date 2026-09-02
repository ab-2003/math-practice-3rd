import {
  CLOSER_ITEMS, COLD_CHECK_ITEMS, COLD_CHECK_DAYS, COLD_CHECK_MIN_POOL,
  FATIGUE_FLOOR_MS, FATIGUE_MIN_ITEMS, FATIGUE_RATIO, FATIGUE_WINDOW,
  NEW_FACT_GATE, NEW_FILL_MAX, REQUEUE_GAP,
  SESSION_HARD_CAP, SESSION_MAX_ITEMS, SESSION_TARGET_ITEMS, STRUGGLE_THRESHOLD,
  STRUGGLE_WINDOW, TOPUP_MAX_BOX,
} from "./config";
import { deckInIntroOrder } from "./facts";
import { applyResponse, canIntroduce, isDue } from "./scheduler";
import type { Caps, Deck, Fact, FactState, Response, SessionState, States, Strands } from "./types";

/**
 * SESSION ASSEMBLY.
 *
 * Order: everything due, then new facts only if the due queue leaves room.
 * The gate is the anti-drowning rule: a heavy review day simply has no space
 * for anything new, so a bad day cannot compound into a worse one.
 */
export const ALL_STRANDS: Strands = { add: true, sub: true, mul: true, div: true };
export const NO_CAPS: Caps = { add: null, sub: null, mul: null, div: null };
const NONE: ReadonlySet<string> = new Set();

/** Does this fact sit inside the parent's magnitude cap for its operation? */
export const withinCap = (f: Fact, caps: Caps): boolean => {
  const cap = caps[f.kind];
  if (cap === null) return true;
  // + and x cap the answer; - and / cap the number he starts from.
  return f.kind === "add" || f.kind === "mul" ? f.answer <= cap : f.a <= cap;
};

/** Is this fact's operation switched on, and the fact within reach? */
export const inPlay = (f: Fact, strands: Strands, caps: Caps = NO_CAPS): boolean =>
  strands[f.kind] && withinCap(f, caps);

export const planQueue = (
  deck: Deck, states: States, day: number, strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
  exclude: ReadonlySet<string> = NONE,
): string[] => {
  const due = [...deck.values()]
    .filter((f) => {
      const s = states.get(f.id);
      return s !== undefined && isDue(s, day) && inPlay(f, strands, caps) && !exclude.has(f.id);
    })
    // Most overdue first, then weakest box: the things he is shakiest on get
    // seen while he still has attention to spend on them.
    .sort((x, y) => {
      const sx = states.get(x.id)!;
      const sy = states.get(y.id)!;
      return sx.dueOn - sy.dueOn || sx.box - sy.box;
    });

  // INTERLEAVE within each priority band. Facts introduced together share a
  // dueOn and a box, so a plain sort hands him eight additions in a row and
  // then eight subtractions: blocked practice, which the research is clear
  // is the weaker kind. Shuffling only WITHIN equal keys keeps the priority
  // order exact and breaks the same-operation runs. Seeded by the day, so a
  // probe and a second sitting see the same queue.
  const queue = bandShuffle(due, (f) => `${states.get(f.id)!.dueOn}:${states.get(f.id)!.box}`, day)
    .map((f) => f.id)
    .slice(0, SESSION_MAX_ITEMS);

  if (due.length < NEW_FACT_GATE) {
    // FILL, don't drip. The session takes as much new material as fits its
    // target, and first-sight placement (scheduler.ts) makes the flood self-
    // limiting: what he already owns flies to a distant box after one look,
    // and what he does not stacks up as due work that closes this gate.
    const room = Math.min(NEW_FILL_MAX, SESSION_TARGET_ITEMS - queue.length);
    for (const id of nextNewFacts(deck, states, room, strands, caps)) if (!exclude.has(id)) queue.push(id);
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
        return s !== undefined && s.introduced && !inQueue.has(f.id) && !exclude.has(f.id)
          && s.box <= TOPUP_MAX_BOX && inPlay(f, strands, caps);
      })
      .sort((x, y) => states.get(x.id)!.box - states.get(y.id)!.box || states.get(x.id)!.dueOn - states.get(y.id)!.dueOn);
    for (const f of bandShuffle(spare, (f) => `${states.get(f.id)!.box}:${states.get(f.id)!.dueOn}`, day + 7919)) {
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
export const nextNewFacts = (
  deck: Deck, states: States, room: number, strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
): string[] => {
  const lanes = new Map<string, Fact[]>();
  for (const f of deckInIntroOrder(deck)) {
    const s = states.get(f.id);
    if (!s || s.introduced) continue;
    if (!inPlay(f, strands, caps)) continue;
    if (!canIntroduce(f, states)) continue;
    const list = lanes.get(f.kind);
    if (list) list.push(f);
    else lanes.set(f.kind, [f]);
  }
  const out: string[] = [];
  const kinds = [...lanes.keys()];
  for (let round = 0; out.length < room; round++) {
    let progressed = false;
    for (const k of kinds) {
      if (out.length >= room) break;
      const f = lanes.get(k)![round];
      if (!f) continue;
      out.push(f.id);
      progressed = true;
    }
    if (!progressed) break;
  }
  return out;
};

/**
 * Start a session. `cold` is the week's cold check (see coldCheckIds): those
 * ids open the queue, unannounced, ahead of everything the planner chooses,
 * and are kept out of the planner's own draw so nothing is asked twice.
 */
export const startSession = (
  deck: Deck, states: States, day: number, strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
  cold: readonly string[] = [],
): SessionState => ({
  day,
  queue: [...cold, ...planQueue(deck, states, day, strands, caps, new Set(cold))],
  cursor: 0,
  responses: [],
  closerAdded: false,
  status: "active",
  succeeded: [],
  coldCount: cold.length,
});

export const currentFactId = (s: SessionState): string | null =>
  s.cursor < s.queue.length ? (s.queue[s.cursor] ?? null) : null;

/** Is the item under the cursor one of the cold check? Requeues never land
 *  inside the cold zone because REQUEUE_GAP >= COLD_CHECK_ITEMS (pinned by
 *  test), so position alone is the truth. */
export const isColdItem = (s: SessionState): boolean => s.cursor < s.coldCount;

// ---------------------------------------------------------------------------
// THE COLD CHECK
// ---------------------------------------------------------------------------

/** A week since the last one (or never had one). */
export const coldCheckDue = (lastColdDay: number | null, day: number): boolean =>
  lastColdDay === null || day - lastColdDay >= COLD_CHECK_DAYS;

/**
 * Up to COLD_CHECK_ITEMS mastered, in-play facts, the ones he has gone
 * LONGEST without retrieving first (the coldest), tie-broken by a day-seeded
 * shuffle. Empty when the mastered pool is too thin to say anything.
 */
export const coldCheckIds = (
  deck: Deck, states: States, day: number, strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
): string[] => {
  const pool = [...deck.values()].filter((f) => {
    const s = states.get(f.id);
    return s !== undefined && s.mastered && inPlay(f, strands, caps);
  });
  if (pool.length < COLD_CHECK_MIN_POOL) return [];
  const shuffled = shuffleStable(pool.map((f) => f.id), day * 31 + 17);
  return shuffled
    .sort((x, y) => (states.get(x)!.lastRetrievedDay ?? -1) - (states.get(y)!.lastRetrievedDay ?? -1))
    .slice(0, COLD_CHECK_ITEMS);
};

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
export const closerIds = (
  deck: Deck, states: States, s: SessionState, strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
): string[] => {
  const asked = new Set(s.queue);
  const pick = (ids: string[]): string[] => ids.slice(0, CLOSER_ITEMS);
  const playable = (id: string): boolean => {
    const f = deck.get(id);
    return f !== undefined && inPlay(f, strands, caps);
  };

  const mastered = [...deck.keys()].filter((id) => states.get(id)?.mastered === true && playable(id));
  if (mastered.length >= CLOSER_ITEMS) return pick(shuffleStable(mastered, s.day));

  const strong = [...deck.keys()]
    .filter((id) => {
      const st = states.get(id);
      return st !== undefined && st.introduced && st.box >= 3 && playable(id);
    })
    .sort((x, y) => (states.get(y)!.box) - (states.get(x)!.box));
  const fromStrong = [...mastered, ...strong.filter((id) => !mastered.includes(id))];
  if (fromStrong.length >= CLOSER_ITEMS) return pick(fromStrong);

  // Last resort, and the day-one path: things he got right in this very
  // session. Prefer ones already in the queue only if nothing else exists.
  const won = s.succeeded.filter((id) => !fromStrong.includes(id) && playable(id));
  const pool = [...fromStrong, ...won];
  if (pool.length > 0) return pick(pool);

  // He got nothing right at all. End on the easiest thing in the deck rather
  // than on nothing: an empty ending is worse than a gentle one.
  return pick([...asked].slice(0, CLOSER_ITEMS));
};

/** Deterministic shuffle so a session is reproducible in tests and probes. */
export const shuffleStable = <T>(items: readonly T[], seed: number): T[] => {
  const out = [...items];
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
 * Shuffle WITHIN runs of equal key, leaving the order of the runs untouched.
 * The input must already be sorted by that key; this only stirs each band.
 */
export const bandShuffle = <T>(sorted: readonly T[], keyOf: (t: T) => string, seed: number): T[] => {
  const out: T[] = [];
  let i = 0;
  let band = 0;
  while (i < sorted.length) {
    const key = keyOf(sorted[i]!);
    let j = i;
    while (j < sorted.length && keyOf(sorted[j]!) === key) j++;
    out.push(...shuffleStable(sorted.slice(i, j), seed * 131 + band));
    i = j;
    band += 1;
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

const medianOf = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Is he TIRING? The clock creeping up across a sitting predicts a bad ending
 * before the misses arrive. Compares the median first-digit time of his last
 * FATIGUE_WINDOW correct answers against his first FATIGUE_WINDOW: tired means
 * the recent median is both FATIGUE_RATIO times the opening one and above an
 * absolute floor. Correct answers only, retries never, and no verdict until
 * there are enough real items to have a baseline at all.
 */
export const isFatigued = (s: SessionState): boolean => {
  const real = s.responses.filter((r) => !r.isRetry);
  if (real.length < FATIGUE_MIN_ITEMS) return false;
  const timed = real.filter((r) => r.correct && r.firstKeyMs !== null).map((r) => r.firstKeyMs!);
  if (timed.length < FATIGUE_WINDOW * 2) return false;
  const opening = medianOf(timed.slice(0, FATIGUE_WINDOW));
  const recent = medianOf(timed.slice(-FATIGUE_WINDOW));
  if (opening === null || recent === null) return false;
  return recent >= FATIGUE_FLOOR_MS && recent >= opening * FATIGUE_RATIO;
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
  strands: Strands = ALL_STRANDS, caps: Caps = NO_CAPS,
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
    return finish(deck, nextStates, s, strands, caps);
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

  return finish(deck, nextStates, s, strands, caps);
};

/** Append the closer and settle the status once the main queue is spent. */
const finish = (
  deck: Deck, states: Map<string, FactState>, s: SessionState, strands: Strands, caps: Caps,
): StepResult => {
  if (s.closerAdded) {
    if (s.cursor >= s.queue.length && s.status === "active") s.status = "complete";
    return { session: s, states };
  }

  const spent = s.cursor >= s.queue.length;
  const capped = s.responses.filter((r) => !r.isRetry).length >= SESSION_HARD_CAP;
  const struggling = isStruggling(s);

  if (spent || capped || struggling) {
    const closer = closerIds(deck, states, s, strands, caps);
    s.queue = [...s.queue.slice(0, s.cursor), ...closer];
    s.closerAdded = true;
    s.status = struggling && !spent ? "endedEarly" : "active";
    if (s.cursor >= s.queue.length) s.status = struggling ? "endedEarly" : "complete";
  }

  return { session: s, states };
};

export const sessionIsOver = (s: SessionState): boolean =>
  s.closerAdded && s.cursor >= s.queue.length;

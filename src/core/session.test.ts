import { describe, expect, it } from "vitest";
import {
  CLOSER_ITEMS, COLD_CHECK_DAYS, COLD_CHECK_ITEMS, COLD_CHECK_MIN_POOL, FATIGUE_MIN_ITEMS,
  FATIGUE_WINDOW, NEW_FACT_GATE, NEW_FILL_MAX, REQUEUE_GAP,
  SESSION_MAX_ITEMS, SESSION_TARGET_ITEMS, STRUGGLE_WINDOW,
} from "./config";
import { buildDeck, deckInIntroOrder } from "./facts";
import { forecast } from "./forecast";
import { allStates, freshState, reviveStrand } from "./scheduler";
import {
  bandShuffle, closerIds, coldCheckDue, coldCheckIds, currentFactId, familyOf, isColdItem, isFatigued,
  isStruggling, nextNewFacts, planQueue, recordResponse, sessionIsOver, spreadFamilies, startSession, withinCap,
} from "./session";
import type { Caps, FactState, Response, ResponseClass, SessionState, States, Strands } from "./types";

const deck = buildDeck();
const ordered = deckInIntroOrder(deck);

/** N facts, introduced and due today, in introduction order. */
const withDue = (n: number, day = 0, box = 2): Map<string, FactState> => {
  const states = allStates(deck);
  for (const f of ordered.slice(0, n)) {
    states.set(f.id, { ...freshState(), introduced: true, box, dueOn: day });
  }
  return states;
};

const answer = (
  factId: string, cls: ResponseClass, day = 0, correct = true, isRetry = false,
): Response => ({
  factId, day, at: 0,
  firstKeyMs: cls === "retrieved" ? 800 : cls === "derived" ? 5_000 : 12_000,
  submitMs: 13_000, correct, answered: correct ? 1 : -1, cls, isRetry,
});

/** Drive a whole session, answering every item the same way. */
const runSession = (
  states: States, cls: ResponseClass, day = 0, correct = true,
): { session: SessionState; states: States } => {
  let s = startSession(deck, states, day);
  let st: States = states;
  let guard = 0;
  while (!sessionIsOver(s) && guard++ < 500) {
    const id = currentFactId(s);
    if (id === null) break;
    const step = recordResponse(deck, st, s, answer(id, cls, day, correct));
    s = step.session;
    st = step.states;
    if (!correct) {
      // A wrong answer must be closed by the forced re-entry.
      const retry = recordResponse(deck, st, s, answer(id, "retrieved", day, true, true));
      s = retry.session;
      st = retry.states;
    }
  }
  return { session: s, states: st };
};

describe("session assembly", () => {
  it("pulls everything due, most overdue first", () => {
    const states = withDue(5);
    const s = states.get(ordered[3]!.id)!;
    states.set(ordered[3]!.id, { ...s, dueOn: -4 });
    const q = planQueue(deck, states, 0);
    expect(q[0]).toBe(ordered[3]!.id);
    expect(q.length).toBeGreaterThanOrEqual(5);
  });

  it("FILLS a clear day with new facts rather than dripping four", () => {
    // Andy, from the first real sessions: "I haven't gotten anything bigger
    // than like 3+2." A reviewer has to be allowed to move.
    const q = planQueue(deck, allStates(deck), 0);
    expect(q.length).toBe(NEW_FILL_MAX);
    // The same facts the tier order would pick, met in a stirred order.
    expect(new Set(q)).toEqual(new Set(nextNewFacts(deck, allStates(deck), NEW_FILL_MAX)));
    expect(q).toContain(ordered[0]!.id);
  });

  it("introduces NOTHING new once the due queue is at the gate", () => {
    // The anti-drowning rule: a heavy review day has no room for anything new,
    // so a bad day cannot compound into a worse one.
    const q = planQueue(deck, withDue(NEW_FACT_GATE), 0);
    expect(q.length).toBe(NEW_FACT_GATE);
    for (const id of q) expect(deck.get(id)!.tier).toBeLessThan(90);
  });

  it("caps the planned queue however much is due", () => {
    const q = planQueue(deck, withDue(200), 0);
    expect(q.length).toBe(SESSION_MAX_ITEMS);
  });

  it("never plans a division fact before its multiplication partner is solid", () => {
    const q = planQueue(deck, allStates(deck), 0);
    for (const id of q) expect(deck.get(id)!.kind).not.toBe("div");
  });
});

describe("the closer", () => {
  it("has a pool on day one, when nothing is mastered yet", () => {
    // The literal spec rule leaves the most important moment in the app, the
    // ending of his very first session, with an empty pool.
    const { session } = runSession(allStates(deck), "retrieved");
    expect(session.closerAdded).toBe(true);
    const closer = session.queue.slice(-CLOSER_ITEMS);
    expect(closer.length).toBe(CLOSER_ITEMS);
    for (const id of closer) expect(session.succeeded).toContain(id);
  });

  it("prefers mastered facts once there are any", () => {
    const states = withDue(20);
    const master = ordered.slice(0, 5).map((f) => f.id);
    for (const id of master) {
      states.set(id, { ...states.get(id)!, box: 5, mastered: true, masteryStreak: 3 });
    }
    const ids = closerIds(deck, states, startSession(deck, states, 0));
    expect(ids.length).toBe(CLOSER_ITEMS);
    for (const id of ids) expect(master).toContain(id);
  });

  it("always ends the session on the closer", () => {
    const { session } = runSession(withDue(10), "derived");
    expect(sessionIsOver(session)).toBe(true);
    expect(session.status).toBe("complete");
    const real = session.responses.filter((r) => !r.isRetry);
    const last = real.slice(-CLOSER_ITEMS);
    expect(last.every((r) => r.correct)).toBe(true);
  });
});

describe("requeueing", () => {
  it("brings a missed fact back later in the same session, never immediately", () => {
    const states = withDue(20);
    const s0 = startSession(deck, states, 0);
    const id = currentFactId(s0)!;
    const { session } = recordResponse(deck, states, s0, answer(id, "effortful"));
    expect(session.cursor).toBe(1);
    expect(session.queue[REQUEUE_GAP]).toBe(id);
    expect(session.queue[1]).not.toBe(id);
  });

  it("holds the cursor on a wrong answer until the re-entry arrives", () => {
    // He cannot be allowed to skip past a wrong answer.
    const states = withDue(20);
    const s0 = startSession(deck, states, 0);
    const id = currentFactId(s0)!;
    const wrong = recordResponse(deck, states, s0, answer(id, "effortful", 0, false));
    expect(wrong.session.cursor).toBe(0);
    expect(currentFactId(wrong.session)).toBe(id);

    const retry = recordResponse(deck, wrong.states, wrong.session, answer(id, "retrieved", 0, true, true));
    expect(retry.session.cursor).toBe(1);
    expect(retry.states.get(id)!.box).toBe(1); // demoted by the wrong answer, untouched by the retry
  });
});

describe("the struggle detector", () => {
  it("stays quiet while the rider is doing fine", () => {
    const { session } = runSession(withDue(20), "derived");
    expect(session.status).toBe("complete");
  });

  it("ends the session early, and says so, when the rider is grinding", () => {
    const states = withDue(30);
    let s = startSession(deck, states, 0);
    let st: States = states;
    for (let i = 0; i < STRUGGLE_WINDOW; i++) {
      const id = currentFactId(s)!;
      const step = recordResponse(deck, st, s, answer(id, "effortful"));
      s = step.session;
      st = step.states;
    }
    expect(isStruggling(s)).toBe(true);
    expect(s.closerAdded).toBe(true);
    expect(s.status).toBe("endedEarly");
    // It still ends on success rather than stopping dead.
    expect(s.queue.length - s.cursor).toBe(CLOSER_ITEMS);
  });

  it("ignores the forced re-entries when judging struggle", () => {
    const s: SessionState = {
      day: 0, queue: [], cursor: 0, closerAdded: false, status: "active", succeeded: [], coldCount: 0,
      responses: Array.from({ length: STRUGGLE_WINDOW }, () =>
        answer("add:0+0", "retrieved", 0, true, true)),
    };
    expect(isStruggling(s)).toBe(false);
  });
});

describe("the fatigue detector", () => {
  const session = (times: number[], extra: Partial<Response> = {}): SessionState => ({
    day: 0, queue: [], cursor: 0, closerAdded: false, status: "active", succeeded: [], coldCount: 0,
    responses: times.map((ms) => ({ ...answer("add:7+8", "retrieved"), firstKeyMs: ms, ...extra })),
  });
  const opening = Array.from({ length: FATIGUE_WINDOW }, () => 900);

  it("says tired when the clock has crept well above where the sitting started", () => {
    const s = session([...opening, ...Array.from({ length: FATIGUE_WINDOW }, () => 2400)]);
    expect(isFatigued(s)).toBe(true);
  });

  it("stays quiet on a steady sitting, and on a drift that never leaves the floor", () => {
    expect(isFatigued(session([...opening, ...opening]))).toBe(false);
    // 600ms to 1000ms is a ratio of 1.7 but nowhere near a tired boy.
    expect(isFatigued(session([...Array.from({ length: 8 }, () => 600), ...Array.from({ length: 8 }, () => 1000)]))).toBe(false);
  });

  it("has no opinion before there is a baseline to compare against", () => {
    const s = session(Array.from({ length: FATIGUE_MIN_ITEMS - 1 }, (_, i) => (i < 8 ? 900 : 5000)));
    expect(isFatigued(s)).toBe(false);
  });

  it("ignores the forced re-entries and wrong answers when judging fatigue", () => {
    const slowRetries = session([...opening, ...Array.from({ length: FATIGUE_WINDOW }, () => 4000)], { isRetry: true });
    expect(isFatigued(slowRetries)).toBe(false);
  });
});

describe("spacing out one family", () => {
  // Andy's phone (2026-09-03): "I get a lot of ascending or descending
  // problems like 16-7 then 16-8 then 16-9. I don't think we should
  // intentionally do that?" We did not mean to: intro order within a tier
  // runs minuend then subtrahend, and the new block was handed over as is.
  const adjacentSameFamily = (q: readonly string[]): number => {
    let n = 0;
    for (let i = 1; i < q.length; i++) if (familyOf(deck.get(q[i]!)!) === familyOf(deck.get(q[i - 1]!)!)) n += 1;
    return n;
  };

  it("names the family: the sum, the minuend, the product, the dividend", () => {
    expect(familyOf(deck.get("sub:16-7")!)).toBe(familyOf(deck.get("sub:16-9")!));
    expect(familyOf(deck.get("add:7+9")!)).toBe(familyOf(deck.get("add:8+8")!));
    expect(familyOf(deck.get("mul:3x4")!)).toBe(familyOf(deck.get("mul:2x6")!));
    expect(familyOf(deck.get("sub:16-7")!)).not.toBe(familyOf(deck.get("sub:15-7")!));
  });

  it("never hands him 16-7, 16-8, 16-9 in a row when there is anything else to hand him", () => {
    const ids = ["sub:16-7", "sub:16-8", "sub:16-9", "sub:15-6", "sub:15-7", "sub:15-8", "sub:14-5", "sub:14-6", "sub:14-7"];
    const spread = spreadFamilies(ids, deck);
    expect(adjacentSameFamily(spread)).toBe(0);
    expect(new Set(spread)).toEqual(new Set(ids));
    expect(spread[0]).toBe("sub:16-7"); // the head never moves
    // All one family: nothing to do, and nothing breaks.
    expect(spreadFamilies(["sub:16-7", "sub:16-8", "sub:16-9"], deck)).toEqual(["sub:16-7", "sub:16-8", "sub:16-9"]);
  });

  it("spaces the new block and the due queue alike, and stays predictable", () => {
    const fill = planQueue(deck, allStates(deck), 5);
    expect(adjacentSameFamily(fill)).toBe(0);
    expect(planQueue(deck, allStates(deck), 5)).toEqual(fill);
    // Nine neighbours introduced together, all due: still spaced.
    const states = allStates(deck);
    for (const id of ["sub:16-7", "sub:16-8", "sub:16-9", "sub:15-6", "sub:15-7", "sub:15-8", "sub:14-5", "sub:14-6", "sub:14-7"]) {
      states.set(id, { ...freshState(), introduced: true, box: 2, dueOn: 0 });
    }
    const q = planQueue(deck, states, 2, { add: false, sub: true, mul: false, div: false });
    expect(adjacentSameFamily(q.slice(0, 9))).toBe(0);
  });
});

describe("interleaving within priority bands", () => {
  it("breaks up same-operation runs without disturbing the priority order", () => {
    // Twenty additions and twenty subtractions introduced together share one
    // dueOn and one box: a plain sort hands him twenty of one kind in a row.
    const states = allStates(deck);
    const adds = [...deck.values()].filter((f) => f.kind === "add").slice(0, 20);
    const subs = [...deck.values()].filter((f) => f.kind === "sub").slice(0, 20);
    for (const f of [...adds, ...subs]) states.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 0 });
    const q = planQueue(deck, states, 3);
    const kinds = q.slice(0, 40).map((id) => deck.get(id)!.kind);
    let longestRun = 1;
    let run = 1;
    for (let i = 1; i < kinds.length; i++) {
      run = kinds[i] === kinds[i - 1] ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
    }
    expect(longestRun).toBeLessThan(8);
    // Same day, same queue: a probe can predict it.
    expect(planQueue(deck, states, 3)).toEqual(q);
  });

  it("only ever stirs inside a band, never across one", () => {
    const items = [1, 1, 1, 2, 2, 3, 3, 3, 3].map((band, i) => ({ band, i }));
    const out = bandShuffle(items, (t) => String(t.band), 5);
    expect(out.map((t) => t.band)).toEqual([1, 1, 1, 2, 2, 3, 3, 3, 3]);
    // The most overdue fact is a band of one and still comes first.
    const states = withDue(5);
    states.set(ordered[3]!.id, { ...states.get(ordered[3]!.id)!, dueOn: -4 });
    expect(planQueue(deck, states, 0)[0]).toBe(ordered[3]!.id);
  });
});

describe("the cold check", () => {
  const mastered = (n: number, lastDay = 0): Map<string, FactState> => {
    const states = allStates(deck);
    for (const f of ordered.slice(0, n)) {
      states.set(f.id, { ...freshState(), introduced: true, box: 6, dueOn: 99, mastered: true, masteryStreak: 3, lastRetrievedDay: lastDay });
    }
    return states;
  };

  it("is due once a week, and on the very first day", () => {
    expect(coldCheckDue(null, 0)).toBe(true);
    expect(coldCheckDue(0, COLD_CHECK_DAYS - 1)).toBe(false);
    expect(coldCheckDue(0, COLD_CHECK_DAYS)).toBe(true);
  });

  it("draws a few MASTERED facts, the coldest first, deterministically", () => {
    const states = mastered(20);
    states.set(ordered[4]!.id, { ...states.get(ordered[4]!.id)!, lastRetrievedDay: -30 });
    const ids = coldCheckIds(deck, states, 10);
    expect(ids.length).toBe(COLD_CHECK_ITEMS);
    expect(ids[0]).toBe(ordered[4]!.id);
    for (const id of ids) expect(states.get(id)!.mastered).toBe(true);
    expect(coldCheckIds(deck, states, 10)).toEqual(ids);
  });

  it("stays silent while the mastered pool is too thin to mean anything", () => {
    expect(coldCheckIds(deck, mastered(COLD_CHECK_MIN_POOL - 1), 10)).toEqual([]);
    expect(coldCheckIds(deck, mastered(COLD_CHECK_MIN_POOL), 10).length).toBe(COLD_CHECK_MIN_POOL);
  });

  it("respects the switched-on operations and the caps", () => {
    const states = mastered(40);
    const ids = coldCheckIds(deck, states, 10, { add: true, sub: false, mul: false, div: false });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(deck.get(id)!.kind).toBe("add");
  });

  it("opens the session, unannounced, and is asked exactly once", () => {
    const states = mastered(20);
    for (const f of ordered.slice(20, 40)) states.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 0 });
    const cold = coldCheckIds(deck, states, 10);
    const s = startSession(deck, states, 10, undefined, undefined, cold);
    expect(s.queue.slice(0, cold.length)).toEqual(cold);
    expect(s.coldCount).toBe(cold.length);
    expect(isColdItem(s)).toBe(true);
    // Nothing the planner drew repeats a cold item.
    expect(s.queue.slice(cold.length).some((id) => cold.includes(id))).toBe(false);
    // And after the cold zone, items are ordinary.
    expect(isColdItem({ ...s, cursor: cold.length })).toBe(false);
  });

  it("never lets a requeue land inside the cold zone", () => {
    // The gap is what keeps the cold positions pure: pinned here so nobody
    // shortens REQUEUE_GAP below the cold check without hearing about it.
    expect(REQUEUE_GAP).toBeGreaterThanOrEqual(COLD_CHECK_ITEMS);
    const states = mastered(20);
    for (const f of ordered.slice(20, 40)) states.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 0 });
    const cold = coldCheckIds(deck, states, 10);
    let s = startSession(deck, states, 10, undefined, undefined, cold);
    const first = currentFactId(s)!;
    s = recordResponse(deck, states, s, answer(first, "effortful", 10)).session;
    expect(s.queue.slice(0, cold.length)).toEqual(cold);
    expect(s.queue[REQUEUE_GAP]).toBe(first);
  });
});

describe("tomorrow's queue", () => {
  it("runs the real planner a day ahead and sorts the answer into due, new and top-up", () => {
    const states = allStates(deck);
    for (const f of ordered.slice(0, 6)) states.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 1 });
    for (const f of ordered.slice(6, 10)) states.set(f.id, { ...freshState(), introduced: true, box: 3, dueOn: 50 });
    const fc = forecast(deck, states, 1, { add: true, sub: true, mul: false, div: false }, { add: null, sub: null, mul: null, div: null });
    expect(fc.due).toBe(6);
    expect(fc.fresh.length).toBeGreaterThan(0);
    expect(fc.topUp).toBe(4);
    expect(fc.total).toBe(fc.due + fc.fresh.length + fc.topUp);
    for (const f of fc.fresh) expect(["add", "sub"]).toContain(f.kind);
  });
});

describe("topping up to a workable session", () => {
  it("fills a thin session to the target length", () => {
    // Leitner alone produces a three minute sitting. Simulation, not
    // guesswork, is what said so.
    const states = withDue(6);
    for (const f of ordered.slice(6, 80)) {
      states.set(f.id, { ...freshState(), introduced: true, box: 4, dueOn: 99 });
    }
    const q = planQueue(deck, states, 0);
    expect(q.length).toBe(SESSION_TARGET_ITEMS);
  });

  it("puts the weakest facts first and lets the strong ones pad the tail", () => {
    const states = allStates(deck);
    ordered.slice(0, 60).forEach((f, i) => {
      states.set(f.id, { ...freshState(), introduced: true, box: i < 10 ? 1 : 5, dueOn: 99 });
    });
    const q = planQueue(deck, states, 0);
    const boxes = q.map((id) => states.get(id)!.box);
    expect(boxes.slice(0, 10).every((b) => b === 1)).toBe(true);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!).toBeGreaterThanOrEqual(boxes[i - 1]!);
  });

  it("still fills a whole sitting once the entire deck is owned", () => {
    // The 200-day simulation's find: with the long boxes, a boy who owned
    // the deck got three-item sessions and empty days, and could never have
    // reached his dose again. Filler may draw from any owned box.
    const states = allStates(deck);
    for (const f of deck.values()) states.set(f.id, { ...freshState(), introduced: true, box: 7, mastered: true, dueOn: 500 });
    expect(planQueue(deck, states, 100).length).toBe(SESSION_TARGET_ITEMS);
  });

  it("never tops up past the target, or past the hard plan cap", () => {
    const states = withDue(200);
    expect(planQueue(deck, states, 0).length).toBe(SESSION_MAX_ITEMS);
    const thin = allStates(deck);
    for (const f of ordered.slice(0, 300)) {
      thin.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 99 });
    }
    expect(planQueue(deck, thin, 0).length).toBe(SESSION_TARGET_ITEMS);
  });
});

describe("new facts across strands", () => {
  it("advances every open strand instead of starving three of them", () => {
    // A strict tier walk left subtraction at 21 of 121 after ten simulated
    // weeks, because every subtraction tier sits behind an addition tier.
    const states = allStates(deck);
    const seen = new Set<string>();
    for (let round = 0; round < 12; round++) {
      for (const id of nextNewFacts(deck, states, 4)) {
        seen.add(deck.get(id)!.kind);
        states.set(id, { ...freshState(), introduced: true, box: 3, dueOn: 99 });
      }
    }
    expect(seen.has("add")).toBe(true);
    expect(seen.has("sub")).toBe(true);
    expect(seen.has("mul")).toBe(true);
  });

  it("still walks strictly by tier WITHIN a strand", () => {
    const states = allStates(deck);
    const picked: number[] = [];
    for (let round = 0; round < 20; round++) {
      for (const id of nextNewFacts(deck, states, 4)) {
        const f = deck.get(id)!;
        if (f.kind === "mul") picked.push(f.tier);
        states.set(id, { ...freshState(), introduced: true, box: 3, dueOn: 99 });
      }
    }
    expect(picked.length).toBeGreaterThan(5);
    for (let i = 1; i < picked.length; i++) expect(picked[i]!).toBeGreaterThanOrEqual(picked[i - 1]!);
  });

  it("lets division in once its own family is solid, not after the whole deck", () => {
    const states = allStates(deck);
    for (const f of deck.values()) {
      if (f.kind === "mul") states.set(f.id, { ...freshState(), introduced: true, box: 4, dueOn: 99 });
    }
    const ids = nextNewFacts(deck, states, 20);
    expect(ids.some((id) => deck.get(id)!.kind === "div")).toBe(true);
  });
});

describe("practising only some operations", () => {
  const onlyAddSub: Strands = { add: true, sub: true, mul: false, div: false };

  it("never introduces a fact from a switched-off operation", () => {
    // School reaches multiplication when it reaches it. Drilling an operation
    // nobody has taught him is not practice.
    const ids = nextNewFacts(deck, allStates(deck), 20, onlyAddSub);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(["add", "sub"]).toContain(deck.get(id)!.kind);
  });

  it("drops switched-off facts out of the due queue entirely", () => {
    const states = withDue(60);
    const q = planQueue(deck, states, 0, onlyAddSub);
    expect(q.length).toBeGreaterThan(0);
    for (const id of q) expect(["add", "sub"]).toContain(deck.get(id)!.kind);
  });

  it("does not top up a session with switched-off facts", () => {
    const states = allStates(deck);
    for (const f of ordered.slice(0, 120)) {
      states.set(f.id, { ...freshState(), introduced: true, box: 2, dueOn: 99 });
    }
    const q = planQueue(deck, states, 0, onlyAddSub);
    for (const id of q) expect(["add", "sub"]).toContain(deck.get(id)!.kind);
  });

  it("ends the session on a switched-on fact, never a switched-off one", () => {
    const states = withDue(60);
    for (const f of ordered.slice(0, 60)) {
      if (f.kind === "mul") states.set(f.id, { ...states.get(f.id)!, box: 5, mastered: true, masteryStreak: 3 });
    }
    const s = startSession(deck, states, 0, onlyAddSub);
    const ids = closerIds(deck, states, s, onlyAddSub);
    for (const id of ids) expect(["add", "sub"]).toContain(deck.get(id)!.kind);
  });

  it("KEEPS the progress in a switched-off operation rather than resetting it", () => {
    const states = withDue(60);
    const mulId = [...deck.values()].find((f) => f.kind === "mul")!.id;
    states.set(mulId, { ...freshState(), introduced: true, box: 4, mastered: true, masteryStreak: 3, dueOn: 0 });
    planQueue(deck, states, 0, onlyAddSub);
    expect(states.get(mulId)!.box).toBe(4);
    expect(states.get(mulId)!.mastered).toBe(true);
  });
});

describe("switching an operation back on", () => {
  it("makes a term's worth of overdue facts due today, not overdue by a term", () => {
    // Otherwise the whole strand avalanches into one session, ordered by an
    // overdue-ness that only measures how long the switch was off.
    const states = allStates(deck);
    const muls = [...deck.values()].filter((f) => f.kind === "mul").slice(0, 20);
    for (const f of muls) states.set(f.id, { ...freshState(), introduced: true, box: 4, dueOn: 5 });
    const revived = reviveStrand(deck, states, "mul", 95);
    for (const f of muls) {
      expect(revived.get(f.id)!.dueOn).toBe(95);
      expect(revived.get(f.id)!.box).toBe(4); // progress untouched
    }
  });

  it("leaves a fact that is not yet due alone", () => {
    const states = allStates(deck);
    const f = [...deck.values()].find((x) => x.kind === "mul")!;
    states.set(f.id, { ...freshState(), introduced: true, box: 5, dueOn: 120 });
    expect(reviveStrand(deck, states, "mul", 95).get(f.id)!.dueOn).toBe(120);
  });

  it("never revives a fact the rider has not met yet", () => {
    const states = allStates(deck);
    const f = [...deck.values()].find((x) => x.kind === "mul")!;
    const revived = reviveStrand(deck, states, "mul", 95);
    expect(revived.get(f.id)!.introduced).toBe(false);
    expect(revived.get(f.id)!.dueOn).toBe(0);
  });
});


describe("magnitude caps, for the very young", () => {
  const all: Strands = { add: true, sub: true, mul: true, div: true };
  const caps: Caps = { add: 6, sub: 6, mul: 20, div: 20 };

  it("caps the ANSWER for + and x, and the STARTING number for - and /", () => {
    expect(withinCap(deck.get("add:2+4")!, caps)).toBe(true);
    expect(withinCap(deck.get("add:3+4")!, caps)).toBe(false);
    expect(withinCap(deck.get("mul:4x5")!, caps)).toBe(true);
    expect(withinCap(deck.get("mul:5x5")!, caps)).toBe(false);
    expect(withinCap(deck.get("sub:6-2")!, caps)).toBe(true);
    expect(withinCap(deck.get("sub:7-2")!, caps)).toBe(false);
    expect(withinCap(deck.get("div:20/4")!, caps)).toBe(true);
    expect(withinCap(deck.get("div:25/5")!, caps)).toBe(false);
  });

  it("means no limit when null, which is the default", () => {
    for (const f of deck.values()) expect(withinCap(f, { add: null, sub: null, mul: null, div: null })).toBe(true);
  });

  it("keeps every capped-out fact out of the due queue, the new draw, the top-up and the closer", () => {
    const states = withDue(200, 0, 2);
    const q = planQueue(deck, states, 0, all, caps);
    expect(q.length).toBeGreaterThan(0);
    for (const id of q) expect(withinCap(deck.get(id)!, caps), id).toBe(true);
    const fresh = nextNewFacts(deck, allStates(deck), 30, all, caps);
    expect(fresh.length).toBeGreaterThan(0);
    for (const id of fresh) expect(withinCap(deck.get(id)!, caps), id).toBe(true);
    const s = startSession(deck, states, 0, all, caps);
    for (const id of closerIds(deck, states, s, all, caps)) expect(withinCap(deck.get(id)!, caps), id).toBe(true);
  });

  it("still has something to ask at the smallest sensible caps", () => {
    const tiny: Caps = { add: 2, sub: 2, mul: 5, div: 5 };
    expect(planQueue(deck, allStates(deck), 0, all, tiny).length).toBeGreaterThan(0);
  });
});

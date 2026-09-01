import { describe, expect, it } from "vitest";
import {
  CLOSER_ITEMS, NEW_FACT_GATE, NEW_FILL_MAX, REQUEUE_GAP,
  SESSION_MAX_ITEMS, SESSION_TARGET_ITEMS, STRUGGLE_WINDOW,
} from "./config";
import { buildDeck, deckInIntroOrder } from "./facts";
import { allStates, freshState, reviveStrand } from "./scheduler";
import {
  closerIds, currentFactId, isStruggling, nextNewFacts, planQueue,
  recordResponse, sessionIsOver, startSession,
} from "./session";
import type { FactState, Response, ResponseClass, SessionState, States, Strands } from "./types";

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
    expect(q[0]).toBe(ordered[0]!.id);
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
  it("stays quiet while he is doing fine", () => {
    const { session } = runSession(withDue(20), "derived");
    expect(session.status).toBe("complete");
  });

  it("ends the session early, and says so, when he is grinding", () => {
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
      day: 0, queue: [], cursor: 0, closerAdded: false, status: "active", succeeded: [],
      responses: Array.from({ length: STRUGGLE_WINDOW }, () =>
        answer("add:0+0", "retrieved", 0, true, true)),
    };
    expect(isStruggling(s)).toBe(false);
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

  it("never revives a fact he has not met yet", () => {
    const states = allStates(deck);
    const f = [...deck.values()].find((x) => x.kind === "mul")!;
    const revived = reviveStrand(deck, states, "mul", 95);
    expect(revived.get(f.id)!.introduced).toBe(false);
    expect(revived.get(f.id)!.dueOn).toBe(0);
  });
});

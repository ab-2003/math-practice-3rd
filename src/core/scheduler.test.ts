import { describe, expect, it } from "vitest";
import { DEMOTE_BOXES_ON_WRONG, FIRST_SIGHT_BOX, MASTERY_STREAK, MAX_BOX, MIN_BOX } from "./config";
import { buildDeck } from "./facts";
import { allStates, applyResponse, boxInterval, canIntroduce, freshState, isDue } from "./scheduler";
import type { FactState, Response, ResponseClass } from "./types";

const deck = buildDeck();

const resp = (
  cls: ResponseClass, day: number, correct = true, isRetry = false,
): Response => ({
  factId: "add:7+8", day, at: day * 86_400_000,
  firstKeyMs: cls === "retrieved" ? 900 : cls === "derived" ? 5_000 : 12_000,
  submitMs: 14_000, correct, answered: correct ? 15 : 14, cls, isRetry,
});

/** Walk a fact through a list of [class, day, correct] steps. */
const walk = (steps: Array<[ResponseClass, number, boolean?]>): FactState => {
  let s = freshState();
  for (const [cls, day, correct] of steps) s = applyResponse(s, resp(cls, day, correct ?? true));
  return s;
};

describe("the Leitner transition", () => {
  it("promotes a box on a retrieved answer and schedules by the new box", () => {
    const seen = { ...freshState(), seen: 2, introduced: true };
    const s = applyResponse(seen, resp("retrieved", 10));
    expect(s.box).toBe(2);
    expect(s.dueOn).toBe(10 + boxInterval(2));
    expect(s.introduced).toBe(true);
  });

  it("HOLDS the box on a derived answer, and credits it in full", () => {
    const start = { ...freshState(), box: 3, introduced: true };
    const s = applyResponse(start, resp("derived", 10));
    expect(s.box).toBe(3);
    expect(s.correct).toBe(1);
    expect(s.dueOn).toBe(10 + boxInterval(3));
  });

  it("does not reset the mastery streak on a derived answer", () => {
    // He was right. Resetting would punish a correct answer and put mastery
    // out of reach for a boy whose whole strength is derivation.
    const s = walk([["retrieved", 1], ["derived", 2], ["retrieved", 3], ["retrieved", 4]]);
    expect(s.mastered).toBe(true);
  });

  it("breaks the streak on an effortful answer but keeps the box", () => {
    const start = { ...freshState(), box: 3, masteryStreak: 2, introduced: true };
    const s = applyResponse(start, resp("effortful", 10));
    expect(s.box).toBe(3);
    expect(s.masteryStreak).toBe(0);
  });

  it("demotes two boxes on a wrong answer and asks again tomorrow", () => {
    const start = { ...freshState(), box: 4, introduced: true, mastered: true, masteryStreak: 3 };
    const s = applyResponse(start, resp("effortful", 10, false));
    expect(s.box).toBe(4 - DEMOTE_BOXES_ON_WRONG);
    expect(s.dueOn).toBe(11);
    expect(s.mastered).toBe(false);
    expect(s.masteryStreak).toBe(0);
  });

  it("floors the box at one and caps it at seven", () => {
    const low = applyResponse({ ...freshState(), box: MIN_BOX, introduced: true }, resp("effortful", 5, false));
    expect(low.box).toBe(MIN_BOX);
    const high = applyResponse({ ...freshState(), box: MAX_BOX, introduced: true, seen: 4 }, resp("retrieved", 5));
    expect(high.box).toBe(MAX_BOX);
    expect(MAX_BOX).toBe(7);
  });

  it("lets an owned fact drift out to two months between sightings", () => {
    // The maintenance arithmetic: 363 facts recycled every 16 days is ~23 due
    // a day just to re-prove what he knows. The long boxes exist for this.
    expect(boxInterval(5)).toBe(16);
    expect(boxInterval(6)).toBe(32);
    expect(boxInterval(7)).toBe(64);
    let s = { ...freshState(), box: 5, introduced: true, seen: 9 };
    s = applyResponse(s, resp("retrieved", 100));
    expect(s.box).toBe(6);
    expect(s.dueOn).toBe(132);
    s = applyResponse(s, resp("retrieved", 132));
    expect(s.box).toBe(7);
    expect(s.dueOn).toBe(196);
  });

  it("keeps steady-state maintenance to a handful a day once the deck is owned", () => {
    // Every fact at the top box, due dates spread evenly: how many come due
    // on a typical day? Under the old five-box ladder this was ~23.
    const per = Math.ceil(deck.size / boxInterval(MAX_BOX));
    expect(per).toBeLessThanOrEqual(6);
  });
});

describe("placement on first sight", () => {
  it("sends a fact he retrieved instantly, never having seen it, to a far box", () => {
    const s = applyResponse(freshState(), resp("retrieved", 10));
    expect(s.box).toBe(FIRST_SIGHT_BOX);
    expect(s.dueOn).toBe(10 + boxInterval(FIRST_SIGHT_BOX));
    expect(s.masteryStreak).toBe(1); // still three distinct days to mastery
  });

  it("gives no such jump to a derived first answer", () => {
    const s = applyResponse(freshState(), resp("derived", 10));
    expect(s.box).toBe(1);
  });

  it("climbs one rung at a time on every sighting after the first", () => {
    const first = applyResponse({ ...freshState(), seen: 1, introduced: true }, resp("retrieved", 10));
    expect(first.box).toBe(2);
  });
});

describe("mastery", () => {
  it("needs three retrieved answers on three DIFFERENT days", () => {
    const s = walk([["retrieved", 1], ["retrieved", 2], ["retrieved", 3]]);
    expect(s.masteryStreak).toBe(MASTERY_STREAK);
    expect(s.mastered).toBe(true);
  });

  it("refuses to count three retrieved answers inside one day", () => {
    // Three fast answers in one session are partly priming from having just
    // seen the fact. Only a new day is evidence it survived sleep.
    const s = walk([["retrieved", 1], ["retrieved", 1], ["retrieved", 1]]);
    expect(s.masteryStreak).toBe(1);
    expect(s.mastered).toBe(false);
  });

  it("does not let a same-day repeat reset the streak either", () => {
    const s = walk([["retrieved", 1], ["retrieved", 2], ["retrieved", 2], ["retrieved", 3]]);
    expect(s.mastered).toBe(true);
  });

  it("never promotes on derivation alone, however many times he is right", () => {
    const s = walk([["derived", 1], ["derived", 2], ["derived", 3], ["derived", 4], ["derived", 5]]);
    expect(s.mastered).toBe(false);
    expect(s.box).toBe(1);
    expect(s.correct).toBe(5); // but he was credited every single time
  });

  it("loses the label when a mastered fact is missed", () => {
    let s = walk([["retrieved", 1], ["retrieved", 2], ["retrieved", 3]]);
    expect(s.mastered).toBe(true);
    s = applyResponse(s, resp("effortful", 20, false));
    expect(s.mastered).toBe(false);
  });

  it("keeps a mastered fact in circulation rather than retiring it", () => {
    const s = walk([["retrieved", 1], ["retrieved", 2], ["retrieved", 3]]);
    expect(s.dueOn).toBeGreaterThan(3);
    expect(isDue(s, s.dueOn)).toBe(true);
  });
});

describe("the forced re-entry after a wrong answer", () => {
  it("never touches the schedule", () => {
    // He has just been shown the answer and the scaffold. Typing it back is
    // a closing gesture, not a retrieval event.
    const before = { ...freshState(), box: 2, introduced: true, seen: 4, correct: 2 };
    const after = applyResponse(before, resp("retrieved", 10, true, true));
    expect(after).toEqual(before);
  });
});

describe("division gating", () => {
  it("keeps a division fact locked until its multiplication partner is solid", () => {
    const states = allStates(deck);
    const div = deck.get("div:56/8")!;
    expect(canIntroduce(div, states)).toBe(false);

    states.set("mul:7x8", { ...freshState(), introduced: true, box: 2 });
    expect(canIntroduce(div, states)).toBe(false);

    states.set("mul:7x8", { ...freshState(), introduced: true, box: 3 });
    expect(canIntroduce(div, states)).toBe(true);
  });

  it("gates nothing else", () => {
    const states = allStates(deck);
    expect(canIntroduce(deck.get("add:7+8")!, states)).toBe(true);
    expect(canIntroduce(deck.get("mul:7x8")!, states)).toBe(true);
  });
});

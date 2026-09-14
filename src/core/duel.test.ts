import { describe, expect, it } from "vitest";
import {
  AIR_POINTS, ASK_MS, askClear, askKey, askSubmit, begin, BLOCK, courseFor, DUEL_LENS, duelDayReset, duelPlaysLeft, duelPlaysTotal,
  earnDuelToken, freshRecord, freshUsed, gesture, grantDuelToken, LAUNCH_VY, newDuel, nextWho, onFlat, recordDuel, surfaceSlope, surfaceY,
  TRASH_TALK, trashTalk, update, useDuelPlay, type DuelEvent, type DuelLen, type DuelMeta, type DuelState,
} from "./duel";
import { buildDeck } from "./facts";
import { G, LAND_TOL } from "./park";
import { RETRIEVED_MAX_MS } from "./config";
import type { Fact } from "./types";

const STEP = 1 / 120;
const deck = buildDeck();
const FACTS: Fact[] = [...deck.values()].filter((f) => f.kind === "add").slice(0, 30);
const course = courseFor(600);

/** Run the clock until the predicate holds or the budget runs out. */
const runUntil = (s: DuelState, pred: (ev: DuelEvent[]) => boolean, maxS = 30, onTick?: (ev: DuelEvent[]) => void): DuelEvent[] => {
  const all: DuelEvent[] = [];
  for (let t = 0; t < maxS; t += STEP) {
    const ev = update(s, STEP);
    all.push(...ev);
    onTick?.(ev);
    if (pred(ev)) break;
  }
  return all;
};
const kinds = (ev: DuelEvent[]): string[] => ev.map((e) => e.kind);
/** Type the answer to the open problem, digit by digit. */
const solve = (s: DuelState, ev: DuelEvent[]): void => {
  for (const d of String(s.ask!.shown.expected)) askKey(s, d, ev);
};
const fresh = (over: Partial<DuelMeta> = {}): DuelMeta => ({ duelDay: null, duelTokens: 0, duelUsed: freshUsed(), duelRecord: freshRecord(), duelWorkDay: null, ...over });

describe("duel tokens", () => {
  it("starts every day with one token, which is one play of each length", () => {
    const m = fresh();
    expect(duelPlaysLeft(m, 10, 10)).toBe(1);
    expect(duelPlaysLeft(m, 10, 20)).toBe(1);
    expect(duelPlaysTotal(m, 10)).toBe(3);
    expect(useDuelPlay(m, 10, 10)).toBe(true);
    expect(useDuelPlay(m, 10, 10)).toBe(false);   // the 10 is spent
    expect(useDuelPlay(m, 10, 15)).toBe(true);    // the 15 is not
    expect(duelPlaysTotal(m, 10)).toBe(1);
    // A new day: one token again, nothing carried, nothing owed.
    expect(duelPlaysLeft(m, 11, 10)).toBe(1);
    expect(duelPlaysTotal(m, 11)).toBe(3);
  });

  it("gives one more with the day's work, once a day, and any number from a grown-up", () => {
    const m = fresh();
    duelDayReset(m, 10);
    expect(earnDuelToken(m, 10)).toBe(true);
    expect(earnDuelToken(m, 10)).toBe(false);
    expect(duelPlaysLeft(m, 10, 15)).toBe(2);
    grantDuelToken(m, 10);
    grantDuelToken(m, 10);
    expect(duelPlaysLeft(m, 10, 15)).toBe(4);
    // Tomorrow the work earns again, and yesterday's tokens are gone.
    expect(earnDuelToken(m, 11)).toBe(true);
    expect(duelPlaysLeft(m, 11, 15)).toBe(2);
  });

  it("keeps a won and lost record for each length", () => {
    const m = fresh();
    recordDuel(m, 10, true); recordDuel(m, 10, false); recordDuel(m, 20, true);
    expect(m.duelRecord[10]).toEqual({ won: 1, lost: 1 });
    expect(m.duelRecord[15]).toEqual({ won: 0, lost: 0 });
    expect(m.duelRecord[20]).toEqual({ won: 1, lost: 0 });
    expect(DUEL_LENS).toEqual([10, 15, 20]);
  });
});

describe("the course", () => {
  it("is a U with a flat bottom: decks at both lips, walls tangent at the coping and the flat", () => {
    const c = course;
    expect(surfaceY(c, 0)).toBe(c.top);
    expect(surfaceY(c, c.deck)).toBe(c.top);
    expect(surfaceY(c, c.deck + c.wall)).toBeCloseTo(0, 5);
    expect(surfaceY(c, c.w / 2)).toBe(0);
    expect(surfaceY(c, c.w - c.deck - c.wall)).toBeCloseTo(0, 5);
    expect(surfaceY(c, c.w - c.deck)).toBe(c.top);
    expect(surfaceY(c, c.w)).toBe(c.top);
    // Mirror symmetric, and smooth at both ends of each wall.
    for (let x = 0; x <= c.w / 2; x += 7) expect(surfaceY(c, x)).toBeCloseTo(surfaceY(c, c.w - x), 5);
    // (The slope is an 8-unit sample, so "flat" is small next to the wall's
    // own pitch, not zero.)
    const pitch = Math.abs(surfaceSlope(c, c.deck + c.wall / 2));
    expect(pitch).toBeGreaterThan(1.5);
    expect(Math.abs(surfaceSlope(c, c.deck + 4))).toBeLessThan(pitch / 6);
    expect(Math.abs(surfaceSlope(c, c.deck + c.wall - 4))).toBeLessThan(pitch / 6);
    expect(onFlat(c, c.w / 2)).toBe(true);
    expect(onFlat(c, c.deck + 10)).toBe(false);
    // A wider stage gets a longer flat; the walls stay the same height.
    const wide = courseFor(880);
    expect(wide.w - 2 * wide.deck - 2 * wide.wall).toBeGreaterThan(c.w - 2 * c.deck - 2 * c.wall);
    expect(wide.top).toBe(c.top);
  });
});

describe("a run", () => {
  it("drops in, crosses the flat, launches out of the far lip, lands on the far deck, and that is a turn", () => {
    const s = newDuel(10, course, FACTS, 3);
    const ev: DuelEvent[] = [];
    begin(s, ev);
    expect(kinds(ev)).toEqual(["turn"]);
    expect(s.phase).toBe("you");
    let peak = 0;
    const all = runUntil(s, (e) => e.some((x) => x.kind === "runEnd"), 10, () => { peak = Math.max(peak, s.you.y); });
    expect(kinds(all)).toEqual(expect.arrayContaining(["dropIn", "launch", "land", "bank", "runEnd"]));
    expect(kinds(all)).not.toContain("bail");
    // Out of the lip he goes well above the deck, and comes down onto it.
    expect(peak).toBeGreaterThan(course.top + 150);
    expect(s.you.side).toBe(1);
    expect(s.yourRuns).toBe(1);
    // A clean lip air with nothing in it is worth a little, never nothing.
    const banked = all.find((e) => e.kind === "bank");
    expect(banked?.kind === "bank" && banked.points).toBe(AIR_POINTS);
    expect(s.yourScore).toBe(AIR_POINTS);
    // The next run goes back the other way.
    const next = runUntil(s, (e) => e.some((x) => x.kind === "dropIn"), 5);
    expect(kinds(next)).toContain("dropIn");
    expect(s.you.dir).toBe(-1);
  });

  it("takes his tricks on the flat and out of the lip, chains two in the big air, and bails a late one", () => {
    const s = newDuel(10, course, FACTS, 5);
    begin(s, []);
    // On the flat: a swipe ollies straight into a kickflip and lands it.
    runUntil(s, () => s.you.mode === "ride" && s.you.dropped && onFlat(course, s.you.x), 5);
    const ev: DuelEvent[] = [];
    gesture(s, "up", ev);
    expect(kinds(ev)).toEqual(["ollie", "trick"]);
    const flat = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    expect(kinds(flat)).toContain("trickDone");
    expect(kinds(flat)).not.toContain("bail");
    // Out of the lip: two tricks, chained, times two.
    runUntil(s, (e) => e.some((x) => x.kind === "launch"), 5);
    gesture(s, "up", []);                       // kickflip, 300ms
    runUntil(s, (e) => e.some((x) => x.kind === "trickDone"), 2);
    gesture(s, "down", []);                     // nose grab, 380ms, fits
    const lip = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    const banked = lip.find((e) => e.kind === "bank");
    expect(banked?.kind === "bank" && banked.chain.map((c) => c.name)).toEqual(["KICKFLIP", "NOSE GRAB"]);
    expect(banked?.kind === "bank" && banked.mult).toBe(2);
    expect(s.yourScore).toBe(100 + (100 + 150) * 2);
    // A backflip started late in the air is still turning at touchdown.
    runUntil(s, (e) => e.some((x) => x.kind === "runEnd"), 5);
    runUntil(s, (e) => e.some((x) => x.kind === "launch"), 6);
    for (let t = 0; t < 0.6; t += STEP) update(s, STEP);
    gesture(s, "left", []);
    const late = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    expect(kinds(late)).toContain("bail");
    // The bail does not end the run: he gets up and rolls to the deck's end.
    const end = runUntil(s, (e) => e.some((x) => x.kind === "runEnd"), 5);
    expect(kinds(end)).toContain("runEnd");
  });

  it("does nothing for a tap on the walls, or on the computer's turn", () => {
    const s = newDuel(10, course, FACTS, 5);
    begin(s, []);
    runUntil(s, () => s.you.dropped && !onFlat(course, s.you.x) && s.you.mode === "ride", 5);
    const ev: DuelEvent[] = [];
    gesture(s, null, ev);
    expect(ev).toEqual([]);
    expect(s.you.mode).toBe("ride");
  });
});

describe("the blocks", () => {
  it("gives him five runs, then the computer five problems, and so on to the length", () => {
    for (const len of DUEL_LENS) {
      const s = newDuel(len, course, FACTS, 9);
      const turns: string[] = [];
      const first: DuelEvent[] = [];
      begin(s, first);
      for (const e of first) if (e.kind === "turn") turns.push(e.who);
      let asks = 0;
      runUntil(s, (e) => e.some((x) => x.kind === "over"), 400, (ev) => {
        for (const e of ev) { if (e.kind === "turn") turns.push(e.who); if (e.kind === "ask") asks += 1; }
      });
      expect(s.phase).toBe("over");
      expect(s.yourRuns).toBe(len);
      expect(s.theirRuns).toBe(len);
      expect(asks).toBe(len);
      const blocks = (len / BLOCK) as number;
      expect(turns).toEqual(Array.from({ length: blocks }, () => ["you", "them"]).flat());
    }
  });

  it("orders the turns by the five-ahead rule", () => {
    const s = newDuel(15, course, FACTS, 1);
    expect(nextWho(s)).toBe("you");
    s.yourRuns = 5; expect(nextWho(s)).toBe("them");
    s.theirRuns = 4; expect(nextWho(s)).toBe("them");
    s.theirRuns = 5; expect(nextWho(s)).toBe("you");
    s.yourRuns = 10; expect(nextWho(s)).toBe("them");
    s.theirRuns = 10; expect(nextWho(s)).toBe("you");
    s.yourRuns = 15; expect(nextWho(s)).toBe("them");
    s.theirRuns = 15; expect(nextWho(s)).toBeNull();
  });
});

describe("the ask", () => {
  it("runs the recall threshold plus the hands, submits itself at the right length, and closes when out", () => {
    expect(ASK_MS).toBe(RETRIEVED_MAX_MS + 600);
    const s = newDuel(10, course, FACTS, 2);
    begin(s, []);
    // Through his five runs to the first problem.
    const all = runUntil(s, (e) => e.some((x) => x.kind === "ask"), 60);
    expect(kinds(all)).toContain("ask");
    expect(s.ask?.state).toBe("open");
    expect(s.ask?.shown.format).toBe("standard");   // never a missing number
    expect(s.ask?.leftMs).toBe(ASK_MS);
    // A wrong first digit on a one-digit answer is judged at once.
    const want = String(s.ask!.shown.expected);
    const ev: DuelEvent[] = [];
    if (want.length === 1) {
      askKey(s, want === "9" ? "8" : "9", ev);
      expect(kinds(ev)).toEqual(["askMissed"]);
      expect(s.ask?.state).toBe("missed");
    } else {
      askKey(s, want[0]!, ev);
      expect(s.ask?.state).toBe("open");
      askClear(s);
      expect(s.ask?.typed).toBe("");
      solve(s, ev);
      expect(kinds(ev)).toEqual(["askSolved"]);
    }
    // Once judged, more digits do nothing.
    const st = s.ask!.state;
    askKey(s, "1", ev); askSubmit(s, ev);
    expect(s.ask!.state).toBe(st);
  });

  it("ends the meter before the computer lands, even on the narrowest course", () => {
    // Otherwise a solve in time could come after the landing it should spoil.
    for (const w of [400, 600, 880]) {
      const s = newDuel(10, courseFor(w), FACTS, 6);
      begin(s, []);
      runUntil(s, (e) => e.some((x) => x.kind === "ask"), 60);
      let outAt = -1; let landAt = -1; let t = 0;
      runUntil(s, (e) => { t += STEP; if (e.some((x) => x.kind === "askOut") && outAt < 0) outAt = t; if (e.some((x) => x.kind === "land" && x.who === "them") && landAt < 0) landAt = t; return landAt >= 0; }, 20);
      expect(outAt, `course ${w}`).toBeGreaterThan(0);
      expect(landAt, `course ${w}`).toBeGreaterThan(outAt + 0.3);
    }
  });

  it("times out at the meter's end, and a late answer counts for nothing", () => {
    const s = newDuel(10, course, FACTS, 2);
    begin(s, []);
    runUntil(s, (e) => e.some((x) => x.kind === "ask"), 60);
    const out = runUntil(s, (e) => e.some((x) => x.kind === "askOut"), 10);
    expect(kinds(out)).toContain("askOut");
    expect(s.ask?.leftMs).toBe(0);
    const ev: DuelEvent[] = [];
    solve(s, ev);
    expect(ev).toEqual([]);
    expect(s.ask?.state).toBe("out");
  });

  it("deals every allowed fact once before any comes back", () => {
    const few = FACTS.slice(0, 7);
    const s = newDuel(20, course, few, 4);
    begin(s, []);
    const seen: string[] = [];
    runUntil(s, (e) => e.some((x) => x.kind === "over"), 500, (ev) => { for (const e of ev) if (e.kind === "ask") seen.push(e.ask.fact.id); });
    expect(seen.length).toBe(20);
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7, 14)).size).toBe(7);
  });
});

describe("the computer", () => {
  it("plans tricks that fit the air it will have, so an unmessed run lands them", () => {
    const s = newDuel(10, course, FACTS, 11);
    begin(s, []);
    runUntil(s, (e) => e.some((x) => x.kind === "ask"), 60);
    // Let the meter run out: nothing solved, the computer lands its plan.
    const run = runUntil(s, (e) => e.some((x) => x.kind === "runEnd"), 15);
    expect(kinds(run)).not.toContain("bail");
    expect(kinds(run)).toContain("launch");
    const end = run.find((e) => e.kind === "runEnd");
    expect(end?.kind === "runEnd" && end.score).toBeGreaterThan(0);
    expect(end?.kind === "runEnd" && end.messed).toBe(false);
    expect(s.theirScore).toBeGreaterThan(0);
    // The lip air is a trick and most of another, by the constants.
    const air = (2 * LAUNCH_VY) / G;
    expect(air).toBeGreaterThan(0.66);
    expect(air * 1000).toBeGreaterThan(300 + 380 * LAND_TOL);
  });

  it("messes up the whole run when the problem is solved in time, whenever it is solved", () => {
    // Solved at once: every landing bails and the run is worth nothing.
    const s = newDuel(10, course, FACTS, 11);
    begin(s, []);
    runUntil(s, (e) => e.some((x) => x.kind === "ask"), 60);
    const ev: DuelEvent[] = [];
    solve(s, ev);
    expect(kinds(ev)).toEqual(["askSolved"]);
    const run = runUntil(s, (e) => e.some((x) => x.kind === "runEnd"), 15);
    expect(kinds(run)).toContain("bail");
    const end = run.find((e) => e.kind === "runEnd");
    expect(end?.kind === "runEnd" && end.messed).toBe(true);
    expect(end?.kind === "runEnd" && end.score).toBe(0);
    expect(s.theirScore).toBe(0);
    // Solved late, AFTER a trick on the flat has already banked: the run
    // still counts for nothing, so a solve is a solve whenever it comes
    // before the meter's end. Find a seed whose plan has that flat trick.
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const t = newDuel(10, course, FACTS, seed);
      begin(t, []);
      runUntil(t, (e) => e.some((x) => x.kind === "ask"), 60);
      runUntil(t, () => (t.them.runScore > 0 && t.ask !== null && t.ask.state === "open") || t.ask === null || t.ask.state !== "open", 10);
      if (!(t.them.runScore > 0 && t.ask !== null && t.ask.state === "open")) continue;
      found = true;
      solve(t, []);
      const late = runUntil(t, (e) => e.some((x) => x.kind === "runEnd"), 10);
      const lend = late.find((e) => e.kind === "runEnd");
      expect(lend?.kind === "runEnd" && lend.messed, `seed ${seed}`).toBe(true);
      expect(t.theirScore, `seed ${seed}`).toBe(0);
    }
    expect(found).toBe(true);
  });

  it("is beaten for certain by solving every problem, even by a rider who never taps", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newDuel(10, course, FACTS, seed);
      begin(s, []);
      runUntil(s, (e) => e.some((x) => x.kind === "over"), 400, (ev) => { if (ev.some((e) => e.kind === "ask")) solve(s, []); });
      expect(s.winner, `seed ${seed}`).toBe("you");
      expect(s.theirScore, `seed ${seed}`).toBe(0);
      expect(s.yourScore, `seed ${seed}`).toBe(10 * AIR_POINTS);
      expect(s.solved).toBe(10);
    }
    // And a rider who solves nothing and never taps loses to it.
    const s = newDuel(10, course, FACTS, 1);
    begin(s, []);
    runUntil(s, (e) => e.some((x) => x.kind === "over"), 400);
    expect(s.winner).toBe("them");
    expect(s.theirScore).toBeGreaterThan(s.yourScore);
  });
});

describe("the words", () => {
  it("has thirty lines of good-sport trash talk, with no dashes and nothing mean", () => {
    expect(TRASH_TALK.length).toBe(30);
    for (const line of TRASH_TALK) {
      expect(line).not.toMatch(/—|–/);
      expect(line).not.toMatch(/stupid|dumb|loser|hate|idiot|suck/i);
      expect(line.length).toBeLessThan(90);
    }
    expect(trashTalk(0)).toBe(TRASH_TALK[0]);
    expect(trashTalk(31)).toBe(TRASH_TALK[1]);
    expect(new Set(Array.from({ length: 30 }, (_, i) => trashTalk(i))).size).toBe(30);
  });
});

void (0 as unknown as DuelLen);

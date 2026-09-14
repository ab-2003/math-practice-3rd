/**
 * HALF PIPE DUELS (0.23.0, Andy, 2026-09-14): the park's free tricks and
 * the app's whole point, fast recall, in one game. His skater against a
 * computer skater, on one big half pipe: a U with a flat bottom, decks at
 * both lips.
 *
 * THE SHAPE OF A DUEL. Rounds come in BLOCKS of five. In his block he
 * makes five RUNS: drop in from one deck, across the flat (tap to ollie,
 * swipe for a trick), up the far wall and OUT at the lip (the big air,
 * swipe for tricks, chain two), land on the far deck. A run is a turn; the
 * next goes back the other way, so five runs end on the other side. Then
 * the computer's block: for each of ITS five runs a problem pops up with a
 * thin meter draining over the recall threshold. Solve it before the meter
 * is gone and the computer MESSES UP that run (every landing a bail, the
 * run worth nothing); otherwise it lands its planned tricks. Mess up every
 * run and the computer scores nothing at all, so the duel is his by any
 * landing of his own: solving is the guarantee, skating is the margin.
 * 10, 15 or 20 rounds: two, three or four blocks each.
 *
 * WHAT IT NEVER DOES. No bonus questions, no dots, only digits; the facts
 * are exactly the parent's practice settings (the strands and caps). It
 * never touches the scheduler or the practice evidence: a timed answer
 * under a draining meter is a game, not a measurement.
 *
 * DUEL TOKENS. Each day starts with one; one more comes with the day's
 * work (alongside the Skate Park's token); a grown-up can give one. A
 * token is one play of EACH length, so one token is a 10, a 15 and a 20.
 * Tokens are the day's; they do not keep.
 *
 * Pure and deterministic given (input, dt, seed): the rules are tested,
 * the screen draws and makes noise. Coordinates are DESIGN UNITS, the
 * course `w` wide and `h` tall, the flat at y = 0, up positive.
 */

import { BAIL_MS, G, LAND_TOL, MAX_MULT, OLLIE_VY, PARK_TRICKS, trickFor, type ChainItem, type ParkTrick, type Swipe } from "./park";
import { RETRIEVED_MAX_MS } from "./config";
import { DEFAULT_MISSING, presentFact, type Presented } from "./present";
import type { Fact } from "./types";

export type DuelLen = 10 | 15 | 20;
export const DUEL_LENS: readonly DuelLen[] = [10, 15, 20];
/** Rounds per block: five runs of his, then five problems. */
export const BLOCK = 5;
/** The meter: the recall threshold (the session's own first-digit line)
 *  plus a little for the hands, since here the whole answer has to land. */
export const ASK_MS = RETRIEVED_MAX_MS + 600;
/** The course is this tall in design units; its width follows the glass. */
export const DUEL_H = 400;
/** Units a second along the pipe. The computer rides at COMP_V of it, and
 *  waits DROP_DELAY after the problem shows, so even on the narrowest
 *  course (a phone's, with an 80 unit flat) its run outlasts the meter:
 *  the answer, or the meter's end, always comes before the landing. */
export const RIDE_V = 260;
export const COMP_V = 0.65;
/** Out of the lip: air for a trick and most of another. */
export const LAUNCH_VY = 800;
/** In that air the skater drifts onto the deck instead of flying across. */
export const DRIFT_V = 40;
/** A clean lip air with no trick in it is still worth a little. */
export const AIR_POINTS = 50;
/** How hard the walls lean on the line: slow up, fast down. */
export const GRIP = 0.34;
/** The computer waits this long after the problem shows before dropping in. */
export const DROP_DELAY = 0.9;
/** The beat between one run's end and the next run's start. */
export const REST = 0.7;
/** Where each skater stands on a deck, in from the stage's edge: his spot
 *  and the computer's differ so two on one deck do not stand in one place. */
export const STAND_YOU = 64;
export const STAND_THEM = 44;

// ---------------------------------------------------------------------------
// The tokens and the record.
// ---------------------------------------------------------------------------

export interface DuelTally { won: number; lost: number }
export interface DuelMeta {
  duelDay: number | null;
  /** Today's tokens. Each is one play of each length. */
  duelTokens: number;
  duelUsed: Record<DuelLen, number>;
  duelRecord: Record<DuelLen, DuelTally>;
  /** The day the day's-work token was earned, so it comes once a day. */
  duelWorkDay: number | null;
}

export const freshUsed = (): Record<DuelLen, number> => ({ 10: 0, 15: 0, 20: 0 });
export const freshRecord = (): Record<DuelLen, DuelTally> => ({ 10: { won: 0, lost: 0 }, 15: { won: 0, lost: 0 }, 20: { won: 0, lost: 0 } });

/** A new day starts with one token and nothing used. */
export const duelDayReset = (m: DuelMeta, day: number): void => {
  if (m.duelDay === day) return;
  m.duelDay = day;
  m.duelTokens = 1;
  m.duelUsed = freshUsed();
};

export const duelPlaysLeft = (m: DuelMeta, day: number, len: DuelLen): number => {
  duelDayReset(m, day);
  return Math.max(0, m.duelTokens - m.duelUsed[len]);
};

export const duelPlaysTotal = (m: DuelMeta, day: number): number =>
  DUEL_LENS.reduce((n, len) => n + duelPlaysLeft(m, day, len), 0);

/** Spend a play of this length. False when there is none to spend. */
export const useDuelPlay = (m: DuelMeta, day: number, len: DuelLen): boolean => {
  if (duelPlaysLeft(m, day, len) <= 0) return false;
  m.duelUsed[len] += 1;
  return true;
};

/** A grown-up's gift, or the day's work: one more of each length today. */
export const grantDuelToken = (m: DuelMeta, day: number): void => {
  duelDayReset(m, day);
  m.duelTokens += 1;
};

/** The day's work earns one, once a day. True when it just did. */
export const earnDuelToken = (m: DuelMeta, day: number): boolean => {
  if (m.duelWorkDay === day) return false;
  m.duelWorkDay = day;
  grantDuelToken(m, day);
  return true;
};

export const recordDuel = (m: DuelMeta, len: DuelLen, won: boolean): void => {
  const t = m.duelRecord[len];
  if (won) t.won += 1; else t.lost += 1;
};

// ---------------------------------------------------------------------------
// The course: one half pipe, decks at both lips, a flat bottom.
// ---------------------------------------------------------------------------

export interface Course {
  w: number;
  h: number;
  /** How wide each deck is, from the edge of the stage to the coping. */
  deck: number;
  /** The horizontal run of each transition, coping to flat. */
  wall: number;
  /** How high the decks stand above the flat. */
  top: number;
}

/** The course for a stage this wide, at DUEL_H tall. Walls take most of
 *  the height; the decks and the transitions scale with the width, so a
 *  phone gets a short flat and a tablet on its side a long one. */
export const courseFor = (w: number, h = DUEL_H): Course => {
  const top = Math.round(h * 0.55);
  const deck = Math.round(Math.max(70, Math.min(120, w * 0.14)));
  const wall = Math.round(Math.max(90, Math.min(top * 1.1, (w - 2 * deck) * 0.3)));
  return { w, h, deck, wall, top };
};

/** The surface under x: the decks at `top`, the flat at 0, and between
 *  them the pipe's own curve (the park's cosine bowl), tangent to the deck
 *  at the coping and tangent to the flat at the bottom. */
export const surfaceY = (c: Course, x: number): number => {
  if (x <= c.deck || x >= c.w - c.deck) return c.top;
  const u = x < c.w / 2 ? x - c.deck : c.w - c.deck - x;
  if (u >= c.wall) return 0;
  return c.top * Math.cos((Math.PI / 2) * (u / c.wall)) ** 2;
};

/** Up the line (to the right) is positive. */
export const surfaceSlope = (c: Course, x: number): number => (surfaceY(c, x + 4) - surfaceY(c, x - 4)) / 8;

export const onDeck = (c: Course, x: number): boolean => x <= c.deck || x >= c.w - c.deck;
export const onFlat = (c: Course, x: number): boolean => x >= c.deck + c.wall && x <= c.w - c.deck - c.wall;

// ---------------------------------------------------------------------------
// The skaters.
// ---------------------------------------------------------------------------

export type Who = "you" | "them";
export type SkaterMode = "wait" | "ride" | "air" | "bail" | "done";

export interface Skater {
  x: number;
  /** Feet above the flat. */
  y: number;
  vy: number;
  /** Speed along the pipe while in the air. */
  vx: number;
  /** Which way the run goes: 1 to the right. */
  dir: 1 | -1;
  mode: SkaterMode;
  trick: ParkTrick | null;
  trickT: number;
  bailT: number;
  chain: ChainItem[];
  /** Into the pipe this run; out of the far lip this run. */
  dropped: boolean;
  launched: boolean;
  /** The lip air, where a clean landing with nothing in it still pays. */
  lipAir: boolean;
  runScore: number;
  /** The deck he stands on between runs: -1 left, 1 right. */
  side: -1 | 1;
}

const standAt = (who: Who, side: -1 | 1, c: Course): number => {
  const inset = who === "you" ? STAND_YOU : STAND_THEM;
  return side < 0 ? inset : c.w - inset;
};

const skater = (who: Who, side: -1 | 1, c: Course): Skater => ({
  x: standAt(who, side, c), y: c.top, vy: 0, vx: 0, dir: side < 0 ? 1 : -1, mode: "wait",
  trick: null, trickT: 0, bailT: 0, chain: [], dropped: false, launched: false, lipAir: false, runScore: 0, side,
});

/** What the computer means to do on a run: maybe a trick on the flat, and
 *  one or two out of the lip, chosen to fit the air it will have. */
export interface CompPlan { flat: ParkTrick | null; lip: ParkTrick[]; flatDone: boolean; lipAt: number }

export interface Ask {
  fact: Fact;
  shown: Presented;
  typed: string;
  leftMs: number;
  state: "open" | "solved" | "missed" | "out";
}

export type Phase = "ready" | "you" | "them" | "over";

export interface DuelState {
  len: DuelLen;
  course: Course;
  you: Skater;
  them: Skater;
  yourScore: number;
  theirScore: number;
  yourRuns: number;
  theirRuns: number;
  phase: Phase;
  /** Seconds until the next thing happens, and what it is. */
  wait: number;
  next: "start" | "drop" | null;
  ask: Ask | null;
  asked: number;
  solved: number;
  plan: CompPlan | null;
  /** The problems, dealt in a shuffled order and redealt when spent. */
  pool: Fact[];
  dealt: number;
  seed: number;
  winner: Who | null;
}

export type DuelEvent =
  | { kind: "turn"; who: Who }
  | { kind: "dropIn"; who: Who }
  | { kind: "ollie"; who: Who }
  | { kind: "launch"; who: Who }
  | { kind: "trick"; who: Who; trick: ParkTrick }
  | { kind: "trickDone"; who: Who; trick: ParkTrick }
  | { kind: "land"; who: Who }
  | { kind: "bail"; who: Who }
  | { kind: "bank"; who: Who; points: number; mult: number; chain: ChainItem[] }
  | { kind: "runEnd"; who: Who; score: number; messed: boolean }
  | { kind: "ask"; ask: Ask }
  | { kind: "askSolved" }
  | { kind: "askMissed" }
  | { kind: "askOut" }
  | { kind: "over"; winner: Who; yours: number; theirs: number };

/** The park's tiny seeded generator, so a seed lays the same duel. */
const rng = (s: { seed: number }): number => {
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = <T>(items: readonly T[], s: { seed: number }): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng(s) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/**
 * A new duel. `facts` are the problems allowed by the parent's settings;
 * the duel deals them in a shuffled order and never asks one twice before
 * every other has been asked. He starts on the left deck, the computer
 * waits on the right, and the first block is his.
 */
export const newDuel = (len: DuelLen, course: Course, facts: readonly Fact[], seed = 1): DuelState => {
  const s: DuelState = {
    len, course, you: skater("you", -1, course), them: skater("them", 1, course),
    yourScore: 0, theirScore: 0, yourRuns: 0, theirRuns: 0,
    phase: "ready", wait: 0, next: null, ask: null, asked: 0, solved: 0, plan: null,
    pool: [], dealt: 0, seed, winner: null,
  };
  s.pool = shuffle(facts, s);
  return s;
};

/** Whose run is next: the blocks alternate, his first. He runs while he
 *  has finished no more blocks than the computer has; then the computer
 *  runs its block; and so on to the length. Null when both are done. */
export const nextWho = (s: DuelState): Who | null => {
  if (s.yourRuns >= s.len && s.theirRuns >= s.len) return null;
  const yours = Math.floor(s.yourRuns / BLOCK);
  const theirs = Math.floor(s.theirRuns / BLOCK);
  return s.yourRuns < s.len && yours <= theirs ? "you" : "them";
};

const deal = (s: DuelState): Fact => {
  if (s.dealt >= s.pool.length) { s.pool = shuffle(s.pool, s); s.dealt = 0; }
  return s.pool[s.dealt++]!;
};

/** The lip air lasts this long: a trick, then as much of another as fits. */
const lipAirS = (): number => (2 * LAUNCH_VY) / G;

const planFor = (s: DuelState): CompPlan => {
  // A short trick on the flat half the time: the ollie's air is small.
  const short = PARK_TRICKS.filter((t) => t.ms <= 480);
  const flat = rng(s) < 0.5 ? short[Math.floor(rng(s) * short.length)]! : null;
  const first = PARK_TRICKS[Math.floor(rng(s) * PARK_TRICKS.length)]!;
  const room = lipAirS() * 1000 - first.ms;
  // A second one only if it can be LAND_TOL done by touchdown.
  const fits = PARK_TRICKS.filter((t) => t.ms * LAND_TOL <= room - 40);
  const second = fits.length > 0 ? fits[Math.floor(rng(s) * fits.length)]! : null;
  return { flat, lip: second ? [first, second] : [first], flatDone: false, lipAt: 0 };
};

/** Start the duel: the first block is his, after a beat. */
export const begin = (s: DuelState, ev: DuelEvent[]): void => {
  if (s.phase !== "ready") return;
  stage(s, "you", ev);
};

/** Put a skater at its deck's edge and set the beat before it rolls. */
const stage = (s: DuelState, who: Who, ev: DuelEvent[]): void => {
  const sk = who === "you" ? s.you : s.them;
  const c = s.course;
  sk.x = standAt(who, sk.side, c);
  sk.dir = sk.side < 0 ? 1 : -1;
  sk.y = c.top; sk.vy = 0; sk.vx = 0;
  sk.mode = "wait"; sk.trick = null; sk.trickT = 0; sk.bailT = 0; sk.chain = [];
  sk.dropped = false; sk.launched = false; sk.lipAir = false; sk.runScore = 0;
  if (s.phase !== who) ev.push({ kind: "turn", who });
  s.phase = who;
  if (who === "them") {
    // The problem is on the glass first; the computer drops in after.
    s.plan = planFor(s);
    const fact = deal(s);
    s.ask = { fact, shown: presentFact(fact, s.asked * 7 + fact.a * 31 + fact.b, DEFAULT_MISSING), typed: "", leftMs: ASK_MS, state: "open" };
    s.asked += 1;
    ev.push({ kind: "ask", ask: s.ask });
    s.wait = DROP_DELAY;
  } else {
    s.wait = REST;
  }
  s.next = "drop";
};

const ollie = (sk: Skater, who: Who, vy: number, ev: DuelEvent[]): void => {
  sk.mode = "air";
  sk.vy = vy;
  sk.vx = RIDE_V * (who === "them" ? COMP_V : 1);
  ev.push({ kind: "ollie", who });
};

const startTrick = (sk: Skater, who: Who, t: ParkTrick, ev: DuelEvent[]): boolean => {
  if (sk.mode !== "air" || sk.trick !== null) return false;
  sk.trick = t;
  sk.trickT = 0;
  ev.push({ kind: "trick", who, trick: t });
  return true;
};

const finishTrick = (sk: Skater, who: Who, ev: DuelEvent[]): void => {
  if (sk.trick === null) return;
  sk.chain.push({ name: sk.trick.name, points: sk.trick.points });
  ev.push({ kind: "trickDone", who, trick: sk.trick });
  sk.trick = null;
};

const bail = (sk: Skater, who: Who, ev: DuelEvent[]): void => {
  sk.mode = "bail"; sk.bailT = 0; sk.trick = null; sk.chain = []; sk.vy = 0;
  ev.push({ kind: "bail", who });
};

const bank = (s: DuelState, sk: Skater, who: Who, ev: DuelEvent[]): void => {
  if (sk.chain.length === 0) return;
  const mult = Math.min(MAX_MULT, sk.chain.length);
  const points = sk.chain.reduce((a, c) => a + c.points, 0) * mult;
  sk.runScore += points;
  // His banks count as they land; the computer's run is judged at its end,
  // since a solve part way through voids the whole run.
  if (who === "you") s.yourScore += points;
  ev.push({ kind: "bank", who, points, mult, chain: sk.chain });
  sk.chain = [];
};

/** Touchdown: a trick still turning is a bail, a messed-up computer bails
 *  whatever it was doing, and a clean lip air with nothing in it pays a
 *  little. Then the chain banks. */
const land = (s: DuelState, sk: Skater, who: Who, ev: DuelEvent[]): void => {
  const c = s.course;
  sk.y = surfaceY(c, sk.x);
  sk.vy = 0;
  const messed = who === "them" && s.ask !== null && s.ask.state === "solved";
  if (messed) { bail(sk, who, ev); return; }
  if (sk.trick !== null) {
    const progress = (sk.trickT * 1000) / sk.trick.ms;
    if (progress < LAND_TOL) { bail(sk, who, ev); return; }
    finishTrick(sk, who, ev);
  }
  if (sk.lipAir && sk.chain.length === 0) sk.chain.push({ name: "AIR", points: AIR_POINTS });
  sk.mode = "ride";
  sk.lipAir = false;
  ev.push({ kind: "land", who });
  bank(s, sk, who, ev);
};

const stepSkater = (s: DuelState, sk: Skater, who: Who, dt: number, ev: DuelEvent[]): void => {
  const c = s.course;
  const plan = who === "them" ? s.plan : null;
  if (sk.mode === "ride") {
    const climb = surfaceSlope(c, sk.x) * sk.dir;
    const k = Math.max(0.55, Math.min(1.5, 1 - GRIP * climb));
    const v = RIDE_V * (who === "them" ? COMP_V : 1) * k * (onDeck(c, sk.x) ? 0.6 : 1);
    sk.x += sk.dir * v * dt;
    if (!sk.dropped && !onDeck(c, sk.x)) { sk.dropped = true; ev.push({ kind: "dropIn", who }); }
    // The computer's trick on the flat, once, as it gets there.
    if (plan !== null && plan.flat !== null && !plan.flatDone && sk.dropped && !sk.launched && onFlat(c, sk.x)) {
      plan.flatDone = true;
      ollie(sk, who, OLLIE_VY, ev);
      startTrick(sk, who, plan.flat, ev);
      return;
    }
    // Out of the far lip.
    const atFarLip = sk.dir > 0 ? sk.x >= c.w - c.deck : sk.x <= c.deck;
    if (sk.dropped && !sk.launched && atFarLip) {
      sk.launched = true;
      sk.lipAir = true;
      sk.x = sk.dir > 0 ? c.w - c.deck : c.deck;
      sk.mode = "air"; sk.y = c.top; sk.vy = LAUNCH_VY; sk.vx = DRIFT_V;
      ev.push({ kind: "launch", who });
      if (plan !== null && plan.lip.length > 0) { plan.lipAt = 0; startTrick(sk, who, plan.lip[0]!, ev); }
      return;
    }
    // Landed on the far deck: roll to a stop, and the run is over.
    if (sk.launched && onDeck(c, sk.x)) {
      const stop = standAt(who, sk.dir > 0 ? 1 : -1, c);
      if ((sk.dir > 0 && sk.x >= stop) || (sk.dir < 0 && sk.x <= stop)) {
        sk.x = stop;
        sk.mode = "done";
        sk.side = sk.dir > 0 ? 1 : -1;
      }
    }
    sk.y = surfaceY(c, sk.x);
    return;
  }
  if (sk.mode === "air") {
    sk.vy -= G * dt;
    sk.y += sk.vy * dt;
    sk.x += sk.dir * sk.vx * dt;
    if (sk.trick !== null) {
      sk.trickT += dt;
      if (sk.trickT * 1000 >= sk.trick.ms) {
        finishTrick(sk, who, ev);
        // The computer's second lip trick follows the first straight away.
        if (plan !== null && sk.lipAir && plan.lipAt === 0 && plan.lip.length > 1) { plan.lipAt = 1; startTrick(sk, who, plan.lip[1]!, ev); }
      }
    }
    if (sk.vy <= 0 && sk.y <= surfaceY(c, sk.x)) land(s, sk, who, ev);
    return;
  }
  if (sk.mode === "bail") {
    sk.bailT += dt;
    // He slides on along the surface while he picks himself up.
    sk.x += sk.dir * RIDE_V * 0.35 * dt;
    sk.y = surfaceY(c, sk.x);
    if (sk.bailT * 1000 >= BAIL_MS) { sk.mode = "ride"; sk.lipAir = false; }
    return;
  }
};

/**
 * Advance the duel by dt seconds. Returns what happened, for the screen.
 */
export const update = (s: DuelState, dt: number): DuelEvent[] => {
  const ev: DuelEvent[] = [];
  if (s.phase === "ready" || s.phase === "over") return ev;

  // The meter drains from the moment the problem is on the glass.
  if (s.ask !== null && s.ask.state === "open") {
    s.ask.leftMs = Math.max(0, s.ask.leftMs - dt * 1000);
    if (s.ask.leftMs <= 0) { s.ask.state = "out"; ev.push({ kind: "askOut" }); }
  }

  if (s.wait > 0) {
    s.wait -= dt;
    if (s.wait > 0) return ev;
    s.wait = 0;
    if (s.next === "drop") {
      const sk = s.phase === "you" ? s.you : s.them;
      sk.mode = "ride";
      s.next = null;
    } else if (s.next === "start") {
      const who = nextWho(s);
      if (who === null) { finish(s, ev); return ev; }
      stage(s, who, ev);
      s.next = "drop";
      return ev;
    }
  }

  const who: Who = s.phase === "you" ? "you" : "them";
  const sk = who === "you" ? s.you : s.them;
  if (sk.mode === "wait") return ev;
  stepSkater(s, sk, who, dt, ev);
  if (sk.mode === "done") {
    const messed = who === "them" && s.ask !== null && s.ask.state === "solved";
    if (who === "you") s.yourRuns += 1;
    else {
      s.theirRuns += 1;
      if (!messed) s.theirScore += sk.runScore;
      if (s.ask !== null && s.ask.state === "open") { s.ask.state = "out"; ev.push({ kind: "askOut" }); }
    }
    ev.push({ kind: "runEnd", who, score: messed ? 0 : sk.runScore, messed });
    s.ask = null;
    s.plan = null;
    s.wait = REST;
    s.next = "start";
  }
  return ev;
};

const finish = (s: DuelState, ev: DuelEvent[]): void => {
  s.phase = "over";
  // A tie is his: he is the one who showed up to practise.
  s.winner = s.yourScore >= s.theirScore ? "you" : "them";
  ev.push({ kind: "over", winner: s.winner, yours: s.yourScore, theirs: s.theirScore });
};

// ---------------------------------------------------------------------------
// His input: the finger on his runs, the keypad on the computer's.
// ---------------------------------------------------------------------------

/** A tap (null) or a swipe, on his run. On the flat a tap ollies and a
 *  swipe ollies into the trick; in the air a swipe is the trick. On the
 *  walls, nothing: the tricks live on the flat and out of the lip. */
export const gesture = (s: DuelState, swipe: Swipe | null, ev: DuelEvent[]): void => {
  if (s.phase !== "you") return;
  const sk = s.you;
  if (sk.mode === "ride" && sk.dropped && onFlat(s.course, sk.x)) {
    ollie(sk, "you", OLLIE_VY, ev);
    if (swipe !== null) startTrick(sk, "you", trickFor(swipe), ev);
    return;
  }
  if (sk.mode === "air" && swipe !== null) startTrick(sk, "you", trickFor(swipe), ev);
};

const judge = (s: DuelState, ev: DuelEvent[]): void => {
  const a = s.ask;
  if (a === null || a.state !== "open") return;
  if (Number(a.typed) === a.shown.expected) { a.state = "solved"; s.solved += 1; ev.push({ kind: "askSolved" }); }
  else { a.state = "missed"; ev.push({ kind: "askMissed" }); }
};

/** A digit. The answer submits itself when it is as long as it should
 *  be: under a meter, no one should have to find enter. */
export const askKey = (s: DuelState, d: string, ev: DuelEvent[]): void => {
  const a = s.ask;
  if (a === null || a.state !== "open" || !/^[0-9]$/.test(d)) return;
  const want = String(a.shown.expected).length;
  if (a.typed.length >= want) return;
  a.typed = a.typed === "0" ? d : a.typed + d;
  if (a.typed.length >= want) judge(s, ev);
};

export const askClear = (s: DuelState): void => {
  if (s.ask !== null && s.ask.state === "open") s.ask.typed = "";
};

/** Enter, for anyone who reaches for it: judges what is typed. */
export const askSubmit = (s: DuelState, ev: DuelEvent[]): void => {
  if (s.ask !== null && s.ask.typed !== "") judge(s, ev);
};

// ---------------------------------------------------------------------------
// The words before the match.
// ---------------------------------------------------------------------------

/** Good-sport trash talk, elementary approved: confident, never cruel. */
export const TRASH_TALK: readonly string[] = [
  "I'm gonna hit some gnarly moves and take the crown!",
  "Hope you brought your A game, because I brought mine!",
  "My kickflips are so clean they squeak!",
  "Get ready to see the biggest air in the whole park!",
  "You're good, but today I'm better. Let's go!",
  "I practised all week for this. Watch out!",
  "My board is faster than your calculator!",
  "Nobody grinds like me. Nobody!",
  "I'm going to spin so much you'll get dizzy watching!",
  "Win or lose, this is going to be the coolest duel ever!",
  "You think you're fast? I'm lightning on four wheels!",
  "I'll be doing backflips while you're still counting!",
  "Warm up those fingers. You're gonna need them!",
  "This half pipe is MY half pipe. For the next few minutes, anyway.",
  "Let's see who really rules the pipe!",
  "Big tricks, big air, big win. That's my plan!",
  "May the best skater win. And that's me!",
  "I've got tricks you've never even seen!",
  "Hope you like second place, because first is taken!",
  "I'm not scared of a little math. Are you?",
  "Ready, set, shred! I'll try not to make it look too easy.",
  "The crowd came to see ME. Sorry, friend!",
  "Watch and learn. Class is in session!",
  "My helmet's on tight and my tricks are tighter!",
  "You bring the brains, I'll bring the air. Let's duel!",
  "I'm going to land every single trick. Every. Single. One.",
  "Good luck! You're going to need a LOT of it.",
  "Nice board. Mine's faster, though!",
  "Let's make this one for the highlight reel!",
  "Rounds of pure shred. Try to keep up!",
];

export const trashTalk = (seed: number): string => TRASH_TALK[Math.abs(seed) % TRASH_TALK.length]!;

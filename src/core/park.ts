/**
 * THE SKATE PARK (Andy, 2026-09-02): the daily reward.
 *
 * Finish the day's dose and a DAILY TOKEN drops. A token buys a stretch of
 * park time (a parent dial, default seven minutes), and the parent also caps
 * how many tokens a day can be spent (default three), so a hoard cannot
 * become an afternoon. The park is a PURE skateboarding game: his monster,
 * its board, its helmet, tricks down a line. It earns no coins and touches
 * no evidence. It is fun, and that is its whole job.
 *
 * THE GAME, IN ONE BREATH. The world scrolls. TAP to ollie; HOLD then let go
 * for a bigger one. In the air, SWIPE for a trick: up KICKFLIP, down NOSE
 * GRAB, right 360 SPIN, left BACKFLIP. A trick takes time; land before it
 * finishes and you bail. Ollie ONTO a rail to grind, tap to hop off. Every
 * trick and grind before the board touches flat ground again joins one
 * CHAIN, and the chain banks its points times its length. Rails, boxes,
 * gaps and kickers come down the line faster as the run goes on; a bail
 * resets the speed. Easy to start, hard to master.
 *
 * Everything here is pure and deterministic given (input, dt, seed), so
 * the rules are unit-tested and the screen only draws and makes noise. The
 * coordinates are DESIGN UNITS: a stage PARK_W wide and PARK_H tall, feet at
 * y = 0, up positive; the screen scales them.
 */

export const PARK_W = 560;
/** Tall enough that a kicker's air (235 units plus the rider) stays on stage. */
export const PARK_H = 380;
/** Where the rider's centre sits on the stage. */
export const RIDER_X = 130;
/** The rider's collision width; the art is wider, the feel is fairer. */
export const RIDER_W = 56;

export const G = 1500;
export const OLLIE_VY = 520;
export const OLLIE_VY_MAX = 760;
export const KICK_VY = 840;
export const BASE_SPEED = 250;
export const MAX_SPEED = 480;
/** Units per second per second: base to top in about half a minute of
 *  clean riding, and a bail drops it straight back to base (Andy). */
export const ACCEL = 8;
export const BAIL_MS = 900;
/** How much of a trick must be done at touchdown to count as landed. */
export const LAND_TOL = 0.85;
/** Holding this long before letting go makes the biggest ollie. */
export const HOLD_MS = 420;
/** A grind pays this at the start, then this much per second. */
export const GRIND_BASE = 60;
export const GRIND_PER_S = 110;
export const MAX_MULT = 5;

export type Swipe = "up" | "down" | "left" | "right";

export interface ParkTrick {
  readonly id: string;
  readonly name: string;
  readonly swipe: Swipe;
  /** How long it takes in the air. Longer tricks need bigger air. */
  readonly ms: number;
  readonly points: number;
}

export const PARK_TRICKS: readonly ParkTrick[] = [
  { id: "kickflip", name: "KICKFLIP", swipe: "up", ms: 300, points: 100 },
  { id: "grab", name: "NOSE GRAB", swipe: "down", ms: 380, points: 150 },
  { id: "spin", name: "360 SPIN", swipe: "right", ms: 480, points: 200 },
  { id: "backflip", name: "BACKFLIP", swipe: "left", ms: 660, points: 300 },
];

export const trickFor = (swipe: Swipe): ParkTrick => PARK_TRICKS.find((t) => t.swipe === swipe)!;

/** THE HALF PIPE and THE HANDRAIL (0.20.0, Andy): after the top of a
 *  four rail set, sometimes a half pipe to drop into, ride through and
 *  launch out of, big; after a three rail set, sometimes a staircase
 *  with a handrail slanting down it to slide. */
export type ObstacleKind = "rail" | "box" | "gap" | "kicker" | "pipe" | "stairs";
/** Out of the pipe's far lip: bigger air than any ollie or kicker. */
export const PIPE_VY = 900;
export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  /** World x of the left edge. */
  x: number;
  w: number;
  /** Height of the top (rail, box, kicker lip). Gaps have none. */
  h: number;
  /** Already collided with, or already launched from. */
  used: boolean;
}

export type Mode = "ground" | "air" | "grind" | "pipe" | "slide" | "bail";
export type BailWhy = "trick" | "rail" | "box" | "gap";

export interface ChainItem { name: string; points: number }

export type ParkEvent =
  | { kind: "ollie"; charge: number }
  | { kind: "kick" }
  | { kind: "trick"; trick: ParkTrick }
  | { kind: "trickDone"; trick: ParkTrick }
  | { kind: "land" }
  | { kind: "grind" }
  | { kind: "grindEnd"; points: number }
  | { kind: "pipeIn" }
  | { kind: "pipeOut" }
  | { kind: "slide" }
  | { kind: "bail"; why: BailWhy }
  | { kind: "bank"; chain: ChainItem[]; points: number; mult: number }
  | { kind: "timeUp" };

export interface Rider {
  /** Feet height above flat ground, design units. */
  y: number;
  vy: number;
  mode: Mode;
  bailT: number;
  bailWhy: BailWhy | null;
  /** The trick in progress and how far along it is, in seconds. */
  trick: ParkTrick | null;
  trickT: number;
  /** The rail, or the handrail, under the trucks; the pipe under the wheels. */
  grindOn: Obstacle | null;
  grindT: number;
  pipeOn: Obstacle | null;
  /** Holding a press on the ground: how long, for the crouch and the charge. */
  holding: boolean;
  holdT: number;
}

export interface ParkState {
  running: boolean;
  timeLeftMs: number;
  scroll: number;
  speed: number;
  elapsed: number;
  rider: Rider;
  chain: ChainItem[];
  score: number;
  bestChain: number;
  bestBank: number;
  tricksLanded: number;
  bails: number;
  obstacles: Obstacle[];
  /** World x where the next pattern goes. */
  nextX: number;
  nextId: number;
  seed: number;
}

/** A tiny seeded generator: the same seed lays down the same line. */
const rng = (s: ParkState): number => {
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const newRun = (minutes: number, seed = 1): ParkState => ({
  running: true, timeLeftMs: minutes * 60_000, scroll: 0, speed: BASE_SPEED, elapsed: 0,
  rider: { y: 0, vy: 0, mode: "ground", bailT: 0, bailWhy: null, trick: null, trickT: 0, grindOn: null, grindT: 0, pipeOn: null, holding: false, holdT: 0 },
  chain: [], score: 0, bestChain: 0, bestBank: 0, tricksLanded: 0, bails: 0,
  obstacles: [], nextX: PARK_W + 260, nextId: 1, seed,
});

/** The rider's centre in world x. */
export const riderX = (s: ParkState): number => s.scroll + RIDER_X;

/** How hard the line is right now: eases in over the first two minutes. */
export const difficulty = (s: ParkState): number => Math.min(1, s.elapsed / 120);

// ---------------------------------------------------------------------------
// The line: patterns of obstacles laid down ahead of the rider.
// ---------------------------------------------------------------------------

type Piece = { kind: ObstacleKind; dx: number; w: number; h: number };

const PATTERNS: ReadonlyArray<{ min: number; make: (r: number, d: number) => Piece[] }> = [
  { min: 0, make: (r) => [{ kind: "rail", dx: 0, w: 180 + r * 140, h: 34 }] },
  { min: 0, make: () => [{ kind: "kicker", dx: 0, w: 84, h: 44 }] },
  { min: 0, make: () => [{ kind: "box", dx: 0, w: 46, h: 40 }] },
  { min: 0.15, make: () => [{ kind: "kicker", dx: 0, w: 84, h: 44 }, { kind: "rail", dx: 250, w: 240, h: 34 }] },
  { min: 0.2, make: (r, d) => [{ kind: "gap", dx: 0, w: 84 + d * 50 + r * 30, h: 0 }] },
  { min: 0.3, make: () => [{ kind: "box", dx: 0, w: 46, h: 40 }, { kind: "box", dx: 160, w: 46, h: 40 }] },
  { min: 0.4, make: (r) => [{ kind: "rail", dx: 0, w: 200 + r * 80, h: 34 }, { kind: "gap", dx: 230 + r * 80, w: 90, h: 0 }] },
  { min: 0.5, make: () => [{ kind: "kicker", dx: 0, w: 84, h: 44 }, { kind: "gap", dx: 150, w: 130, h: 0 }] },
  { min: 0.6, make: () => [{ kind: "box", dx: 0, w: 46, h: 40 }, { kind: "rail", dx: 130, w: 220, h: 34 }] },
  // THE STAIRS (Andy): rails that climb, spaced so an ollie off one lands
  // on the next. Three hops in a row is the satisfaction he asked for.
  { min: 0.1, make: () => [{ kind: "rail", dx: 0, w: 170, h: 34 }, { kind: "rail", dx: 230, w: 170, h: 62 }, { kind: "rail", dx: 460, w: 190, h: 90 }] },
  { min: 0.45, make: () => [{ kind: "rail", dx: 0, w: 150, h: 34 }, { kind: "rail", dx: 210, w: 150, h: 64 }, { kind: "rail", dx: 420, w: 150, h: 94 }, { kind: "rail", dx: 630, w: 200, h: 124 }] },
  // Sometimes the top of the four leads straight into a HALF PIPE: drop in,
  // across, up the far wall, and out with air enough for a big trick.
  { min: 0.5, make: () => [{ kind: "rail", dx: 0, w: 150, h: 34 }, { kind: "rail", dx: 210, w: 150, h: 64 }, { kind: "rail", dx: 420, w: 150, h: 94 }, { kind: "rail", dx: 630, w: 200, h: 124 }, { kind: "pipe", dx: 830, w: 380, h: 124 }] },
  // Sometimes the top of the three leads onto a STAIRCASE with a handrail
  // slanting down it, to slide to the bottom.
  { min: 0.3, make: () => [{ kind: "rail", dx: 0, w: 170, h: 34 }, { kind: "rail", dx: 230, w: 170, h: 62 }, { kind: "rail", dx: 460, w: 190, h: 90 }, { kind: "stairs", dx: 650, w: 300, h: 90 }] },
];

const spawn = (s: ParkState): void => {
  const d = difficulty(s);
  const open = PATTERNS.filter((p) => p.min <= d);
  const pick = open[Math.floor(rng(s) * open.length)]!;
  const pieces = pick.make(rng(s), d);
  let end = s.nextX;
  for (const p of pieces) {
    const x = s.nextX + p.dx;
    s.obstacles.push({ id: s.nextId++, kind: p.kind, x, w: p.w, h: p.h, used: false });
    end = Math.max(end, x + p.w);
  }
  // The rest between patterns is TIME, not distance, so a faster line does
  // not also become a denser one; it eases from 1.5s down to 0.9s.
  const rest = 1.5 - 0.6 * d;
  s.nextX = end + Math.max(180, s.speed * rest);
};

/**
 * Where the surface is under a given world x: a pipe dips from its lip
 * to the ground and back (a cosine bowl), a staircase's handrail slants
 * from its top straight down to the ground. Everything else is flat.
 */
export const surfaceY = (o: Obstacle, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - o.x) / o.w));
  if (o.kind === "pipe") return o.h * Math.cos(Math.PI * t) ** 2;
  if (o.kind === "stairs") return o.h * (1 - t);
  return o.h;
};

/** The rider's centre is over the obstacle. */
const over = (s: ParkState, o: Obstacle): boolean => { const x = riderX(s); return x >= o.x && x <= o.x + o.w; };

const overlaps = (s: ParkState, o: Obstacle, pad = 0): boolean => {
  const x = riderX(s);
  return x + RIDER_W / 2 - pad > o.x && x - RIDER_W / 2 + pad < o.x + o.w;
};

// ---------------------------------------------------------------------------
// Input.
// ---------------------------------------------------------------------------

/** Finger down. On the ground it starts a charge; anywhere else, nothing yet. */
export const press = (s: ParkState): void => {
  if (!s.running) return;
  const r = s.rider;
  if (r.mode === "ground" || r.mode === "grind" || r.mode === "slide") { r.holding = true; r.holdT = 0; }
};

const ollie = (s: ParkState, vy: number, ev: ParkEvent[], charge: number): void => {
  const r = s.rider;
  if (r.mode === "grind" || r.mode === "slide") endGrind(s, ev);
  r.mode = "air";
  r.vy = vy;
  r.y = Math.max(r.y, 0.01);
  ev.push({ kind: "ollie", charge });
};

const startTrick = (s: ParkState, t: ParkTrick, ev: ParkEvent[]): boolean => {
  const r = s.rider;
  if (r.mode !== "air" || r.trick !== null) return false;
  r.trick = t;
  r.trickT = 0;
  ev.push({ kind: "trick", trick: t });
  return true;
};

/**
 * Finger up. A tap ollies; a hold ollies bigger; a swipe in the air is a
 * trick; a swipe on the ground or a rail ollies AND starts the trick, so a
 * kid does not need two gestures to do one thing.
 */
export const release = (s: ParkState, swipe: Swipe | null, ev: ParkEvent[]): void => {
  const r = s.rider;
  const holdT = r.holdT;
  r.holding = false;
  r.holdT = 0;
  if (!s.running || r.mode === "bail" || r.mode === "pipe") return;
  if (r.mode === "ground" || r.mode === "grind" || r.mode === "slide") {
    const charge = swipe !== null ? 0 : Math.max(0, Math.min(1, (holdT * 1000 - 140) / (HOLD_MS - 140)));
    ollie(s, OLLIE_VY + (OLLIE_VY_MAX - OLLIE_VY) * charge, ev, charge);
    if (swipe !== null) startTrick(s, trickFor(swipe), ev);
    return;
  }
  if (r.mode === "air" && swipe !== null) startTrick(s, trickFor(swipe), ev);
};

// ---------------------------------------------------------------------------
// The clock.
// ---------------------------------------------------------------------------

const bail = (s: ParkState, why: BailWhy, ev: ParkEvent[]): void => {
  const r = s.rider;
  r.mode = "bail";
  r.bailT = 0;
  r.bailWhy = why;
  r.trick = null;
  r.grindOn = null;
  r.pipeOn = null;
  r.vy = 0;
  s.chain = [];
  s.bails += 1;
  s.speed = BASE_SPEED;
  ev.push({ kind: "bail", why });
};

const endGrind = (s: ParkState, ev: ParkEvent[]): void => {
  const r = s.rider;
  if (r.grindOn === null) return;
  const points = Math.round(GRIND_BASE + GRIND_PER_S * r.grindT);
  s.chain.push({ name: r.grindOn.kind === "stairs" ? "RAIL SLIDE" : "GRIND", points });
  r.grindOn = null;
  ev.push({ kind: "grindEnd", points });
};

const bank = (s: ParkState, ev: ParkEvent[]): void => {
  if (s.chain.length === 0) return;
  const mult = Math.min(MAX_MULT, s.chain.length);
  const points = s.chain.reduce((a, c) => a + c.points, 0) * mult;
  s.score += points;
  s.bestBank = Math.max(s.bestBank, points);
  s.bestChain = Math.max(s.bestChain, s.chain.length);
  ev.push({ kind: "bank", chain: s.chain, points, mult });
  s.chain = [];
};

/** The trick in progress counts if it is far enough along; else a bail. */
const settleTrick = (s: ParkState, ev: ParkEvent[]): boolean => {
  const r = s.rider;
  if (r.trick === null) return true;
  const progress = r.trickT * 1000 / r.trick.ms;
  if (progress < LAND_TOL) { bail(s, "trick", ev); return false; }
  finishTrick(s, ev);
  return true;
};

const finishTrick = (s: ParkState, ev: ParkEvent[]): void => {
  const r = s.rider;
  if (r.trick === null) return;
  s.chain.push({ name: r.trick.name, points: r.trick.points });
  s.tricksLanded += 1;
  ev.push({ kind: "trickDone", trick: r.trick });
  r.trick = null;
};

/**
 * Advance the world by dt seconds. Returns what happened, for the screen to
 * draw and sound. Deterministic: the same inputs on the same seed give the
 * same run, which is what the tests lean on.
 */
export const update = (s: ParkState, dt: number): ParkEvent[] => {
  const ev: ParkEvent[] = [];
  if (!s.running) return ev;
  s.timeLeftMs -= dt * 1000;
  if (s.timeLeftMs <= 0) {
    s.timeLeftMs = 0;
    s.running = false;
    if (s.rider.mode === "grind" || s.rider.mode === "slide") endGrind(s, ev);
    if (s.rider.mode !== "bail") bank(s, ev);
    ev.push({ kind: "timeUp" });
    return ev;
  }
  s.elapsed += dt;
  const r = s.rider;

  if (r.mode === "bail") {
    r.bailT += dt;
    if (r.bailT * 1000 >= BAIL_MS) { r.mode = "ground"; r.y = 0; r.vy = 0; r.bailWhy = null; }
    // The world keeps rolling, slowly, while he picks himself up.
    s.scroll += s.speed * 0.4 * dt;
  } else {
    s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt);
    s.scroll += s.speed * dt;
  }
  if (r.holding) r.holdT += dt;

  while (s.nextX < s.scroll + PARK_W + 240) spawn(s);
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > s.scroll - 160);

  if (r.mode === "air") {
    r.vy -= G * dt;
    r.y += r.vy * dt;
    if (r.trick !== null) {
      r.trickT += dt;
      if (r.trickT * 1000 >= r.trick.ms) finishTrick(s, ev);
    }
    // Rails: a landing zone on top, a wall at the front.
    for (const o of s.obstacles) {
      if (o.kind !== "rail" || !overlaps(s, o, 6)) continue;
      if (r.vy <= 0 && r.y <= o.h + 10 && r.y >= o.h - 18) {
        if (!settleTrick(s, ev)) return ev;
        r.mode = "grind"; r.y = o.h; r.vy = 0; r.grindOn = o; r.grindT = 0;
        ev.push({ kind: "grind" });
        return ev;
      }
      if (!o.used && r.y < o.h - 18 && riderX(s) - RIDER_W / 2 < o.x + 18) { o.used = true; bail(s, "rail", ev); return ev; }
    }
    for (const o of s.obstacles) {
      if (o.kind === "box" && !o.used && overlaps(s, o, 6) && r.y < o.h - 8) { o.used = true; bail(s, "box", ev); return ev; }
    }
    // The pipe catches anything that comes down into it; the handrail
    // catches a landing near its line and throws one that comes in under.
    for (const o of s.obstacles) {
      if ((o.kind !== "pipe" && o.kind !== "stairs") || r.vy > 0) continue;
      if (!o.used && riderX(s) - RIDER_W / 2 < o.x + 18 && riderX(s) + RIDER_W / 2 > o.x && r.y < o.h - 18) { o.used = true; bail(s, "rail", ev); return ev; }
      if (!over(s, o)) continue;
      const sy = surfaceY(o, riderX(s));
      if (o.kind === "pipe" && r.y <= sy + 10) {
        if (!settleTrick(s, ev)) return ev;
        r.mode = "pipe"; r.pipeOn = o; r.y = sy; r.vy = 0;
        ev.push({ kind: "pipeIn" });
        return ev;
      }
      if (o.kind === "stairs" && r.y <= sy + 10 && r.y >= sy - 18) {
        if (!settleTrick(s, ev)) return ev;
        r.mode = "slide"; r.grindOn = o; r.grindT = 0; r.y = sy; r.vy = 0;
        ev.push({ kind: "slide" });
        return ev;
      }
      if (o.kind === "stairs" && !o.used && r.y < sy - 18) { o.used = true; bail(s, "box", ev); return ev; }
    }
    if (r.y <= 0) {
      r.y = 0;
      r.vy = 0;
      if (!settleTrick(s, ev)) return ev;
      // Down into a gap is a fall, not a landing.
      const gap = s.obstacles.find((o) => o.kind === "gap" && overlaps(s, o, 14));
      if (gap !== undefined) { bail(s, "gap", ev); return ev; }
      r.mode = "ground";
      ev.push({ kind: "land" });
      bank(s, ev);
    }
    return ev;
  }

  if (r.mode === "grind") {
    r.grindT += dt;
    const o = r.grindOn!;
    if (riderX(s) - RIDER_W / 2 > o.x + o.w) {
      // Rolled off the end: a short drop to the ground.
      endGrind(s, ev);
      r.mode = "air"; r.vy = 0; r.y = Math.max(r.y, 1);
    }
    return ev;
  }

  if (r.mode === "pipe") {
    const o = r.pipeOn!;
    const x = riderX(s);
    if (x >= o.x + o.w) {
      // Off the far lip, straight up, with air for anything.
      r.pipeOn = null;
      r.mode = "air"; r.y = o.h; r.vy = PIPE_VY;
      ev.push({ kind: "pipeOut" });
      return ev;
    }
    r.y = surfaceY(o, x);
    return ev;
  }

  if (r.mode === "slide") {
    r.grindT += dt;
    const o = r.grindOn!;
    const x = riderX(s);
    if (x >= o.x + o.w) {
      // The bottom of the stairs is flat ground: the chain banks here.
      endGrind(s, ev);
      r.mode = "ground"; r.y = 0;
      ev.push({ kind: "land" });
      bank(s, ev);
      return ev;
    }
    r.y = surfaceY(o, x);
    return ev;
  }

  // On the ground: kickers launch, gaps swallow, rails and boxes stop you.
  for (const o of s.obstacles) {
    const x = riderX(s);
    if (o.kind === "kicker" && !o.used && x >= o.x + o.w - 6 && x <= o.x + o.w + 40) {
      o.used = true;
      ollie(s, KICK_VY, ev, 1);
      ev.push({ kind: "kick" });
      return ev;
    }
    if (o.kind === "gap" && overlaps(s, o, 14)) { bail(s, "gap", ev); return ev; }
    if ((o.kind === "rail" || o.kind === "box" || o.kind === "pipe" || o.kind === "stairs") && !o.used && x + RIDER_W / 2 > o.x && x - RIDER_W / 2 < o.x + 18) {
      o.used = true; bail(s, o.kind === "box" ? "box" : "rail", ev); return ev;
    }
  }
  return ev;
};

/** The words for the chain, for the pop when it banks. */
export const chainLabel = (chain: readonly ChainItem[]): string => chain.map((c) => c.name).join(" + ");

// ---------------------------------------------------------------------------
// Tokens: earned once a day, spent one at a time, capped per day.
// ---------------------------------------------------------------------------

export const PARK_DEFAULTS = { minutes: 7, tokensPerDay: 3 } as const;

export interface ParkMeta {
  tokens: number;
  tokenDay: number | null;
  parkDay: number | null;
  parkSpent: number;
  parkMinutes: number;
  parkTokensPerDay: number;
  parkUnlocked: boolean;
}

export const spentToday = (m: ParkMeta, day: number): number => (m.parkDay === day ? m.parkSpent : 0);

export type ParkGate = { ok: true; leftToday: number } | { ok: false; why: "noToken" | "dayFull" };

/** May a token be spent right now? Tokens first, then today's cap. */
export const parkGate = (m: ParkMeta, day: number): ParkGate => {
  const left = m.parkTokensPerDay - spentToday(m, day);
  if (left <= 0) return { ok: false, why: "dayFull" };
  if (m.tokens <= 0) return { ok: false, why: "noToken" };
  return { ok: true, leftToday: left };
};

/** The day's dose is done: one token, once a day. Returns whether it dropped. */
export const awardDailyToken = (m: ParkMeta, day: number): boolean => {
  if (m.tokenDay === day) return false;
  m.tokenDay = day;
  m.tokens += 1;
  m.parkUnlocked = true;
  return true;
};

/** Spend one. The caller has passed the gate and the confirm. */
export const spendToken = (m: ParkMeta, day: number): void => {
  m.tokens = Math.max(0, m.tokens - 1);
  m.parkSpent = spentToday(m, day) + 1;
  m.parkDay = day;
};

/** The gate's words, for the sheet. */
export const gateWords = (g: ParkGate, m: ParkMeta): string => {
  if (g.ok) return `${m.tokens} ${m.tokens === 1 ? "token" : "tokens"} in the pocket. ${g.leftToday} more ${g.leftToday === 1 ? "play" : "plays"} allowed today.`;
  if (g.why === "noToken") return "No Daily Token yet. Land today's tricks and one drops.";
  return `That is all ${m.parkTokensPerDay} plays for today. The park opens again tomorrow.`;
};

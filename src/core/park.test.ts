import { describe, expect, it } from "vitest";
import {
  awardDailyToken, BASE_SPEED, chainLabel, G, KICK_VY, LAND_TOL, MAX_SPEED, newRun, OLLIE_VY, OLLIE_VY_MAX,
  PARK_TRICKS, PARK_W, parkGate, PIPE_VY, press, railLength, release, RIDER_X, riderX, spendToken, spentToday, surfaceY, trickFor, update,
  type Obstacle, type ParkEvent, type ParkMeta, type ParkState,
} from "./park";

const STEP = 1 / 120;
/** Run the clock until the predicate holds or the budget runs out. */
const runUntil = (s: ParkState, pred: (ev: ParkEvent[]) => boolean, maxS = 10): ParkEvent[] => {
  const all: ParkEvent[] = [];
  for (let t = 0; t < maxS; t += STEP) {
    const ev = update(s, STEP);
    all.push(...ev);
    if (pred(ev)) break;
  }
  return all;
};
const kinds = (ev: ParkEvent[]): string[] => ev.map((e) => e.kind);
/** A clean run with no obstacles for the physics tests: the line starts far away. */
const flat = (minutes = 7): ParkState => { const s = newRun(minutes, 3); s.nextX = 1e9; return s; };
const tap = (s: ParkState): ParkEvent[] => { press(s); const ev: ParkEvent[] = []; release(s, null, ev); return ev; };
/** Plant one obstacle just ahead of the rider. */
const plant = (s: ParkState, kind: Obstacle["kind"], ahead: number, w: number, h: number): Obstacle => {
  const o: Obstacle = { id: 999, kind, x: riderX(s) + ahead, w, h, used: false };
  s.obstacles.push(o);
  return o;
};

describe("the ollie", () => {
  it("leaves the ground on a tap and comes back down in about two thirds of a second", () => {
    const s = flat();
    expect(kinds(tap(s))).toEqual(["ollie"]);
    expect(s.rider.mode).toBe("air");
    let peak = 0;
    let t = 0;
    for (; t < 3; t += STEP) { update(s, STEP); peak = Math.max(peak, s.rider.y); if (s.rider.mode === "ground") break; }
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(0.8);
    expect(peak).toBeGreaterThan(80);
    expect(peak).toBeLessThan(OLLIE_VY * OLLIE_VY / (2 * G) + 2);
  });

  it("goes higher the longer the press is held, up to a cap", () => {
    const s = flat();
    press(s);
    for (let t = 0; t < 0.5; t += STEP) update(s, STEP);
    const ev: ParkEvent[] = [];
    release(s, null, ev);
    expect(ev[0]).toEqual({ kind: "ollie", charge: 1 });
    expect(s.rider.vy).toBe(OLLIE_VY_MAX);
    // A quick tap is the small one.
    const q = flat();
    press(q); update(q, STEP); release(q, null, []);
    expect(q.rider.vy).toBe(OLLIE_VY);
  });

  it("does nothing in the air, and nothing while bailed", () => {
    const s = flat();
    tap(s);
    update(s, STEP);
    const before = s.rider.vy;
    expect(kinds(tap(s))).toEqual([]);
    expect(s.rider.vy).toBe(before);
  });
});

describe("tricks", () => {
  it("maps the four swipes to four tricks of rising length and worth", () => {
    expect(PARK_TRICKS.map((t) => t.swipe)).toEqual(["up", "down", "right", "left"]);
    for (let i = 1; i < PARK_TRICKS.length; i++) {
      expect(PARK_TRICKS[i]!.ms).toBeGreaterThan(PARK_TRICKS[i - 1]!.ms);
      expect(PARK_TRICKS[i]!.points).toBeGreaterThan(PARK_TRICKS[i - 1]!.points);
    }
    expect(trickFor("left").name).toBe("BACKFLIP");
  });

  it("lands a kickflip off a plain ollie and banks it as a chain of one", () => {
    const s = flat();
    tap(s);
    const ev: ParkEvent[] = [];
    release(s, "up", ev);
    expect(kinds(ev)).toEqual(["trick"]);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "land"));
    expect(kinds(all)).toContain("trickDone");
    const banked = all.find((e) => e.kind === "bank");
    expect(banked).toBeDefined();
    if (banked?.kind === "bank") { expect(banked.points).toBe(100); expect(banked.mult).toBe(1); }
    expect(s.score).toBe(100);
    expect(s.tricksLanded).toBe(1);
  });

  it("bails when a long trick is still turning at touchdown, and the chain is lost", () => {
    const s = flat();
    tap(s); // ~0.69s of air
    release(s, "left", []); // a 660ms backflip started late in the air? no: started now, but the air is 690ms
    // Start it after a delay so it cannot finish.
    const s2 = flat();
    tap(s2);
    for (let t = 0; t < 0.25; t += STEP) update(s2, STEP);
    release(s2, "left", []);
    const all = runUntil(s2, (e) => e.some((x) => x.kind === "bail" || x.kind === "land"));
    expect(kinds(all)).toContain("bail");
    expect(kinds(all)).not.toContain("bank");
    expect(s2.rider.mode).toBe("bail");
    expect(s2.score).toBe(0);
    expect(s2.bails).toBe(1);
    void s;
  });

  it("counts a trick that is nearly done as landed (the tolerance), and not one that is not", () => {
    expect(LAND_TOL).toBeGreaterThan(0.7);
    expect(LAND_TOL).toBeLessThan(1);
  });

  it("chains two tricks in one big air and multiplies them", () => {
    const s = flat();
    press(s);
    for (let t = 0; t < 0.5; t += STEP) update(s, STEP);
    release(s, "up", []); // charged ollie straight into a kickflip
    // Wait for the kickflip to finish, then a grab.
    runUntil(s, (e) => e.some((x) => x.kind === "trickDone"));
    release(s, "down", []);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"));
    const banked = all.find((e) => e.kind === "bank");
    expect(banked).toBeDefined();
    if (banked?.kind === "bank") {
      expect(banked.chain.map((c) => c.name)).toEqual(["KICKFLIP", "NOSE GRAB"]);
      expect(banked.mult).toBe(2);
      expect(banked.points).toBe((100 + 150) * 2);
    }
    expect(s.bestChain).toBe(2);
    expect(chainLabel(banked?.kind === "bank" ? banked.chain : [])).toBe("KICKFLIP + NOSE GRAB");
  });

  it("swiping on the ground ollies AND starts the trick in one gesture", () => {
    const s = flat();
    press(s);
    const ev: ParkEvent[] = [];
    release(s, "right", ev);
    expect(kinds(ev)).toEqual(["ollie", "trick"]);
    expect(s.rider.trick?.name).toBe("360 SPIN");
  });

  it("a bail resets the speed to the base", () => {
    const s = flat();
    for (let t = 0; t < 20; t += STEP) update(s, STEP);
    expect(s.speed).toBeGreaterThan(BASE_SPEED + 50);
    expect(s.speed).toBeLessThanOrEqual(MAX_SPEED);
    tap(s);
    for (let t = 0; t < 0.3; t += STEP) update(s, STEP);
    release(s, "left", []);
    runUntil(s, (e) => e.some((x) => x.kind === "bail"));
    expect(s.speed).toBe(BASE_SPEED);
  });
});

describe("the line", () => {
  it("lands on a rail and grinds it, then hops off and banks trick plus grind", () => {
    const s = flat();
    const rail = plant(s, "rail", 60, 300, 34);
    tap(s);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "grind"));
    expect(kinds(all)).toContain("grind");
    expect(s.rider.mode).toBe("grind");
    expect(s.rider.grindOn).toBe(rail);
    for (let t = 0; t < 0.3; t += STEP) update(s, STEP);
    expect(s.rider.mode).toBe("grind");
    // Hop off with a kickflip.
    press(s); release(s, "up", []);
    const rest = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"));
    const banked = rest.find((e) => e.kind === "bank");
    expect(banked).toBeDefined();
    if (banked?.kind === "bank") {
      expect(banked.chain.map((c) => c.name)).toEqual(["GRIND", "KICKFLIP"]);
      expect(banked.mult).toBe(2);
      expect(banked.chain[0]!.points).toBeGreaterThan(60);
    }
  });

  it("rolls off the end of a rail and lands clean", () => {
    const s = flat();
    plant(s, "rail", 60, 160, 34);
    tap(s);
    runUntil(s, (e) => e.some((x) => x.kind === "grind"));
    const all = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 5);
    expect(kinds(all)).toContain("grindEnd");
    expect(kinds(all)).toContain("land");
    expect(kinds(all)).not.toContain("bail");
    expect(s.score).toBeGreaterThan(0);
  });

  it("running into a rail or a box on the ground is a bail", () => {
    for (const kind of ["rail", "box"] as const) {
      const s = flat();
      plant(s, kind, 40, 120, 36);
      const all = runUntil(s, (e) => e.some((x) => x.kind === "bail"), 3);
      const b = all.find((e) => e.kind === "bail");
      expect(b).toBeDefined();
      if (b?.kind === "bail") expect(b.why).toBe(kind);
    }
  });

  it("clears a box with an ollie and falls into a gap without one", () => {
    const s = flat();
    plant(s, "box", 60, 46, 40); // tapped as the box arrives, the way a player would
    tap(s);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    expect(kinds(all)).toContain("land");
    expect(kinds(all)).not.toContain("bail");

    const g = flat();
    plant(g, "gap", 40, 120, 0);
    const fell = runUntil(g, (e) => e.some((x) => x.kind === "bail"), 3);
    const b = fell.find((e) => e.kind === "bail");
    expect(b?.kind === "bail" && b.why).toBe("gap");

    const j = flat();
    plant(j, "gap", 30, 100, 0); // ollie at the lip and a plain jump clears a hundred units
    tap(j);
    const over = runUntil(j, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    expect(kinds(over)).toContain("land");
  });

  it("climbs a set of rising rails with one ollie each, chaining three grinds", () => {
    const s = flat();
    plant(s, "rail", 60, 170, 34);
    plant(s, "rail", 290, 170, 62);
    plant(s, "rail", 520, 190, 90);
    tap(s);
    runUntil(s, (e) => e.some((x) => x.kind === "grind"));
    expect(s.rider.mode).toBe("grind");
    // Ride a little, hop, and land the next one up; twice.
    for (let hop = 0; hop < 2; hop++) {
      for (let t = 0; t < 0.25; t += STEP) update(s, STEP);
      tap(s);
      const ev = runUntil(s, (e) => e.some((x) => x.kind === "grind" || x.kind === "bail" || x.kind === "land"), 3);
      expect(kinds(ev), `hop ${hop + 1}`).toContain("grind");
      expect(kinds(ev), `hop ${hop + 1}`).not.toContain("bail");
    }
    expect(s.rider.grindOn?.h).toBe(90);
    expect(s.chain.filter((c) => c.name === "GRIND").length).toBe(2);
    // Off the top and down to the ground: three grinds bank at x3.
    const rest = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 5);
    const banked = rest.find((e) => e.kind === "bank");
    expect(banked?.kind === "bank" && banked.mult).toBe(3);
  });

  it("speeds up the longer the ride goes, and a bail sends it back to base", () => {
    const s = flat();
    for (let t = 0; t < 10; t += STEP) update(s, STEP);
    expect(s.speed).toBeGreaterThan(BASE_SPEED + 60);
    for (let t = 0; t < 40; t += STEP) update(s, STEP);
    expect(s.speed).toBe(MAX_SPEED);
    tap(s);
    for (let t = 0; t < 0.3; t += STEP) update(s, STEP);
    release(s, "left", []);
    runUntil(s, (e) => e.some((x) => x.kind === "bail"));
    expect(s.speed).toBe(BASE_SPEED);
  });

  it("drops off the top rail into a half pipe, rides through, and launches out with big air", () => {
    const s = flat();
    // Already grinding the top of a four rail set, 30 units from its end.
    const top = plant(s, "rail", -100, 130, 124);
    const pipe = plant(s, "pipe", 30, 380, 124);
    s.rider.mode = "grind"; s.rider.y = 124; s.rider.grindOn = top; s.rider.grindT = 0.4;
    const all = runUntil(s, (e) => e.some((x) => x.kind === "pipeOut" || x.kind === "bail"), 5);
    expect(kinds(all)).toContain("grindEnd");
    expect(kinds(all)).toContain("pipeIn");
    expect(kinds(all)).toContain("pipeOut");
    expect(kinds(all)).not.toContain("bail");
    expect(s.rider.mode).toBe("air");
    expect(s.rider.vy).toBe(PIPE_VY);
    expect(s.rider.y).toBeCloseTo(124, 0);
    // The bowl: lip, bottom, lip.
    expect(surfaceY(pipe, pipe.x)).toBeCloseTo(124, 5);
    expect(surfaceY(pipe, pipe.x + pipe.w / 2)).toBeCloseTo(0, 5);
    expect(surfaceY(pipe, pipe.x + pipe.w)).toBeCloseTo(124, 5);
    // The grind is still on the chain, and a backflip fits in the air.
    expect(s.chain.map((c) => c.name)).toEqual(["GRIND"]);
    release(s, "left", []);
    const rest = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 5);
    const banked = rest.find((e) => e.kind === "bank");
    expect(banked?.kind === "bank" && banked.chain.map((c) => c.name)).toEqual(["GRIND", "BACKFLIP"]);
    expect(banked?.kind === "bank" && banked.mult).toBe(2);
  });

  it("rolls off the third rail onto the handrail, slides to the bottom, and banks the slide", () => {
    const s = flat();
    const top = plant(s, "rail", -100, 130, 90);
    const stairs = plant(s, "stairs", 30, 300, 90);
    s.rider.mode = "grind"; s.rider.y = 90; s.rider.grindOn = top; s.rider.grindT = 0.3;
    const all = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 6);
    expect(kinds(all)).toContain("slide");
    expect(kinds(all)).not.toContain("bail");
    expect(kinds(all)).toContain("land");
    expect(surfaceY(stairs, stairs.x)).toBeCloseTo(90, 5);
    expect(surfaceY(stairs, stairs.x + stairs.w)).toBeCloseTo(0, 5);
    const banked = all.find((e) => e.kind === "bank");
    expect(banked?.kind === "bank" && banked.chain.map((c) => c.name)).toEqual(["GRIND", "RAIL SLIDE"]);
    expect(s.rider.mode).toBe("ground");
  });

  it("hops off the handrail mid-slide with a trick, and the slide counts", () => {
    const s = flat();
    const top = plant(s, "rail", -100, 130, 90);
    plant(s, "stairs", 30, 300, 90);
    s.rider.mode = "grind"; s.rider.y = 90; s.rider.grindOn = top;
    runUntil(s, (e) => e.some((x) => x.kind === "slide"), 4);
    for (let t = 0; t < 0.2; t += STEP) update(s, STEP);
    press(s); release(s, "up", []);
    const rest = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 5);
    const banked = rest.find((e) => e.kind === "bank");
    // The hop lands back on the handrail lower down, so the slide resumes.
    const names = banked?.kind === "bank" ? banked.chain.map((c) => c.name) : [];
    expect(names.slice(0, 3)).toEqual(["GRIND", "RAIL SLIDE", "KICKFLIP"]);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(banked?.kind === "bank" && banked.mult).toBeGreaterThanOrEqual(3);
  });

  it("running into the pipe's or the staircase's wall on the ground is a bail", () => {
    for (const kind of ["pipe", "stairs"] as const) {
      const s = flat();
      plant(s, kind, 40, 300, 124);
      const all = runUntil(s, (e) => e.some((x) => x.kind === "bail"), 3);
      expect(kinds(all)).toContain("bail");
    }
  });

  it("a kicker launches without a tap, and high enough for a backflip", () => {
    const s = flat();
    plant(s, "kicker", 30, 84, 44);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "kick"), 3);
    expect(kinds(all)).toContain("kick");
    expect(s.rider.vy).toBe(KICK_VY);
    release(s, "left", []);
    const rest = runUntil(s, (e) => e.some((x) => x.kind === "land" || x.kind === "bail"), 3);
    expect(kinds(rest)).toContain("land");
    expect(s.score).toBe(300);
  });

  it("varies the flat rails a lot, and runs them longer as the line speeds up", () => {
    const widths = (elapsed: number): number[] => {
      const out: number[] = [];
      for (let seed = 1; seed <= 40; seed++) {
        const s = newRun(7, seed);
        s.elapsed = elapsed;
        for (let t = 0; t < 8; t += STEP) update(s, STEP);
        for (const o of s.obstacles) if (o.kind === "rail" && o.h === 34) out.push(o.w);
      }
      return out;
    };
    const early = widths(0);
    const late = widths(150);
    expect(Math.min(...early)).toBeLessThan(200);
    expect(Math.max(...early) - Math.min(...early)).toBeGreaterThan(120);
    expect(Math.max(...late)).toBeGreaterThan(500);
    // The single rail's own length: the roll spreads it, the speed stretches it.
    expect(railLength(0, 0)).toBe(140);
    expect(railLength(1, 0)).toBe(340);
    expect(railLength(0, 1)).toBe(360);
    expect(railLength(1, 1)).toBe(560);
  });

  it("lays the line down ahead, deterministically per seed, and never overlaps a pattern with the next", () => {
    const a = newRun(7, 42);
    const b = newRun(7, 42);
    for (let t = 0; t < 30; t += STEP) { update(a, STEP); update(b, STEP); }
    expect(a.obstacles.map((o) => [o.kind, o.x, o.w])).toEqual(b.obstacles.map((o) => [o.kind, o.x, o.w]));
    expect(a.obstacles.length).toBeGreaterThan(0);
    const c = newRun(7, 7);
    const seen: Obstacle[] = [];
    for (let t = 0; t < 90; t += STEP) {
      update(c, STEP);
      for (const o of c.obstacles) if (!seen.some((x) => x.id === o.id)) seen.push({ ...o });
    }
    expect(seen.length).toBeGreaterThan(20);
    expect(new Set(seen.map((o) => o.kind)).size).toBeGreaterThanOrEqual(4);
    const sorted = [...seen].sort((x, y) => x.x - y.x);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.w);
    // Everything spawns ahead of the stage's right edge.
    for (const o of seen) expect(o.x).toBeGreaterThan(PARK_W - RIDER_X);
  });
});

describe("the clock", () => {
  it("ends the run when the minutes are spent, banking any open chain, and then stands still", () => {
    const s = flat(0.01); // 0.6s
    tap(s);
    release(s, "up", []);
    const all = runUntil(s, (e) => e.some((x) => x.kind === "timeUp"), 5);
    expect(kinds(all)).toContain("timeUp");
    expect(s.running).toBe(false);
    expect(s.timeLeftMs).toBe(0);
    expect(update(s, STEP)).toEqual([]);
  });
});

describe("tokens", () => {
  const fresh = (): ParkMeta => ({ tokens: 0, tokenDay: null, parkDay: null, parkSpent: 0, parkMinutes: 7, parkTokensPerDay: 3, parkUnlocked: false });

  it("drops one token per day, and unlocks the park the first time", () => {
    const m = fresh();
    expect(awardDailyToken(m, 10)).toBe(true);
    expect(awardDailyToken(m, 10)).toBe(false);
    expect(m.tokens).toBe(1);
    expect(m.parkUnlocked).toBe(true);
    expect(awardDailyToken(m, 11)).toBe(true);
    expect(m.tokens).toBe(2);
  });

  it("gates on tokens first, then on the day's cap, which resets with the day", () => {
    const m = fresh();
    expect(parkGate(m, 10)).toEqual({ ok: false, why: "noToken" });
    m.tokens = 5;
    expect(parkGate(m, 10)).toEqual({ ok: true, leftToday: 3 });
    spendToken(m, 10); spendToken(m, 10); spendToken(m, 10);
    expect(m.tokens).toBe(2);
    expect(spentToday(m, 10)).toBe(3);
    expect(parkGate(m, 10)).toEqual({ ok: false, why: "dayFull" });
    expect(parkGate(m, 11)).toEqual({ ok: true, leftToday: 3 });
    expect(spentToday(m, 11)).toBe(0);
  });

  it("never spends below zero", () => {
    const m = fresh();
    spendToken(m, 1);
    expect(m.tokens).toBe(0);
  });
});

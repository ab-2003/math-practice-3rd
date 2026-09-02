import { describe, expect, it } from "vitest";
import { RETRIEVED_MAX_MS } from "./config";
import { buildDeck } from "./facts";
import { allStates, freshState } from "./scheduler";
import { BUCKETS, baseline, byWeek, coldByWeek, csv, headline, heatCells, histogram, kindSummary, slipping } from "./report";
import type { Response, SessionRecord } from "./types";

const deck = buildDeck();

const resp = (over: Partial<Response>): Response => ({
  factId: "add:7+8", day: 0, at: 0, firstKeyMs: 900, submitMs: 2000, correct: true,
  answered: 15, cls: "retrieved", isRetry: false, ...over,
});

describe("the headline", () => {
  it("counts retrieved and derived shares of CORRECT answers, retries excluded", () => {
    const rs = [
      resp({}), resp({ cls: "derived", firstKeyMs: 5000 }),
      resp({ correct: false, cls: "effortful" }),
      resp({ isRetry: true }), resp({ isRetry: true }),
      resp({ factId: "elapsed:600:30" }),
    ];
    const h = headline(rs);
    expect(h.correct).toBe(2);
    expect(h.retrievedPct).toBe(50);
    expect(h.derivedPct).toBe(50);
  });

  it("buckets by week in order, with a median per week", () => {
    const rs = [resp({ day: 0, firstKeyMs: 1000 }), resp({ day: 3, firstKeyMs: 3000 }), resp({ day: 9, firstKeyMs: 500 })];
    const w = byWeek(rs);
    expect(w.map((p) => p.week)).toEqual([0, 1]);
    expect(w[0]!.items).toBe(2);
    expect(w[0]!.medianMs).toBe(2000);
    expect(w[1]!.label).toBe("wk 2");
  });
});

describe("the cold series", () => {
  it("counts only cold-check items, and the headline still counts them all", () => {
    const rs = [
      resp({ cold: true, cls: "derived", firstKeyMs: 4000 }),
      resp({ cold: true }),
      resp({}), resp({}), resp({}),
    ];
    const cold = coldByWeek(rs);
    expect(cold.length).toBe(1);
    expect(cold[0]!.items).toBe(2);
    expect(cold[0]!.retrievedPct).toBe(50);
    expect(byWeek(rs)[0]!.items).toBe(5);
  });

  it("is empty until a cold check has happened", () => {
    expect(coldByWeek([resp({}), resp({})])).toEqual([]);
  });
});

describe("his personal floor", () => {
  it("is the median first-digit time on MASTERED facts only", () => {
    const states = allStates(deck);
    states.set("add:7+8", { ...freshState(), introduced: true, mastered: true, box: 5 });
    const rs = [
      resp({ firstKeyMs: 1200 }), resp({ firstKeyMs: 800 }), resp({ firstKeyMs: 1000 }),
      resp({ factId: "add:2+3", firstKeyMs: 9000 }), // not mastered: ignored
      resp({ firstKeyMs: 9000, correct: false, cls: "effortful" }), // wrong: ignored
    ];
    const b = baseline(rs, states);
    expect(b.n).toBe(3);
    expect(b.medianMs).toBe(1000);
    expect(b.headroom).toBe(RETRIEVED_MAX_MS / 1000);
  });

  it("says nothing rather than guessing when there is no data", () => {
    expect(baseline([], allStates(deck))).toEqual({ medianMs: null, n: 0, headroom: null });
  });
});

describe("the histogram", () => {
  it("nests its buckets inside the classification bands", () => {
    expect(BUCKETS[1]!.max).toBe(3000); // the retrieved band closes here
    expect(BUCKETS[3]!.max).toBe(8000); // the derived band closes here
  });

  it("splits rows by operation and format, with an ALL row first", () => {
    const rs = [
      resp({ firstKeyMs: 500 }), resp({ factId: "sub:11-8", firstKeyMs: 4000, cls: "derived" }),
      resp({ factId: "sub:11-8", format: "missing", firstKeyMs: 9000, cls: "effortful" }),
      resp({ correct: false, cls: "effortful" }), // wrong answers never enter
    ];
    const rows = histogram(rs);
    expect(rows[0]!.key).toBe("all");
    expect(rows[0]!.total).toBe(3);
    expect(rows.map((r) => r.key)).toEqual(["all", "+", "−", "− missing"]);
    expect(rows.find((r) => r.key === "− missing")!.counts[4]).toBe(1);
  });
});

describe("the heat map and its summary", () => {
  it("summarises each operation as mastered / working / unseen", () => {
    const states = allStates(deck);
    states.set("add:7+8", { ...freshState(), introduced: true, mastered: true, box: 5, seen: 4, correct: 4 });
    states.set("add:2+3", { ...freshState(), introduced: true, box: 2, seen: 2, correct: 1 });
    const cells = heatCells(deck, states, []);
    const add = kindSummary(cells).find((k) => k.kind === "add")!;
    expect(add.total).toBe(66);
    expect(add.mastered).toBe(1);
    expect(add.working).toBe(1);
    expect(add.unseen).toBe(64);
  });

  it("lists the facts going the wrong way, weakest first", () => {
    const states = allStates(deck);
    states.set("sub:11-8", { ...freshState(), introduced: true, box: 1, seen: 6, correct: 2 });
    states.set("sub:13-5", { ...freshState(), introduced: true, box: 3, seen: 5, correct: 2 });
    states.set("add:7+8", { ...freshState(), introduced: true, box: 1, seen: 6, correct: 6 });
    const cells = heatCells(deck, states, []);
    expect(slipping(cells, states).map((c) => c.id)).toEqual(["sub:11-8", "sub:13-5"]);
  });
});

describe("the CSV", () => {
  it("carries the measurement definition, the raw timings, and the cold flag", () => {
    const sessions: SessionRecord[] = [{
      id: "s1", day: 0, startedAt: 0, endedAt: 120000, items: 10, correct: 9,
      retrieved: 5, derived: 4, status: "endedEarly", coins: 12, reason: "tired",
    }];
    const out = csv([resp({ cold: true })], sessions);
    expect(out).toContain("FIRST DIGIT");
    expect(out).toContain("first_key_ms");
    expect(out).toContain("cold_check");
    expect(out.split("\n")[2]).toContain(",true");
    expect(out).toContain("endedEarly,tired");
  });
});

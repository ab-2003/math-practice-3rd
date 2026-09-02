import { describe, expect, it } from "vitest";
import { buildDeck } from "./facts";
import { improvement, projection, replayMilestones, trendRows } from "./report";
import type { Response, SessionRecord } from "./types";

const deck = buildDeck();
const resp = (factId: string, day: number, i: number, cls: Response["cls"] = "retrieved", correct = true): Response => ({
  factId, day, at: day * 86_400_000 + i * 1000, firstKeyMs: cls === "retrieved" ? 900 : cls === "derived" ? 4000 : 9000,
  submitMs: 5000, correct, answered: 1, cls, isRetry: false,
});

describe("replaying the log for milestones", () => {
  it("dates mastery by the scheduler's own rule: three retrieved answers on three days", () => {
    const rs = [resp("add:7+8", 0, 1), resp("add:7+8", 0, 2), resp("add:7+8", 1, 1), resp("add:7+8", 3, 1)];
    const { introducedOn, masteredOn } = replayMilestones(deck, rs);
    expect(introducedOn.get("add:7+8")).toBe(0);
    expect(masteredOn.get("add:7+8")).toBe(3); // day 0 twice counts once; day 1; day 3
  });

  it("ignores forced re-entries and facts not in the deck", () => {
    const rs = [{ ...resp("add:7+8", 0, 1), isRetry: true }, resp("elapsed:600:30", 0, 2)];
    const { introducedOn } = replayMilestones(deck, rs);
    expect(introducedOn.size).toBe(0);
  });
});

describe("weekly trend rows", () => {
  const rs: Response[] = [];
  // week 0: slow and derived; week 1: fast and retrieved; week 2 empty; week 3: back
  for (let i = 0; i < 10; i++) rs.push(resp(`add:${i}+${i}`, 1, i, i < 3 ? "retrieved" : "derived"));
  for (let i = 0; i < 10; i++) rs.push(resp(`add:${i}+${i}`, 8, i, i < 8 ? "retrieved" : "derived"));
  for (let i = 0; i < 4; i++) rs.push(resp(`add:${i}+${i}`, 22, i, "retrieved"));
  const sessions: SessionRecord[] = [
    { id: "a", day: 1, startedAt: 0, endedAt: 300_000, items: 10, correct: 10, retrieved: 3, derived: 7, status: "complete", coins: 10 },
    { id: "b", day: 8, startedAt: 0, endedAt: 600_000, items: 10, correct: 10, retrieved: 8, derived: 2, status: "complete", coins: 10 },
  ];

  it("fills every week from first to last, empty ones included, with the log's figures", () => {
    const rows = trendRows(deck, rs, sessions);
    expect(rows.map((r) => r.week)).toEqual([0, 1, 2, 3]);
    expect(rows[0]!.retrievedPct).toBe(30);
    expect(rows[1]!.retrievedPct).toBe(80);
    expect(rows[2]!.items).toBe(0);
    expect(rows[0]!.minutes).toBe(5);
    expect(rows[1]!.sessions).toBe(1);
    expect(rows[0]!.byKind.add?.items).toBe(10);
    expect(rows[0]!.label.length).toBeGreaterThan(2);
  });

  it("carries cumulative facts met and facts from memory", () => {
    const rows = trendRows(deck, rs, sessions);
    expect(rows[0]!.introducedCum).toBe(10);
    expect(rows[3]!.introducedCum).toBe(10);
    // mastery needs three distinct retrieved days: facts 0..2 hit it on day 22
    expect(rows[1]!.masteredCum).toBe(0);
    expect(rows[3]!.masteredCum).toBe(3);
  });

  it("is empty with no scoreable answers", () => {
    expect(trendRows(deck, [], [])).toEqual([]);
  });
});

describe("improvement and projection", () => {
  const rows = (pcts: number[], mastered: number[]) => pcts.map((p, i) => ({
    week: i, label: `w${i}`, items: 20, correct: 20, accuracyPct: 100, retrievedPct: p, medianMs: 3000 - i * 300,
    sessions: 5, minutes: 40, masteredCum: mastered[i]!, introducedCum: 60, byKind: {},
  }));

  it("compares the latest weeks against the ones before, two each once there are four", () => {
    const imp = improvement(rows([20, 30, 40, 50], [5, 10, 20, 30]))!;
    expect(imp.span).toBe(2);
    expect(imp.retrievedBefore).toBe(25);
    expect(imp.retrievedAfter).toBe(45);
    expect(imp.masteredBefore).toBe(10);
    expect(imp.masteredAfter).toBe(30);
    expect(imp.medianAfter!).toBeLessThan(imp.medianBefore!);
  });

  it("needs two weeks with answers, and compares one to one until there are four", () => {
    expect(improvement(rows([40], [5]))).toBeNull();
    expect(improvement(rows([20, 40], [5, 9]))!.span).toBe(1);
  });

  it("projects a straight line through the recent pace, and says so when there is none", () => {
    const p = projection(rows([1, 1, 1, 1, 1], [0, 10, 20, 30, 40]), 187, 100)!;
    expect(p.perWeek).toBe(10);
    expect(p.remaining).toBe(147);
    expect(p.etaDay).toBe(100 + Math.round(14.7 * 7));
    expect(projection(rows([1, 1], [5, 5]), 187, 100)!.etaDay).toBeNull();
    expect(projection(rows([1], [5]), 187, 100)).toBeNull();
  });
});

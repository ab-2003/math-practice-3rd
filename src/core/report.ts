/**
 * THE REPORT, DERIVED. Every figure the parent dashboard shows is computed
 * here, from the stored raw response log, never from a running total, so the
 * dashboard cannot drift away from its evidence and so the same report can be
 * drawn from a device's own data OR from a cloud snapshot (the viewer mode).
 *
 * Pure: no DOM, no clock. The UI only lays these out.
 */

import { dayLabel, isoOf } from "./clock";
import { DERIVED_MAX_MS, RETRIEVED_MAX_MS } from "./config";
import { applyResponse, freshState } from "./scheduler";
import type { Caps, Deck, FactKind, FactState, Response, SessionRecord, States, Strands } from "./types";

/** Everything the report needs, from wherever it came. */
export interface Snapshot {
  deck: Deck;
  states: States;
  responses: readonly Response[];
  sessions: readonly SessionRecord[];
  strands: Strands;
  caps: Caps;
}

export const MEASUREMENT_NOTE =
  `Response time is measured from the moment the problem is painted to the FIRST DIGIT pressed on the app's own keypad, ` +
  `not to submission, so it excludes the motor time of typing a two or three digit answer. ` +
  `Retrieved = correct under ${RETRIEVED_MAX_MS / 1000}s. Derived = correct ${RETRIEVED_MAX_MS / 1000}-${DERIVED_MAX_MS / 1000}s. ` +
  `Effortful = correct over ${DERIVED_MAX_MS / 1000}s, or incorrect. ` +
  `Forced re-entries after a wrong answer and elapsed-time bonus items are excluded from all figures. ` +
  `Cold-check items (a few mastered facts asked unannounced at the top of a weekly session) are reported as their own series. ` +
  `This is practice telemetry from a tablet, not a normed assessment.`;

/** Retries are excluded everywhere: he had just been shown the answer.
 *  Elapsed-time bonus items are excluded too: they would inflate the headline. */
export const scoreable = (rs: readonly Response[]): Response[] =>
  rs.filter((r) => !r.isRetry && !r.factId.startsWith("elapsed:"));

export const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? null) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
};

export const weekOf = (day: number): number => Math.floor(day / 7);

export interface WeekPoint {
  label: string;
  retrievedPct: number;
  items: number;
  week: number;
  /** Median first-digit time on correct answers that week, when known. */
  medianMs: number | null;
}

const weekly = (rs: readonly Response[]): WeekPoint[] => {
  const buckets = new Map<number, Response[]>();
  for (const r of rs) {
    const w = weekOf(r.day);
    const list = buckets.get(w);
    if (list) list.push(r); else buckets.set(w, [r]);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([w, list], i) => {
    const correct = list.filter((r) => r.correct);
    return {
      label: `wk ${i + 1}`,
      items: list.length,
      retrievedPct: correct.length === 0 ? 0
        : Math.round((correct.filter((r) => r.cls === "retrieved").length / correct.length) * 100),
      week: w,
      medianMs: median(correct.filter((r) => r.firstKeyMs !== null).map((r) => r.firstKeyMs!)),
    };
  });
};

/** THE HEADLINE: retrieval share of correct answers, by week. */
export const byWeek = (rs: readonly Response[]): WeekPoint[] => weekly(scoreable(rs));

/** THE COLD SERIES: the same figure over cold-check items only. */
export const coldByWeek = (rs: readonly Response[]): WeekPoint[] =>
  weekly(scoreable(rs).filter((r) => r.cold === true));

export interface Headline {
  correct: number;
  retrievedPct: number;
  derivedPct: number;
}

export const headline = (rs: readonly Response[]): Headline => {
  const correct = scoreable(rs).filter((r) => r.correct);
  const pct = (cls: string): number => correct.length === 0 ? 0
    : Math.round((correct.filter((r) => r.cls === cls).length / correct.length) * 100);
  return { correct: correct.length, retrievedPct: pct("retrieved"), derivedPct: pct("derived") };
};

/**
 * HIS PERSONAL FLOOR: the median first-digit time on facts he has mastered.
 * The 3 second threshold is a hypothesis; this is the number to test it
 * against. If his floor is 1.1s the line sits comfortably above it; if it is
 * 2.6s the derived band is starving and the dial wants moving.
 */
export interface Baseline {
  medianMs: number | null;
  n: number;
  /** How many times the floor fits under the retrieved threshold. */
  headroom: number | null;
}

export const baseline = (rs: readonly Response[], states: States): Baseline => {
  const times = scoreable(rs)
    .filter((r) => r.correct && r.firstKeyMs !== null && states.get(r.factId)?.mastered === true)
    .map((r) => r.firstKeyMs!);
  const m = median(times);
  return { medianMs: m, n: times.length, headroom: m === null || m === 0 ? null : Math.round((RETRIEVED_MAX_MS / m) * 10) / 10 };
};

/**
 * THE HISTOGRAM. Buckets NEST inside the classification: the first two are
 * the retrieved band, the next two the derived band, the last the tail.
 */
export const BUCKETS = [
  { max: 1500, label: "under 1.5s", color: "#B6FF3C" },
  { max: 3000, label: "1.5–3s", color: "#8FE08F" },
  { max: 5000, label: "3–5s", color: "#35E6FF" },
  { max: 8000, label: "5–8s", color: "#FFE14D" },
  { max: Infinity, label: "8s+", color: "#FF8A1F" },
] as const;

export const OP_SYMBOL: Record<FactKind, string> = { add: "+", sub: "−", mul: "×", div: "÷" };
export const KIND_LABEL: Record<FactKind, string> = { add: "Addition", sub: "Subtraction", mul: "Multiplication", div: "Division" };
export const KINDS: readonly FactKind[] = ["add", "sub", "mul", "div"];

export interface HistRow { key: string; counts: number[]; total: number }

export const HIST_ORDER = ["all", "+", "+ missing", "−", "− missing", "×", "× missing", "÷", "÷ missing"];

export const histogram = (rs: readonly Response[]): HistRow[] => {
  const rows = new Map<string, number[]>();
  const bump = (key: string, ms: number): void => {
    const row = rows.get(key) ?? BUCKETS.map(() => 0);
    const i = BUCKETS.findIndex((b) => ms < b.max);
    row[i] = (row[i] ?? 0) + 1;
    rows.set(key, row);
  };
  for (const r of scoreable(rs)) {
    if (!r.correct || r.firstKeyMs === null) continue;
    const kind = r.factId.split(":")[0] as FactKind;
    const op = OP_SYMBOL[kind] ?? "?";
    const key = `${op}${(r.format ?? "standard") === "missing" ? " missing" : ""}`;
    bump("all", r.firstKeyMs);
    bump(key, r.firstKeyMs);
  }
  return HIST_ORDER
    .filter((k) => rows.has(k))
    .map((key) => {
      const counts = rows.get(key)!;
      return { key, counts, total: counts.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.total > 0);
};

export interface HeatCell {
  id: string;
  kind: FactKind;
  label: string;
  box: number;
  mastered: boolean;
  medianMs: number | null;
  seen: number;
}

export const heatCells = (deck: Deck, states: States, rs: readonly Response[]): HeatCell[] => {
  const perFact = new Map<string, number[]>();
  for (const r of scoreable(rs)) {
    if (!r.correct || r.firstKeyMs === null) continue;
    const list = perFact.get(r.factId);
    if (list) list.push(r.firstKeyMs); else perFact.set(r.factId, [r.firstKeyMs]);
  }
  return [...deck.values()].map((f) => {
    const st = states.get(f.id);
    return {
      id: f.id, kind: f.kind, label: `${f.a}${OP_SYMBOL[f.kind]}${f.b}`,
      box: st?.box ?? 1, mastered: st?.mastered ?? false,
      medianMs: median(perFact.get(f.id) ?? []),
      seen: st?.seen ?? 0,
    };
  });
};

export interface KindSummary {
  kind: FactKind;
  total: number;
  mastered: number;
  /** Introduced, not yet mastered. */
  working: number;
  unseen: number;
}

export const kindSummary = (cells: readonly HeatCell[]): KindSummary[] =>
  KINDS.map((kind) => {
    const mine = cells.filter((c) => c.kind === kind);
    return {
      kind, total: mine.length,
      mastered: mine.filter((c) => c.mastered).length,
      working: mine.filter((c) => c.seen > 0 && !c.mastered).length,
      unseen: mine.filter((c) => c.seen === 0).length,
    };
  });

/** Introduced, seen a few times, and mostly wrong: the ones going the wrong way. */
export const slipping = (cells: readonly HeatCell[], states: States): HeatCell[] =>
  cells.filter((c) => {
    const st = states.get(c.id);
    return st !== undefined && st.introduced && !st.mastered && st.seen >= 4 && st.correct / st.seen < 0.7;
  }).sort((a, b) => a.box - b.box).slice(0, 12);

export const csv = (rs: readonly Response[], sessions: readonly SessionRecord[]): string => {
  const esc = (v: string | number | boolean | null | undefined): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`# TRICK LINE practice export. ${MEASUREMENT_NOTE}`);
  lines.push(["date", "fact", "kind", "format", "correct", "answered", "first_key_ms", "submit_ms", "classification", "is_retry", "cold_check"].join(","));
  for (const r of rs) {
    lines.push([
      esc(isoOf(r.at)), esc(r.factId), esc(r.factId.split(":")[0] ?? ""),
      esc(r.format ?? "standard"),
      esc(r.correct), esc(r.answered), esc(r.firstKeyMs), esc(r.submitMs), esc(r.cls), esc(r.isRetry),
      esc(r.cold === true),
    ].join(","));
  }
  lines.push("");
  lines.push(["session_date", "minutes", "items", "correct", "retrieved", "derived", "status", "reason"].join(","));
  for (const s of sessions) {
    lines.push([
      esc(isoOf(s.startedAt)),
      esc(Math.round((s.endedAt - s.startedAt) / 60000)),
      esc(s.items), esc(s.correct), esc(s.retrieved), esc(s.derived), esc(s.status), esc(s.reason),
    ].join(","));
  }
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// TRENDS: improvement over time, measured, not felt (Andy, 2026-09-02).
//
// Everything below replays the stored response log, so a week's figures are
// what the log says happened that week and mastery dates are what the
// scheduler's own transition would have produced from those responses.
// ---------------------------------------------------------------------------

export interface KindWeek { items: number; retrievedPct: number }

export interface TrendRow {
  week: number;
  /** The week's first day as a short date. */
  label: string;
  items: number;
  correct: number;
  accuracyPct: number;
  retrievedPct: number;
  medianMs: number | null;
  sessions: number;
  minutes: number;
  /** Facts from memory / facts met, as of the end of this week. */
  masteredCum: number;
  introducedCum: number;
  byKind: Partial<Record<FactKind, KindWeek>>;
}

/** Replay the log through the scheduler's own transition, fact by fact, and
 *  note the day each fact was first met and first mastered. */
export const replayMilestones = (
  deck: Deck, rs: readonly Response[],
): { introducedOn: Map<string, number>; masteredOn: Map<string, number> } => {
  const states = new Map<string, FactState>();
  const introducedOn = new Map<string, number>();
  const masteredOn = new Map<string, number>();
  const ordered = [...rs].filter((r) => deck.has(r.factId)).sort((a, b) => a.at - b.at || a.day - b.day);
  for (const r of ordered) {
    if (r.isRetry) continue;
    const prev = states.get(r.factId) ?? freshState();
    const next = applyResponse(prev, r);
    states.set(r.factId, next);
    if (!introducedOn.has(r.factId)) introducedOn.set(r.factId, r.day);
    if (next.mastered && !masteredOn.has(r.factId)) masteredOn.set(r.factId, r.day);
  }
  return { introducedOn, masteredOn };
};

export const trendRows = (deck: Deck, rs: readonly Response[], sessions: readonly SessionRecord[]): TrendRow[] => {
  const scored = scoreable(rs);
  if (scored.length === 0) return [];
  const { introducedOn, masteredOn } = replayMilestones(deck, rs);
  const weeks = new Map<number, Response[]>();
  for (const r of scored) {
    const w = weekOf(r.day);
    const list = weeks.get(w);
    if (list) list.push(r); else weeks.set(w, [r]);
  }
  const first = Math.min(...weeks.keys());
  const last = Math.max(...weeks.keys());
  const rows: TrendRow[] = [];
  for (let w = first; w <= last; w++) {
    const list = weeks.get(w) ?? [];
    const correct = list.filter((r) => r.correct);
    const weekEnd = w * 7 + 6;
    const inWeek = sessions.filter((s) => weekOf(s.day) === w);
    const byKind: Partial<Record<FactKind, KindWeek>> = {};
    for (const k of KINDS) {
      const mine = correct.filter((r) => r.factId.startsWith(`${k}:`));
      if (mine.length === 0) continue;
      byKind[k] = { items: mine.length, retrievedPct: Math.round((mine.filter((r) => r.cls === "retrieved").length / mine.length) * 100) };
    }
    rows.push({
      week: w, label: dayLabel(w * 7),
      items: list.length, correct: correct.length,
      accuracyPct: list.length === 0 ? 0 : Math.round((correct.length / list.length) * 100),
      retrievedPct: correct.length === 0 ? 0 : Math.round((correct.filter((r) => r.cls === "retrieved").length / correct.length) * 100),
      medianMs: median(correct.filter((r) => r.firstKeyMs !== null).map((r) => r.firstKeyMs!)),
      sessions: inWeek.length,
      minutes: Math.round(inWeek.reduce((a, s) => a + Math.max(0, s.endedAt - s.startedAt), 0) / 60000),
      masteredCum: [...masteredOn.values()].filter((d) => d <= weekEnd).length,
      introducedCum: [...introducedOn.values()].filter((d) => d <= weekEnd).length,
      byKind,
    });
  }
  return rows;
};

export interface Improvement {
  /** How many weeks each side of the comparison covers. */
  span: number;
  retrievedBefore: number; retrievedAfter: number;
  medianBefore: number | null; medianAfter: number | null;
  masteredBefore: number; masteredAfter: number;
}

/** The latest weeks with practice against the ones before them. Null until
 *  there are at least two weeks with answers in them. */
export const improvement = (rows: readonly TrendRow[]): Improvement | null => {
  const active = rows.filter((r) => r.items > 0);
  if (active.length < 2) return null;
  const span = active.length >= 4 ? 2 : 1;
  const after = active.slice(-span);
  const before = active.slice(-span * 2, -span);
  const pct = (xs: TrendRow[]): number => {
    const correct = xs.reduce((a, r) => a + r.correct, 0);
    const retrieved = xs.reduce((a, r) => a + Math.round((r.retrievedPct / 100) * r.correct), 0);
    return correct === 0 ? 0 : Math.round((retrieved / correct) * 100);
  };
  const med = (xs: TrendRow[]): number | null => median(xs.filter((r) => r.medianMs !== null).map((r) => r.medianMs!));
  return {
    span,
    retrievedBefore: pct(before), retrievedAfter: pct(after),
    medianBefore: med(before), medianAfter: med(after),
    masteredBefore: before[before.length - 1]!.masteredCum, masteredAfter: after[after.length - 1]!.masteredCum,
  };
};

export interface Projection {
  /** Facts from memory per week over the pace window. */
  perWeek: number;
  weeksOfPace: number;
  remaining: number;
  /** Day index the total would be reached at this pace. */
  etaDay: number | null;
}

/** A straight line through the last few weeks of mastery, toward a total.
 *  A projection, never a promise, and null when there is no pace to read. */
export const projection = (rows: readonly TrendRow[], total: number, todayDay: number, span = 4): Projection | null => {
  if (rows.length < 2) return null;
  const tail = rows.slice(-Math.min(span, rows.length));
  const gained = tail[tail.length - 1]!.masteredCum - tail[0]!.masteredCum;
  const weeks = tail.length - 1;
  if (weeks <= 0) return null;
  const perWeek = gained / weeks;
  const remaining = Math.max(0, total - tail[tail.length - 1]!.masteredCum);
  return {
    perWeek: Math.round(perWeek * 10) / 10, weeksOfPace: weeks, remaining,
    etaDay: perWeek <= 0 ? null : Math.round(todayDay + (remaining / perWeek) * 7),
  };
};

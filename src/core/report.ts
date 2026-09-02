/**
 * THE REPORT, DERIVED. Every figure the parent dashboard shows is computed
 * here, from the stored raw response log, never from a running total, so the
 * dashboard cannot drift away from its evidence and so the same report can be
 * drawn from a device's own data OR from a cloud snapshot (the viewer mode).
 *
 * Pure: no DOM, no clock. The UI only lays these out.
 */

import { isoOf } from "./clock";
import { DERIVED_MAX_MS, RETRIEVED_MAX_MS } from "./config";
import type { Caps, Deck, FactKind, Response, SessionRecord, States, Strands } from "./types";

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

/**
 * THE TRENDS TAB: improvement over time, measured (Andy, 2026-09-02).
 *
 * Every figure comes from core/report.ts replaying the stored log, so the
 * same tab draws on the iPad and on the grown-ups' door from a cloud copy.
 * Three questions, in order: is he getting better, how fast, and at this
 * pace when does the standard land. The last is a straight line through the
 * recent weeks and says so: a projection, never a promise.
 */

import { dayLabel } from "../../core/clock";
import { improvement, KIND_LABEL, KINDS, projection, trendRows, type Snapshot, type TrendRow } from "../../core/report";
import { standardProgress } from "../../core/standards";
import { trendChart, type Series } from "../charts";
import { el } from "../dom";

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const section = (text: string): HTMLElement => el("div", { class: "dash-h", text });
const signed = (n: number, unit = ""): string => `${n > 0 ? "+" : ""}${n}${unit}`;

export const trendsTab = (snap: Snapshot, day: number): HTMLElement => {
  const wrap = el("div", { "data-probe": "trends-tab" });
  const rows = trendRows(snap.deck, snap.responses, snap.sessions);
  const labels = rows.map((r) => r.label);

  // ---- is he getting better? ----------------------------------------------------
  wrap.append(section("Improvement"));
  const imp = improvement(rows);
  const head = el("div", { class: "card", "data-probe": "improvement" });
  head.append(el("h3", { class: "title", text: "Are they getting better?" }));
  if (imp === null) {
    head.append(el("p", { class: "note", text: "Needs two weeks with practice in them to compare. The lines below start filling in from the first week." }));
  } else {
    const weeks = imp.span === 1 ? "the last week against the week before" : "the last two weeks against the two before";
    const bits: string[] = [];
    bits.push(`from memory ${imp.retrievedBefore}% → ${imp.retrievedAfter}% (${signed(imp.retrievedAfter - imp.retrievedBefore, " points")})`);
    if (imp.medianBefore !== null && imp.medianAfter !== null) {
      bits.push(`first digit ${secs(imp.medianBefore)} → ${secs(imp.medianAfter)} (${imp.medianAfter < imp.medianBefore ? "faster" : imp.medianAfter > imp.medianBefore ? "slower" : "the same"})`);
    }
    bits.push(`facts from memory ${imp.masteredBefore} → ${imp.masteredAfter} (${signed(imp.masteredAfter - imp.masteredBefore)})`);
    head.append(el("p", { class: "note", text: `Comparing ${weeks}: ${bits.join("; ")}.` }));
    const up = imp.retrievedAfter > imp.retrievedBefore || imp.masteredAfter > imp.masteredBefore;
    head.append(el("p", { class: `note${up ? "" : " warn"}`, text: up
      ? "Going the right way. Retrieval share and facts from memory are the two numbers that mean automaticity is building."
      : "Not moving yet. A flat fortnight early on is normal; a flat month is worth a look at the caps, the dose, and the clock card." }));
  }
  wrap.append(head);

  // ---- the lines ------------------------------------------------------------------
  wrap.append(section("By week"));
  const retr = el("div", { class: "card" });
  retr.append(el("h3", { class: "title", text: "From memory, and correct" }));
  retr.append(el("p", { class: "note", text: "Share of correct answers retrieved under three seconds (the line that has to climb), and share of all answers that were correct." }));
  const s1: Series[] = [
    { label: "from memory", color: "#B6FF3C", points: rows.map((r) => (r.items === 0 ? null : r.retrievedPct)) },
    { label: "correct", color: "#35E6FF", points: rows.map((r) => (r.items === 0 ? null : r.accuracyPct)) },
  ];
  retr.append(trendChart(s1, labels, { max: 100, unit: "%" }));
  wrap.append(retr);

  const speed = el("div", { class: "card" });
  speed.append(el("h3", { class: "title", text: "How fast the first digit lands" }));
  speed.append(el("p", { class: "note", text: "Median seconds from the problem appearing to the first digit, correct answers only. Lower is better; three seconds is the retrieval line." }));
  const maxMs = Math.max(4000, ...rows.map((r) => r.medianMs ?? 0));
  speed.append(trendChart([{ label: "median first digit", color: "#FFE14D", points: rows.map((r) => (r.medianMs === null ? null : r.medianMs / 1000)) }],
    labels, { max: Math.ceil(maxMs / 1000), unit: "s", guide: 3 }));
  wrap.append(speed);

  const facts = el("div", { class: "card" });
  facts.append(el("h3", { class: "title", text: "Facts met, and facts from memory" }));
  facts.append(el("p", { class: "note", text: "Running totals across the whole deck of 363. The gap between the lines is the work in progress." }));
  const maxFacts = Math.max(20, ...rows.map((r) => r.introducedCum));
  facts.append(trendChart([
    { label: "met", color: "#8A97A6", points: rows.map((r) => r.introducedCum) },
    { label: "from memory", color: "#B6FF3C", points: rows.map((r) => r.masteredCum) },
  ], labels, { max: Math.ceil(maxFacts / 10) * 10, unit: "" }));
  // The projection, per standard, in plain words.
  for (const s of standardProgress(snap.deck, snap.states)) {
    const p = projection(rows, s.total, day);
    if (p === null) continue;
    const line = p.etaDay === null
      ? `${s.code}: no facts from memory gained over the last ${p.weeksOfPace} week${p.weeksOfPace === 1 ? "" : "s"}, so no pace to project. ${p.remaining} of ${s.total} still to go.`
      : p.remaining === 0
        ? `${s.code}: all ${s.total} facts from memory. Done.`
        : `${s.code}: at the pace of the last ${p.weeksOfPace} week${p.weeksOfPace === 1 ? "" : "s"} (about ${p.perWeek} facts a week), the ${s.total} facts land around ${dayLabel(p.etaDay)}. A straight line, not a promise.`;
    facts.append(el("p", { class: "note", "data-probe": `projection-${s.code}`, text: line }));
  }
  wrap.append(facts);

  const kinds = KINDS.filter((k) => rows.some((r) => r.byKind[k] !== undefined));
  if (kinds.length > 0) {
    const byOp = el("div", { class: "card" });
    byOp.append(el("h3", { class: "title", text: "From memory, by operation" }));
    byOp.append(el("p", { class: "note", text: "The same retrieval share, one line per operation they have practised." }));
    const colors: Record<string, string> = { add: "#B6FF3C", sub: "#35E6FF", mul: "#FFE14D", div: "#FF8A1F" };
    byOp.append(trendChart(kinds.map((k) => ({
      label: KIND_LABEL[k].toLowerCase(), color: colors[k]!,
      points: rows.map((r) => r.byKind[k]?.retrievedPct ?? null),
    })), labels, { max: 100, unit: "%" }));
    wrap.append(byOp);
  }

  // ---- the table ----------------------------------------------------------------------
  wrap.append(section("The weeks"));
  const tbl = el("div", { class: "card" });
  tbl.append(el("h3", { class: "title", text: "Week by week" }));
  if (rows.length === 0) {
    tbl.append(el("p", { class: "note", text: "No practice yet." }));
  } else {
    const table = el("table", { class: "rows", "data-probe": "trend-table" });
    table.append(el("tr", {}, ...["Week", "Items", "Correct", "From memory", "First digit", "Runs", "Min", "Facts known"].map((t) => el("th", { text: t }))));
    for (const r of [...rows].reverse()) table.append(rowOf(r));
    tbl.append(el("div", { class: "scroll-x" }, table));
  }
  wrap.append(tbl);
  return wrap;
};

const rowOf = (r: TrendRow): HTMLElement => el("tr", {},
  el("td", { text: r.label }),
  el("td", { text: String(r.items) }),
  el("td", { text: r.items === 0 ? "—" : `${r.accuracyPct}%` }),
  el("td", { text: r.correct === 0 ? "—" : `${r.retrievedPct}%` }),
  el("td", { text: r.medianMs === null ? "—" : secs(r.medianMs) }),
  el("td", { text: String(r.sessions) }),
  el("td", { text: String(r.minutes) }),
  el("td", { text: String(r.masteredCum) }),
);

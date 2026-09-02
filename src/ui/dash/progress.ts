/**
 * THE PROGRESS TAB: the report, and nothing but the report. Draws from a
 * Snapshot so the same cards serve this device and a cloud copy.
 */

import { forecast } from "../../core/forecast";
import {
  baseline, BUCKETS, byWeek, coldByWeek, headline, heatCells, histogram, KIND_LABEL, KINDS,
  kindSummary, MEASUREMENT_NOTE, OP_SYMBOL, slipping, type Snapshot,
} from "../../core/report";
import { standardProgress } from "../../core/standards";
import type { EndReason, FactKind } from "../../core/types";
import { heatMap, progressBar, retrievalTrend } from "../charts";
import { el, on } from "../dom";

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

const REASON: Record<EndReason, string> = {
  struggle: "the app called it", tired: "tiring, offered the exit", choice: "their call at a line", breather: "took a breather",
};

const section = (text: string): HTMLElement => el("div", { class: "dash-h", text });

export const progressTab = (snap: Snapshot, day: number, viewer: boolean): HTMLElement => {
  const wrap = el("div", { "data-probe": "progress-tab" });
  const { deck, states, responses, sessions, strands, caps } = snap;

  // ---- the headline ---------------------------------------------------------
  wrap.append(section("The headline"));
  const h = headline(responses);
  const head = el("div", { class: "card" });
  head.append(el("h3", { class: "title", text: "Retrieval vs derivation" }));
  head.append(el("p", { class: "note", text:
    `Of ${h.correct} correct answers, ${h.retrievedPct}% were retrieved from memory and ${h.derivedPct}% were worked out. ` +
    `Both are correct. The first number is the one that has to climb.` }));
  head.append(retrievalTrend(byWeek(responses)));
  wrap.append(head);

  // ---- from cold --------------------------------------------------------------
  const coldPts = coldByWeek(responses);
  const cold = el("div", { class: "card", "data-probe": "cold-card" });
  cold.append(el("h3", { class: "title", text: "From cold" }));
  cold.append(el("p", { class: "note", text:
    "Once a week the first few items of a session are facts they have mastered, asked before anything has warmed them up. " +
    "The headline above can be flattered by a fact they saw minutes earlier; this line cannot. It is the honest measure of durable automaticity." }));
  if (coldPts.length === 0) {
    cold.append(el("p", { class: "note", "data-probe": "cold-empty", text: "No cold check yet. The first one arrives once a few facts are mastered." }));
  } else {
    cold.append(retrievalTrend(coldPts, "#35E6FF"));
    const last = coldPts[coldPts.length - 1]!;
    cold.append(el("p", { class: "note", text:
      `Latest: ${last.retrievedPct}% from memory on ${last.items} cold items${last.medianMs !== null ? `, median ${secs(last.medianMs)} to the first digit` : ""}.` }));
  }
  wrap.append(cold);

  // ---- the standards ----------------------------------------------------------
  wrap.append(section("The standards"));
  const std = el("div", { class: "card" });
  std.append(el("h3", { class: "title", text: "Virginia Standards of Learning" }));
  for (const s of standardProgress(deck, states)) {
    const kinds: FactKind[] = s.code === "2.CE.1" ? ["add", "sub"] : ["mul", "div"];
    const live = kinds.filter((k) => strands[k]);
    std.append(el("div", { class: "mon-sub", text: `${s.code} · grade ${s.grade} · ${s.title}` }));
    std.append(progressBar(s.pct, s.grade === 3 ? "#B6FF3C" : "#35E6FF"));
    std.append(el("p", { class: "note", text: `${s.mastered} of ${s.total} known from memory. ${s.inProgress} in progress.` }));
    // Without this, a teacher reads "0 of 176" as a boy failing
    // multiplication, when in fact nobody has switched it on yet.
    if (live.length === 0) {
      std.append(el("p", { class: "note warn", text:
        `Not being practised at the moment: this standard is switched off in settings, so the figure above is a starting point, not a result.` }));
    } else if (live.length < kinds.length) {
      const off = kinds.filter((k) => !strands[k]);
      std.append(el("p", { class: "note warn", text:
        `Partly switched off (${off.join(" and ")}), so this figure covers only what is being practised.` }));
    }
    const capped = kinds.filter((k) => caps[k] !== null);
    if (capped.length > 0) {
      std.append(el("p", { class: "note warn", text:
        `Capped: ${capped.map((k) => `${k} up to ${caps[k]}`).join(", ")}. Facts beyond the cap are not being practised yet.` }));
    }
  }
  std.append(el("p", { class: "note", text:
    "2.CE.1 is a second grade standard being closed this year. 3.CE.2 is due by the end of third grade and is the direct prerequisite for fourth grade multi-digit multiplication and long division." }));
  wrap.append(std);

  // ---- his floor, and how long answers take ----------------------------------
  wrap.append(section("The clock"));
  const floor = baseline(responses, states);
  const hist = el("div", { class: "card", "data-probe": "histogram" });
  hist.append(el("h3", { class: "title", text: "How long answers take" }));
  hist.append(el("p", { class: "note", "data-probe": "baseline", text: floor.medianMs === null
    ? "Their personal floor is not measurable yet: it is the median first-digit time on facts they have mastered, and there are none."
    : `Their personal floor: on facts they own, the first digit lands in a median ${secs(floor.medianMs)} (${floor.n} answers). ` +
      `The 3 second retrieval line sits ${floor.headroom}x above that${(floor.headroom ?? 0) < 1.5 ? ", which is TIGHT: the derived band may be starving, and the threshold deserves a look" : ", which leaves room"}.` }));
  hist.append(el("p", { class: "note", text:
    "First-digit time on correct answers. The first two bands are answers from memory (under 3s); the middle two are worked out (3–8s); the last is the long tail." }));
  const legend = el("div", { class: "hist-legend" });
  for (const b of BUCKETS) {
    legend.append(el("span", { class: "hist-key" },
      el("span", { class: "hist-swatch", style: `background:${b.color}` }), el("span", { text: b.label })));
  }
  hist.append(legend);
  const rows = histogram(responses);
  for (const row of rows) {
    const line = el("div", { class: "hist-row" });
    line.append(el("span", { class: "hist-label", text: row.key === "all" ? "ALL" : row.key }));
    const barEl = el("div", { class: "hist-bar" });
    row.counts.forEach((n, i) => {
      if (n === 0) return;
      barEl.append(el("span", {
        class: "hist-seg", style: `flex:${n};background:${BUCKETS[i]!.color}`,
        title: `${BUCKETS[i]!.label}: ${n}`,
      }));
    });
    line.append(barEl);
    line.append(el("span", { class: "hist-n", text: String(row.total) }));
    hist.append(line);
  }
  if (rows.length === 0) hist.append(el("p", { class: "note", text: "No answers yet." }));
  hist.append(el("p", { class: "note", style: "margin-top:10px", text: MEASUREMENT_NOTE }));
  wrap.append(hist);

  // ---- tomorrow --------------------------------------------------------------
  wrap.append(section("The plan"));
  const fc = forecast(deck, states, day + 1, strands, caps);
  const tomorrow = el("div", { class: "card", "data-probe": "tomorrow" });
  tomorrow.append(el("h3", { class: "title", text: viewer ? "Next session" : "Tomorrow" }));
  if (fc.total === 0) {
    tomorrow.append(el("p", { class: "note", text: "Nothing planned: every switched-on operation is empty or capped out." }));
  } else {
    const sample = fc.fresh.slice(0, 6).map((f) => `${f.a}${OP_SYMBOL[f.kind]}${f.b}`).join("  ");
    tomorrow.append(el("p", { class: "note", text:
      `${fc.due} due for review, ${fc.fresh.length} new${fc.fresh.length > 0 ? ` (${sample}${fc.fresh.length > 6 ? " …" : ""})` : ""}, ` +
      `and ${fc.topUp} pulled forward to fill the sitting. The real planner, run a day ahead.` }));
  }
  wrap.append(tomorrow);

  // ---- the facts, summarised, with the grid on request -----------------------
  wrap.append(section("The facts"));
  const cells = heatCells(deck, states, responses);
  const facts = el("div", { class: "card" });
  facts.append(el("h3", { class: "title", text: "Every fact, by operation" }));
  facts.append(el("p", { class: "note", text: "From memory, being worked on, not met yet. Tap an operation to see its grid." }));
  for (const s of kindSummary(cells)) {
    const row = el("button", { type: "button", class: "sum-row", "data-probe": `heat-summary-${s.kind}`, "aria-expanded": "false" });
    row.append(el("span", { class: "sum-label", text: KIND_LABEL[s.kind] }));
    const bar = el("span", { class: "sum-bar" });
    const pct = (n: number): number => (s.total === 0 ? 0 : (n / s.total) * 100);
    bar.append(el("span", { style: `width:${pct(s.mastered)}%;background:#B6FF3C` }));
    bar.append(el("span", { style: `width:${pct(s.working)}%;background:#A88A3A` }));
    row.append(bar);
    row.append(el("span", { class: "sum-n", text: `${s.mastered} / ${s.working} / ${s.unseen}` }));
    facts.append(row);
    const grid = el("div", { class: "heat-wrap", "data-probe": `heat-grid-${s.kind}` });
    grid.hidden = true;
    grid.append(heatMap(cells.filter((c) => c.kind === s.kind)));
    facts.append(grid);
    on(row, "click", () => {
      grid.hidden = !grid.hidden;
      row.setAttribute("aria-expanded", String(!grid.hidden));
    });
  }
  facts.append(el("p", { class: "note", text: "Green is from memory. Warmer amber is a higher box, still being worked on. Dark is not introduced yet." }));
  wrap.append(facts);

  // ---- regressions -----------------------------------------------------------
  const slip = slipping(cells, states);
  const regr = el("div", { class: "card" });
  regr.append(el("h3", { class: "title", text: "Going the wrong way" }));
  regr.append(slip.length === 0
    ? el("p", { class: "note", text: "Nothing is slipping right now." })
    : el("p", { class: "note", text: slip.map((c) => c.label).join("   ") }));
  wrap.append(regr);

  // ---- sessions ----------------------------------------------------------------
  wrap.append(section("Stamina"));
  const log = el("div", { class: "card" });
  log.append(el("h3", { class: "title", text: "Sessions" }));
  log.append(el("p", { class: "note", text:
    "Stamina is itself worth watching. \"Ended early\" is working as intended: the app called it when they were grinding, the exit was offered early when they were tiring, or they chose to stop at a line break." }));
  const table = el("table", { class: "rows" });
  table.append(el("tr", {}, ...["Date", "Min", "Items", "Correct", "Retrieved", "How it ended"].map((t) => el("th", { text: t }))));
  for (const s of [...sessions].reverse().slice(0, 20)) {
    table.append(el("tr", {},
      el("td", { text: new Date(s.startedAt).toLocaleDateString() }),
      el("td", { text: String(Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))) }),
      el("td", { text: String(s.items) }),
      el("td", { text: s.items === 0 ? "—" : `${Math.round((s.correct / s.items) * 100)}%` }),
      el("td", { text: s.correct === 0 ? "—" : `${Math.round((s.retrieved / s.correct) * 100)}%` }),
      el("td", { text: s.status === "endedEarly" ? `early · ${s.reason !== undefined ? REASON[s.reason] : "stopped"}` : s.status }),
    ));
  }
  if (sessions.length === 0) log.append(el("p", { class: "note", text: "No sessions yet." }));
  else log.append(el("div", { class: "scroll-x" }, table));
  wrap.append(log);

  // The strands the deck does not carry today still get named, so a viewer
  // never wonders where division went.
  const off = KINDS.filter((k) => !strands[k]);
  if (off.length > 0) wrap.append(el("p", { class: "note", text: `Switched off: ${off.map((k) => KIND_LABEL[k].toLowerCase()).join(", ")}.` }));

  return wrap;
};

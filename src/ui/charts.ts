/**
 * CHARTS, DRAWN INLINE.
 *
 * No chart library: the whole app has to boot offline from a tiny bundle, and
 * these are three shapes.
 *
 * Every figure here arrives from core/report.ts, recomputed from the stored
 * raw response log rather than from a running total, so the dashboard can
 * never drift away from the evidence underneath it.
 */

import { MAX_BOX } from "../core/config";
import type { HeatCell, WeekPoint } from "../core/report";
import { el, svg } from "./dom";
export type { HeatCell, WeekPoint } from "../core/report";

const INK = "#05070A";
const GRID = "#2A323C";

/**
 * THE HEADLINE. Percentage of correct answers under three seconds, by week.
 * This is the evidence that automaticity is or is not building, and it is the
 * one chart a teacher will actually read. The cold series wears its own tint.
 */
export const retrievalTrend = (points: readonly WeekPoint[], tint = "#B6FF3C"): SVGElement => {
  const w = 640;
  const h = 240;
  const pad = { l: 58, r: 16, t: 16, b: 40 };
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart", role: "img", "aria-label": "Retrieval percentage by week" });

  for (let p = 0; p <= 100; p += 25) {
    const y = pad.t + (1 - p / 100) * (h - pad.t - pad.b);
    g.append(svg("line", { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: GRID, "stroke-width": 2 }));
    g.append(svg("text", { x: pad.l - 10, y: y + 5, "text-anchor": "end", fill: "#8A97A6", "font-size": 15 }, `${p}%`));
  }

  if (points.length === 0) {
    g.append(svg("text", { x: w / 2, y: h / 2, "text-anchor": "middle", fill: "#8A97A6", "font-size": 18 }, "No sessions yet"));
    return g;
  }

  const step = points.length === 1 ? 0 : (w - pad.l - pad.r) / (points.length - 1);
  const px = (i: number): number => points.length === 1 ? (pad.l + w - pad.r) / 2 : pad.l + i * step;
  const py = (v: number): number => pad.t + (1 - v / 100) * (h - pad.t - pad.b);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i)} ${py(p.retrievedPct)}`).join(" ");
  g.append(svg("path", { d, fill: "none", stroke: tint, "stroke-width": 6, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  points.forEach((p, i) => {
    g.append(svg("circle", { cx: px(i), cy: py(p.retrievedPct), r: 8, fill: tint, stroke: INK, "stroke-width": 4 }));
    g.append(svg("text", { x: px(i), y: h - 14, "text-anchor": "middle", fill: "#8A97A6", "font-size": 14 }, p.label));
  });
  return g;
};

export interface Series { label: string; color: string; points: Array<number | null> }

/**
 * Several lines on one grid, gaps where a week had nothing. A dashed guide
 * marks a threshold when asked (the three second line). Drawn inline like
 * everything else; the legend is text under the axis.
 */
export const trendChart = (
  series: readonly Series[], labels: readonly string[], opts: { max: number; unit: string; guide?: number },
): SVGElement => {
  const w = 640;
  const h = 260;
  const pad = { l: 52, r: 16, t: 14, b: 58 };
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart", role: "img", "aria-label": series.map((s) => s.label).join(", ") + " by week" });
  const max = Math.max(1, opts.max);
  const py = (v: number): number => pad.t + (1 - Math.min(v, max) / max) * (h - pad.t - pad.b);
  const n = labels.length;
  const px = (i: number): number => (n <= 1 ? (pad.l + w - pad.r) / 2 : pad.l + (i * (w - pad.l - pad.r)) / (n - 1));
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = (max * t) / ticks;
    g.append(svg("line", { x1: pad.l, y1: py(v), x2: w - pad.r, y2: py(v), stroke: GRID, "stroke-width": 2 }));
    g.append(svg("text", { x: pad.l - 8, y: py(v) + 5, "text-anchor": "end", fill: "#8A97A6", "font-size": 14 }, `${Math.round(v * 10) / 10}${opts.unit}`));
  }
  if (opts.guide !== undefined && opts.guide <= max) {
    g.append(svg("line", { x1: pad.l, y1: py(opts.guide), x2: w - pad.r, y2: py(opts.guide), stroke: "#FF8A1F", "stroke-width": 3, "stroke-dasharray": "8 8" }));
  }
  if (n === 0) {
    g.append(svg("text", { x: w / 2, y: h / 2, "text-anchor": "middle", fill: "#8A97A6", "font-size": 18 }, "No practice yet"));
    return g;
  }
  // Labels: every one when few, thinned when many, so they never collide.
  const every = Math.max(1, Math.ceil(n / 8));
  labels.forEach((l, i) => {
    if (i % every !== 0 && i !== n - 1) return;
    g.append(svg("text", { x: px(i), y: h - 34, "text-anchor": "middle", fill: "#8A97A6", "font-size": 13 }, l));
  });
  for (const s of series) {
    let d = "";
    let open = false;
    s.points.forEach((v, i) => {
      if (v === null) { open = false; return; }
      d += `${open ? "L" : "M"}${px(i)} ${py(v)} `;
      open = true;
    });
    g.append(svg("path", { d: d.trim(), fill: "none", stroke: s.color, "stroke-width": 5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    s.points.forEach((v, i) => {
      if (v === null) return;
      g.append(svg("circle", { cx: px(i), cy: py(v), r: 6, fill: s.color, stroke: INK, "stroke-width": 3 }));
    });
  }
  // The legend, as text along the bottom.
  let x = pad.l;
  for (const s of series) {
    g.append(svg("rect", { x, y: h - 16, width: 14, height: 14, rx: 3, fill: s.color, stroke: INK, "stroke-width": 2 }));
    g.append(svg("text", { x: x + 20, y: h - 4, fill: "#8A97A6", "font-size": 14 }, s.label));
    x += 32 + s.label.length * 8;
  }
  return g;
};

/** Box colour, weakest to strongest across all seven rungs. Never red:
 *  nothing here is a failure. */
const RUNGS = ["#4A3B2A", "#6B5230", "#8A6A33", "#A88A3A", "#C9B04A", "#D6C25A", "#E3D46C"];
const boxColour = (c: HeatCell): string => {
  if (c.seen === 0) return "#1B2029";
  if (c.mastered) return "#B6FF3C";
  return RUNGS[Math.min(c.box, MAX_BOX) - 1] ?? "#4A3B2A";
};

/** Every fact in the set, at a glance. The specific gaps become visible. */
export const heatMap = (cells: readonly HeatCell[]): HTMLElement => {
  const grid = el("div", { class: "heat" });
  for (const c of cells) {
    const cell = el("div", {
      class: `heat-cell${c.mastered ? " mastered" : ""}${c.seen === 0 ? " unseen" : ""}`,
      style: `background:${boxColour(c)}`,
      title: c.seen === 0 ? `${c.label} not introduced yet`
        : `${c.label} — box ${c.box}${c.mastered ? ", mastered" : ""}${c.medianMs === null ? "" : `, median ${(c.medianMs / 1000).toFixed(1)}s`}`,
    }, el("span", { text: c.label }));
    grid.append(cell);
  }
  return grid;
};

/** A simple labelled bar, used for the two standards. */
export const progressBar = (pct: number, tint: string): HTMLElement =>
  el("div", { class: "bar" }, el("div", { class: "bar-fill", style: `width:${Math.max(0, Math.min(100, pct))}%;background:${tint}` }));

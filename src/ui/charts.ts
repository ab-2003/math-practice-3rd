/**
 * CHARTS, DRAWN INLINE.
 *
 * No chart library: the whole app has to boot offline from a tiny bundle, and
 * these are three shapes.
 *
 * Every figure here is recomputed from the stored raw response log rather than
 * from a running total, so the dashboard can never drift away from the
 * evidence underneath it.
 */

import { el, svg } from "./dom";

const INK = "#05070A";
const GRID = "#2A323C";

export interface WeekPoint {
  label: string;
  retrievedPct: number;
  items: number;
}

/**
 * THE HEADLINE. Percentage of correct answers under three seconds, by week.
 * This is the evidence that automaticity is or is not building, and it is the
 * one chart a teacher will actually read.
 */
export const retrievalTrend = (points: readonly WeekPoint[]): SVGElement => {
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
  g.append(svg("path", { d, fill: "none", stroke: "#B6FF3C", "stroke-width": 6, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  points.forEach((p, i) => {
    g.append(svg("circle", { cx: px(i), cy: py(p.retrievedPct), r: 8, fill: "#B6FF3C", stroke: INK, "stroke-width": 4 }));
    g.append(svg("text", { x: px(i), y: h - 14, "text-anchor": "middle", fill: "#8A97A6", "font-size": 14 }, p.label));
  });
  return g;
};

export interface HeatCell {
  id: string;
  label: string;
  box: number;
  mastered: boolean;
  medianMs: number | null;
  seen: number;
}

/** Box colour, weakest to strongest. Never red: nothing here is a failure. */
const boxColour = (c: HeatCell): string => {
  if (c.seen === 0) return "#1B2029";
  if (c.mastered) return "#B6FF3C";
  return ["#4A3B2A", "#6B5230", "#8A6A33", "#A88A3A", "#C9B04A"][Math.min(c.box, 5) - 1] ?? "#4A3B2A";
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

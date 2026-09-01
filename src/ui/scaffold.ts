/**
 * THE SCAFFOLD SHOWN AFTER A WRONG ANSWER.
 *
 * It must match HIS method, not a generic hint. He finds the tens: he
 * decomposes across 5s and 10s and talks himself through it. So a bridge
 * subtraction shows 11, one taken to reach 10, then seven more, landing on 3.
 * That is his own strategy handed back to him, which is the opposite of being
 * told he was wrong.
 *
 * Multiplication and division get an array, because an array is the picture
 * that makes both operations the same picture.
 *
 * No red. No X. No sound plays from here.
 */

import type { Fact } from "../core/types";
import { el, svg } from "./dom";

const INK = "#05070A";
const FILL = "#B6FF3C";
const FILL2 = "#35E6FF";

/** A ten-frame: two rows of five, the shape he already reads. */
const tenFrame = (
  filled: number, highlightFrom: number, highlightCount: number, tint: string,
  extra = 0,
): SVGElement => {
  // `extra` cells sit attached to the frame's top row: for 11 - 8 the
  // eleventh square IS part of the picture, and captioning it as loose text
  // ("plus 1 more") made it float free of the maths it belonged to.
  const w = 210 + (extra > 0 ? extra * 40 + 12 : 0);
  const g = svg("svg", { viewBox: `0 0 ${w} 92`, class: "frame" });
  for (let k = 0; k < extra; k++) {
    const x = 6 + 5 * 40 + 12 + k * 40;
    g.append(svg("rect", { x, y: 6, width: 34, height: 34, rx: 6, fill: tint, stroke: INK, "stroke-width": 4 }));
    g.append(svg("path", { d: `M${x + 8} 23 l6 7 l12 -14`, fill: "none", stroke: INK, "stroke-width": 4, "stroke-linecap": "round" }));
  }
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = 6 + col * 40;
    const y = 6 + row * 40;
    const on = i < filled;
    const hot = i >= highlightFrom && i < highlightFrom + highlightCount;
    g.append(svg("rect", {
      x, y, width: 34, height: 34, rx: 6,
      fill: on ? (hot ? tint : FILL) : "#141922",
      stroke: INK, "stroke-width": 4,
    }));
    if (on && hot) g.append(svg("path", { d: `M${x + 8} ${y + 17} l6 7 l12 -14`, fill: "none", stroke: INK, "stroke-width": 4, "stroke-linecap": "round" }));
  }
  return g;
};

const step = (n: number, text: string): HTMLElement =>
  el("li", { class: "step" }, el("span", { class: "stepn", text: String(n) }), el("span", { text }));

/** An array of dots: rows by columns. The picture multiplication and division share. */
const dotArray = (rows: number, cols: number): SVGElement => {
  const cell = 22;
  const g = svg("svg", { viewBox: `0 0 ${cols * cell + 8} ${rows * cell + 8}`, class: "frame array" });
  for (let r = 0; r < rows; r++) {
    // Each row lights in turn, so the picture skip-counts along with step 2
    // instead of arriving as a wall of dots.
    const row = svg("g", { class: "arow", style: `animation-delay:${120 + r * 140}ms` });
    for (let c = 0; c < cols; c++) {
      row.append(svg("circle", {
        cx: 4 + c * cell + cell / 2, cy: 4 + r * cell + cell / 2, r: cell / 2 - 4,
        fill: r % 2 === 0 ? FILL : FILL2, stroke: INK, "stroke-width": 3,
      }));
    }
    g.append(row);
  }
  return g;
};

export const scaffold = (f: Fact, shownA: number, shownB: number): HTMLElement => {
  const box = el("div", { class: "scaffold" });
  const steps = el("ol", { class: "steps" });

  if (f.kind === "sub" && f.bridge) {
    const m = f.a;
    const s = f.b;
    const toTen = m - 10;      // take this much to land on ten
    const rest = s - toTen;    // then take the rest out of the ten
    box.append(el("p", { class: "scaf-head", text: "Find the ten." }));
    box.append(tenFrame(10, 10 - rest, rest, "#FF8A1F", toTen));
    steps.append(step(1, `Start at ${m}.`));
    steps.append(step(2, `Take ${toTen} to land on 10.`));
    steps.append(step(3, `Take ${rest} more. That leaves ${f.answer}.`));
  } else if (f.kind === "add" && f.bridge) {
    const a = Math.max(f.a, f.b);
    const b = Math.min(f.a, f.b);
    const toTen = 10 - a;
    const rest = b - toTen;
    box.append(el("p", { class: "scaf-head", text: "Fill the ten first." }));
    box.append(tenFrame(10, a, toTen, "#FF8A1F"));
    box.append(el("p", { class: "scaf-extra", text: `and ${rest} more makes ${f.answer}` }));
    steps.append(step(1, `Start at ${a}.`));
    steps.append(step(2, `Add ${toTen} to fill the ten.`));
    steps.append(step(3, `Add the other ${rest}. That makes ${f.answer}.`));
  } else if (f.kind === "mul") {
    const rows = Math.min(shownA, shownB);
    const cols = Math.max(shownA, shownB);
    box.append(el("p", { class: "scaf-head", text: `${rows} rows of ${cols}.` }));
    box.append(dotArray(rows, cols));
    steps.append(step(1, `${rows} rows, ${cols} in each row.`));
    steps.append(step(2, `Count by ${cols}s: ${Array.from({ length: Math.min(rows, 4) }, (_, i) => cols * (i + 1)).join(", ")}${rows > 4 ? " ..." : ""}`));
    steps.append(step(3, `That is ${f.answer} altogether.`));
  } else if (f.kind === "div") {
    const groups = f.b;
    const each = f.answer;
    box.append(el("p", { class: "scaf-head", text: `Share ${f.a} into ${groups} rows.` }));
    box.append(dotArray(groups, Math.max(each, 1)));
    steps.append(step(1, `${f.a} altogether, split into ${groups} rows.`));
    steps.append(step(2, `Think: ${groups} times what makes ${f.a}?`));
    steps.append(step(3, `${each} in each row. The answer is ${each}.`));
  } else {
    // Small facts he already owns: just show the count, no lecture.
    const total = Math.max(f.answer, 1);
    box.append(el("p", { class: "scaf-head", text: "Count it out." }));
    box.append(tenFrame(Math.min(total, 10), 0, 0, FILL));
    steps.append(step(1, `${shownA} and ${shownB}.`));
    steps.append(step(2, `That is ${f.answer}.`));
  }

  box.append(steps);
  return box;
};

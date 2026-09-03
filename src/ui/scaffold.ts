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

/**
 * FILL THE TEN, then the rest (Andy's iPad, 2026-09-03: "needs to show the
 * 4 more blocks, so smaller blocks"): the ten frame with the start in green
 * and the fill in orange ticks, a plus, then the leftover as blue blocks,
 * all in ONE picture that scales to the card, so 7 + 7 shows fourteen.
 */
const fillTen = (a: number, toTen: number, rest: number): SVGElement => {
  const cell = 40;
  const colsB = Math.min(5, Math.max(rest, 1));
  const rowsB = Math.max(1, Math.ceil(rest / 5));
  const gap = 34;
  const w = 6 + 5 * cell + gap + colsB * cell + 6;
  const h = 6 + Math.max(2, rowsB) * cell + 6;
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "frame blocks", "data-probe": "fill-ten" });
  for (let i = 0; i < 10; i++) {
    const x = 6 + (i % 5) * cell;
    const y = 6 + Math.floor(i / 5) * cell;
    const on = i < a + toTen;
    const hot = i >= a && i < a + toTen;
    g.append(svg("rect", { x, y, width: 34, height: 34, rx: 6, fill: on ? (hot ? "#FF8A1F" : FILL) : "#141922", stroke: INK, "stroke-width": 4 }));
    if (hot) g.append(svg("path", { d: `M${x + 8} ${y + 17} l6 7 l12 -14`, fill: "none", stroke: INK, "stroke-width": 4, "stroke-linecap": "round" }));
  }
  const x0 = 6 + 5 * cell + gap;
  g.append(svg("text", { x: x0 - gap / 2, y: 6 + cell / 2 + 10, "text-anchor": "middle", "font-size": 30, "font-weight": 900, fill: "#8A97A6" }, "+"));
  for (let i = 0; i < rest; i++) {
    g.append(svg("rect", { x: x0 + (i % 5) * cell, y: 6 + Math.floor(i / 5) * cell, width: 34, height: 34, rx: 6, fill: FILL2, stroke: INK, "stroke-width": 4 }));
  }
  g.dataset["start"] = String(a);
  g.dataset["fill"] = String(toTen);
  g.dataset["rest"] = String(rest);
  return g;
};

/**
 * COUNT ON, in blocks (Andy, 2026-09-03): the bigger number as one group
 * of green blocks, the smaller as a group of blue, side by side, so 10 + 9
 * SHOWS nineteen. Rows of five; the blocks scale to the card, however
 * many there are.
 */
const twoGroups = (big: number, small: number): SVGElement => {
  const cell = 40;
  const colsA = Math.min(5, Math.max(big, 1));
  const colsB = Math.min(5, Math.max(small, 1));
  const rowsA = Math.max(1, Math.ceil(big / 5));
  const rowsB = Math.max(1, Math.ceil(small / 5));
  const gap = 34;
  const w = 6 + colsA * cell + gap + colsB * cell + 6;
  const h = 6 + Math.max(rowsA, rowsB) * cell + 6;
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "frame blocks", "data-probe": "count-on" });
  const block = (x: number, y: number, tint: string): void => {
    g.append(svg("rect", { x, y, width: 34, height: 34, rx: 6, fill: tint, stroke: INK, "stroke-width": 4 }));
  };
  for (let i = 0; i < big; i++) block(6 + (i % 5) * cell, 6 + Math.floor(i / 5) * cell, FILL);
  const x0 = 6 + colsA * cell + gap;
  g.append(svg("text", { x: x0 - gap / 2, y: 6 + cell / 2 + 10, "text-anchor": "middle", "font-size": 30, "font-weight": 900, fill: "#8A97A6" }, "+"));
  for (let i = 0; i < small; i++) block(x0 + (i % 5) * cell, 6 + Math.floor(i / 5) * cell, FILL2);
  g.dataset["big"] = String(big);
  g.dataset["small"] = String(small);
  return g;
};

/** COUNT BACK, in blocks: the start as green blocks, the ones taken away
 *  crossed through in orange, so 9 - 4 shows five left. */
const takeAway = (start: number, taken: number): SVGElement => {
  const cell = 40;
  const cols = Math.min(5, Math.max(start, 1));
  const rows = Math.max(1, Math.ceil(start / 5));
  const w = 6 + cols * cell + 6;
  const h = 6 + rows * cell + 6;
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "frame blocks", "data-probe": "take-away" });
  for (let i = 0; i < start; i++) {
    const x = 6 + (i % 5) * cell;
    const y = 6 + Math.floor(i / 5) * cell;
    const gone = i >= start - taken;
    g.append(svg("rect", { x, y, width: 34, height: 34, rx: 6, fill: gone ? "#FF8A1F" : FILL, stroke: INK, "stroke-width": 4 }));
    if (gone) g.append(svg("path", { d: `M${x + 8} ${y + 8} l18 18 M${x + 26} ${y + 8} l-18 18`, stroke: INK, "stroke-width": 4, "stroke-linecap": "round" }));
  }
  g.dataset["start"] = String(start);
  g.dataset["taken"] = String(taken);
  return g;
};

const countList = (from: number, n: number, dir: 1 | -1): string =>
  Array.from({ length: n }, (_, i) => String(from + dir * (i + 1))).join(", ");

const step = (n: number, text: string): HTMLElement =>
  el("li", { class: "step" }, el("span", { class: "stepn", text: String(n) }), el("span", { text }));

/** An array of dots: rows by columns. The picture multiplication and division share. */
const dotArray = (rows: number, cols: number): SVGElement => {
  const cell = 22;
  const g = svg("svg", { viewBox: `0 0 ${cols * cell + 8} ${rows * cell + 8}`, class: "frame array", "data-probe": "array" });
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

/**
 * SHARE INTO GROUPS (Andy's phone, 2026-09-03): every group in a dotted
 * rounded box with its own small number, so 8 shared into 4 reads as four
 * boxed pairs. The boxes are laid out in lines chosen to keep the picture
 * near the card's own 2:1 shape rather than a tall column, and the frame
 * scales to the card (styles.css caps its height), so it never scrolls.
 */
const shareGroups = (groups: number, each: number): SVGElement => {
  const cell = 22;
  const numCol = 14;                       // the numeral's column inside the box
  const bw = numCol + each * cell + 4;     // box width
  const bh = cell + 6;                     // box height
  const gapX = 8;
  const gapY = 6;
  // Pick boxes per line so the whole picture sits nearest a 2:1 shape.
  let perLine = 1;
  let best = Infinity;
  for (let k = 1; k <= Math.min(groups, 5); k++) {
    const lines = Math.ceil(groups / k);
    const w = k * bw + (k - 1) * gapX;
    const h = lines * bh + (lines - 1) * gapY;
    const off = Math.abs(w / h - 2);
    if (off < best) { best = off; perLine = k; }
  }
  const lines = Math.ceil(groups / perLine);
  const w = perLine * bw + (perLine - 1) * gapX + 4;
  const h = lines * bh + (lines - 1) * gapY + 4;
  const g = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "frame array share", "data-probe": "share" });
  for (let i = 0; i < groups; i++) {
    const x = 2 + (i % perLine) * (bw + gapX);
    const y = 2 + Math.floor(i / perLine) * (bh + gapY);
    const box = svg("g", { class: "arow", style: `animation-delay:${120 + i * 110}ms`, "data-group": String(i + 1) });
    box.append(svg("rect", { x, y, width: bw, height: bh, rx: 9, fill: "none", stroke: "#8A97A6", "stroke-width": 2, "stroke-dasharray": "5 4" }));
    box.append(svg("text", { x: x + 4, y: y + 12, "font-size": 13, "font-weight": 900, fill: "#FF8A1F" }, String(i + 1)));
    for (let c = 0; c < each; c++) {
      box.append(svg("circle", {
        cx: x + numCol + c * cell + cell / 2, cy: y + bh / 2, r: cell / 2 - 4,
        fill: i % 2 === 0 ? FILL : FILL2, stroke: INK, "stroke-width": 3,
      }));
    }
    g.append(box);
  }
  g.dataset["groups"] = String(groups);
  g.dataset["each"] = String(each);
  return g;
};

/**
 * Three GROUPS (Andy, 2026-09-03: "separate into groups more clearly"):
 * the picture with its heading, the steps, and, from the session, the
 * answer. Each is a panel with its own small label.
 */
export const scaffold = (f: Fact, shownA: number, shownB: number): HTMLElement => {
  const box = el("div", { class: "scaffold" });
  const picture = el("div", { class: "scaf-panel scaf-picture", "data-label": "the picture" });
  const stepsPanel = el("div", { class: "scaf-panel scaf-stepbox", "data-label": "step by step" });
  const steps = el("ol", { class: "steps" });
  box.append(picture, stepsPanel);
  // Everything appended to `box` below lands in the picture panel; the
  // steps go in their own.
  const append = box.append.bind(box);
  box.append = (...nodes: (string | Node)[]): void => { for (const n of nodes) picture.append(n); };
  void append;

  if (f.kind === "sub" && f.bridge) {
    const m = f.a;
    const s = f.b;
    const toTen = m - 10;      // take this much to land on ten
    const rest = s - toTen;    // then take the rest out of the ten
    box.append(el("p", { class: "scaf-head", text: "Find the ten." }));
    const frame = tenFrame(10, 10 - rest, rest, "#FF8A1F", toTen);
    frame.setAttribute("data-probe", "find-ten");
    box.append(frame);
    steps.append(step(1, `Start at ${m}.`));
    steps.append(step(2, `Take ${toTen} to land on 10.`));
    steps.append(step(3, `Take ${rest} more. That leaves ${f.answer}.`));
  } else if (f.kind === "add" && f.bridge) {
    const a = Math.max(f.a, f.b);
    const b = Math.min(f.a, f.b);
    const toTen = 10 - a;
    const rest = b - toTen;
    box.append(el("p", { class: "scaf-head", text: "Fill the ten first." }));
    box.append(fillTen(a, toTen, rest));
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
    box.append(el("p", { class: "scaf-head", text: `Share ${f.a} into ${groups} groups.` }));
    box.append(shareGroups(groups, Math.max(each, 1)));
    steps.append(step(1, `${f.a} altogether, split into ${groups} groups.`));
    steps.append(step(2, `Think: ${groups} times what makes ${f.a}?`));
    steps.append(step(3, `${each} in each group. The answer is ${each}.`));
  } else if (f.kind === "add") {
    // COUNT ON: start with the bigger number, count the smaller one up.
    const big = Math.max(shownA, shownB);
    const small = Math.min(shownA, shownB);
    box.append(el("p", { class: "scaf-head", text: "Count on." }));
    box.append(twoGroups(big, small));
    steps.append(step(1, `Start with the bigger number: ${big}.`));
    steps.append(step(2, small === 0 ? "Count 0 more: nothing changes." : `Count ${small} more: ${countList(big, small, 1)}.`));
    steps.append(step(3, `That makes ${f.answer}.`));
  } else {
    // COUNT BACK: start at the big number, take the small one away.
    const start = f.a;
    const taken = f.b;
    box.append(el("p", { class: "scaf-head", text: "Count back." }));
    box.append(takeAway(start, taken));
    steps.append(step(1, `Start at ${start}.`));
    steps.append(step(2, taken === 0 ? "Take 0 away: nothing changes." : `Take ${taken} away: ${countList(start, taken, -1)}.`));
    steps.append(step(3, `That leaves ${f.answer}.`));
  }

  stepsPanel.append(steps);
  return box;
};

/**
 * THE BOARDS, DRAWN. One renderer, nine themes: a real deck silhouette with
 * a kicked nose and tail, trucks, wheels with hub colour, a deck-top graphic
 * per theme, and a TRAIL that plays while the board rides (fixed duration,
 * decorative, stands down under reduced motion). The plain board is the old
 * acid deck with the same heavy outline, so nothing he already owns looks
 * lesser.
 *
 * Coordinates live in a 120 x 40 box; the rider's lane scales it.
 */

import type { Board, BoardTheme } from "../core/boards";
import { svg } from "./dom";

const INK = "#05070A";

/** The deck: nose left, tail right, both kicked. */
const DECK = "M10 20 C4 20 2 12 8 11 L22 9 L96 9 L110 11 C116 12 114 20 108 20 L96 25 L22 25 Z";

const graphic = (theme: BoardTheme, [deck, accent, glow]: readonly [string, string, string]): SVGElement[] => {
  const out: SVGElement[] = [];
  switch (theme) {
    case "plain":
      out.push(svg("path", { d: "M30 13 L88 13", stroke: glow, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.7 }));
      break;
    case "ember":
      out.push(svg("path", { d: "M70 12 L84 10 L78 15 L92 13 L80 18 L94 20 L72 22 Z", fill: glow, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M26 14 L58 14", stroke: accent, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.6 }));
      break;
    case "void":
      for (const [x, y, r] of [[30, 14, 1.4], [44, 20, 1], [56, 12, 1.6], [70, 21, 1.2], [84, 13, 1.5], [92, 19, 1]] as const) {
        out.push(svg("circle", { cx: x, cy: y, r, fill: x % 3 === 0 ? "#FFFFFF" : glow, opacity: 0.95 }));
      }
      out.push(svg("path", { d: "M36 17 Q52 10 66 17 Q80 24 96 16", fill: "none", stroke: "#C9A6FF", "stroke-width": 2, opacity: 0.55 }));
      out.push(svg("path", { d: "M62 17 l1.2 -3.5 l1.2 3.5 l3.5 1.2 l-3.5 1.2 l-1.2 3.5 l-1.2 -3.5 l-3.5 -1.2 Z", fill: "#C9A6FF" }));
      break;
    case "frost":
      out.push(svg("path", { d: "M28 17 L92 17 M40 12 L52 22 M52 12 L40 22 M68 12 L80 22 M80 12 L68 22", stroke: "#FFFFFF", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.8 }));
      out.push(svg("path", { d: "M100 25 L102 33 L104 25 M92 25 L93 31 L94 25", fill: "none", stroke: glow, "stroke-width": 2, "stroke-linecap": "round" }));
      break;
    case "storm":
      out.push(svg("path", { d: "M36 12 L58 12 L50 17 L76 15 L44 24 L54 18 L32 19 Z", fill: glow, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      break;
    case "tide":
      out.push(svg("path", { d: "M26 20 Q38 10 50 18 Q62 26 74 16 Q86 8 96 17", fill: "none", stroke: glow, "stroke-width": 3.5, "stroke-linecap": "round" }));
      out.push(svg("path", { d: "M30 23 Q44 15 58 21 Q72 27 92 21", fill: "none", stroke: "#FFFFFF", "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.7 }));
      break;
    case "gilded":
      for (const [x, y, r] of [[34, 15, 5], [60, 19, 4], [86, 14, 5]] as const) {
        out.push(svg("path", { d: `M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`, fill: glow, stroke: INK, "stroke-width": 1.2 }));
      }
      break;
    case "magma":
      out.push(svg("path", { d: "M24 16 L40 14 L48 20 L62 13 L74 21 L88 15 L98 18", fill: "none", stroke: accent, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M40 14 L44 11 M62 13 L60 9 M74 21 L78 25", stroke: glow, "stroke-width": 2, "stroke-linecap": "round" }));
      break;
    case "neon":
      out.push(svg("path", { d: DECK, fill: "none", stroke: accent, "stroke-width": 2.2, opacity: 0.9 }));
      out.push(svg("path", { d: "M30 17 L90 17", stroke: glow, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.8 }));
      break;
  }
  void deck;
  return out;
};

/** The trail behind a riding board: one shape per theme, animated by CSS. */
const trail = (theme: BoardTheme, [, accent, glow]: readonly [string, string, string]): SVGElement | null => {
  const g = svg("g", { class: `board-trail trail-${theme}` });
  switch (theme) {
    case "plain": return null;
    case "ember":
      g.append(svg("path", { d: "M-2 24 L-18 20 L-10 26 L-24 30 L-6 30 Z", fill: glow, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      g.append(svg("path", { d: "M-4 26 L-14 24 L-8 28 Z", fill: accent }));
      break;
    case "void":
      g.append(svg("path", { d: "M-2 22 L-40 30", stroke: "#FFFFFF", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.9 }));
      for (const [x, y] of [[-12, 20], [-24, 30], [-34, 24]] as const) g.append(svg("circle", { cx: x, cy: y, r: 1.6, fill: glow }));
      break;
    case "frost":
      for (const [x, y] of [[-10, 22], [-22, 30], [-32, 22]] as const) {
        g.append(svg("path", { d: `M${x - 3} ${y} L${x + 3} ${y} M${x} ${y - 3} L${x} ${y + 3}`, stroke: "#FFFFFF", "stroke-width": 1.6, "stroke-linecap": "round" }));
      }
      break;
    case "storm":
      g.append(svg("path", { d: "M-4 26 l-4 -6 M-10 30 l-3 -7 M-2 32 l-6 -3", stroke: glow, "stroke-width": 2.4, "stroke-linecap": "round" }));
      break;
    case "tide":
      g.append(svg("path", { d: "M-2 28 Q-14 20 -26 28 Q-34 33 -42 28", fill: "none", stroke: glow, "stroke-width": 3, "stroke-linecap": "round" }));
      break;
    case "gilded":
      for (const [x, y, r] of [[-12, 22, 3], [-24, 30, 2.4], [-34, 24, 2.8]] as const) {
        g.append(svg("path", { d: `M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`, fill: glow }));
      }
      break;
    case "magma":
      for (const [x, y] of [[-8, 30], [-18, 34], [-28, 31]] as const) g.append(svg("circle", { cx: x, cy: y, r: 2.4, fill: glow, stroke: accent, "stroke-width": 1.2 }));
      break;
    case "neon":
      g.append(svg("path", { d: "M-2 17 L-44 17", stroke: accent, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.8 }));
      g.append(svg("path", { d: "M-2 22 L-30 22", stroke: glow, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.6 }));
      break;
  }
  return g;
};

/**
 * Draw a board. `riding` adds the trail (the trick and the lap); the shop
 * and the card draw it still. The data attribute is the probe's handle.
 */
export const boardSvg = (b: Board, opts: { riding?: boolean; cls?: string } = {}): SVGElement => {
  const [deck, accent, glow] = b.palette;
  const root = svg("svg", { viewBox: "-48 0 168 40", class: `board board-${b.theme}${opts.cls !== undefined ? ` ${opts.cls}` : ""}`, "data-board": b.id, role: "img", "aria-label": b.name });
  if (opts.riding === true) { const t = trail(b.theme, b.palette); if (t) root.append(t); }
  if (b.theme === "neon") {
    root.append(svg("path", { d: DECK, fill: deck, opacity: 0.55, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
  } else {
    root.append(svg("path", { class: "deck-top", d: DECK, fill: deck, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
  }
  for (const g of graphic(b.theme, b.palette)) root.append(g);
  // trucks and wheels
  for (const x of [30, 88]) {
    root.append(svg("rect", { x: x - 6, y: 24, width: 12, height: 5, rx: 2, fill: accent, stroke: INK, "stroke-width": 2 }));
    root.append(svg("circle", { cx: x - 8, cy: 32, r: 5.5, fill: b.theme === "gilded" ? glow : INK, stroke: INK, "stroke-width": 2 }));
    root.append(svg("circle", { cx: x + 8, cy: 32, r: 5.5, fill: b.theme === "gilded" ? glow : INK, stroke: INK, "stroke-width": 2 }));
    root.append(svg("circle", { cx: x - 8, cy: 32, r: 2, fill: b.theme === "plain" ? "#2E3843" : glow }));
    root.append(svg("circle", { cx: x + 8, cy: 32, r: 2, fill: b.theme === "plain" ? "#2E3843" : glow }));
  }
  return root;
};

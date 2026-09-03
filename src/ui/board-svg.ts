/**
 * THE BOARDS, DRAWN. One renderer, fifteen themes: a real deck silhouette with
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
    case "jet":
      // The deck rides to the right, so the nose cone leads and the tail
      // fin trails: cone, canopy bubble, swept wing on the deck, fin.
      out.push(svg("path", { class: "jet-nose", d: "M106 9.5 L124 15.5 L106 20.5 Z", fill: deck, stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M108 13 L120 15.5", stroke: glow, "stroke-width": 1.6, "stroke-linecap": "round" }));
      out.push(svg("path", { class: "jet-wing", d: "M36 11 L64 11 L54 23 L28 23 Z", fill: accent, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M40 14 L58 14", stroke: glow, "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.8 }));
      out.push(svg("path", { class: "jet-canopy", d: "M70 11 Q80 -2 96 11 Z", fill: "#9EE8FF", stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round", opacity: 0.9 }));
      out.push(svg("path", { d: "M76 8 Q82 3 90 6", fill: "none", stroke: "#FFFFFF", "stroke-width": 1.4, "stroke-linecap": "round", opacity: 0.8 }));
      out.push(svg("path", { class: "jet-fin", d: "M12 11 L6 -2 L28 11 Z", fill: accent, stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M14 9 L10 1", stroke: glow, "stroke-width": 1.4, "stroke-linecap": "round" }));
      break;
    case "hockey":
      // Ice: the red centre line, two blue lines, a stick and a puck.
      out.push(svg("path", { d: "M60 10 L60 24", stroke: accent, "stroke-width": 2.6 }));
      out.push(svg("path", { d: "M42 10 L42 24 M78 10 L78 24", stroke: glow, "stroke-width": 2 }));
      out.push(svg("circle", { cx: 60, cy: 17, r: 4, fill: "none", stroke: accent, "stroke-width": 1.4 }));
      out.push(svg("path", { class: "stick", d: "M22 12 L30 21 L38 21", fill: "none", stroke: "#C98A3A", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      out.push(svg("ellipse", { class: "puck", cx: 94, cy: 20, rx: 5, ry: 2.6, fill: INK, stroke: "#8FB7D6", "stroke-width": 1.2 }));
      break;
    case "hoops":
      // Hardwood: plank seams, the key and its arc, a ball on the tail.
      for (const x of [34, 50, 66, 82]) out.push(svg("path", { d: `M${x} 10 L${x} 24`, stroke: accent, "stroke-width": 1, opacity: 0.5 }));
      out.push(svg("rect", { x: 22, y: 11.5, width: 22, height: 11, fill: "none", stroke: "#FFFFFF", "stroke-width": 1.4, opacity: 0.85 }));
      out.push(svg("path", { d: "M44 12 Q56 17 44 22", fill: "none", stroke: "#FFFFFF", "stroke-width": 1.4, opacity: 0.85 }));
      out.push(svg("path", { d: "M58 11 L58 23", stroke: "#FFFFFF", "stroke-width": 1.4, opacity: 0.6 }));
      out.push(svg("circle", { class: "ball", cx: 90, cy: 16.5, r: 5.5, fill: glow, stroke: INK, "stroke-width": 1.5 }));
      out.push(svg("path", { d: "M84.5 16.5 L95.5 16.5 M90 11 L90 22 M86.5 13 Q90 16.5 86.5 20 M93.5 13 Q90 16.5 93.5 20", fill: "none", stroke: INK, "stroke-width": 1 }));
      break;
    case "soccer":
      // The pitch: touchlines, the halfway line and centre circle, a ball on the tail.
      out.push(svg("rect", { x: 22, y: 11.5, width: 74, height: 11, fill: "none", stroke: "#FFFFFF", "stroke-width": 1.4, opacity: 0.85 }));
      out.push(svg("path", { d: "M59 11.5 L59 22.5", stroke: "#FFFFFF", "stroke-width": 1.4, opacity: 0.85 }));
      out.push(svg("circle", { cx: 59, cy: 17, r: 4, fill: "none", stroke: "#FFFFFF", "stroke-width": 1.2, opacity: 0.85 }));
      out.push(svg("path", { d: "M22 14 L28 14 M22 20 L28 20 M90 14 L96 14 M90 20 L96 20", stroke: "#FFFFFF", "stroke-width": 1.2, opacity: 0.7 }));
      out.push(svg("circle", { class: "ball", cx: 100, cy: 16.5, r: 5, fill: "#FFFFFF", stroke: INK, "stroke-width": 1.5 }));
      out.push(svg("path", { d: "M100 13 L102.5 15 L101.5 18 L98.5 18 L97.5 15 Z", fill: INK }));
      break;
    case "hazard":
      // The site: hazard stripes down the deck and a hard hat sticker.
      for (let x = 24; x < 96; x += 14) out.push(svg("path", { d: `M${x} 22 L${x + 7} 12 L${x + 12} 12 L${x + 5} 22 Z`, fill: accent, opacity: 0.85 }));
      out.push(svg("path", { class: "hat", d: "M84 19 A 7 6 0 0 1 98 19 L100 19 L100 21 L82 21 L82 19 Z", fill: glow, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      break;
    case "tag":
      // The tag: TL in fat pink over a yellow outline, drips, a crown,
      // and a spray of dots. Skate culture started on a wall.
      out.push(svg("path", { d: "M30 12 L50 12 M40 12 L40 24 M58 11 L58 24 L76 24", fill: "none", stroke: glow, "stroke-width": 6.5, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      out.push(svg("path", { class: "tag-letters", d: "M30 12 L50 12 M40 12 L40 24 M58 11 L58 24 L76 24", fill: "none", stroke: accent, "stroke-width": 3.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M46 14 L46 20 M66 25 L66 30", stroke: accent, "stroke-width": 1.8, "stroke-linecap": "round" }));
      out.push(svg("circle", { cx: 46, cy: 21.5, r: 1.3, fill: accent }));
      out.push(svg("circle", { cx: 66, cy: 31, r: 1.3, fill: accent }));
      out.push(svg("path", { class: "tag-crown", d: "M34 9 L35 4 L38 7 L40 3 L42 7 L45 4 L46 9 Z", fill: glow, stroke: INK, "stroke-width": 1.2, "stroke-linejoin": "round" }));
      for (const [x, y, r] of [[84, 13, 1.2], [90, 19, 1.6], [96, 12, 1], [86, 22, 1], [100, 20, 1.3]] as const) {
        out.push(svg("circle", { cx: x, cy: y, r, fill: "#35E6FF", opacity: 0.85 }));
      }
      break;
  }
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
    case "jet": // afterburner
      g.append(svg("path", { d: "M-2 12 L-34 9 L-20 15 L-40 20 L-2 20 Z", fill: glow, stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
      g.append(svg("path", { d: "M-4 14 L-22 13 L-14 16 L-24 18 L-4 18 Z", fill: "#FFE14D" }));
      break;
    case "hockey": // ice shavings
      for (const [x, y] of [[-8, 26], [-16, 22], [-22, 30], [-30, 25], [-36, 31]] as const) {
        g.append(svg("path", { d: `M${x - 2.5} ${y + 1.5} L${x + 2.5} ${y - 1.5}`, stroke: "#FFFFFF", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.9 }));
      }
      break;
    case "hoops": // the ball bouncing along behind
      g.append(svg("path", { d: "M-4 30 Q-14 8 -24 30 Q-32 14 -40 30", fill: "none", stroke: glow, "stroke-width": 1.6, "stroke-dasharray": "3 3", opacity: 0.8 }));
      g.append(svg("circle", { cx: -24, cy: 28, r: 4.5, fill: glow, stroke: INK, "stroke-width": 1.4 }));
      g.append(svg("path", { d: "M-28.5 28 L-19.5 28 M-24 23.5 L-24 32.5", stroke: INK, "stroke-width": 0.9 }));
      break;
    case "soccer": // grass flying
      for (const [x, y, r] of [[-8, 22, -30], [-16, 28, -60], [-24, 20, -20], [-32, 27, -50]] as const) {
        g.append(svg("path", { d: `M${x} ${y} l-3 -8 M${x + 2} ${y} l1 -9`, stroke: "#8FE08F", "stroke-width": 2, "stroke-linecap": "round", transform: `rotate(${r} ${x} ${y})` }));
      }
      break;
    case "hazard": // gravel
      for (const [x, y, r] of [[-8, 30, 2.2], [-16, 24, 1.6], [-24, 31, 2], [-32, 26, 1.5], [-40, 30, 1.8]] as const) {
        g.append(svg("circle", { cx: x, cy: y, r, fill: "#8A97A6", stroke: INK, "stroke-width": 1 }));
      }
      break;
    case "tag": // spray mist
      for (const [x, y, r, col] of [[-8, 18, 2, accent], [-14, 26, 1.4, glow], [-20, 15, 1.7, accent], [-28, 24, 2.2, glow], [-36, 18, 1.5, "#35E6FF"], [-42, 28, 1.2, accent]] as const) {
        g.append(svg("circle", { cx: x, cy: y, r, fill: col, opacity: 0.85 }));
      }
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

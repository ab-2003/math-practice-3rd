/**
 * AN ANALOG CLOCK FACE, drawn in the house style: heavy ink outline, flat
 * fills, chunky hands. Every time it ever shows sits on a five minute mark
 * (elapsed.ts guarantees it), so reading these IS clock practice, not a
 * squint. All twelve numerals are present because reading the hour hand
 * between numbers is the actual skill.
 */

import { svg } from "./dom";

const INK = "#05070A";

export const clockSvg = (minutesSinceMidnight: number): SVGElement => {
  const root = svg("svg", { viewBox: "0 0 200 200", class: "clock", role: "img",
    "aria-label": "An analog clock" });
  const cx = 100;
  const cy = 100;

  root.append(svg("circle", { cx, cy, r: 92, fill: "#1E242C", stroke: INK, "stroke-width": 9 }));
  root.append(svg("circle", { cx, cy, r: 80, fill: "#10151B", stroke: "#2E3843", "stroke-width": 3 }));

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = -Math.cos(a);
    root.append(svg("line", {
      x1: cx + sin * 72, y1: cy + cos * 72, x2: cx + sin * 78, y2: cy + cos * 78,
      stroke: "#8A97A6", "stroke-width": i % 3 === 0 ? 6 : 4, "stroke-linecap": "round",
    }));
    const n = i === 0 ? 12 : i;
    root.append(svg("text", {
      x: cx + sin * 58, y: cy + cos * 58 + 7,
      "text-anchor": "middle", fill: "#F2F5F8", "font-size": 20, "font-weight": 900,
    }, String(n)));
  }

  const h = minutesSinceMidnight / 60;
  const m = minutesSinceMidnight % 60;
  const hourA = ((h % 12) / 12) * Math.PI * 2;
  const minA = (m / 60) * Math.PI * 2;

  // Hour hand: short, pale, under the minute hand.
  root.append(svg("line", {
    x1: cx - Math.sin(hourA) * 8, y1: cy + Math.cos(hourA) * 8,
    x2: cx + Math.sin(hourA) * 38, y2: cy - Math.cos(hourA) * 38,
    stroke: "#F2F5F8", "stroke-width": 11, "stroke-linecap": "round",
  }));
  // Minute hand: long and acid, the one he reads the fives from.
  root.append(svg("line", {
    x1: cx - Math.sin(minA) * 10, y1: cy + Math.cos(minA) * 10,
    x2: cx + Math.sin(minA) * 62, y2: cy - Math.cos(minA) * 62,
    stroke: "#B6FF3C", "stroke-width": 8, "stroke-linecap": "round",
  }));
  root.append(svg("circle", { cx, cy, r: 8, fill: INK, stroke: "#B6FF3C", "stroke-width": 3 }));
  return root;
};

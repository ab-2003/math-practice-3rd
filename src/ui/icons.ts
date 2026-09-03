/** Small drawn icons for buttons, in the house ink. */

import { svg } from "./dom";

/** Two arrows chasing each other: the refresh icon. */
export const icoRefresh = (): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 24 24", class: "ico ico-spin", "aria-hidden": "true" });
  g.append(svg("path", { d: "M12 4 a8 8 0 0 1 7.4 5 L21.5 8 L21.5 14 L15.5 14 L17.6 11.9 A6 6 0 0 0 12 6 Z" }));
  g.append(svg("path", { d: "M12 20 a8 8 0 0 1 -7.4 -5 L2.5 16 L2.5 10 L8.5 10 L6.4 12.1 A6 6 0 0 0 12 18 Z" }));
  return g;
};

/**
 * THE DAILY TOKEN (0.19.0): a cyan hexagon with a board across it, so it
 * never reads as a coin. Coins are warm diamonds; tokens are cool hexes.
 */
export const tokenIcon = (cls = "token-ico"): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 40 40", class: cls, "aria-hidden": "true" });
  g.append(svg("path", { d: "M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z", fill: "#35E6FF", stroke: "#05070A", "stroke-width": 3, "stroke-linejoin": "round" }));
  g.append(svg("path", { d: "M20 8 L31 14 L31 26 L20 32 L9 26 L9 14 Z", fill: "none", stroke: "#05070A", "stroke-width": 2, opacity: 0.55 }));
  g.append(svg("path", { d: "M11 19 C9 19 9 23 11 23 L29 23 C31 23 31 19 29 19 Z", fill: "#05070A" }));
  g.append(svg("circle", { cx: 15, cy: 26, r: 2.2, fill: "#05070A" }));
  g.append(svg("circle", { cx: 25, cy: 26, r: 2.2, fill: "#05070A" }));
  return g;
};

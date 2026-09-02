/** Small drawn icons for buttons, in the house ink. */

import { svg } from "./dom";

/** Two arrows chasing each other: the refresh icon. */
export const icoRefresh = (): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 24 24", class: "ico ico-spin", "aria-hidden": "true" });
  g.append(svg("path", { d: "M12 4 a8 8 0 0 1 7.4 5 L21.5 8 L21.5 14 L15.5 14 L17.6 11.9 A6 6 0 0 0 12 6 Z" }));
  g.append(svg("path", { d: "M12 20 a8 8 0 0 1 -7.4 -5 L2.5 16 L2.5 10 L8.5 10 L6.4 12.1 A6 6 0 0 0 12 18 Z" }));
  return g;
};

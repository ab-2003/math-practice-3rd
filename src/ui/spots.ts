/**
 * THE SPOTS: scenery behind the stage, earned by lines landed. Deliberately
 * dim, stroke-only, pointer-inert: the world grows richer as mastery
 * accumulates, but the equation always owns the contrast.
 */
import { svg } from "./dom";

const S = "#2E3843";
const S2 = "#3A4754";

const draw = (id: string): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 400 260", class: "spot-art", "aria-hidden": "true" });
  const line = (d: string, w = 5, stroke = S): SVGElement =>
    svg("path", { d, fill: "none", stroke, "stroke-width": w, "stroke-linecap": "round" });
  if (id === "halfpipe") {
    g.append(line("M20 40 C20 200 120 230 200 230 C280 230 380 200 380 40", 7));
    g.append(line("M12 40 L44 40 M356 40 L388 40", 7, S2));
  } else if (id === "rooftop") {
    g.append(line("M0 230 L400 230", 7));
    g.append(line("M40 230 L40 150 L110 150 L110 230", 5));
    g.append(line("M150 230 L150 110 L230 110 L230 230", 5));
    g.append(line("M270 230 L270 170 L350 170 L350 230", 5));
    g.append(line("M190 110 L190 70 M182 78 L198 78", 4, S2));
  } else if (id === "bowl") {
    g.append(svg("circle", { cx: 320, cy: 60, r: 34, fill: "none", stroke: S2, "stroke-width": 5 }));
    g.append(line("M0 200 C100 260 300 260 400 200", 7));
    g.append(line("M0 170 L80 170 M320 170 L400 170", 4, S2));
  } else if (id === "megaramp") {
    g.append(line("M20 230 L260 230 C330 230 370 190 380 40", 7));
    g.append(line("M380 40 L380 230", 5, S2));
    g.append(line("M40 230 L40 214 M70 230 L70 214", 4, S2));
  } else {
    // the street: ground, a rail, a curb
    g.append(line("M0 230 L400 230", 7));
    g.append(line("M120 200 L280 200 M140 200 L140 230 M260 200 L260 230", 5, S2));
    g.append(line("M20 230 L20 218 L70 218", 4, S2));
  }
  return g;
};

export const spotLayer = (id: string): HTMLElement => {
  const wrap = document.createElement("div");
  wrap.className = "spot";
  wrap.append(draw(id));
  return wrap;
};

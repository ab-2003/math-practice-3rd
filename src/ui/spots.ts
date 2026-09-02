/**
 * THE SPOTS: scenery behind the stage, earned by lines landed. Deliberately
 * dim, stroke-only, pointer-inert: the world grows richer as mastery
 * accumulates, but the equation always owns the contrast.
 */
import { svg } from "./dom";

const S = "#2E3843";
const S2 = "#3A4754";

const draw = (id: string): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 400 260", class: "spot-art", "aria-hidden": "true", "data-spot": id });
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
  } else if (id === "frostpark") {
    // winter: a snowed-over rail with icicles, drifts, and falling flakes
    g.append(line("M0 230 L400 230", 7));
    g.append(line("M110 196 L290 196 M130 196 L130 230 M270 196 L270 230", 5, S2));
    g.append(line("M150 200 L150 214 M190 200 L190 210 M230 200 L230 216", 4, S2));
    g.append(line("M0 226 C30 210 70 210 100 226", 5, S2));
    g.append(line("M300 226 C330 212 370 212 400 226", 5, S2));
    for (const [x, y] of [[60, 60], [140, 40], [220, 90], [320, 50], [360, 120], [90, 130]] as const) {
      g.append(line(`M${x - 8} ${y} L${x + 8} ${y} M${x} ${y - 8} L${x} ${y + 8} M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`, 3, S2));
    }
  } else if (id === "boardwalk") {
    // summer: planks on posts over the water, a low sun, a gull or two
    g.append(line("M0 214 L400 214", 7));
    for (let x = 20; x < 400; x += 36) g.append(line(`M${x} 214 L${x} 200`, 3, S2));
    g.append(line("M60 214 L60 250 M200 214 L200 250 M340 214 L340 250", 5, S2));
    g.append(line("M0 246 C40 238 80 254 120 246 C160 238 200 254 240 246 C280 238 320 254 360 246 L400 246", 4, S2));
    g.append(svg("circle", { cx: 320, cy: 70, r: 30, fill: "none", stroke: S2, "stroke-width": 5 }));
    g.append(line("M80 70 q10 -10 20 0 q10 -10 20 0 M150 44 q8 -8 16 0 q8 -8 16 0", 4, S2));
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

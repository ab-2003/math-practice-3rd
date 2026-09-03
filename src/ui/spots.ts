/**
 * THE SPOTS: scenery behind the stage, earned by lines landed. Deliberately
 * dim, stroke-only, pointer-inert: the world grows richer as mastery
 * accumulates, but the equation always owns the contrast.
 *
 * EVERY SPOT IS A RAIL LINE (Andy, 2026-09-03). The rider crosses the stage
 * left to right on the rail lane, so the scenery is always flat ground with
 * a rail to grind, in a different configuration per spot: a street rail, a
 * stair set with a handrail, a rooftop rail, a plaza with two, a kink rail.
 * The half pipe and the bowl he "just moved through" are gone. Stroke widths
 * pick the lit colour: 7 is the ground (acid), 5 a rail (cyan), 4 detail
 * (warm); see styles.css under "the victory lap".
 */
import { svg } from "./dom";

const S = "#2E3843";
const S2 = "#3A4754";

interface Pen {
  /** A dim stroke: ground at 7, detail at 4. */
  line: (d: string, w?: number, stroke?: string) => void;
  /** A rail: width 5, marked data-rail so a probe can prove one is there. */
  rail: (d: string) => void;
  circle: (cx: number, cy: number, r: number) => void;
}

const GROUND = "M0 230 L400 230";

const ART: Record<string, (p: Pen) => void> = {
  street: (p) => {
    // the street: ground, one flat rail on posts, a curb
    p.line(GROUND, 7);
    p.rail("M120 200 L280 200 M140 200 L140 230 M260 200 L260 230");
    p.line("M20 230 L20 218 L70 218", 4, S2);
  },
  stairs: (p) => {
    // a four-stair set down to the right, the handrail slanting with it, and
    // a ledge at the top to pop off
    p.line(GROUND, 7);
    p.line("M150 190 L175 190 L175 200 L200 200 L200 210 L225 210 L225 220 L250 220 L250 230", 4, S2);
    p.line("M60 190 L150 190", 4, S2);
    p.rail("M136 174 L262 218 M148 178 L148 190 M250 214 L250 230");
    p.line("M300 230 L300 220 L360 220", 4, S2);
  },
  rooftop: (p) => {
    // the roof edge for ground, a rail between two vents, the aerial.
    // The aerial's arms ANGLE UP and there is no horizontal bar: a mast
    // crossed by one made a religious symbol of the skyline (Andy's phone,
    // 2026-09-03). Keep any future mast crossbar-free.
    p.line(GROUND, 7);
    p.line("M40 230 L40 180 L100 180 L100 230", 4, S2);
    p.line("M290 230 L290 172 L350 172 L350 230", 4, S2);
    p.rail("M130 198 L262 198 M150 198 L150 230 M242 198 L242 230");
    p.line("M320 172 L320 118", 4, S2);
    p.line("M320 140 L306 126 M320 140 L334 126 M320 128 L310 118 M320 128 L330 118", 3, S2);
  },
  plaza: (p) => {
    // a plaza: a low rail and a tall one, a bench, planters
    p.line(GROUND, 7);
    p.rail("M50 208 L170 208 M70 208 L70 230 M150 208 L150 230");
    p.rail("M220 190 L350 190 M240 190 L240 230 M330 190 L330 230");
    p.line("M0 214 L36 214 M8 214 L8 230 M28 214 L28 230", 4, S2);
    p.line("M180 230 L180 216 L206 216 L206 230 M366 230 L366 216 L392 216 L392 230", 4, S2);
  },
  kink: (p) => {
    // a kink rail: flat, a drop, flat again; a flat box past it
    p.line(GROUND, 7);
    p.rail("M60 194 L170 194 L250 214 L330 214 M80 194 L80 230 M170 194 L170 230 M250 214 L250 230 M310 214 L310 230");
    p.line("M350 230 L350 218 L392 218", 4, S2);
  },
  frostpark: (p) => {
    // winter: a snowed-over rail with icicles, drifts, and falling flakes
    p.line(GROUND, 7);
    p.rail("M110 196 L290 196 M130 196 L130 230 M270 196 L270 230");
    p.line("M150 200 L150 214 M190 200 L190 210 M230 200 L230 216", 4, S2);
    p.line("M0 226 C30 210 70 210 100 226", 5, S2);
    p.line("M300 226 C330 212 370 212 400 226", 5, S2);
    for (const [x, y] of [[60, 60], [140, 40], [220, 90], [320, 50], [360, 120], [90, 130]] as const) {
      p.line(`M${x - 8} ${y} L${x + 8} ${y} M${x} ${y - 8} L${x} ${y + 8} M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`, 3, S2);
    }
  },
  boardwalk: (p) => {
    // summer: planks on posts over the water, a rail down the boards, a low
    // sun, a gull or two
    p.line("M0 214 L400 214", 7);
    for (let x = 20; x < 400; x += 36) p.line(`M${x} 214 L${x} 200`, 3, S2);
    p.rail("M140 184 L260 184 M160 184 L160 214 M240 184 L240 214");
    p.line("M60 214 L60 250 M200 214 L200 250 M340 214 L340 250", 5, S2);
    p.line("M0 246 C40 238 80 254 120 246 C160 238 200 254 240 246 C280 238 320 254 360 246 L400 246", 4, S2);
    p.circle(320, 70, 30);
    p.line("M80 70 q10 -10 20 0 q10 -10 20 0 M150 44 q8 -8 16 0 q8 -8 16 0", 4, S2);
  },
};

const draw = (id: string): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 400 260", class: "spot-art", "aria-hidden": "true", "data-spot": id });
  const stroke = (d: string, w: number, col: string, extra: Record<string, string> = {}): void => {
    g.append(svg("path", { d, fill: "none", stroke: col, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra }));
  };
  const pen: Pen = {
    line: (d, w = 5, col = S) => stroke(d, w, col),
    rail: (d) => stroke(d, 5, S2, { "data-rail": "1" }),
    circle: (cx, cy, r) => { g.append(svg("circle", { cx, cy, r, fill: "none", stroke: S2, "stroke-width": 5 })); },
  };
  (ART[id] ?? ART["street"]!)(pen);
  return g;
};

export const spotLayer = (id: string): HTMLElement => {
  const wrap = document.createElement("div");
  wrap.className = "spot";
  wrap.append(draw(id));
  return wrap;
};

// For the probes: light any spot on demand (the day picks one otherwise).
(window as unknown as Record<string, unknown>).__spot = spotLayer;

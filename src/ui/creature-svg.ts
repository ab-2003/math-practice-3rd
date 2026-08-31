/**
 * THE MONSTERS, DRAWN.
 *
 * Sticker art rules: one heavy black outline on everything, saturated flat
 * fills, a highlight shape rather than shading, and ANGLES rather than curves.
 * The first pass drew soft blobs and every creature came out the same cute
 * animal in a different colour, which is the exact opposite of the brief.
 *
 * So the silhouette carries the identity now: a brute is low and enormous, a
 * raptor leans forward on tall legs, a titan towers, a serpent coils. The
 * crest reads from across the room. Twelve creatures are twelve PARAMETER
 * SETS through one renderer, which is how they fit in a bundle small enough
 * to live offline.
 *
 * Everything is original. Real dinosaur silhouettes and general kaiju
 * conventions are the only borrowings, and neither belongs to anybody.
 */

import type { Creature, Silhouette } from "../core/creatures";
import { svg } from "./dom";

const INK = "#05070A";
const SW = 7;

interface Plan {
  /** Main mass. */
  body: string;
  /** Head, drawn over the body, always facing right. */
  head: string;
  /** Where the jaw and eyes sit. */
  face: { x: number; y: number; scale: number };
  legs: string[];
  /** Where the crest runs, as a spine polyline from tail end to neck. */
  spine: Array<[number, number]>;
  tailAnchor: [number, number];
}

const PLANS: Record<Silhouette, Plan> = {
  // Low, enormous, all shoulder. Head sunk between the shoulders.
  brute: {
    body: "M26 158 L30 122 L52 96 L96 84 L140 92 L166 116 L174 158 Z",
    head: "M142 96 L192 88 L198 116 L182 130 L142 126 Z",
    face: { x: 152, y: 100, scale: 1 },
    legs: ["M50 150 L44 184 L74 184 L74 150 Z", "M122 150 L118 184 L150 184 L146 150 Z"],
    spine: [[40, 128], [66, 98], [100, 86], [138, 94]],
    tailAnchor: [28, 140],
  },
  // Lean, forward, up on its toes. Reads fast even standing still.
  raptor: {
    body: "M44 136 L56 98 L88 78 L122 80 L142 100 L138 132 L98 148 L60 146 Z",
    head: "M132 86 L188 72 L198 92 L180 108 L134 108 Z",
    face: { x: 146, y: 84, scale: 0.95 },
    legs: ["M70 142 L58 186 L86 186 L92 142 Z", "M112 142 L108 186 L134 186 L128 142 Z"],
    spine: [[54, 118], [70, 92], [100, 78], [130, 86]],
    tailAnchor: [44, 126],
  },
  // Low and wide so the plates on its back are the whole point.
  plated: {
    body: "M22 160 L34 124 L68 104 L118 100 L154 118 L176 160 Z",
    head: "M150 108 L196 100 L200 126 L184 138 L150 134 Z",
    face: { x: 158, y: 112, scale: 0.9 },
    legs: ["M46 154 L40 184 L70 184 L70 154 Z", "M124 154 L120 184 L150 184 L146 154 Z"],
    spine: [[36, 128], [66, 104], [104, 98], [142, 110]],
    tailAnchor: [24, 144],
  },
  // Front-heavy: the head and its frill are most of the animal.
  horned: {
    body: "M32 158 L42 122 L72 102 L112 98 L138 114 L158 158 Z",
    head: "M118 92 L184 78 L200 106 L186 134 L124 136 Z",
    face: { x: 140, y: 98, scale: 1.15 },
    legs: ["M52 152 L46 184 L74 184 L76 152 Z", "M116 152 L114 184 L142 184 L138 152 Z"],
    spine: [[44, 128], [72, 104], [104, 98], [126, 106]],
    tailAnchor: [34, 144],
  },
  // Coiled, no legs, head raised off the body.
  serpent: {
    body: "M18 156 L26 126 L52 112 L78 116 L92 96 L82 72 L104 58 L136 62 L154 84 L146 112 L120 128 L86 138 L54 160 Z",
    head: "M128 52 L184 44 L196 68 L178 84 L132 82 Z",
    face: { x: 142, y: 56, scale: 1 },
    legs: [],
    spine: [[30, 130], [66, 112], [92, 84], [124, 60]],
    tailAnchor: [20, 148],
  },
  // Towering biped. Everything about it is vertical.
  titan: {
    body: "M52 176 L48 112 L70 70 L110 56 L148 78 L156 128 L146 176 Z",
    head: "M126 58 L186 44 L198 72 L180 92 L130 92 Z",
    face: { x: 142, y: 60, scale: 1.05 },
    legs: ["M64 168 L52 192 L88 192 L90 168 Z", "M116 168 L112 192 L146 192 L140 168 Z"],
    spine: [[54, 140], [58, 96], [86, 64], [124, 60]],
    tailAnchor: [50, 158],
  },
};

const poly = (d: string, fill: string, w = SW): SVGElement =>
  svg("path", { d, fill, stroke: INK, "stroke-width": w, "stroke-linejoin": "round" });

/** The crest, built along the creature's own spine so it fits the silhouette. */
const crest = (c: Creature, plan: Plan): SVGElement[] => {
  const out: SVGElement[] = [];
  const [, dark, light] = c.palette;
  const accent = light;
  const glow = dark;
  const pts = plan.spine;
  if (c.crest === "none") return out;

  if (c.crest === "spikes") {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const h = 30 - Math.abs(i - (pts.length - 1) / 2) * 5;
      out.push(poly(`M${p[0] - 11} ${p[1] + 6} L${p[0]} ${p[1] - h} L${p[0] + 11} ${p[1] + 6} Z`, accent, SW - 1));
    }
  } else if (c.crest === "sail") {
    const top = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1] - 16 - Math.sin((i / (pts.length - 1)) * Math.PI) * 30}`).join(" ");
    const back = [...pts].reverse().map((p) => `L${p[0]} ${p[1] + 4}`).join(" ");
    out.push(poly(`${top} ${back} Z`, accent));
    // Ribs, so the sail is not a flat shape.
    for (const p of pts.slice(1, -1)) {
      out.push(svg("line", { x1: p[0], y1: p[1] + 2, x2: p[0], y2: p[1] - 34, stroke: INK, "stroke-width": 4 }));
    }
  } else if (c.crest === "plates") {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const w = 20 - Math.abs(i - (pts.length - 1) / 2) * 2;
      const h = 34 - Math.abs(i - (pts.length - 1) / 2) * 7;
      out.push(poly(`M${p[0] - w} ${p[1] + 6} L${p[0] - w * 0.4} ${p[1] - h} L${p[0] + w * 0.4} ${p[1] - h} L${p[0] + w} ${p[1] + 6} Z`,
        i % 2 === 0 ? accent : glow, SW - 2));
    }
  } else if (c.crest === "frill") {
    const f = plan.face;
    out.push(poly(
      `M${f.x - 6} ${f.y + 34} L${f.x - 30} ${f.y - 6} L${f.x - 18} ${f.y - 40} L${f.x + 24} ${f.y - 50} L${f.x + 56} ${f.y - 26} L${f.x + 52} ${f.y + 22} Z`,
      accent));
  }
  return out;
};

const tail = (c: Creature, plan: Plan): SVGElement[] => {
  const [body, accent] = c.palette;
  const [ax, ay] = plan.tailAnchor;
  const path = `M${ax} ${ay} L${ax - 18} ${ay - 26} L${ax - 6} ${ay - 44}`;
  const out: SVGElement[] = [
    svg("path", { d: path, fill: "none", stroke: INK, "stroke-width": SW + 12, "stroke-linecap": "round", "stroke-linejoin": "round" }),
    svg("path", { d: path, fill: "none", stroke: body, "stroke-width": SW + 2, "stroke-linecap": "round", "stroke-linejoin": "round" }),
  ];
  const tx = ax - 6;
  const ty = ay - 44;
  if (c.tail === "club") out.push(svg("circle", { cx: tx, cy: ty - 6, r: 16, fill: accent, stroke: INK, "stroke-width": SW }));
  else if (c.tail === "blade") out.push(poly(`M${tx} ${ty + 6} L${tx - 16} ${ty - 26} L${tx + 16} ${ty - 12} Z`, accent));
  else if (c.tail === "spike") out.push(poly(`M${tx - 9} ${ty + 4} L${tx + 1} ${ty - 32} L${tx + 11} ${ty + 2} Z`, accent));
  else out.push(svg("path", { d: `M${tx} ${ty} L${tx + 14} ${ty - 18} L${tx - 4} ${ty - 30}`, fill: "none", stroke: body, "stroke-width": 7, "stroke-linecap": "round" }));
  return out;
};

const horns = (c: Creature, plan: Plan): SVGElement[] => {
  const out: SVGElement[] = [];
  const [, , glow] = c.palette;
  const f = plan.face;
  for (let i = 0; i < c.horns; i++) {
    const t = c.horns === 1 ? 0.5 : i / (c.horns - 1);
    const x = f.x + 2 + t * 34;
    const y = f.y - 4 - Math.sin(t * Math.PI) * 6;
    const h = 20 + Math.sin(t * Math.PI) * 12;
    out.push(poly(`M${x - 7} ${y + 4} L${x + 2} ${y - h} L${x + 9} ${y + 4} Z`, glow, SW - 3));
  }
  return out;
};

const face = (c: Creature, plan: Plan): SVGElement[] => {
  const out: SVGElement[] = [];
  const f = plan.face;
  const [, accent] = c.palette;
  const s = f.scale;

  // The jaw: a wedge with real teeth, not a smile.
  const jx = f.x + 20;
  const jy = f.y + 24 * s;
  out.push(poly(`M${jx} ${jy} L${jx + 42 * s} ${jy - 4} L${jx + 38 * s} ${jy + 22 * s} L${jx + 2} ${jy + 18 * s} Z`, accent, SW - 2));
  for (let i = 0; i < 3; i++) {
    const tx = jx + 6 + i * 12 * s;
    out.push(svg("path", { d: `M${tx} ${jy + 1} l${5 * s} ${11 * s} l${5 * s} ${-11 * s} z`, fill: "#FFFFFF", stroke: INK, "stroke-width": 2.5 }));
  }

  const spots: Array<[number, number]> =
    c.eyes === 1 ? [[f.x + 16, f.y + 6]]
    : c.eyes === 2 ? [[f.x + 8, f.y + 6], [f.x + 28, f.y + 4]]
    : [[f.x + 6, f.y + 8], [f.x + 24, f.y + 2], [f.x + 40, f.y + 10]];
  for (const [x, y] of spots) {
    out.push(svg("circle", { cx: x, cy: y, r: 10 * s, fill: "#FFFFFF", stroke: INK, "stroke-width": SW - 2 }));
    // A slit pupil, angled. This is the single line that stops it reading cute.
    out.push(svg("ellipse", { cx: x + 2, cy: y + 1, rx: 3.2 * s, ry: 7 * s, fill: INK, transform: `rotate(-12 ${x + 2} ${y + 1})` }));
    out.push(svg("path", { d: `M${x - 12 * s} ${y - 9 * s} L${x + 12 * s} ${y - 13 * s}`, stroke: INK, "stroke-width": 5, "stroke-linecap": "round" }));
  }
  return out;
};

export const creatureSvg = (c: Creature): SVGElement => {
  const plan = PLANS[c.silhouette];
  const [body, , glow] = c.palette;
  const root = svg("svg", { viewBox: "-14 -6 246 214", class: "creature", role: "img", "aria-label": c.name });

  root.append(...tail(c, plan));
  root.append(...crest(c, plan));
  for (const l of plan.legs) root.append(poly(l, body));
  root.append(poly(plan.body, body, SW + 2));
  // A highlight shape rather than a gradient: sticker art has no shading.
  root.append(svg("path", {
    d: `M${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 16} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 12} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 26} L${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 32} Z`,
    fill: glow, opacity: 0.5,
  }));
  root.append(poly(plan.head, body, SW + 1));
  root.append(...horns(c, plan));
  root.append(...face(c, plan));
  return root;
};

/** Locked slots show the SHAPE, which is the part that carries the identity,
 *  without giving away the colour or the face. */
export const creatureSilhouette = (c: Creature): SVGElement => {
  const plan = PLANS[c.silhouette];
  const root = svg("svg", { viewBox: "-14 -6 246 214", class: "creature locked", role: "img", "aria-label": "Locked" });
  const g = svg("g", { opacity: 0.85 });
  for (const l of plan.legs) g.append(poly(l, "#1E242C", 5));
  g.append(poly(plan.body, "#1E242C", 5));
  g.append(poly(plan.head, "#1E242C", 5));
  root.append(g);
  root.append(svg("text", {
    x: 100, y: 122, "text-anchor": "middle", fill: "#4A5867", "font-size": 62, "font-weight": 900,
  }, "?"));
  return root;
};

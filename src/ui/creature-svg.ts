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
import type { Helmet, HelmetShape } from "../core/gear";
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
  /** Bat-wing fan drawn behind the body. Dragons only. */
  wings?: string;
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
  // Winged. The wings ARE the silhouette; everything else stays grounded.
  dragon: {
    body: "M38 152 L46 114 L72 94 L112 88 L142 98 L158 118 L164 152 Z",
    head: "M130 76 L184 58 L198 82 L182 98 L134 100 Z",
    face: { x: 144, y: 66, scale: 1 },
    legs: ["M56 146 L50 182 L78 182 L80 146 Z", "M116 146 L112 182 L142 182 L138 146 Z"],
    spine: [[48, 124], [74, 96], [110, 88], [138, 96]],
    tailAnchor: [40, 140],
    wings: "M66 98 L20 20 L74 58 L92 14 L116 54 L152 24 L146 92 Z",
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

/**
 * Six dragons, six FORMS (Andy 2026-09-01): not palette swaps. Each overrides
 * the base dragon's wings at minimum, and most reshape body and head too:
 * bat-winged ember, fin-winged sea serpent, leaf-winged glider, swept-wing
 * night hunter, crystal-winged glacier, high-winged regal gold.
 */
const DRAGON_VARIANTS: Record<string, Partial<Plan>> = {
  cinderwyrm: {}, // the base dragon IS the ember: jagged bat wings
  tidalwyrm: {
    body: "M24 150 C36 118 64 116 78 96 C92 76 118 72 140 84 C158 94 162 118 166 150 Z",
    legs: [],
    wings: "M70 96 C40 60 44 28 78 44 C86 20 116 24 118 52 C138 36 152 52 146 88 Z",
  },
  mosswing: {
    body: "M36 152 L44 108 L76 86 L116 84 L146 98 L160 120 L164 152 Z",
    wings: "M66 96 L30 34 Q52 44 60 36 Q64 18 84 30 Q96 10 108 32 Q124 20 128 44 Q146 40 142 90 Z",
  },
  nightwyrm: {
    body: "M42 152 L52 118 L80 98 L114 92 L142 102 L154 122 L158 152 Z",
    wings: "M68 96 L14 40 L64 66 L54 18 L92 56 L120 30 L138 88 Z",
    head: "M132 66 L188 48 L200 72 L184 88 L136 92 Z",
    face: { x: 146, y: 56, scale: 1 },
  },
  glacierwing: {
    body: "M34 152 L40 110 L70 90 L114 86 L148 100 L162 122 L168 152 Z",
    wings: "M66 96 L34 22 L64 52 L80 12 L96 50 L120 18 L128 54 L150 34 L146 90 Z",
  },
  gildedwyrm: {
    wings: "M64 94 L36 14 L72 50 L98 8 L118 48 L150 16 L148 88 Z",
    head: "M128 62 L186 44 L198 70 L182 86 L132 90 Z",
    face: { x: 142, y: 52, scale: 1 },
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

const horns = (c: Creature, plan: Plan, gold: boolean): SVGElement[] => {
  const out: SVGElement[] = [];
  const glow = gold ? "#FFD84A" : c.palette[2];
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

const face = (c: Creature, plan: Plan, glowing: boolean): SVGElement[] => {
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
    if (glowing) out.push(svg("circle", { cx: x, cy: y, r: 15 * s, fill: "#B6FF3C", opacity: 0.35 }));
    out.push(svg("circle", { cx: x, cy: y, r: 10 * s, fill: glowing ? "#EDFFC7" : "#FFFFFF", stroke: INK, "stroke-width": SW - 2 }));
    // A slit pupil, angled. This is the single line that stops it reading cute.
    out.push(svg("ellipse", { cx: x + 2, cy: y + 1, rx: 3.2 * s, ry: 7 * s, fill: INK, transform: `rotate(-12 ${x + 2} ${y + 1})` }));
    out.push(svg("path", { d: `M${x - 12 * s} ${y - 9 * s} L${x + 12 * s} ${y - 13 * s}`, stroke: INK, "stroke-width": 5, "stroke-linecap": "round" }));
  }
  return out;
};

/**
 * Level accessories, so LEVEL UP buys something the eye can see: a deck-
 * sticker star at 2, glowing eyes at 4, gold horns at 7, an aura at 10.
 * Spending two days of coins on an invisible number taught the wrong lesson
 * about the whole economy.
 */
/** Every shape drawn around a local origin at the crown of the head, so one
 *  renderer dresses twenty monsters AND draws the shop tiles. */
export const helmetPaths = (shape: HelmetShape, shell: string, accent: string): SVGElement[] => {
  const out: SVGElement[] = [];
  const dome = (ry = 20, rx = 27): void => {
    out.push(svg("path", { d: `M-${rx} 6 A ${rx} ${ry} 0 0 1 ${rx} 6 L ${rx - 4} 12 L -${rx - 4} 12 Z`,
      fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
  };
  switch (shape) {
    case "half": dome(); out.push(svg("line", { x1: -16, y1: 12, x2: -12, y2: 24, stroke: INK, "stroke-width": 4 })); break;
    case "cap": dome(18, 24); out.push(svg("path", { d: "M18 4 L44 2 L44 12 L20 12 Z", fill: accent, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" })); break;
    case "full":
      out.push(svg("path", { d: "M-28 4 A 28 24 0 0 1 28 4 L 28 20 L -28 20 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("rect", { x: 2, y: 4, width: 24, height: 8, rx: 4, fill: accent, stroke: INK, "stroke-width": 3 }));
      break;
    case "mohawk": dome();
      for (let k = 0; k < 4; k++) out.push(svg("path", { d: `M${-18 + k * 11} -10 L${-13 + k * 11} -26 L${-8 + k * 11} -10 Z`, fill: accent, stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
      break;
    case "viking": dome();
      out.push(svg("path", { d: "M-24 -2 L-38 -24 L-26 -20 L-18 -6 Z", fill: accent, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M24 -2 L38 -24 L26 -20 L18 -6 Z", fill: accent, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      break;
    case "crown":
      out.push(svg("path", { d: "M-24 12 L-24 -14 L-12 -2 L0 -18 L12 -2 L24 -14 L24 12 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("circle", { cx: 0, cy: 2, r: 4, fill: accent, stroke: INK, "stroke-width": 2.5 }));
      break;
    case "beanie": dome();
      out.push(svg("rect", { x: -27, y: 4, width: 54, height: 9, rx: 4, fill: accent, stroke: INK, "stroke-width": 4 }));
      out.push(svg("circle", { cx: 0, cy: -22, r: 7, fill: accent, stroke: INK, "stroke-width": 4 }));
      break;
    case "samurai": dome();
      out.push(svg("path", { d: "M-27 8 L-42 20 L-24 18 Z", fill: shell, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M27 8 L42 20 L24 18 Z", fill: shell, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M-3 -8 L0 -26 L3 -8 M-10 -6 L0 -22 M10 -6 L0 -22", fill: "none", stroke: accent, "stroke-width": 4, "stroke-linecap": "round" }));
      break;
    case "goggle": dome(16, 25);
      out.push(svg("circle", { cx: -9, cy: 8, r: 8, fill: accent, stroke: INK, "stroke-width": 4 }));
      out.push(svg("circle", { cx: 11, cy: 8, r: 8, fill: accent, stroke: INK, "stroke-width": 4 }));
      break;
    case "cone":
      out.push(svg("path", { d: "M-8 -30 L8 -30 L20 12 L-20 12 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("rect", { x: -14, y: -12, width: 28, height: 8, fill: accent, stroke: INK, "stroke-width": 3 }));
      break;
  }
  return out;
};

/** A helmet alone, for the gear rack tiles. */
export const helmetIcon = (h: Helmet): SVGElement => {
  const root = svg("svg", { viewBox: "-48 -40 96 68", class: "helm-mini", role: "img", "aria-label": h.name });
  const g = svg("g", {});
  for (const p of helmetPaths(h.shape, h.colors[0], h.colors[1])) g.append(p);
  root.append(g);
  return root;
};

export const creatureSvg = (
  c: Creature,
  opts: { level?: number; helmet?: Helmet; idle?: number; fastIdle?: boolean } = {},
): SVGElement => {
  const lvl = opts.level ?? 1;
  const plan: Plan = { ...PLANS[c.silhouette], ...(DRAGON_VARIANTS[c.id] ?? {}) };
  const [body, , glow] = c.palette;
  const root = svg("svg", {
    viewBox: "-14 -6 246 214", role: "img", "aria-label": c.name,
    // Shop tiles breathe: a tiny idle every ~5s, staggered per tile so the
    // crew never moves in lockstep. Everywhere else the art stands still.
    class: `creature${opts.idle !== undefined ? ` idle idle-${c.silhouette} idle-id-${c.id}` : ""}${opts.fastIdle === true ? " idle-fast" : ""}`,
    ...(opts.idle !== undefined ? { style: `--idle-delay:${opts.idle.toFixed(2)}s` } : {}),
  });

  if (lvl >= 10) {
    root.append(svg("ellipse", { cx: 100, cy: 108, rx: 116, ry: 106, fill: "#B6FF3C", opacity: 0.13 }));
    root.append(svg("ellipse", { cx: 100, cy: 108, rx: 98, ry: 90, fill: "#B6FF3C", opacity: 0.11 }));
  }

  root.append(...tail(c, plan));
  if (plan.wings !== undefined) {
    const w = poly(plan.wings, c.palette[2], SW);
    w.classList.add("wings");
    root.append(w);
  }
  root.append(...crest(c, plan));
  for (const l of plan.legs) root.append(poly(l, body));
  root.append(poly(plan.body, body, SW + 2));
  // A highlight shape rather than a gradient: sticker art has no shading.
  root.append(svg("path", {
    d: `M${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 16} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 12} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 26} L${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 32} Z`,
    fill: glow, opacity: 0.5,
  }));
  root.append(poly(plan.head, body, SW + 1));
  if (lvl >= 2) {
    // The deck-sticker star, planted on the flank.
    const sx = plan.spine[1]?.[0] ?? 70;
    const sy = (plan.spine[1]?.[1] ?? 110) + 34;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 13 : 5.5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      return `${sx + Math.cos(a) * r},${sy + Math.sin(a) * r}`;
    }).join(" ");
    root.append(svg("polygon", { points: pts, fill: c.palette[2], stroke: INK, "stroke-width": 3 }));
  }

  root.append(...horns(c, plan, lvl >= 7));
  root.append(...face(c, plan, lvl >= 4));

  // Dragons breathe on their idle beat, and EACH BREATHES ITS OWN ELEMENT
  // (Andy 2026-09-01): ember fire, ice shards, leaf-spray, void wisps, frost
  // crystals, gold sparkles. Same clock, different weather.
  if (opts.idle !== undefined && c.silhouette === "dragon") {
    const f = plan.face;
    const fx = f.x + 60 * f.scale;
    const fy = f.y + 30 * f.scale;
    // Bigger, and angled down-range like a real breath, not a whisper.
    const flame = svg("g", { class: "flame", transform: `translate(${fx} ${fy}) rotate(40) scale(1.6)` });
    const jag = (d: string, fill: string): SVGElement =>
      svg("path", { d, fill, stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" });
    switch (c.id) {
      case "tidalwyrm": // ice water: sharp shards and a droplet spray
        flame.append(jag("M2 0 L26 -10 L18 0 L34 -2 L24 6 L30 14 L2 10 Z", "#35E6FF"));
        flame.append(svg("circle", { cx: 30, cy: -12, r: 3.5, fill: "#C8DDFF", stroke: INK, "stroke-width": 2 }));
        flame.append(svg("circle", { cx: 36, cy: 8, r: 2.8, fill: "#FFFFFF", stroke: INK, "stroke-width": 2 }));
        break;
      case "mosswing": // a spray of leaves
        flame.append(jag("M2 2 L18 -6 Q26 -10 24 -2 Q32 -6 30 4 Q38 2 32 10 L4 10 Z", "#4FC24F"));
        flame.append(svg("ellipse", { cx: 30, cy: -10, rx: 5, ry: 3, fill: "#D8F7C8", stroke: INK, "stroke-width": 2, transform: "rotate(-24 30 -10)" }));
        flame.append(svg("ellipse", { cx: 36, cy: 6, rx: 4.4, ry: 2.6, fill: "#8FE08F", stroke: INK, "stroke-width": 2, transform: "rotate(18 36 6)" }));
        break;
      case "nightwyrm": // void wisps and two small stars
        flame.append(jag("M2 2 Q16 -8 22 0 Q34 -6 30 6 Q38 10 26 12 Q12 14 2 8 Z", "#6B4BD6"));
        flame.append(svg("path", { d: "M32 -10 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z", fill: "#D9CCFF", stroke: INK, "stroke-width": 1.6 }));
        flame.append(svg("path", { d: "M38 8 l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 l3 -1.5 Z", fill: "#FFFFFF", stroke: INK, "stroke-width": 1.4 }));
        break;
      case "glacierwing": // a frost crystal burst
        flame.append(jag("M2 0 L20 -4 L26 -14 L30 -4 L42 0 L30 4 L26 14 L20 6 Z", "#CFEFFF"));
        flame.append(svg("path", { d: "M14 -8 L18 0 L14 8 M34 -8 L30 0 L34 8", fill: "none", stroke: "#FFFFFF", "stroke-width": 2.4, "stroke-linecap": "round" }));
        break;
      case "gildedwyrm": // pure treasure: three four-point sparkles
        for (const [sx, sy, r] of [[10, 0, 9], [26, -8, 6], [32, 8, 7]] as const) {
          flame.append(svg("path", {
            d: `M${sx} ${sy - r} L${sx + r * 0.32} ${sy - r * 0.32} L${sx + r} ${sy} L${sx + r * 0.32} ${sy + r * 0.32} L${sx} ${sy + r} L${sx - r * 0.32} ${sy + r * 0.32} L${sx - r} ${sy} L${sx - r * 0.32} ${sy - r * 0.32} Z`,
            fill: "#FFE14D", stroke: INK, "stroke-width": 2,
          }));
        }
        break;
      default: // cinderwyrm: the classic ember fire
        flame.append(jag("M2 0 L30 -8 L20 2 L34 6 L18 10 L26 18 L2 10 Z", "#FF8A1F"));
        flame.append(svg("path", { d: "M4 2 L20 -2 L14 4 L22 8 L6 8 Z", fill: "#FFE14D" }));
    }
    root.append(flame);
  }

  // PUCKJAW takes a BIG SLAPPER: stick winds up and swings, the puck
  // rockets off low and fast, and the impact star pops at contact.
  if (opts.idle !== undefined && c.id === "puckjaw") {
    const shot = svg("g", { class: "puck-shot", transform: "translate(168 150)" });
    const stick = svg("g", { class: "stick" });
    stick.append(svg("path", { d: "M0 -34 L10 26", fill: "none", stroke: "#C98A3A", "stroke-width": 7, "stroke-linecap": "round" }));
    stick.append(svg("path", { d: "M10 26 L30 32", fill: "none", stroke: INK, "stroke-width": 9, "stroke-linecap": "round" }));
    shot.append(stick);
    shot.append(svg("path", { class: "smack", d: "M30 22 l6 -10 l2 10 l10 -4 l-6 9 l9 4 l-11 2 z", fill: "#FFE14D", stroke: INK, "stroke-width": 2.4 }));
    const puck = svg("g", { class: "puck" });
    puck.append(svg("ellipse", { cx: 0, cy: 0, rx: 9, ry: 5.2, fill: INK, stroke: "#E4F2FC", "stroke-width": 2.6 }));
    puck.append(svg("path", { d: "M-14 -4 L-30 -7 M-13 3 L-26 6", fill: "none", stroke: "#8FB7D6", "stroke-width": 2.6, "stroke-linecap": "round" }));
    puck.setAttribute("transform", "translate(32 30)");
    shot.append(puck);
    const goal = svg("g", { class: "goal", transform: "translate(96 6)" });
    goal.append(svg("path", { d: "M0 44 L0 6 L30 6 L30 44", fill: "none", stroke: "#D33A3A", "stroke-width": 5, "stroke-linecap": "round" }));
    goal.append(svg("path", { d: "M4 14 L26 14 M4 24 L26 24 M4 34 L26 34 M10 8 L10 42 M20 8 L20 42", fill: "none", stroke: "#E4F2FC", "stroke-width": 1.8, opacity: 0.85 }));
    shot.append(goal);
    root.append(shot);
  }

  // GRINDJAW grinds a log in his jaw until it SNAPS in half.
  if (opts.idle !== undefined && c.id === "grindjaw") {
    const rig = svg("g", { class: "logrig", transform: "translate(150 122)" });
    const half = (cls: string, dir: number): SVGElement => {
      const g = svg("g", { class: cls });
      g.append(svg("rect", { x: dir < 0 ? -44 : 2, y: -8, width: 42, height: 16, rx: 7, fill: "#8B5A2B", stroke: INK, "stroke-width": 4 }));
      g.append(svg("ellipse", { cx: dir < 0 ? -44 : 44, cy: 0, rx: 4.5, ry: 8, fill: "#C98A3A", stroke: INK, "stroke-width": 3 }));
      return g;
    };
    rig.append(half("log-l", -1), half("log-r", 1));
    rig.append(svg("path", { class: "grind-sparks", d: "M-4 -12 l3 -7 M2 -13 l4 -6 M8 -11 l2 -8", fill: "none", stroke: "#FFE14D", "stroke-width": 3, "stroke-linecap": "round" }));
    root.append(rig);
  }

  // VOLTMAW crackles: lightning arcs over the body while it leaps.
  if (opts.idle !== undefined && c.id === "voltmaw") {
    const arcs = svg("g", { class: "voltrig" });
    arcs.append(svg("path", { class: "bolt bolt-a", d: "M56 84 l12 -14 l-4 12 l14 -10 l-6 16", fill: "none", stroke: "#35E6FF", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    arcs.append(svg("path", { class: "bolt bolt-b", d: "M120 70 l10 -16 l-2 12 l12 -8 l-8 18", fill: "none", stroke: "#D6FBFF", "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    arcs.append(svg("path", { class: "bolt bolt-a", d: "M78 140 l-12 10 l10 -2 l-12 12", fill: "none", stroke: "#35E6FF", "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    root.append(arcs);
  }

  // MAGMASPYNE stands in his own lava pool; bubbles pop as he stomps.
  if (opts.idle !== undefined && c.id === "magmaspyne") {
    const pool = svg("g", { class: "lavarig" });
    pool.append(svg("ellipse", { class: "lava", cx: 100, cy: 186, rx: 82, ry: 13, fill: "#FF5A2A", stroke: "#3A0000", "stroke-width": 5 }));
    pool.append(svg("ellipse", { cx: 100, cy: 186, rx: 58, ry: 8, fill: "#FF8A1F", opacity: 0.85 }));
    for (const [bx, d] of [[66, 0], [104, 1], [138, 2]] as const) {
      pool.append(svg("circle", { class: `bubble bubble-${d}`, cx: bx, cy: 186, r: 5, fill: "#FFE14D", stroke: "#3A0000", "stroke-width": 2.5 }));
    }
    root.append(pool);
  }

  // GLACIODON rides a sailing ice floe under his jump.
  if (opts.idle !== undefined && c.id === "glaciodon") {
    const floe = svg("g", { class: "floe" });
    floe.append(svg("path", { d: "M30 184 L52 176 L96 178 L142 174 L172 182 L164 194 L44 194 Z", fill: "#CFEFFF", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
    floe.append(svg("path", { d: "M60 182 L84 180 M116 180 L142 179", fill: "none", stroke: "#FFFFFF", "stroke-width": 2.6, "stroke-linecap": "round" }));
    root.append(floe);
  }

  // BLADEBACK's idle is a speed burst: hot streaks trail the lean.
  if (opts.idle !== undefined && c.id === "bladeback") {
    const dash = svg("g", { class: "dash" });
    dash.append(svg("path", { d: "M52 110 L10 104 M58 130 L4 128 M52 148 L14 152", fill: "none", stroke: "#FF3D8B", "stroke-width": 5, "stroke-linecap": "round" }));
    root.append(dash);
  }

  if (opts.helmet) {
    const f = plan.face;
    const g = svg("g", { class: "helm", transform: `translate(${f.x + 20 * f.scale} ${f.y - 12 * f.scale}) scale(${f.scale})` });
    for (const pth of helmetPaths(opts.helmet.shape, opts.helmet.colors[0], opts.helmet.colors[1])) g.append(pth);
    root.append(g);
  }
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

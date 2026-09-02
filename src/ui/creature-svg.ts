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
 * FORMS, not palette swaps. The dragons came first (Andy 2026-09-01): each
 * overrides the base wings at minimum, and most reshape body and head too:
 * bat-winged ember, fin-winged sea serpent, leaf-winged glider, swept-wing
 * night hunter, crystal-winged glacier, high-winged regal gold.
 *
 * Then the rest of the company (alpha): the brutes, plated, raptors, horned,
 * serpents and titans each shared one body plan, so at tile size GRINDJAW,
 * PUCKJAW and GLACIODON read as the same animal in three colours. Every
 * monster that shared a plan with another now has its own mass: a humped
 * mammoth, a squat board-checker, a chiselled slab, a low spined crawler, a
 * blocky scrap-heap, a long low speedster, a raised-neck charger, a tighter
 * coil, a taller leaner titan. The probe asserts no two bodies match.
 */
const VARIANTS: Record<string, Partial<Plan>> = {
  // the brutes: GRINDJAW keeps the base plan
  glaciodon: {
    body: "M24 160 L28 118 L48 84 L92 66 L136 78 L166 110 L176 160 Z",
    head: "M144 100 L194 92 L200 120 L184 134 L144 130 Z",
    face: { x: 154, y: 104, scale: 1 },
    legs: ["M48 152 L40 186 L76 186 L76 152 Z", "M120 152 L114 186 L152 186 L148 152 Z"],
    spine: [[38, 124], [62, 90], [98, 68], [138, 82]],
  },
  puckjaw: {
    body: "M18 160 L22 118 L44 100 L100 92 L156 100 L178 118 L182 160 Z",
    head: "M148 98 L200 92 L202 128 L186 136 L148 132 Z",
    face: { x: 156, y: 104, scale: 1.05 },
    legs: ["M40 152 L34 184 L72 184 L72 152 Z", "M128 152 L124 184 L162 184 L160 152 Z"],
    spine: [[34, 126], [60, 104], [100, 92], [146, 100]],
  },
  // the plated: MAGMASPYNE low and long, QUARRYBACK a chiselled slab
  quarryback: {
    body: "M20 160 L26 118 L60 92 L124 88 L164 108 L180 160 Z",
    head: "M152 104 L200 94 L202 126 L188 140 L152 136 Z",
    face: { x: 160, y: 110, scale: 0.92 },
    legs: ["M42 154 L36 184 L70 184 L70 154 Z", "M126 154 L122 184 L156 184 L152 154 Z"],
    spine: [[34, 124], [64, 94], [110, 88], [150, 106]],
  },
  magmaspyne: {
    body: "M14 160 L24 130 L60 112 L120 104 L160 118 L182 160 Z",
    head: "M154 112 L200 104 L202 130 L186 142 L154 138 Z",
    face: { x: 160, y: 116, scale: 0.88 },
    spine: [[30, 132], [64, 110], [110, 104], [148, 116]],
  },
  // the raptors: VOLTMAW keeps the base plan
  rustfang: {
    body: "M40 140 L50 96 L86 74 L126 76 L148 98 L144 134 L100 152 L58 150 Z",
    head: "M130 80 L192 70 L198 96 L182 110 L134 110 Z",
    face: { x: 146, y: 82, scale: 0.98 },
    legs: ["M66 144 L54 186 L88 186 L92 144 Z", "M114 144 L110 186 L140 186 L134 144 Z"],
  },
  bladeback: {
    body: "M30 138 L52 104 L94 86 L138 88 L158 104 L150 132 L104 146 L52 146 Z",
    head: "M138 86 L196 74 L202 90 L186 104 L140 106 Z",
    face: { x: 150, y: 84, scale: 0.9 },
    legs: ["M66 140 L56 184 L82 184 L88 140 Z", "M114 140 L110 184 L136 184 L130 140 Z"],
    spine: [[44, 118], [74, 96], [110, 86], [138, 92]],
  },
  // the horned: SKATHORN keeps the base plan, EMBERCLAW raises its neck
  emberclaw: {
    body: "M30 158 L40 118 L70 96 L110 90 L136 108 L156 158 Z",
    head: "M116 78 L184 62 L200 92 L186 120 L124 124 Z",
    face: { x: 140, y: 84, scale: 1.15 },
    spine: [[42, 124], [70, 98], [104, 90], [126, 100]],
  },
  // the serpents: TIDEWRECK keeps the base plan, NIGHTCOIL coils tighter
  nightcoil: {
    body: "M16 156 L22 130 L44 118 L70 120 L86 102 L74 78 L94 62 L128 64 L150 86 L142 112 L118 124 L90 134 L58 156 Z",
    head: "M124 56 L186 46 L198 66 L180 80 L130 82 Z",
    face: { x: 140, y: 58, scale: 0.92 },
    spine: [[28, 132], [64, 118], [90, 88], [122, 62]],
  },
  // the titans: STORMHIDE keeps the base plan, VOIDCREST stands taller
  voidcrest: {
    body: "M56 176 L54 104 L74 60 L112 46 L146 70 L152 126 L144 176 Z",
    head: "M124 50 L188 34 L200 62 L182 84 L128 86 Z",
    face: { x: 142, y: 52, scale: 1.05 },
    spine: [[58, 140], [62, 90], [88, 56], [124, 52]],
  },
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
  // Kallen's VOIDWYRM: nebula-torn wings and a sleek raised head; the body
  // carries its own stars.
  voidwyrm: {
    wings: "M64 96 L18 30 L46 58 L40 10 L74 48 L86 6 L108 46 L134 16 L142 60 L150 40 L144 90 Z",
    head: "M130 70 L188 52 L200 78 L182 94 L134 96 Z",
    face: { x: 145, y: 61, scale: 1 },
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
  const plan: Plan = { ...PLANS[c.silhouette], ...(VARIANTS[c.id] ?? {}) };
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
  const mass = poly(plan.body, body, SW + 2);
  mass.classList.add("body");
  root.append(mass);
  // A highlight shape rather than a gradient: sticker art has no shading.
  root.append(svg("path", {
    d: `M${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 16} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 12} L${plan.spine[2]?.[0] ?? 100} ${(plan.spine[2]?.[1] ?? 90) + 26} L${plan.spine[1]?.[0] ?? 60} ${(plan.spine[1]?.[1] ?? 100) + 32} Z`,
    fill: glow, opacity: 0.5,
  }));
  if (c.id === "voidwyrm") {
    // The starfield is the hide: white and starlight-blue glints over the
    // deep violet, so he reads cosmic even standing still.
    for (const [sx2, sy2, r2] of [[72, 118, 2], [94, 106, 1.6], [114, 128, 2.2], [134, 110, 1.6], [86, 140, 1.8], [124, 142, 1.5], [103, 117, 1.4]] as const) {
      root.append(svg("circle", { cx: sx2, cy: sy2, r: r2, fill: sx2 % 2 === 0 ? "#FFFFFF" : "#9DB8FF", opacity: 0.9 }));
    }
    for (const [gx, gy, gs] of [[80, 128, 5], [120, 118, 6]] as const) {
      root.append(svg("path", {
        d: `M${gx} ${gy - gs} L${gx + gs * 0.3} ${gy - gs * 0.3} L${gx + gs} ${gy} L${gx + gs * 0.3} ${gy + gs * 0.3} L${gx} ${gy + gs} L${gx - gs * 0.3} ${gy + gs * 0.3} L${gx - gs} ${gy} L${gx - gs * 0.3} ${gy - gs * 0.3} Z`,
        fill: "#C9A6FF", opacity: 0.95,
      }));
    }
  }

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

  // VOIDWYRM performs on his own patch of COSMOS: a deep-space halo that
  // fades in for the act, stars twinkling in alternation, one comet.
  if (opts.idle !== undefined && c.id === "voidwyrm") {
    const cosmos = svg("g", { class: "cosmos" });
    cosmos.append(svg("ellipse", { cx: 100, cy: 104, rx: 114, ry: 98, fill: "#0A0620", opacity: 0.85 }));
    const starGroup = (cls: string, pts: ReadonlyArray<readonly [number, number, number, string]>): SVGElement => {
      const g2 = svg("g", { class: cls });
      for (const [x, y, r, col] of pts) g2.append(svg("circle", { cx: x, cy: y, r, fill: col }));
      return g2;
    };
    cosmos.append(starGroup("cstars-a", [[24, 44, 2, "#FFFFFF"], [176, 30, 1.6, "#9DB8FF"], [40, 150, 1.8, "#C9A6FF"], [188, 130, 2.2, "#FFFFFF"], [66, 22, 1.4, "#9DB8FF"]]));
    cosmos.append(starGroup("cstars-b", [[150, 16, 2, "#C9A6FF"], [12, 100, 1.7, "#FFFFFF"], [196, 78, 1.5, "#9DB8FF"], [90, 12, 1.8, "#FFFFFF"], [168, 168, 1.9, "#C9A6FF"]]));
    cosmos.append(svg("path", { class: "comet", d: "M30 60 L58 74", stroke: "#FFFFFF", "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.9 }));
    root.prepend(cosmos);
  }

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
      case "voidwyrm": { // cosmos stardust: a cone of glints and dust
        flame.append(svg("path", { d: "M2 2 L34 -12 L46 0 L38 12 L4 10 Z", fill: "#9DB8FF", opacity: 0.28 }));
        const star = (sx3: number, sy3: number, r3: number, col: string): SVGElement => svg("path", {
          d: `M${sx3} ${sy3 - r3} L${sx3 + r3 * 0.32} ${sy3 - r3 * 0.32} L${sx3 + r3} ${sy3} L${sx3 + r3 * 0.32} ${sy3 + r3 * 0.32} L${sx3} ${sy3 + r3} L${sx3 - r3 * 0.32} ${sy3 + r3 * 0.32} L${sx3 - r3} ${sy3} L${sx3 - r3 * 0.32} ${sy3 - r3 * 0.32} Z`,
          fill: col, stroke: INK, "stroke-width": 1.4,
        });
        flame.append(star(14, -2, 8, "#FFFFFF"));
        flame.append(star(30, -8, 6, "#C9A6FF"));
        flame.append(star(36, 6, 5, "#9DB8FF"));
        flame.append(svg("circle", { cx: 24, cy: 8, r: 2, fill: "#FFFFFF" }));
        flame.append(svg("circle", { cx: 42, cy: -4, r: 1.7, fill: "#C9A6FF" }));
        break;
      }
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

  // MAGMASPYNE stands in his own lava pool. The pool has DEPTH at rest,
  // permanent half-risen bubbles breaking the surface, and during his act it
  // comes to a rolling boil (Andy: "not just a red puddle").
  if (opts.idle !== undefined && c.id === "magmaspyne") {
    const pool = svg("g", { class: "lavarig" });
    pool.append(svg("ellipse", { class: "lava", cx: 100, cy: 186, rx: 82, ry: 13, fill: "#FF5A2A", stroke: "#3A0000", "stroke-width": 5 }));
    pool.append(svg("ellipse", { cx: 100, cy: 186, rx: 58, ry: 8, fill: "#FF8A1F", opacity: 0.85 }));
    // The standing depth: domes mid-surfacing and one dark blister.
    const depth = svg("g", { class: "lava-depth" });
    depth.append(svg("path", { d: "M58 187 a7 5 0 0 1 14 0 Z", fill: "#FFB25A", stroke: "#3A0000", "stroke-width": 2.5 }));
    depth.append(svg("path", { d: "M116 189 a5.5 4 0 0 1 11 0 Z", fill: "#FF8A1F", stroke: "#3A0000", "stroke-width": 2.2 }));
    depth.append(svg("path", { d: "M143 185 a4.5 3.4 0 0 1 9 0 Z", fill: "#FFE14D", stroke: "#3A0000", "stroke-width": 2 }));
    depth.append(svg("circle", { cx: 87, cy: 190, r: 3.2, fill: "#B33A0E", stroke: "#3A0000", "stroke-width": 1.8 }));
    pool.append(depth);
    // The boil: six poppers on tight staggers.
    for (const [bx, d] of [[66, 0], [104, 1], [138, 2], [80, 3], [122, 4], [95, 5]] as const) {
      pool.append(svg("circle", { class: `bubble bubble-${d}`, cx: bx, cy: 186, r: d % 2 === 0 ? 5 : 3.8, fill: "#FFE14D", stroke: "#3A0000", "stroke-width": 2.5 }));
    }
    root.append(pool);
  }

  // QUARRYBACK stomps and BOULDERS FALL FROM THE SKY (Andy's spec).
  if (opts.idle !== undefined && c.id === "quarryback") {
    const rig = svg("g", { class: "rockfall" });
    const rock = (cls: string, x: number, sc: number, fill: string): void => {
      const g2 = svg("g", { class: cls, transform: `translate(${x} -30) scale(${sc})` });
      g2.append(svg("path", { d: "M-11 4 L-7 -8 L4 -11 L12 -3 L9 8 L-3 11 Z", fill, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      rig.append(g2);
    };
    rock("rock-1", 52, 1, "#9AA6B2");
    rock("rock-2", 106, 1.35, "#7A8794");
    rock("rock-3", 152, 0.9, "#B5C0CB");
    for (const [dx2, dcls] of [[52, "dust-1"], [106, "dust-2"], [152, "dust-3"]] as const) {
      const d2 = svg("g", { class: dcls });
      d2.append(svg("circle", { cx: dx2 - 10, cy: 182, r: 4, fill: "#8A97A6", opacity: 0.8 }));
      d2.append(svg("circle", { cx: dx2 + 9, cy: 184, r: 3.2, fill: "#B5C0CB", opacity: 0.8 }));
      rig.append(d2);
    }
    root.append(rig);
  }

  // STORMHIDE: a storm cloud forms over his head, rains, then throws a bolt.
  if (opts.idle !== undefined && c.id === "stormhide") {
    const rig = svg("g", { class: "stormrig" });
    const cloud = svg("g", { class: "scloud" });
    cloud.append(svg("path", {
      d: "M96 22 a13 13 0 0 1 24 -8 a14 14 0 0 1 26 2 a11 11 0 0 1 14 12 q0 8 -10 8 L104 36 q-10 0 -8 -14 Z",
      fill: "#4A5866", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round",
    }));
    rig.append(cloud);
    const rain = svg("g", { class: "srain" });
    for (const rx2 of [104, 118, 132, 148]) {
      rain.append(svg("line", { x1: rx2, y1: 42, x2: rx2 - 3, y2: 52, stroke: "#8FB7D6", "stroke-width": 3, "stroke-linecap": "round" }));
    }
    rig.append(rain);
    const bolt = svg("g", { class: "sbolt" });
    bolt.append(svg("path", { d: "M128 36 L118 58 L127 56 L114 84 L136 60 L126 62 L138 40 Z", fill: "#FFE14D", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
    rig.append(bolt);
    root.append(rig);
  }

  // NIGHTCOIL vanishes, and while you cannot see him, the trophy MOVES.
  if (opts.idle !== undefined && c.id === "nightcoil") {
    const trophy = svg("g", { class: "trophy", transform: "translate(38 168)" });
    trophy.append(svg("path", { d: "M-8 -14 L8 -14 L6 -2 Q0 4 -6 -2 Z", fill: "#F5C542", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
    trophy.append(svg("path", { d: "M-4 2 L4 2 L6 8 L-6 8 Z", fill: "#C9971E", stroke: INK, "stroke-width": 2.6 }));
    root.append(trophy);
  }

  // SKATHORN's frill IS a deck, so a deck appears and flips over it.
  if (opts.idle !== undefined && c.id === "skathorn") {
    const deckp = svg("g", { class: "deckprop", transform: "translate(150 26)" });
    deckp.append(svg("path", { d: "M-24 -4 C-30 -4 -30 4 -24 4 L24 4 C30 4 30 -4 24 -4 Z", fill: "#B6FF3C", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
    deckp.append(svg("circle", { cx: -14, cy: 8, r: 4, fill: INK }));
    deckp.append(svg("circle", { cx: 14, cy: 8, r: 4, fill: INK }));
    root.append(deckp);
  }

  // TIDEWRECK: a wave washes through, carrying a drowned mast.
  if (opts.idle !== undefined && c.id === "tidewreck") {
    const rig = svg("g", { class: "waverig" });
    const wave = svg("g", { class: "wave" });
    wave.append(svg("path", {
      d: "M8 196 Q34 172 62 188 Q66 176 80 180 Q104 164 132 186 Q138 172 152 178 Q176 168 196 190 L196 200 L8 200 Z",
      fill: "#2FA8FF", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round", opacity: 0.95,
    }));
    wave.append(svg("path", { d: "M30 182 q6 -6 12 0 M96 176 q6 -6 12 0 M158 176 q6 -6 12 0", fill: "none", stroke: "#CBE9FF", "stroke-width": 3, "stroke-linecap": "round" }));
    wave.append(svg("path", { d: "M120 182 L132 152 L136 154 L127 182 Z M130 160 L144 166 L131 170 Z", fill: "#8B5A2B", stroke: INK, "stroke-width": 2.6, "stroke-linejoin": "round" }));
    rig.append(wave);
    root.append(rig);
  }

  // RUSTFANG shakes himself and the scrapyard falls off: nuts, a bolt, a gear.
  if (opts.idle !== undefined && c.id === "rustfang") {
    const rig = svg("g", { class: "scraprig" });
    const nut = (cls: string, x: number, y: number): void => {
      const g2 = svg("g", { class: cls, transform: `translate(${x} ${y})` });
      g2.append(svg("path", { d: "M-6 -3 L0 -7 L6 -3 L6 3 L0 7 L-6 3 Z", fill: "#C98A3A", stroke: INK, "stroke-width": 2.6, "stroke-linejoin": "round" }));
      g2.append(svg("circle", { cx: 0, cy: 0, r: 2.2, fill: INK }));
      rig.append(g2);
    };
    nut("scrap-1", 70, 96);
    nut("scrap-2", 112, 88);
    const gear = svg("g", { class: "scrap-gear", transform: "translate(58 150)" });
    gear.append(svg("circle", { cx: 0, cy: 0, r: 9, fill: "#8A97A6", stroke: INK, "stroke-width": 3 }));
    for (let i = 0; i < 8; i++) {
      const a2 = (i / 8) * Math.PI * 2;
      gear.append(svg("rect", { x: Math.cos(a2) * 10 - 2, y: Math.sin(a2) * 10 - 2, width: 4, height: 4, fill: "#8A97A6", stroke: INK, "stroke-width": 1.6 }));
    }
    gear.append(svg("circle", { cx: 0, cy: 0, r: 3, fill: INK }));
    rig.append(gear);
    root.append(rig);
  }

  // EMBERCLAW's charge burns a scorch mark in, embers rising off it.
  if (opts.idle !== undefined && c.id === "emberclaw") {
    const rig = svg("g", { class: "scorchrig" });
    rig.append(svg("path", { class: "scorch", d: "M52 186 Q100 174 158 184", fill: "none", stroke: "#FF6A00", "stroke-width": 7, "stroke-linecap": "round" }));
    rig.append(svg("path", { class: "scorch2", d: "M60 190 Q104 180 150 188", fill: "none", stroke: "#FFD79E", "stroke-width": 3, "stroke-linecap": "round" }));
    for (const [ex, dcls] of [[76, "ember-1"], [108, "ember-2"], [138, "ember-3"]] as const) {
      rig.append(svg("circle", { class: dcls, cx: ex, cy: 182, r: 3, fill: "#FFE14D", stroke: "#3A0E00", "stroke-width": 1.6 }));
    }
    root.append(rig);
  }

  // VOIDCREST: a rift tears open beside him and takes a little light with it.
  if (opts.idle !== undefined && c.id === "voidcrest") {
    const rig = svg("g", { class: "riftrig" });
    const rift = svg("g", { class: "rift", transform: "translate(28 96)" });
    rift.append(svg("ellipse", { cx: 0, cy: 0, rx: 9, ry: 34, fill: "#05070A", stroke: "#FF3D8B", "stroke-width": 4 }));
    rift.append(svg("ellipse", { cx: 0, cy: 0, rx: 3.5, ry: 22, fill: "#2A0016" }));
    rig.append(rift);
    for (const [sx4, sy4, dcls] of [[54, 74, "riftstar-1"], [58, 122, "riftstar-2"]] as const) {
      rig.append(svg("path", {
        class: dcls,
        d: `M${sx4} ${sy4 - 5} L${sx4 + 1.6} ${sy4 - 1.6} L${sx4 + 5} ${sy4} L${sx4 + 1.6} ${sy4 + 1.6} L${sx4} ${sy4 + 5} L${sx4 - 1.6} ${sy4 + 1.6} L${sx4 - 5} ${sy4} L${sx4 - 1.6} ${sy4 - 1.6} Z`,
        fill: "#FFD6E7", stroke: INK, "stroke-width": 1.4,
      }));
    }
    root.append(rig);
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

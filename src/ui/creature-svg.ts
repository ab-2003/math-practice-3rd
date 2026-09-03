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
  /** Arms drawn over the body in the body colour. The kaiju that hold
   *  things (a ball, a snack) have them; everyone else is all shoulder. */
  arms?: string[];
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

  // THE KAIJU SIX (0.18.0). Hybrids, each its own mass.
  // SKYHOOK: the tallest thing in the shop. A narrow tower of a body on
  // stilt legs, one arm up with the ball, the head well under the rim.
  hoops: {
    body: "M74 176 L70 92 L84 44 L116 34 L140 56 L138 108 L128 176 Z",
    head: "M104 20 L154 8 L168 30 L154 50 L108 52 Z",
    face: { x: 116, y: 22, scale: 0.9 },
    legs: ["M78 168 L66 200 L92 200 L96 168 Z", "M114 168 L108 200 L136 200 L132 168 Z"],
    spine: [[72, 150], [76, 90], [92, 50], [120, 36]],
    tailAnchor: [72, 160],
    arms: ["M136 70 L162 44 L176 52 L150 82 Z", "M76 96 L54 130 L64 138 L88 106 Z"],
  },
  // MACHFANG: compact and swept back, built to sit in a cockpit. Broad
  // shoulders, short legs, a head that leans into the wind.
  ace: {
    body: "M40 154 L46 110 L74 86 L120 80 L154 96 L166 124 L160 154 Z",
    head: "M136 74 L192 62 L202 88 L184 104 L138 104 Z",
    face: { x: 150, y: 74, scale: 0.98 },
    legs: ["M58 148 L52 180 L82 180 L84 148 Z", "M120 148 L118 180 L150 180 L146 148 Z"],
    spine: [[50, 130], [70, 92], [112, 80], [148, 92]],
    tailAnchor: [42, 142],
  },
  // MOONHOWL: four legs, a deep chest, a long muzzle raised to the sky, a
  // ruff like a snowdrift.
  wolf: {
    body: "M30 150 L36 112 L62 96 L104 92 L138 100 L160 116 L164 150 Z",
    head: "M138 72 L198 56 L210 80 L192 100 L144 104 Z",
    face: { x: 150, y: 70, scale: 0.92 },
    legs: ["M42 144 L34 184 L56 184 L64 144 Z", "M66 146 L62 184 L84 184 L90 146 Z", "M112 146 L108 184 L130 184 L136 146 Z", "M136 144 L136 184 L158 184 L160 144 Z"],
    spine: [[40, 122], [66, 100], [104, 92], [136, 100]],
    tailAnchor: [32, 140],
  },
  // PANDAMONIUM: round and low, all belly and tail. Short legs, big paws.
  panda: {
    body: "M44 160 L40 120 L62 90 L110 80 L152 94 L168 126 L164 160 Z",
    head: "M118 66 L176 56 L188 82 L170 100 L120 100 Z",
    face: { x: 132, y: 68, scale: 1 },
    legs: ["M56 154 L48 184 L82 184 L84 154 Z", "M118 154 L114 184 L150 184 L148 154 Z"],
    spine: [[46, 130], [66, 96], [110, 82], [150, 96]],
    tailAnchor: [46, 148],
    arms: ["M150 110 L176 122 L172 134 L146 126 Z"],
  },
  // TRIOMAW: a coiled base with three necks. The main head takes the
  // serpent's place; the other two are grown in the renderer.
  hydra: {
    body: "M14 160 L22 126 L50 110 L86 108 L104 92 L118 108 L150 110 L176 128 L184 160 Z",
    head: "M128 52 L184 44 L196 68 L178 84 L132 82 Z",
    face: { x: 142, y: 56, scale: 1 },
    legs: [],
    spine: [[26, 134], [60, 114], [104, 104], [150, 116]],
    tailAnchor: [16, 150],
  },
  // WRECKARM (0.18.3): wolf muzzle, dragon wings, two legs and one enormous
  // fist. Towers over everything but SKYHOOK.
  wrecker: {
    body: "M56 176 L50 106 L72 68 L112 56 L150 74 L160 128 L150 176 Z",
    head: "M124 58 L196 42 L210 64 L192 84 L128 88 Z",
    face: { x: 140, y: 56, scale: 1 },
    legs: ["M66 168 L52 196 L90 196 L92 168 Z", "M118 168 L114 196 L150 196 L142 168 Z"],
    spine: [[56, 140], [60, 94], [90, 64], [126, 58]],
    tailAnchor: [54, 160],
    wings: "M70 92 L28 26 L76 60 L92 18 L112 58 L148 30 L142 88 Z",
    arms: ["M62 104 L36 132 L48 140 L74 114 Z"],
  },
  // PANTHERACLAW (0.18.3): long, low and sleek on four legs, a short round
  // muzzle, ears up, a whip of a tail.
  panther: {
    body: "M28 148 L40 116 L70 104 L120 100 L156 108 L172 124 L168 148 Z",
    head: "M148 90 L200 82 L206 104 L190 118 L150 118 Z",
    face: { x: 158, y: 90, scale: 0.9 },
    legs: ["M40 142 L30 182 L54 182 L62 142 Z", "M62 144 L58 182 L80 182 L86 144 Z", "M118 144 L114 182 L136 182 L142 144 Z", "M144 142 L146 182 L170 182 L168 142 Z"],
    spine: [[38, 124], [70, 104], [118, 100], [152, 108]],
    tailAnchor: [30, 140],
  },
  // KOMODUSTER (0.18.6): the monitor lizard. Longer and lower than
  // anything else, legs splayed wide, a flat wedge of a head held low.
  komodo: {
    body: "M20 150 L30 120 L64 106 L118 102 L152 112 L170 134 L166 150 Z",
    head: "M150 100 L208 96 L214 114 L198 126 L152 126 Z",
    face: { x: 158, y: 100, scale: 0.85 },
    legs: ["M34 144 L16 184 L44 184 L56 144 Z", "M66 146 L60 184 L84 184 L90 146 Z", "M122 146 L118 184 L142 184 L146 146 Z", "M146 144 L156 184 L182 184 L168 144 Z"],
    spine: [[30, 128], [64, 108], [118, 102], [150, 112]],
    tailAnchor: [22, 140],
  },
  // HATTRICK (0.20.0): the striker. A stocky biped with arms out for
  // balance, the back leg planted; the kicking leg is a rig of its own.
  striker: {
    body: "M60 150 L64 96 L84 64 L124 56 L150 74 L152 112 L142 150 Z",
    head: "M118 44 L172 30 L184 54 L170 74 L122 78 Z",
    face: { x: 130, y: 44, scale: 0.9 },
    legs: ["M70 144 L58 190 L86 190 L92 144 Z"],
    spine: [[62, 130], [72, 90], [104, 62], [136, 64]],
    tailAnchor: [60, 136],
    arms: ["M64 96 L34 116 L42 128 L74 110 Z", "M146 88 L178 100 L172 112 L142 102 Z"],
  },
  // SCOOPJAW (0.20.0): the excavator. A cab of a body on treads instead
  // of legs; the boom and bucket are a rig of their own.
  digger: {
    body: "M60 146 L60 90 L84 70 L140 66 L156 84 L156 146 Z",
    head: "M130 60 L192 50 L200 74 L184 92 L136 92 Z",
    face: { x: 144, y: 58, scale: 0.95 },
    legs: [],
    spine: [[62, 120], [70, 84], [112, 68], [146, 78]],
    tailAnchor: [58, 128],
  },
  // NINJAW (0.20.0): lean and quick, up on the toes, arms in a guard. The
  // kicking leg is a rig of its own.
  ninja: {
    body: "M70 148 L74 100 L92 70 L126 62 L148 78 L148 114 L136 148 Z",
    head: "M120 52 L170 38 L182 60 L168 80 L124 84 Z",
    face: { x: 132, y: 50, scale: 0.9 },
    legs: ["M78 142 L66 190 L92 190 L98 142 Z"],
    spine: [[72, 128], [80, 94], [110, 68], [138, 70]],
    tailAnchor: [70, 136],
    arms: ["M78 100 L48 88 L44 100 L76 114 Z", "M144 92 L176 82 L180 94 L146 106 Z"],
  },
  // GRIMSHIELD (0.20.0): the dark knight, broad in plate, planted. The
  // sword arm is a rig of its own; the shield arm is drawn with him.
  knight: {
    body: "M56 152 L58 100 L78 72 L120 60 L154 76 L160 116 L150 152 Z",
    head: "M122 54 L178 40 L192 64 L176 86 L126 90 Z",
    face: { x: 136, y: 54, scale: 1 },
    legs: ["M66 146 L58 190 L90 190 L92 146 Z", "M116 146 L114 190 L146 190 L142 146 Z"],
    spine: [[58, 130], [66, 92], [100, 66], [140, 68]],
    tailAnchor: [56, 138],
    arms: ["M64 104 L36 118 L44 132 L74 118 Z"],
  },
  // CHROMALEON: a long low lizard on wide-set legs, a casque on the head,
  // the tail curling behind.
  chameleon: {
    body: "M40 152 L48 118 L80 100 L128 96 L160 108 L172 132 L168 152 Z",
    head: "M138 78 L196 70 L206 96 L188 112 L142 112 Z",
    face: { x: 152, y: 80, scale: 0.95 },
    legs: ["M52 146 L36 184 L62 184 L74 146 Z", "M132 146 L128 184 L156 184 L160 146 Z"],
    spine: [[50, 128], [80, 102], [124, 96], [156, 106]],
    tailAnchor: [42, 140],
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
  else if (c.tail === "bush") {
    // The wolf's brush: a jagged tuft, light-tipped.
    out.push(poly(`M${tx + 8} ${ty + 10} L${tx - 14} ${ty - 2} L${tx - 8} ${ty - 22} L${tx - 20} ${ty - 34} L${tx + 2} ${ty - 40} L${tx + 14} ${ty - 22} L${tx + 18} ${ty - 6} Z`, body, SW - 1));
    out.push(poly(`M${tx - 8} ${ty - 22} L${tx - 20} ${ty - 34} L${tx + 2} ${ty - 40} L${tx + 6} ${ty - 28} Z`, c.palette[2], 3));
  } else if (c.tail === "curl") {
    // The chameleon's coil: a spiral that reads from across the room.
    out.push(svg("path", { d: `M${tx} ${ty} c-22 -18 -2 -44 18 -30 c12 10 0 26 -10 18 c-6 -6 2 -12 6 -8`, fill: "none", stroke: INK, "stroke-width": 13, "stroke-linecap": "round" }));
    out.push(svg("path", { d: `M${tx} ${ty} c-22 -18 -2 -44 18 -30 c12 10 0 26 -10 18 c-6 -6 2 -12 6 -8`, fill: "none", stroke: accent, "stroke-width": 6, "stroke-linecap": "round" }));
  } else out.push(svg("path", { d: `M${tx} ${ty} L${tx + 14} ${ty - 18} L${tx - 4} ${ty - 30}`, fill: "none", stroke: body, "stroke-width": 7, "stroke-linecap": "round" }));
  return out;
};

/** PANDAMONIUM's ringed tail: its own rig, so it can SPIN. Drawn as a fat
 *  rounded wedge from the anchor up and back, banded in the light colour. */
const ringTail = (c: Creature, plan: Plan): SVGElement => {
  const [body, , light] = c.palette;
  const [ax, ay] = plan.tailAnchor;
  const g = svg("g", { class: "ringtail" });
  g.append(svg("path", { d: `M${ax + 6} ${ay + 8} L${ax - 44} ${ay - 22} Q${ax - 60} ${ay - 34} ${ax - 50} ${ay - 52} Q${ax - 38} ${ay - 66} ${ax - 26} ${ay - 52} L${ax + 10} ${ay - 12} Z`, fill: body, stroke: INK, "stroke-width": SW, "stroke-linejoin": "round" }));
  for (const [t, w] of [[0.25, 9], [0.55, 9], [0.85, 8]] as const) {
    const x1 = ax + 6 - t * 50;
    const y1 = ay + 8 - t * 30;
    const x2 = ax + 10 - t * 36;
    const y2 = ay - 12 - t * 40;
    g.append(svg("line", { x1, y1, x2, y2, stroke: light, "stroke-width": w, "stroke-linecap": "round" }));
  }
  g.append(svg("circle", { class: "spin-blur", cx: ax - 22, cy: ay - 26, r: 40, fill: "none", stroke: light, "stroke-width": 5, "stroke-dasharray": "14 10", opacity: 0 }));
  return g;
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
    case "soccer":
      // The ball as a lid: a dome with the pentagons on it.
      dome(21, 27);
      for (const [px, py, sc] of [[0, -8, 1], [-16, 2, 0.8], [16, 2, 0.8]] as const) {
        out.push(svg("path", { d: `M${px} ${py - 6 * sc} L${px + 6 * sc} ${py - 2 * sc} L${px + 4 * sc} ${py + 5 * sc} L${px - 4 * sc} ${py + 5 * sc} L${px - 6 * sc} ${py - 2 * sc} Z`, fill: accent }));
      }
      break;
    case "basketball":
      // The ball as a lid: the seams over the dome.
      dome(21, 27);
      out.push(svg("path", { d: "M-27 6 A 27 21 0 0 1 27 6 M0 -15 L0 12 M-20 -6 Q0 2 20 -6", fill: "none", stroke: accent, "stroke-width": 2.6 }));
      break;
    case "hockey":
      // The rink lid: a dome with the cage over the face.
      dome(21, 27);
      out.push(svg("path", { d: "M-24 10 L-22 30 L22 30 L24 10", fill: "none", stroke: accent, "stroke-width": 3, "stroke-linejoin": "round" }));
      for (const y of [16, 22]) out.push(svg("path", { d: `M-23 ${y} L23 ${y}`, stroke: accent, "stroke-width": 2 }));
      for (const x of [-12, 0, 12]) out.push(svg("path", { d: `M${x} 10 L${x} 30`, stroke: accent, "stroke-width": 2 }));
      break;
    case "hardhat":
      // The site lid: a high dome, a ridge on top, and the brim.
      out.push(svg("path", { d: "M-24 8 A 24 24 0 0 1 24 8 L 24 12 L -24 12 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M-6 -14 L6 -14 L6 6 L-6 6 Z", fill: shell, stroke: INK, "stroke-width": 3 }));
      out.push(svg("path", { d: "M-34 12 L34 12 L36 18 L-36 18 Z", fill: shell, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M-30 15 L30 15", stroke: accent, "stroke-width": 2, opacity: 0.8 }));
      break;
    case "headband":
      // The ninja's band: a strip around the brow with two tails flying
      // back, and a plate at the front.
      out.push(svg("path", { d: "M-28 2 L28 -2 L28 10 L-28 14 Z", fill: shell, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M-26 6 L-44 -6 L-40 -16 L-30 0 Z M-26 8 L-46 8 L-42 -2 L-28 4 Z", fill: shell, stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
      out.push(svg("rect", { x: -8, y: 0, width: 16, height: 10, rx: 2, fill: accent, stroke: INK, "stroke-width": 2.5 }));
      break;
    case "knight":
      // The great helm: a tall dome, the visor slit, the breaths, a plume.
      out.push(svg("path", { d: "M-26 8 A 26 28 0 0 1 26 8 L 26 26 L -26 26 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("path", { d: "M-20 10 L20 10", stroke: accent, "stroke-width": 4, "stroke-linecap": "round" }));
      out.push(svg("path", { d: "M0 12 L0 24 M-10 16 L-10 22 M10 16 L10 22", stroke: INK, "stroke-width": 2.5, "stroke-linecap": "round" }));
      out.push(svg("path", { d: "M-4 -18 Q-2 -40 18 -34 Q6 -30 8 -20 Z", fill: accent, stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
      break;
    case "pilot":
      // The flight helmet: a deep shell, a tinted visor dropped over the
      // eyes, the oxygen-mask clip at the cheek, a chin strap.
      out.push(svg("path", { d: "M-28 6 A 28 24 0 0 1 28 6 L 28 16 L -28 16 Z", fill: shell, stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
      out.push(svg("path", { class: "visor", d: "M-24 8 L26 8 L22 24 Q0 30 -20 22 Z", fill: accent, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round", opacity: 0.92 }));
      out.push(svg("path", { d: "M-18 12 L14 12", stroke: "#FFFFFF", "stroke-width": 2.4, "stroke-linecap": "round", opacity: 0.7 }));
      out.push(svg("rect", { x: 20, y: 18, width: 12, height: 9, rx: 3, fill: shell, stroke: INK, "stroke-width": 3 }));
      out.push(svg("path", { d: "M-26 16 L-22 30 L20 30", fill: "none", stroke: INK, "stroke-width": 3.5, "stroke-linecap": "round" }));
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

  if (c.tail === "ring") root.append(ringTail(c, plan));
  // KOMODUSTER's tail trails long and LOW, the way a monitor's does; the
  // raised spike every other tail starts from read as an antenna on it.
  else if (c.id === "komoduster") root.append(poly("M30 124 L-2 140 L-12 156 L28 150 Z", body, SW - 1));
  else root.append(...tail(c, plan));
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

  for (const a of plan.arms ?? []) root.append(poly(a, body, SW - 1));
  // The head is one GROUP so an act can move it (TRIOMAW's heads snap).
  const headG = svg("g", { class: "head head-m" });
  headG.append(poly(plan.head, body, SW + 1));
  // PANDAMONIUM wears the red panda's cream mask; the eyes sit on it.
  if (c.id === "pandamonium") headG.append(poly("M132 64 L170 60 L177 82 L164 95 L134 93 Z", c.palette[2], 3));
  // NINJAW's mask: the band over the face, and the eyes narrowed to slits
  // through it. Drawn after the face lands (below), via the head group.
  if (c.id === "ninjaw") {
    headG.dataset["ninja"] = "1";
  }
  // PANTHERACLAW's ears, up, gold inside; and gold claws on every paw.
  if (c.id === "pantheraclaw") {
    headG.append(poly("M154 90 L158 68 L172 86 Z", body, 4));
    headG.append(poly("M178 86 L186 66 L196 84 Z", body, 4));
    headG.append(svg("path", { d: "M159 84 L160 76 L166 83 Z M183 82 L185 74 L190 81 Z", fill: c.palette[2] }));
    for (const px of [52, 78, 134, 168]) {
      root.append(svg("path", { d: `M${px - 6} 182 L${px - 4} 190 L${px - 1} 182 Z M${px} 182 L${px + 2} 191 L${px + 5} 182 Z`, fill: c.palette[2], stroke: INK, "stroke-width": 1.5, "stroke-linejoin": "round" }));
    }
    // A gold tuft on the tail tip, or the black tail is lost on the panel.
    root.append(svg("circle", { cx: 20, cy: 66, r: 6, fill: c.palette[2], stroke: INK, "stroke-width": 3 }));
  }
  // KOMODUSTER's hide: a scatter of darker scales along the flank.
  if (c.id === "komoduster") {
    for (const [sx, sy, r] of [[58, 124, 3], [78, 134, 2.4], [96, 118, 3], [114, 132, 2.6], [132, 120, 2.8], [148, 134, 2.2], [88, 142, 2]] as const) {
      root.append(svg("circle", { cx: sx, cy: sy, r, fill: c.palette[1], opacity: 0.55 }));
    }
  }
  // NINJAW's gi: the wrap across the chest, the belt, and the kicking leg on
  // its own rig. The hood is the head itself; the mask band goes on with
  // the face below, so the eyes come out as a ninja's.
  if (c.id === "ninjaw") {
    root.append(poly("M84 80 L128 68 L142 96 L138 136 L86 140 L76 104 Z", "#3B4252", 4));
    root.append(svg("path", { d: "M92 82 L128 130 M116 72 L84 128", stroke: c.palette[2], "stroke-width": 4, "stroke-linecap": "round", opacity: 0.85 }));
    root.append(poly("M80 126 L140 122 L142 134 L82 138 Z", "#E8483A", 3));
    const leg = svg("g", { class: "ninja-leg" });
    leg.append(poly("M112 142 L108 190 L134 190 L134 142 Z", body, SW - 1));
    leg.append(poly("M106 184 L138 184 L142 196 L104 196 Z", INK, 2));
    root.append(leg);
  }
  // GRIMSHIELD's plate: pauldrons, a crestless shield on the off arm, and
  // the sword arm on its own rig.
  if (c.id === "grimshield") {
    root.append(poly("M70 74 L102 66 L106 84 L74 92 Z", "#5A6272", 4));
    root.append(poly("M116 62 L150 72 L146 90 L114 80 Z", "#5A6272", 4));
    root.append(poly("M24 104 L60 100 L62 132 Q44 150 26 134 Z", "#12141B", 5));
    root.append(svg("path", { d: "M32 108 L54 106 L54 126 Q44 138 34 128 Z", fill: "#3A3F4C", stroke: c.palette[2], "stroke-width": 2 }));
    // The GREATSWORD: two hands on a long grip, a wide blade with a fuller.
    const arm = svg("g", { class: "sword-arm" });
    arm.append(poly("M142 96 L186 104 L184 120 L144 112 Z", body, SW - 1));
    arm.append(svg("path", { d: "M178 112 L250 30", stroke: INK, "stroke-width": 15, "stroke-linecap": "round" }));
    arm.append(svg("path", { d: "M178 112 L250 30", stroke: "#B8C2CF", "stroke-width": 9, "stroke-linecap": "round" }));
    arm.append(svg("path", { d: "M186 104 L244 38", stroke: "#E8EEF6", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.8 }));
    arm.append(svg("path", { d: "M170 104 L196 128", stroke: INK, "stroke-width": 9, "stroke-linecap": "round" }));
    arm.append(svg("path", { d: "M170 104 L196 128", stroke: c.palette[2], "stroke-width": 5, "stroke-linecap": "round" }));
    arm.append(svg("circle", { cx: 172, cy: 120, r: 5, fill: c.palette[2], stroke: INK, "stroke-width": 2.5 }));
    root.append(arm);
  }
  // HATTRICK's kit: the number 7 shirt, the long socks, and a kicking leg
  // on its own rig so the act can swing it.
  if (c.id === "hattrick") {
    root.append(poly("M80 78 L126 70 L142 96 L138 136 L84 140 L70 104 Z", "#FFFFFF", 4));
    root.append(svg("text", { x: 110, y: 122, "text-anchor": "middle", "font-size": 40, "font-weight": 900, fill: "#E8483A", stroke: INK, "stroke-width": 1.5 }, "7"));
    const sock = (x0: number, x1: number, x2: number, x3: number): void => {
      root.append(poly(`M${x0} 166 L${x1} 190 L${x2} 190 L${x3} 166 Z`, "#FFFFFF", 3));
      root.append(svg("path", { d: `M${x0 + 1} 172 L${x3 - 1} 172 M${x0 + 2} 179 L${x3 - 2} 179`, stroke: "#E8483A", "stroke-width": 3 }));
    };
    sock(64, 58, 86, 88);
    const leg = svg("g", { class: "kick-leg" });
    leg.append(poly("M112 144 L108 190 L136 190 L134 144 Z", body, SW - 1));
    leg.append(poly("M110 166 L108 190 L136 190 L134 166 Z", "#FFFFFF", 3));
    leg.append(svg("path", { d: "M111 172 L133 172 M110 179 L134 179", stroke: "#E8483A", "stroke-width": 3 }));
    leg.append(poly("M106 184 L140 184 L144 196 L104 196 Z", INK, 2));
    root.append(leg);
  }
  // SCOOPJAW's treads, and its boom and bucket on a rig of their own.
  if (c.id === "scoopjaw") {
    root.append(poly("M40 150 L176 150 L184 170 L176 190 L40 190 L32 170 Z", "#3A4656", SW - 1));
    for (const wx of [52, 80, 108, 136, 164]) root.append(svg("circle", { cx: wx, cy: 170, r: 9, fill: "#8A97A6", stroke: INK, "stroke-width": 3 }));
    root.append(svg("path", { d: "M40 156 L176 156 M40 184 L176 184", stroke: INK, "stroke-width": 2.5, "stroke-dasharray": "6 5" }));
    root.append(svg("path", { d: "M84 78 L134 74 L134 92 L86 96 Z", fill: "#9EE8FF", stroke: INK, "stroke-width": 3, opacity: 0.85 }));
    const boom = svg("g", { class: "boom" });
    boom.append(poly("M150 74 L214 30 L224 42 L160 92 Z", body, SW - 1));
    const bucket = svg("g", { class: "bucket" });
    bucket.append(svg("path", { d: "M218 36 L236 84", stroke: INK, "stroke-width": 12, "stroke-linecap": "round" }));
    bucket.append(svg("path", { d: "M218 36 L236 84", stroke: body, "stroke-width": 6, "stroke-linecap": "round" }));
    bucket.append(poly("M226 84 L252 78 L252 104 L234 110 L224 98 Z", "#8A97A6", 4));
    bucket.append(svg("path", { d: "M236 108 l0 6 M244 106 l0 6 M251 103 l0 6", stroke: INK, "stroke-width": 3, "stroke-linecap": "round" }));
    bucket.append(svg("path", { class: "dirt-load", d: "M228 90 Q238 78 250 86 L250 100 L232 104 Z", fill: "#8B5A2B", stroke: INK, "stroke-width": 2, opacity: 0 }));
    boom.append(bucket);
    root.append(boom);
    root.append(svg("circle", { cx: 152, cy: 82, r: 7, fill: INK }));
  }
  // WRECKARM's fist: its own rig, so the act can wind it up and swing it.
  if (c.id === "wreckarm") {
    const arm = svg("g", { class: "fist-arm" });
    // Carried low at rest, so the fist shows under the jaw; the wind-up
    // lifts it over the head and the punch brings it down on the tower.
    arm.append(poly("M136 106 L184 98 L190 114 L146 128 Z", body, SW - 1));
    arm.append(svg("circle", { cx: 197, cy: 110, r: 16, fill: body, stroke: INK, "stroke-width": SW - 1 }));
    arm.append(svg("path", { d: "M188 100 L192 96 M196 98 L200 93 M204 100 L209 96", fill: "none", stroke: INK, "stroke-width": 3, "stroke-linecap": "round" }));
    root.append(arm); // the head goes on after, so the arm sits behind it
  }
  if (lvl >= 2) {
    // The deck-sticker star, planted on the flank. From level 3 it carries
    // the level number, so every level-up changes something the eye can
    // see. Gold at 7 for the hornless, who have no horns to gild.
    const sx = plan.spine[1]?.[0] ?? 70;
    const sy = (plan.spine[1]?.[1] ?? 110) + 34;
    const r0 = lvl >= 3 ? 16 : 13;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? r0 : r0 * 0.42;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      return `${sx + Math.cos(a) * r},${sy + Math.sin(a) * r}`;
    }).join(" ");
    const star = svg("g", { class: "lvl-star" });
    star.append(svg("polygon", { points: pts, fill: lvl >= 7 && c.horns === 0 ? "#FFD84A" : c.palette[2], stroke: INK, "stroke-width": 3 }));
    if (lvl >= 3) star.append(svg("text", { x: sx, y: sy + 4.5, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: INK, class: "lvl-num" }, String(lvl)));
    root.append(star);
  }

  headG.append(...horns(c, plan, lvl >= 7));
  headG.append(...face(c, plan, lvl >= 4));
  if (headG.dataset["ninja"] === "1") {
    // The mask band sits over the round eyes; two narrow slits look out.
    const f = plan.face;
    headG.append(poly(`M${f.x - 6} ${f.y - 8} L${f.x + 48} ${f.y - 14} L${f.x + 50} ${f.y + 14} L${f.x - 4} ${f.y + 18} Z`, "#12141B", 3));
    for (const ex of [f.x + 8, f.x + 28]) {
      headG.append(svg("path", { d: `M${ex - 8} ${f.y + 4} L${ex + 8} ${f.y + 1}`, stroke: "#D8DEE8", "stroke-width": 5, "stroke-linecap": "round" }));
      headG.append(svg("path", { d: `M${ex - 5} ${f.y + 3.5} L${ex + 5} ${f.y + 1.5}`, stroke: INK, "stroke-width": 2, "stroke-linecap": "round" }));
    }
  }
  root.append(headG);

  // TRIOMAW grows two more heads off the coil, each with its own neck,
  // horn and jaw, drawn behind the main one. Three groups, three snaps.
  if (c.id === "triomaw") {
    const extra = (cls: string, dx: number, dy: number, sc: number, neck: string): void => {
      const outer = svg("g", { transform: `translate(${dx} ${dy}) scale(${sc})` });
      const g = svg("g", { class: `head ${cls}` });
      g.append(svg("path", { d: neck, fill: "none", stroke: INK, "stroke-width": 30, "stroke-linecap": "round" }));
      g.append(svg("path", { d: neck, fill: "none", stroke: body, "stroke-width": 18, "stroke-linecap": "round" }));
      g.append(poly(plan.head, body, SW + 1));
      g.append(...horns(c, plan, lvl >= 7));
      g.append(...face(c, plan, lvl >= 4));
      outer.append(g);
      root.insertBefore(outer, headG);
    };
    extra("head-l", -64, 16, 0.8, "M150 100 Q168 130 190 150");
    extra("head-t", -22, -36, 0.85, "M150 100 Q160 140 170 190");
    const neckM = "M150 92 Q140 120 120 128";
    headG.prepend(svg("path", { d: neckM, fill: "none", stroke: body, "stroke-width": 18, "stroke-linecap": "round" }));
    headG.prepend(svg("path", { d: neckM, fill: "none", stroke: INK, "stroke-width": 30, "stroke-linecap": "round" }));
    for (const [cx, cy, cls] of [[124, 78, "chomp chomp-l"], [206, 82, "chomp chomp-m"], [150, 36, "chomp chomp-t"]] as const) {
      root.append(svg("path", { class: cls, d: `M${cx} ${cy - 9} l3 6 l7 -1 l-4 5 l4 6 l-7 -2 l-3 6 l-3 -6 l-7 2 l4 -6 l-4 -5 l7 1 z`, fill: "#FFE14D", stroke: INK, "stroke-width": 2, opacity: 0 }));
    }
  }

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

  // SKYHOOK shoots hoops: the rim swings in at the top right, the ball
  // leaves the raised hand, arcs, drops through, and the net swishes.
  // The ball is BASKETBALL ORANGE (Andy), seams in ink.
  if (opts.idle !== undefined && c.id === "skyhook") {
    const rig = svg("g", { class: "hoops-rig" });
    const hoop = svg("g", { class: "hoop" });
    hoop.append(svg("rect", { x: 206, y: 2, width: 8, height: 46, rx: 2, fill: "#EDF2F7", stroke: INK, "stroke-width": 3.5 }));
    hoop.append(svg("rect", { x: 182, y: 12, width: 24, height: 18, rx: 2, fill: "none", stroke: "#FF3D3D", "stroke-width": 3 }));
    hoop.append(svg("path", { d: "M172 32 L208 32", stroke: "#FF6A00", "stroke-width": 5, "stroke-linecap": "round" }));
    const net = svg("path", { class: "net", d: "M174 34 L178 56 L202 56 L206 34 M182 34 L184 56 M190 34 L190 56 M198 34 L196 56 M176 44 L204 44", fill: "none", stroke: "#FFFFFF", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.9 });
    hoop.append(net);
    rig.append(hoop);
    const ball = svg("g", { class: "ball" });
    ball.append(svg("circle", { cx: 168, cy: 44, r: 12, fill: "#EE6730", stroke: INK, "stroke-width": 3 }));
    ball.append(svg("path", { d: "M156 44 L180 44 M168 32 L168 56 M159 36 Q168 44 159 52 M177 36 Q168 44 177 52", fill: "none", stroke: INK, "stroke-width": 2 }));
    rig.append(ball);
    root.append(rig);
  }

  // MACHFANG's jet: fuselage and wings behind him, the canopy over him,
  // afterburner lit; then the whole creature (jet and all) rockets off the
  // tile and comes back for another go. The takeoff is the root's idle.
  if (opts.idle !== undefined && c.id === "machfang") {
    const back = svg("g", { class: "jet jet-back" });
    back.append(svg("path", { d: "M8 150 L60 128 L196 124 L232 140 L206 160 L40 164 Z", fill: "#3A4656", stroke: INK, "stroke-width": 5, "stroke-linejoin": "round" }));
    back.append(svg("path", { d: "M12 134 L2 88 L26 92 L54 130 Z", fill: "#55657A", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
    back.append(svg("path", { d: "M92 150 L30 178 L60 178 L130 154 Z", fill: "#55657A", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" }));
    back.append(svg("path", { d: "M176 128 L226 138", stroke: "#FF8A1F", "stroke-width": 3, "stroke-linecap": "round" }));
    const burner = svg("g", { class: "burner" });
    burner.append(svg("path", { d: "M10 148 L-46 152 L-20 158 L-52 164 L8 162 Z", fill: "#FF8A1F", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
    burner.append(svg("path", { d: "M8 152 L-26 155 L-14 158 L-30 161 L6 159 Z", fill: "#FFE14D" }));
    back.append(burner);
    root.prepend(back);
    const front = svg("g", { class: "jet jet-front" });
    front.append(svg("path", { d: "M52 112 Q64 78 120 74 Q160 74 166 108 L166 126 L52 126 Z", fill: "#9EE8FF", stroke: INK, "stroke-width": 4, "stroke-linejoin": "round", opacity: 0.55 }));
    front.append(svg("path", { d: "M64 108 Q80 88 118 84", fill: "none", stroke: "#FFFFFF", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.8 }));
    root.append(front);
  }

  // MOONHOWL: the moon rises, the head tips back (the root's idle), and the
  // howl rings ride out of the muzzle one after another.
  if (opts.idle !== undefined && c.id === "moonhowl") {
    const rig = svg("g", { class: "moonrig" });
    const moon = svg("g", { class: "moon" });
    moon.append(svg("circle", { cx: 36, cy: 34, r: 34, fill: "#9EC7FF", opacity: 0.22 }));
    moon.append(svg("circle", { cx: 36, cy: 34, r: 22, fill: "#FFF8CC", stroke: INK, "stroke-width": 4 }));
    moon.append(svg("circle", { cx: 28, cy: 28, r: 4, fill: "#E6E0B8" }));
    moon.append(svg("circle", { cx: 44, cy: 40, r: 3, fill: "#E6E0B8" }));
    rig.append(moon);
    for (const [k, r] of [[1, 12], [2, 22], [3, 32]] as const) {
      rig.append(svg("path", { class: `howl howl-${k}`, d: `M${206 - r * 0.3} ${58 - r} A ${r} ${r} 0 0 1 ${206 - r * 0.3} ${58 + r}`, fill: "none", stroke: "#9EC7FF", "stroke-width": 4, "stroke-linecap": "round", opacity: 0 }));
    }
    root.append(rig);
  }

  // CHROMALEON: the colour shift is the root's idle (a hue sweep); the
  // tongue zaps a fly off the edge of the tile and the fly is gone.
  if (opts.idle !== undefined && c.id === "chromaleon") {
    const rig = svg("g", { class: "tonguerig" });
    const fly = svg("g", { class: "fly" });
    fly.append(svg("ellipse", { cx: 226, cy: 56, rx: 5, ry: 3.5, fill: INK }));
    fly.append(svg("path", { d: "M222 52 l-4 -6 M230 52 l4 -6", fill: "none", stroke: INK, "stroke-width": 2, "stroke-linecap": "round" }));
    rig.append(fly);
    rig.append(svg("path", { class: "tongue", d: "M198 96 L224 58", fill: "none", stroke: "#FF3D8B", "stroke-width": 6, "stroke-linecap": "round" }));
    root.append(rig);
  }

  // WRECKARM wrecks a skyscraper: the tower rises at the right, the fist
  // winds up and lands, the top storeys tip and fall, debris flies, dust.
  if (opts.idle !== undefined && c.id === "wreckarm") {
    const rig = svg("g", { class: "wreckrig" });
    const tower = svg("g", { class: "tower" });
    const storeys = (cls: string, y: number, h: number): SVGElement => {
      const g2 = svg("g", { class: cls });
      g2.append(svg("rect", { x: 202, y, width: 30, height: h, fill: "#3A4656", stroke: INK, "stroke-width": 3.5 }));
      for (let wy = y + 6; wy < y + h - 6; wy += 11) {
        g2.append(svg("rect", { x: 207, y: wy, width: 6, height: 6, fill: "#FFE14D", opacity: 0.9 }));
        g2.append(svg("rect", { x: 219, y: wy, width: 6, height: 6, fill: wy % 22 === 0 ? "#FFE14D" : "#8FB7D6", opacity: 0.9 }));
      }
      return g2;
    };
    tower.append(storeys("tower-base", 112, 82));
    tower.append(storeys("tower-top", 16, 96));
    tower.append(svg("path", { class: "tower-crack", d: "M202 110 l8 -6 l4 6 l8 -8 l6 6", fill: "none", stroke: INK, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0 }));
    rig.append(tower);
    for (const [k, x, y] of [[1, 214, 60], [2, 222, 40], [3, 208, 84]] as const) {
      rig.append(svg("path", { class: `debris debris-${k}`, d: `M${x - 6} ${y + 4} L${x - 2} ${y - 6} L${x + 6} ${y - 4} L${x + 5} ${y + 5} Z`, fill: "#55657A", stroke: INK, "stroke-width": 2, "stroke-linejoin": "round", opacity: 0 }));
    }
    const dust = svg("g", { class: "dust-w" });
    for (const [dx, r] of [[196, 6], [208, 8], [222, 6], [234, 5]] as const) dust.append(svg("circle", { cx: dx, cy: 190, r, fill: "#8A97A6", opacity: 0.85 }));
    rig.append(dust);
    root.append(rig);
  }

  // PANTHERACLAW slashes: a paw of gold claws sweeps down and three gold
  // marks are left hanging in the air, then fade.
  if (opts.idle !== undefined && c.id === "pantheraclaw") {
    const rig = svg("g", { class: "clawrig" });
    const paw = svg("g", { class: "claw-paw" });
    paw.append(poly("M150 110 L194 116 L192 132 L148 126 Z", body, SW - 2));
    paw.append(svg("circle", { cx: 194, cy: 124, r: 10, fill: body, stroke: INK, "stroke-width": SW - 2 }));
    for (const [dy, len] of [[-8, 26], [0, 30], [8, 26]] as const) {
      paw.append(svg("path", { class: "claw", d: `M200 ${124 + dy - 3} L${200 + len} ${124 + dy + 2} L200 ${124 + dy + 3} Z`, fill: c.palette[2], stroke: INK, "stroke-width": 1.8, "stroke-linejoin": "round" }));
    }
    rig.append(paw);
    for (const [k, x] of [[1, 196], [2, 212], [3, 228]] as const) {
      rig.append(svg("path", { class: `slash slash-${k}`, d: `M${x + 14} 54 L${x - 10} 134`, stroke: c.palette[2], "stroke-width": 5, "stroke-linecap": "round", opacity: 0 }));
    }
    rig.append(svg("path", { class: "slash-spark", d: "M232 60 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z", fill: "#FFFFFF", stroke: INK, "stroke-width": 1.2, opacity: 0 }));
    root.append(rig);
  }

  // KOMODUSTER lunges and FLICKS a forked tongue, twice, out of the jaw;
  // dust kicks up at the feet.
  if (opts.idle !== undefined && c.id === "komoduster") {
    const rig = svg("g", { class: "komodo-rig" });
    const tongue = svg("g", { class: "tongue-fork" });
    tongue.append(svg("path", { d: "M210 127 L238 122", fill: "none", stroke: INK, "stroke-width": 7, "stroke-linecap": "round" }));
    tongue.append(svg("path", { d: "M210 127 L238 122 M236 122 L246 115 M236 122 L246 127", fill: "none", stroke: "#FFD84A", "stroke-width": 3.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    rig.append(tongue);
    const dust = svg("g", { class: "dust-k" });
    for (const [dx, r] of [[24, 5], [44, 6], [160, 5], [182, 6]] as const) dust.append(svg("circle", { cx: dx, cy: 186, r, fill: "#B8B28A", opacity: 0.8 }));
    rig.append(dust);
    root.append(rig);
  }

  // NINJAW's flying kick: the root leaps (its idle), the leg snaps out,
  // and speed lines flash off the foot.
  if (opts.idle !== undefined && c.id === "ninjaw") {
    const rig = svg("g", { class: "kick-rig" });
    rig.append(svg("path", { class: "kick-lines", d: "M170 120 L206 112 M172 132 L214 128 M170 144 L206 146", stroke: c.palette[2], "stroke-width": 4, "stroke-linecap": "round", opacity: 0 }));
    rig.append(svg("path", { class: "kick-pow", d: "M212 126 l4 -10 l2 10 l10 -5 l-6 9 l9 4 l-11 2 l4 9 l-8 -6 l-3 9 l-2 -10 l-9 4 l6 -8 l-9 -4 l10 -2 z", fill: "#FFE14D", stroke: INK, "stroke-width": 2, opacity: 0 }));
    root.append(rig);
  }

  // GRIMSHIELD's sweep: the greatsword raises and comes round, and a
  // SHIMMER TRAIL follows the blade (the power of the sword, Andy): three
  // arcs drawing in behind it, each a beat later and fainter, and glints
  // that hang in the air after.
  if (opts.idle !== undefined && c.id === "grimshield") {
    const rig = svg("g", { class: "slash-rig" });
    rig.append(svg("path", { class: "slash-arc slash-1", d: "M158 -4 Q252 50 228 150", fill: "none", stroke: c.palette[2], "stroke-width": 9, "stroke-linecap": "round", opacity: 0 }));
    rig.append(svg("path", { class: "slash-arc slash-2", d: "M166 10 Q240 58 220 136", fill: "none", stroke: "#E6A6C8", "stroke-width": 5, "stroke-linecap": "round", opacity: 0 }));
    rig.append(svg("path", { class: "slash-arc slash-3", d: "M172 24 Q230 64 214 124", fill: "none", stroke: "#FFFFFF", "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0 }));
    for (const [k, gx, gy, r] of [[1, 236, 44, 6], [2, 244, 96, 5], [3, 226, 138, 4]] as const) {
      rig.append(svg("path", { class: `glint glint-${k}`, d: `M${gx} ${gy - r} L${gx + r * 0.3} ${gy - r * 0.3} L${gx + r} ${gy} L${gx + r * 0.3} ${gy + r * 0.3} L${gx} ${gy + r} L${gx - r * 0.3} ${gy + r * 0.3} L${gx - r} ${gy} L${gx - r * 0.3} ${gy - r * 0.3} Z`, fill: "#FFFFFF", stroke: c.palette[2], "stroke-width": 1.2, opacity: 0 }));
    }
    root.append(rig);
  }

  // HATTRICK scores: the goal fades in at the right, the leg swings, the
  // ball flies into the top corner and the net bulges.
  if (opts.idle !== undefined && c.id === "hattrick") {
    const rig = svg("g", { class: "goal-rig" });
    const goal = svg("g", { class: "goal-net" });
    goal.append(svg("path", { d: "M196 190 L196 96 L246 96 L246 190", fill: "none", stroke: "#FFFFFF", "stroke-width": 5, "stroke-linecap": "round" }));
    const net = svg("g", { class: "net-mesh" });
    for (let y = 104; y < 190; y += 12) net.append(svg("path", { d: `M198 ${y} L246 ${y}`, stroke: "#E4F2FC", "stroke-width": 1.4, opacity: 0.7 }));
    for (let x = 206; x < 246; x += 10) net.append(svg("path", { d: `M${x} 98 L${x} 188`, stroke: "#E4F2FC", "stroke-width": 1.4, opacity: 0.7 }));
    goal.append(net);
    rig.append(goal);
    const ball = svg("g", { class: "ball" });
    ball.append(svg("circle", { cx: 156, cy: 184, r: 11, fill: "#FFFFFF", stroke: INK, "stroke-width": 3 }));
    ball.append(svg("path", { d: "M156 177 L162 181 L160 188 L152 188 L150 181 Z", fill: INK }));
    ball.append(svg("path", { d: "M147 180 L150 181 M165 180 L162 181 M152 194 L152 188 M160 194 L160 188", stroke: INK, "stroke-width": 2 }));
    rig.append(ball);
    root.append(rig);
  }

  // SCOOPJAW digs: the boom drops the bucket into the pile, scoops, lifts,
  // swings over and dumps; dirt falls.
  if (opts.idle !== undefined && c.id === "scoopjaw") {
    const rig = svg("g", { class: "dig-rig" });
    rig.append(svg("path", { class: "dirt-pile", d: "M212 190 Q232 160 252 172 Q262 180 258 190 Z", fill: "#8B5A2B", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" }));
    for (const [k, x, y] of [[1, 120, 40], [2, 132, 30], [3, 110, 52]] as const) {
      rig.append(svg("circle", { class: `dirt-fall dirt-fall-${k}`, cx: x, cy: y, r: 4, fill: "#8B5A2B", stroke: INK, "stroke-width": 1.5, opacity: 0 }));
    }
    root.append(rig);
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

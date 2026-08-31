import type { Deck, Fact } from "./types";

/**
 * THE DECK, AND THE ORDER HE MEETS IT.
 *
 * The tier number IS the curriculum. Tiers interleave addition/subtraction
 * with multiplication deliberately: a strict "finish all the adding first"
 * order would keep a third grader off multiplication until spring, and
 * multiplication is the wall he is about to hit. So multiplication opens at
 * tier 20, third group in.
 *
 *   10  addition within ten, and the +0 facts (early wins on purpose)
 *   15  the +10 facts (place value, easy)
 *   20  x0, x1, x2, x5, x10
 *   25  doubles above ten (6+6 .. 9+9)
 *   30  BRIDGE-THROUGH-TEN ADDITION      <- his strategy zone, priority
 *   40  subtraction within ten, and the -0 facts
 *   45  the -10 and "back to ten" facts (15-5, 20-10)
 *   50  x3, x4
 *   60  BRIDGE-THROUGH-TEN SUBTRACTION   <- 11-8, 13-5. priority
 *   70  the hard middles: 6,7,8,9 by 6,7,8,9
 *   80  everything left within twenty
 *   90  division (additionally gated per family, see scheduler)
 */

/** 11-8 and 13-5 bridge; 15-3 does not. You bridge when the subtrahend is
 *  bigger than the minuend's units digit, so you must break the ten. */
export const isBridgeSub = (m: number, s: number): boolean =>
  m > 10 && s < 10 && m - 10 < s;

/** 8+7 bridges; 3+4 does not. Both addends under ten, sum over ten. */
export const isBridgeAdd = (a: number, b: number): boolean =>
  a <= 9 && b <= 9 && a + b > 10;

const addTier = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 10;
  if (a + b <= 10) return 10;
  if (a === 10 || b === 10) return 15;
  if (a === b) return 25;
  if (isBridgeAdd(a, b)) return 30;
  return 80;
};

const subTier = (m: number, s: number, d: number): number => {
  if (s === 0 || d === 0) return 40;
  if (m <= 10) return 40;
  if (s === 10 || d === 10) return 45;
  if (isBridgeSub(m, s)) return 60;
  return 80;
};

const mulTier = (a: number, b: number): number => {
  if (a <= 1 || b <= 1) return 20;
  if (a === 2 || b === 2 || a === 5 || b === 5 || a === 10 || b === 10) return 20;
  if (a === 3 || b === 3 || a === 4 || b === 4) return 50;
  return 70;
};

const fact = (f: Fact): Fact => f;

/**
 * Identity facts (+0, x0, x1, and their inverses) sort to the BACK of their
 * own tier. They are worth having in the deck: they are genuine free wins and
 * they master in three days. But the first problem the app ever shows must
 * not be 0 + 0. He can derive 11 - 8 in his head; opening on 0 + 0 tells him
 * the app has not met him.
 */
const TRIVIAL = 10_000;
const addTrivial = (a: number, b: number): number => (a === 0 || b === 0 ? TRIVIAL : 0);

/**
 * Build the whole deck. Pure, deterministic, and the same every load: fact
 * ids are stable strings so a progress file survives any change to this
 * function's ordering.
 */
export const buildDeck = (): Deck => {
  const out = new Map<string, Fact>();
  const put = (f: Fact): void => {
    out.set(f.id, f);
  };

  // Addition within twenty. Canonical a <= b: 8+7 and 7+8 are ONE fact.
  for (let a = 0; a <= 10; a++) {
    for (let b = a; b <= 10; b++) {
      put(fact({
        id: `add:${a}+${b}`, kind: "add", a, b, answer: a + b,
        tier: addTier(a, b), order: addTrivial(a, b) + (a + b) * 100 + a,
        bridge: isBridgeAdd(a, b),
      }));
    }
  }

  // Subtraction within twenty. A fact only if both the subtrahend and the
  // difference are single-column, which is what "within twenty" means here.
  for (let s = 0; s <= 10; s++) {
    for (let d = 0; d <= 10; d++) {
      const m = s + d;
      put(fact({
        id: `sub:${m}-${s}`, kind: "sub", a: m, b: s, answer: d,
        tier: subTier(m, s, d), order: addTrivial(s, d) + m * 100 + s,
        bridge: isBridgeSub(m, s),
      }));
    }
  }

  // Multiplication 0-10, canonical a <= b.
  for (let a = 0; a <= 10; a++) {
    for (let b = a; b <= 10; b++) {
      put(fact({
        id: `mul:${a}x${b}`, kind: "mul", a, b, answer: a * b,
        tier: mulTier(a, b), order: (a <= 1 || b <= 1 ? TRIVIAL : 0) + a * b * 100 + a,
        bridge: false,
      }));
    }
  }

  // Division as the inverse of multiplication. Divisor is never zero.
  for (let a = 0; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      const c = a * b;
      put(fact({
        id: `div:${c}/${b}`, kind: "div", a: c, b, answer: a,
        // Division rides just behind its own multiplication family rather
        // than waiting for the entire rest of the deck. The box-3 partner
        // gate in the scheduler is what actually holds it back; the tier only
        // says where it belongs in the queue.
        tier: mulTier(Math.min(a, b), Math.max(a, b)) + 3,
        order: (a <= 1 || b <= 1 ? TRIVIAL : 0) + c * 100 + b, bridge: false,
      }));
    }
  }

  return out;
};

/** The multiplication fact a division fact is the inverse of. */
export const mulPartnerId = (f: Fact): string | null => {
  if (f.kind !== "div") return null;
  const q = f.answer;
  const d = f.b;
  const lo = Math.min(q, d);
  const hi = Math.max(q, d);
  return `mul:${lo}x${hi}`;
};

/** Introduction order across the whole deck: tier first, then within tier. */
export const introOrder = (f: Fact): number => f.tier * 1_000_000 + f.order;

export const deckInIntroOrder = (deck: Deck): Fact[] =>
  [...deck.values()].sort((x, y) => introOrder(x) - introOrder(y));

/**
 * THE ROSTER.
 *
 * Original dinosaur-kaiju hybrids. Nothing licensed, nothing imitated: no
 * Pokemon, no Godzilla, no Marvel or DC, no real team or league. Real
 * dinosaur species and general kaiju conventions are the only borrowings, and
 * both are public domain ideas rather than anyone's property.
 *
 * Each creature is a PARAMETER SET, not a drawing. ui/creature-svg.ts renders
 * it as heavy-outlined sticker art, which is how twelve distinct monsters fit
 * in a bundle small enough to live offline.
 */

export type Silhouette = "brute" | "raptor" | "plated" | "horned" | "serpent" | "titan";
export type Crest = "spikes" | "sail" | "plates" | "frill" | "none";
export type Tail = "club" | "blade" | "whip" | "spike";

export interface Creature {
  readonly id: string;
  readonly name: string;
  readonly lore: string;
  readonly cost: number;
  readonly silhouette: Silhouette;
  readonly crest: Crest;
  readonly tail: Tail;
  readonly eyes: 1 | 2 | 3;
  readonly horns: number;
  /** [body, accent, glow] */
  readonly palette: readonly [string, string, string];
}

/** Costs climb so the first unlock lands in session one and the last takes months. */
export const ROSTER: readonly Creature[] = [
  { id: "grindjaw", name: "GRINDJAW", cost: 60,
    lore: "Ate a whole handrail on a dare. The dent is still in its jaw.",
    silhouette: "brute", crest: "plates", tail: "club", eyes: 2, horns: 2,
    palette: ["#B6FF3C", "#1B3A00", "#EDFFC7"] },
  { id: "skathorn", name: "SKATHORN", cost: 90,
    lore: "Its frill is shaped like a deck. Nobody knows which came first.",
    silhouette: "horned", crest: "frill", tail: "spike", eyes: 2, horns: 3,
    palette: ["#FF8A1F", "#4A1B00", "#FFE3C2"] },
  { id: "voltmaw", name: "VOLTMAW", cost: 130,
    lore: "Runs faster than the storm it stole its teeth from.",
    silhouette: "raptor", crest: "spikes", tail: "whip", eyes: 2, horns: 1,
    palette: ["#35E6FF", "#00293A", "#D6FBFF"] },
  { id: "magmaspyne", name: "MAGMASPYNE", cost: 180,
    lore: "Sleeps in the caldera. Wakes up warmer than it went to bed.",
    silhouette: "plated", crest: "plates", tail: "spike", eyes: 2, horns: 0,
    palette: ["#FF3D3D", "#3A0000", "#FFD2C2"] },
  { id: "tidewreck", name: "TIDEWRECK", cost: 240,
    lore: "Drags shipwrecks up the beach and arranges them by size.",
    silhouette: "serpent", crest: "sail", tail: "blade", eyes: 3, horns: 2,
    palette: ["#2FA8FF", "#001E3A", "#CBE9FF"] },
  { id: "glaciodon", name: "GLACIODON", cost: 320,
    lore: "Breathes out and the puddle becomes a ramp.",
    silhouette: "brute", crest: "spikes", tail: "club", eyes: 2, horns: 4,
    palette: ["#9EE8FF", "#0C2B3A", "#FFFFFF"] },
  { id: "rustfang", name: "RUSTFANG", cost: 420,
    lore: "Built itself out of the scrap yard, one bad idea at a time.",
    silhouette: "raptor", crest: "plates", tail: "blade", eyes: 3, horns: 2,
    palette: ["#C98A3A", "#2E1900", "#FFE0B0"] },
  { id: "nightcoil", name: "NIGHTCOIL", cost: 540,
    lore: "You do not see it land. You only hear the landing.",
    silhouette: "serpent", crest: "none", tail: "whip", eyes: 3, horns: 1,
    palette: ["#A46BFF", "#1B0038", "#E9D9FF"] },
  { id: "quarryback", name: "QUARRYBACK", cost: 700,
    lore: "Half of the mountain is missing. This is where it went.",
    silhouette: "plated", crest: "plates", tail: "club", eyes: 2, horns: 3,
    palette: ["#9AA6B2", "#161C22", "#EDF2F7"] },
  { id: "emberclaw", name: "EMBERCLAW", cost: 900,
    lore: "Leaves scorch marks shaped exactly like a perfect grind.",
    silhouette: "horned", crest: "sail", tail: "blade", eyes: 2, horns: 5,
    palette: ["#FF6A00", "#3A1200", "#FFD79E"] },
  { id: "stormhide", name: "STORMHIDE", cost: 1150,
    lore: "The thunder is not the sky. The thunder is the tail.",
    silhouette: "titan", crest: "sail", tail: "spike", eyes: 2, horns: 4,
    palette: ["#FFE14D", "#2E2400", "#FFF8CC"] },
  { id: "voidcrest", name: "VOIDCREST", cost: 1500,
    lore: "Landed a line so long it finished somewhere else entirely.",
    silhouette: "titan", crest: "spikes", tail: "blade", eyes: 3, horns: 6,
    palette: ["#FF3D8B", "#2A0016", "#FFD6E7"] },
];

export const MAX_LEVEL = 10;

/** What the next level costs. Flat-ish so levelling never blocks unlocking. */
export const levelCost = (currentLevel: number): number => 40 * currentLevel;

export const creatureById = (id: string): Creature | undefined =>
  ROSTER.find((c) => c.id === id);

/** The next creature he has not unlocked, or null once he owns them all. */
export const nextLocked = (owned: readonly string[]): Creature | null =>
  ROSTER.find((c) => !owned.includes(c.id)) ?? null;

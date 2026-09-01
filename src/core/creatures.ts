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

export type Silhouette = "brute" | "raptor" | "plated" | "horned" | "serpent" | "titan" | "dragon";
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

/**
 * THE SHOP IS OPEN, Andy 2026-09-01: every monster is VISIBLE with its price,
 * and he buys whichever one he wants, in any order. No mysteries; wanting a
 * specific one and saving for it IS the game. Twenty in all: the original
 * twelve plus six dragons in six colours, a hockey bruiser and an inline
 * speedster.
 */
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
  { id: "puckjaw", name: "PUCKJAW", cost: 200,
    lore: "Checks the boards so hard the rink apologises afterward.",
    silhouette: "brute", crest: "plates", tail: "club", eyes: 2, horns: 2,
    palette: ["#8FB7D6", "#0E2233", "#E4F2FC"] },
  { id: "bladeback", name: "BLADEBACK", cost: 280,
    lore: "Eight wheels, zero brakes, one very confident grin.",
    silhouette: "raptor", crest: "sail", tail: "whip", eyes: 2, horns: 1,
    palette: ["#C9D3DC", "#22282F", "#FF3D8B"] },
  { id: "cinderwyrm", name: "CINDERWYRM", cost: 350,
    lore: "Its ollies leave scorch marks. The park pretends not to mind.",
    silhouette: "dragon", crest: "spikes", tail: "spike", eyes: 2, horns: 2,
    palette: ["#FF5A2A", "#3A0E00", "#FFD2A8"] },
  { id: "tidalwyrm", name: "TIDALWYRM", cost: 500,
    lore: "Surfs the bowl like it is still the sea it grew up in.",
    silhouette: "dragon", crest: "sail", tail: "blade", eyes: 2, horns: 2,
    palette: ["#2F7DFF", "#001A45", "#C8DDFF"] },
  { id: "mosswing", name: "MOSSWING", cost: 650,
    lore: "Sleeps in the treetops. Lands quieter than a falling leaf.",
    silhouette: "dragon", crest: "plates", tail: "whip", eyes: 2, horns: 3,
    palette: ["#4FC24F", "#0C2E0C", "#D8F7C8"] },
  { id: "nightwyrm", name: "NIGHTWYRM", cost: 800,
    lore: "You never see its run. You just find the trophies moved.",
    silhouette: "dragon", crest: "spikes", tail: "blade", eyes: 3, horns: 2,
    palette: ["#6B4BD6", "#120826", "#D9CCFF"] },
  { id: "glacierwing", name: "GLACIERWING", cost: 1000,
    lore: "Grinds rails made of ice it brought along personally.",
    silhouette: "dragon", crest: "plates", tail: "spike", eyes: 2, horns: 4,
    palette: ["#CFEFFF", "#0C3A4A", "#FFFFFF"] },
  { id: "gildedwyrm", name: "GILDEDWYRM", cost: 1300,
    lore: "Hoards exactly one thing: perfect landings.",
    silhouette: "dragon", crest: "sail", tail: "blade", eyes: 2, horns: 5,
    palette: ["#F5C542", "#4A3200", "#FFF3C4"] },
  // Kallen's commission (2026-09-01): the VOID DRAGON. Last in the shop on
  // purpose, because he is the special one.
  { id: "voidwyrm", name: "VOIDWYRM", cost: 500,
    lore: "Hatched beyond the last star. Every line it lands leaves stardust.",
    silhouette: "dragon", crest: "spikes", tail: "whip", eyes: 3, horns: 2,
    palette: ["#251C4A", "#0A0620", "#9DB8FF"] },
];

export const MAX_LEVEL = 10;

/** What the next level costs. Flat-ish so levelling never blocks unlocking. */
export const levelCost = (currentLevel: number): number => 40 * currentLevel;

export const creatureById = (id: string): Creature | undefined =>
  ROSTER.find((c) => c.id === id);

/** The cheapest monster he does not own yet: the home screen's default
 *  savings target. In the shop itself he buys whatever he wants. */
export const cheapestLocked = (owned: readonly string[]): Creature | null =>
  [...ROSTER].filter((c) => !owned.includes(c.id)).sort((a, b) => a.cost - b.cost)[0] ?? null;

/** Can he afford at least one monster he does not own? */
export const canAffordAny = (owned: readonly string[], coins: number): boolean =>
  ROSTER.some((c) => !owned.includes(c.id) && c.cost <= coins);

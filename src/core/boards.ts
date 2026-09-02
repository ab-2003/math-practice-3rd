/**
 * THE BOARD RACK (Andy, 2026-09-02): custom decks, bought once, ridden by
 * whichever monster he puts them under.
 *
 * PLAIN BOARD is always owned and costs nothing, so there is always a way
 * back. The eight custom boards are priced as a real save: the first is a
 * quick win, the rest are the spring's long arc. VOID BOARD matches
 * VOIDWYRM, Kallen's commission, and costs what the dragon costs.
 *
 * Pure data, like the monsters and helmets: the drawing lives in
 * ui/board-svg.ts, keyed by theme.
 */

export type BoardTheme = "plain" | "ember" | "void" | "frost" | "storm" | "tide" | "gilded" | "magma" | "neon";

export interface Board {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly lore: string;
  readonly theme: BoardTheme;
  /** [deck, accent, glow] */
  readonly palette: readonly [string, string, string];
}

export const PLAIN_BOARD = "plain";

export const BOARDS: readonly Board[] = [
  { id: "plain", name: "PLAIN BOARD", cost: 0, theme: "plain",
    lore: "The one that came with the park. Never let anyone down.",
    palette: ["#B6FF3C", "#05070A", "#EDFFC7"] },
  { id: "ember", name: "EMBER DECK", cost: 100, theme: "ember",
    lore: "Warm to the touch. The tail leaves a little fire behind.",
    palette: ["#FF5A2A", "#3A0E00", "#FFE14D"] },
  { id: "void", name: "VOID BOARD", cost: 500, theme: "void",
    lore: "Cut from the same dark as VOIDWYRM. It trails a comet.",
    palette: ["#251C4A", "#0A0620", "#9DB8FF"] },
  { id: "frost", name: "FROSTBITE", cost: 600, theme: "frost",
    lore: "Icicles under the tail. Grinds like a glacier.",
    palette: ["#9EE8FF", "#0C2B3A", "#FFFFFF"] },
  { id: "storm", name: "STORM DECK", cost: 700, theme: "storm",
    lore: "There is a bolt down the middle. Sparks on every landing.",
    palette: ["#2E3843", "#05070A", "#FFE14D"] },
  { id: "tide", name: "TIDE RIDER", cost: 800, theme: "tide",
    lore: "A wave across the deck. It sprays when it lands.",
    palette: ["#2F7DFF", "#001A45", "#CBE9FF"] },
  { id: "gilded", name: "GILDED", cost: 900, theme: "gilded",
    lore: "Gold from nose to tail. Even the wheels.",
    palette: ["#F5C542", "#4A3200", "#FFF3C4"] },
  { id: "magma", name: "MAGMA", cost: 1000, theme: "magma",
    lore: "Black rock with the fire showing through the cracks.",
    palette: ["#1B1416", "#FF3D3D", "#FF8A1F"] },
  { id: "neon", name: "NEON GHOST", cost: 1100, theme: "neon",
    lore: "You can see through it. The glow you cannot.",
    palette: ["#10151B", "#B6FF3C", "#35E6FF"] },
];

export const boardById = (id: string): Board | undefined => BOARDS.find((b) => b.id === id);

/** The boards a rider may put under a monster: plain, plus everything bought. */
export const ownedBoards = (boardsOwned: readonly string[]): Board[] =>
  BOARDS.filter((b) => b.id === PLAIN_BOARD || boardsOwned.includes(b.id));

/** Which board a monster rides: its own pick, else plain. */
export const boardFor = (boardOf: Readonly<Record<string, string>>, creatureId: string, boardsOwned: readonly string[]): Board => {
  const picked = boardOf[creatureId];
  const b = picked !== undefined ? boardById(picked) : undefined;
  return b !== undefined && (b.id === PLAIN_BOARD || boardsOwned.includes(b.id)) ? b : BOARDS[0]!;
};

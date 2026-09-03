/**
 * THE BOARD RACK (Andy, 2026-09-02): custom decks, bought once, ridden by
 * whichever monster he puts them under.
 *
 * PLAIN BOARD is always owned and costs nothing, so there is always a way
 * back. The custom boards are priced as a real save: the first is a
 * quick win, the sports decks a short save under 400, the rest the spring's long
 * arc up the ladder. VOID BOARD matches
 * VOIDWYRM, Kallen's commission, and costs what the dragon costs.
 *
 * Pure data, like the monsters and helmets: the drawing lives in
 * ui/board-svg.ts, keyed by theme.
 */

export type BoardTheme =
  | "plain" | "ember" | "void" | "frost" | "storm" | "tide" | "gilded" | "magma" | "neon"
  // 0.18.2 (Andy): a fighter jet, a rink, a court, and a wall of tags.
  | "jet" | "hockey" | "hoops" | "tag"
  // 0.20.0 (Andy): a pitch, a building site, a shuriken, a dark knight.
  | "soccer" | "hazard" | "ninja" | "knight"
  // 0.20.0 (Andy): a diamond, and a gridiron.
  | "baseball" | "football"
  // 0.20.3 (Andy): a dirt track.
  | "moto";

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
  // The sports decks are a short save, under 400 (Andy, 2026-09-03).
  { id: "soccer", name: "PITCH DECK", cost: 250, theme: "soccer",
    lore: "A whole pitch, nose to tail, and a ball on the tail. Grass flies.",
    palette: ["#3FBF6F", "#0E3A1E", "#FFFFFF"] },
  { id: "baseball", name: "DIAMOND DECK", cost: 280, theme: "baseball",
    lore: "Infield dirt, four bases, and a ball on the tail. It slides in a cloud of dust.",
    palette: ["#C98A3A", "#3A2A1A", "#FFFFFF"] },
  { id: "hockey", name: "SLAPSHOT", cost: 300, theme: "hockey",
    lore: "Rink lines on the deck and a puck on the tail. Ice shavings on every stop.",
    palette: ["#E4F2FC", "#D33A3A", "#2F7DFF"] },
  { id: "football", name: "END ZONE", cost: 320, theme: "football",
    lore: "Yard lines down the deck and a football on the tail. The ball spirals behind.",
    palette: ["#2E8B3F", "#0E3A1E", "#8B5A2B"] },
  { id: "moto", name: "HOLESHOT", cost: 330, theme: "moto",
    lore: "Dirt on the deck, knobby tracks down it, a number plate on the tail. Roost flies behind.",
    palette: ["#5A3A1E", "#FFE14D", "#B6FF3C"] },
  { id: "hoops", name: "BUZZER BEATER", cost: 350, theme: "hoops",
    lore: "Hardwood, court lines, and a ball that bounces along behind.",
    palette: ["#D19A4A", "#7A4A1A", "#EE6730"] },
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
  // THE THEMED FOUR (Andy, 2026-09-02): the ladder keeps climbing.
  { id: "jet", name: "AFTERBURNER", cost: 1200, theme: "jet",
    lore: "A cockpit up front, wings out the sides. It does not fly. It nearly does.",
    palette: ["#55657A", "#1A2230", "#FF8A1F"] },
  { id: "tag", name: "STREET TAG", cost: 1500, theme: "tag",
    lore: "Tagged, dripped and crowned. The wall started it.",
    palette: ["#1E242C", "#FF3D8B", "#FFE14D"] },
  { id: "hazard", name: "SITE DECK", cost: 1700, theme: "hazard",
    lore: "Hazard stripes and a hard hat sticker. Gravel sprays behind it.",
    palette: ["#F5B400", "#05070A", "#FF8A1F"] },
  { id: "ninja", name: "SHURIKEN", cost: 1800, theme: "ninja",
    lore: "Black on black with one red stripe. A shuriken spins off the tail.",
    palette: ["#0B0D12", "#E8483A", "#D8DEE8"] },
  { id: "knight", name: "DARK SWORD", cost: 1900, theme: "knight",
    lore: "Black plate down the deck, a dark sword along it, hilt and all, and a crestless shield.",
    palette: ["#12141B", "#8FA0B4", "#B33A6E"] },
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

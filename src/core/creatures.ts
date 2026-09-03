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

export type Silhouette =
  | "brute" | "raptor" | "plated" | "horned" | "serpent" | "titan" | "dragon"
  // THE KAIJU SIX (0.18.0): hybrids, not elements.
  | "hoops" | "ace" | "wolf" | "panda" | "hydra" | "chameleon"
  // 0.18.3: a wolf-dragon on two legs, and a panther.
  | "wrecker" | "panther"
  // 0.18.6: a Komodo dragon.
  | "komodo"
  // 0.20.0: a striker in a number 7 shirt, an excavator, a ninja, a dark knight.
  | "striker" | "digger" | "ninja" | "knight"
  // 0.20.0: a batter, and a football player.
  | "batter" | "lineman"
  // 0.20.3: a motocross rider, the bike parked beside him.
  | "moto";
export type Crest = "spikes" | "sail" | "plates" | "frill" | "none";
export type Tail = "club" | "blade" | "whip" | "spike" | "bush" | "ring" | "curl";

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
  /** In-character lines for the end of a run. The lore was trapped in the
   *  shop; this is the monster talking to him where it counts. */
  readonly voice: readonly [string, string];
  /** THE KAIJU SIX wear a tag in the shop: they are the bonus crew. */
  readonly kaiju?: true;
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
    palette: ["#B6FF3C", "#1B3A00", "#EDFFC7"] ,
    voice: ["That rail never stood a chance.", "Chewed through it. Landed it. Same thing."] },
  { id: "skathorn", name: "SKATHORN", cost: 90,
    lore: "Its frill is shaped like a deck. Nobody knows which came first.",
    silhouette: "horned", crest: "frill", tail: "spike", eyes: 2, horns: 3,
    palette: ["#FF8A1F", "#4A1B00", "#FFE3C2"] ,
    voice: ["Frill first, wheels second. Every time.", "The deck was my idea. Ask anyone."] },
  // KOMODUSTER (Andy, 2026-09-02): a Komodo dragon, an early save at 125.
  { id: "komoduster", name: "KOMODUSTER", cost: 125,
    lore: "Tastes the air before every trick. Then eats the dust it kicked up.",
    silhouette: "komodo", crest: "none", tail: "spike", eyes: 2, horns: 0,
    palette: ["#8C8A5A", "#3A3820", "#D9D3A0"] ,
    voice: ["Tasted the air. Landed the trick.", "The dust is mine. So is the rail."] },
  { id: "voltmaw", name: "VOLTMAW", cost: 130,
    lore: "Runs faster than the storm it stole its teeth from.",
    silhouette: "raptor", crest: "spikes", tail: "whip", eyes: 2, horns: 1,
    palette: ["#35E6FF", "#00293A", "#D6FBFF"] ,
    voice: ["Faster than the storm. Still faster.", "Did you see that? No. Too quick."] },
  { id: "magmaspyne", name: "MAGMASPYNE", cost: 180,
    lore: "Sleeps in the caldera. Wakes up warmer than it went to bed.",
    silhouette: "plated", crest: "plates", tail: "spike", eyes: 2, horns: 0,
    palette: ["#FF3D3D", "#3A0000", "#FFD2C2"] ,
    voice: ["Warm landings. Every one of them.", "The ground is steaming again. Good sign."] },
  // RONALDOHORN (Andy, 2026-09-03; HATTRICK until 0.20.3, the id stays so
  // a bought striker stays bought): the striker. Number 7 shirt, the long
  // socks, one horn, and a shot into the top corner for an act.
  { id: "hattrick", name: "RONALDOHORN", cost: 190,
    lore: "Wears the number 7 and one horn. Puts everything in the top corner, tricks included.",
    silhouette: "striker", crest: "none", tail: "whip", eyes: 2, horns: 1,
    palette: ["#3FBF6F", "#0E3A1E", "#E9FFF0"] ,
    voice: ["Top corner. Top rail. Same thing.", "Number 7. One horn. Zero misses."] },
  // DINGER (Andy, 2026-09-03): the batter. A bat on its own rig, a pitch
  // coming in, and a crack that sends it out of the park. The cap is a
  // lid to buy.
  { id: "dinger", name: "DINGER", cost: 220,
    lore: "Swings at everything. Connects with most of it. The ball is still going.",
    silhouette: "batter", crest: "none", tail: "club", eyes: 2, horns: 0,
    palette: ["#E8E4D8", "#3A2A1A", "#D33A3A"] ,
    voice: ["That one is still going.", "Swung at the rail. Hit the landing."] },
  // GRIDJAW (Andy, 2026-09-03): the football player. Shoulder pads, a
  // throwing arm on its own rig, and a spiral for an act. The helmet is a
  // lid to buy.
  { id: "gridjaw", name: "GRIDJAW", cost: 230,
    lore: "Shoulders like a truck. Throws a spiral you could set a watch by.",
    silhouette: "lineman", crest: "none", tail: "spike", eyes: 2, horns: 0,
    palette: ["#1B2A5A", "#0A1030", "#F5C542"] ,
    voice: ["Spiral, landing, touchdown.", "The pads took the hit. The line stayed clean."] },
  { id: "tidewreck", name: "TIDEWRECK", cost: 240,
    lore: "Drags shipwrecks up the beach and arranges them by size.",
    silhouette: "serpent", crest: "sail", tail: "blade", eyes: 3, horns: 2,
    palette: ["#2FA8FF", "#001E3A", "#CBE9FF"] ,
    voice: ["Lined those tricks up by size. Beautiful.", "Dragged that whole run up the beach."] },
  // NINJAW (Andy, 2026-09-03): the ninja. A gi, a belt, the eyes of a
  // ninja under the hood, and a flying kick for an act. The headband is
  // a lid in the rack, not part of him.
  { id: "ninjaw", name: "NINJAW", cost: 260,
    lore: "Nobody hears the landing. Nobody sees the kick until it has happened.",
    silhouette: "ninja", crest: "none", tail: "whip", eyes: 2, horns: 0,
    palette: ["#2A2F3A", "#0B0D12", "#D8DEE8"] ,
    voice: ["You heard nothing. That was the trick.", "One kick, one line, gone."] },
  // BRAAPTOR (Andy, 2026-09-03): the motocross rider. The dirt bike is
  // parked beside him; the act is the hop on, the ride off, and the roost
  // of dirt behind. The MOTO DOME in the rack is his lid.
  { id: "braaptor", name: "BRAAPTOR", cost: 270,
    lore: "Never walks anywhere the bike can go. Leaves a wall of dirt behind every trick.",
    silhouette: "moto", crest: "none", tail: "whip", eyes: 2, horns: 0,
    palette: ["#C13CFF", "#1B1226", "#FFE14D"] ,
    voice: ["Braap. That was the whole plan.", "Roost on the landing. Nobody saw the rail."] },
  { id: "glaciodon", name: "GLACIODON", cost: 320,
    lore: "Breathes out and the puddle becomes a ramp.",
    silhouette: "brute", crest: "spikes", tail: "club", eyes: 2, horns: 4,
    palette: ["#9EE8FF", "#0C2B3A", "#FFFFFF"] ,
    voice: ["Breathed once. Instant ramp.", "Cold hands, clean landings."] },
  // SCOOPJAW (Andy, 2026-09-03): half monster, half excavator. Treads for
  // feet, a boom for an arm, and a bucket that digs and dumps for an act.
  { id: "scoopjaw", name: "SCOOPJAW", cost: 380,
    lore: "Half monster, half excavator. Digs the bowl a little deeper every visit.",
    silhouette: "digger", crest: "none", tail: "club", eyes: 2, horns: 0,
    palette: ["#F5B400", "#3A2A00", "#FFF0B0"] ,
    voice: ["Dug it. Dumped it. Landed it.", "The bucket does the talking."] },
  { id: "rustfang", name: "RUSTFANG", cost: 420,
    lore: "Built itself out of the scrap yard, one bad idea at a time.",
    silhouette: "raptor", crest: "plates", tail: "blade", eyes: 3, horns: 2,
    palette: ["#C98A3A", "#2E1900", "#FFE0B0"] ,
    voice: ["One bad idea after another, all of them landed.", "Something rattled loose. Landed it anyway."] },
  // GRIMSHIELD (Andy, 2026-09-03): the dark knight. Plate, a shield, a
  // sword, and a sword slash for an act. The great helm is a lid to buy.
  // GRIMSWORD (GRIMSHIELD until 0.20.6; the id stays so a bought one stays
  // bought). Andy: blocky armour, and "a true dark sword" with a pointy tip
  // and a cooler hilt.
  { id: "grimshield", name: "GRIMSWORD", cost: 440,
    lore: "Blocky black plate, riveted shut, and a dark sword with a point that has never missed a rail.",
    silhouette: "knight", crest: "none", tail: "blade", eyes: 2, horns: 0,
    palette: ["#3A3F4C", "#12141B", "#B33A6E"] ,
    voice: ["The plate held. The sword landed.", "Dark knights land in the dark. Ask the rail."] },
  { id: "nightcoil", name: "NIGHTCOIL", cost: 540,
    lore: "You do not see it land. You only hear the landing.",
    silhouette: "serpent", crest: "none", tail: "whip", eyes: 3, horns: 1,
    palette: ["#A46BFF", "#1B0038", "#E9D9FF"] ,
    voice: ["You did not see it. You heard it.", "The trophies have moved again."] },
  { id: "quarryback", name: "QUARRYBACK", cost: 700,
    lore: "Half of the mountain is missing. This is where it went.",
    silhouette: "plated", crest: "plates", tail: "club", eyes: 2, horns: 3,
    palette: ["#9AA6B2", "#161C22", "#EDF2F7"] ,
    voice: ["Half a mountain, and still a soft landing.", "The ground remembers every stomp."] },
  { id: "emberclaw", name: "EMBERCLAW", cost: 900,
    lore: "Leaves scorch marks shaped exactly like a perfect grind.",
    silhouette: "horned", crest: "sail", tail: "blade", eyes: 2, horns: 5,
    palette: ["#FF6A00", "#3A1200", "#FFD79E"] ,
    voice: ["Every landing left a perfect scorch.", "Follow the burn marks. That is the line."] },
  { id: "stormhide", name: "STORMHIDE", cost: 1150,
    lore: "The thunder is not the sky. The thunder is the tail.",
    silhouette: "titan", crest: "sail", tail: "spike", eyes: 2, horns: 4,
    palette: ["#FFE14D", "#2E2400", "#FFF8CC"] ,
    voice: ["That thunder? Tail. All tail.", "The sky is jealous. Let it be."] },
  { id: "voidcrest", name: "VOIDCREST", cost: 1500,
    lore: "Landed a line so long it finished somewhere else entirely.",
    silhouette: "titan", crest: "spikes", tail: "blade", eyes: 3, horns: 6,
    palette: ["#FF3D8B", "#2A0016", "#FFD6E7"] ,
    voice: ["That line finished somewhere else entirely.", "Longer than yesterday. Always longer."] },
  { id: "puckjaw", name: "PUCKJAW", cost: 200,
    lore: "Checks the boards so hard the rink apologises afterward.",
    silhouette: "brute", crest: "plates", tail: "club", eyes: 2, horns: 2,
    palette: ["#8FB7D6", "#0E2233", "#E4F2FC"] ,
    voice: ["Top shelf. Right where the milk lives.", "The boards apologised. Twice."] },
  { id: "bladeback", name: "BLADEBACK", cost: 280,
    lore: "Eight wheels, zero brakes, one very confident grin.",
    silhouette: "raptor", crest: "sail", tail: "whip", eyes: 2, horns: 1,
    palette: ["#C9D3DC", "#22282F", "#FF3D8B"] ,
    voice: ["Eight wheels. Zero brakes. No regrets.", "Grinning the whole way down."] },
  { id: "cinderwyrm", name: "CINDERWYRM", cost: 350,
    lore: "Its ollies leave scorch marks. The park pretends not to mind.",
    silhouette: "dragon", crest: "spikes", tail: "spike", eyes: 2, horns: 2,
    palette: ["#FF5A2A", "#3A0E00", "#FFD2A8"] ,
    voice: ["Scorch marks on every ollie. Sorry, park.", "The flames were the easy part."] },
  { id: "tidalwyrm", name: "TIDALWYRM", cost: 500,
    lore: "Surfs the bowl like it is still the sea it grew up in.",
    silhouette: "dragon", crest: "sail", tail: "blade", eyes: 2, horns: 2,
    palette: ["#2F7DFF", "#001A45", "#C8DDFF"] ,
    voice: ["Rode it like a wave. Because it was one.", "Bowl, sea, same thing to me."] },
  { id: "mosswing", name: "MOSSWING", cost: 650,
    lore: "Sleeps in the treetops. Lands quieter than a falling leaf.",
    silhouette: "dragon", crest: "plates", tail: "whip", eyes: 2, horns: 3,
    palette: ["#4FC24F", "#0C2E0C", "#D8F7C8"] ,
    voice: ["Quieter than a leaf. Landed it anyway.", "The treetops were watching."] },
  { id: "nightwyrm", name: "NIGHTWYRM", cost: 800,
    lore: "You never see its run. You just find the trophies moved.",
    silhouette: "dragon", crest: "spikes", tail: "blade", eyes: 3, horns: 2,
    palette: ["#6B4BD6", "#120826", "#D9CCFF"] ,
    voice: ["Nobody saw the run. The trophies know.", "Hunting in the dark is easier on wheels."] },
  { id: "glacierwing", name: "GLACIERWING", cost: 1000,
    lore: "Grinds rails made of ice it brought along personally.",
    silhouette: "dragon", crest: "plates", tail: "spike", eyes: 2, horns: 4,
    palette: ["#CFEFFF", "#0C3A4A", "#FFFFFF"] ,
    voice: ["Brought my own ice. Grinds better.", "Every rail is a glacier if you try."] },
  { id: "gildedwyrm", name: "GILDEDWYRM", cost: 1300,
    lore: "Hoards exactly one thing: perfect landings.",
    silhouette: "dragon", crest: "sail", tail: "blade", eyes: 2, horns: 5,
    palette: ["#F5C542", "#4A3200", "#FFF3C4"] ,
    voice: ["Hoarded another perfect landing.", "Gold does not bail. Neither did I."] },
  // THE KAIJU (Andy, 2026-09-02; six, then eight): "cool bonus creatures for the kids to
  // work towards", hybrids rather than elements. Our own inventions; the
  // only borrowing is the idea of a giant monster, which belongs to nobody.
  // SKYHOOK is the cheap door in at 150; the rest are a real save. They sit
  // before VOIDWYRM, who keeps the last tile because that one is Kallen's.
  { id: "skyhook", name: "SKYHOOK", cost: 150, kaiju: true,
    lore: "Tall enough to dunk without jumping. Shoots anyway, for style.",
    silhouette: "hoops", crest: "none", tail: "whip", eyes: 2, horns: 0,
    palette: ["#2FBF8F", "#063A2A", "#CFFFE9"] ,
    voice: ["Nothing but net. Nothing but rail.", "Swish. That is what a landing sounds like."] },
  { id: "pantheraclaw", name: "PANTHERACLAW", cost: 250, kaiju: true,
    lore: "Black as the halfpipe at midnight. The claws are gold, and they are sharp.",
    silhouette: "panther", crest: "none", tail: "whip", eyes: 2, horns: 0,
    palette: ["#1B1F26", "#0A0C10", "#F5C542"] ,
    voice: ["Three claws, three marks, one landing.", "Gold claws. Clean line. Quiet exit."] },
  { id: "pandamonium", name: "PANDAMONIUM", cost: 350, kaiju: true,
    lore: "Spins its tail so fast the whole park leans. Never spills its snack.",
    silhouette: "panda", crest: "none", tail: "ring", eyes: 2, horns: 0,
    palette: ["#D9552A", "#3A1408", "#FFE7D1"] ,
    voice: ["Tail spin, trick, snack. In that order.", "The whole park leaned. I did not."] },
  { id: "machfang", name: "MACHFANG", cost: 450, kaiju: true,
    lore: "Keeps a fighter jet behind the halfpipe. Takes off between tricks.",
    silhouette: "ace", crest: "spikes", tail: "blade", eyes: 2, horns: 2,
    palette: ["#8A94A6", "#1A2230", "#FF8A1F"] ,
    voice: ["Cleared for takeoff. Cleared for landing.", "That line had afterburners."] },
  { id: "moonhowl", name: "MOONHOWL", cost: 550, kaiju: true,
    lore: "Howls at the moon after every run. The moon has started howling back.",
    silhouette: "wolf", crest: "none", tail: "bush", eyes: 2, horns: 0,
    palette: ["#EEF4FA", "#1C2A3A", "#9EC7FF"] ,
    voice: ["The moon heard that landing.", "One howl per line. House rules."] },
  { id: "wreckarm", name: "WRECKARM", cost: 600, kaiju: true,
    lore: "Half wolf, half dragon, one enormous fist. The skyline keeps getting shorter.",
    silhouette: "wrecker", crest: "spikes", tail: "bush", eyes: 2, horns: 2,
    palette: ["#6B7A99", "#1A2233", "#FFB25A"] ,
    voice: ["One fist. One tower. One trick.", "The skyline got shorter. The line got longer."] },
  { id: "chromaleon", name: "CHROMALEON", cost: 700, kaiju: true,
    lore: "Changes colour mid-trick. Judges have never agreed on what they saw.",
    silhouette: "chameleon", crest: "sail", tail: "curl", eyes: 2, horns: 1,
    palette: ["#7BD64A", "#123A0E", "#F6FFB0"] ,
    voice: ["Which colour landed it? All of them.", "The judges saw six riders. All me."] },
  { id: "triomaw", name: "TRIOMAW", cost: 950, kaiju: true,
    lore: "Three heads, one board. They argue about every trick and land it anyway.",
    silhouette: "hydra", crest: "none", tail: "spike", eyes: 2, horns: 1,
    palette: ["#9C4DFF", "#25083F", "#E6D1FF"] ,
    voice: ["Three votes. Three landings. Same trick.", "Left head called it. Middle head landed it."] },
  // Kallen's commission (2026-09-01): the VOID DRAGON. Last in the shop on
  // purpose, because he is the special one.
  { id: "voidwyrm", name: "VOIDWYRM", cost: 500,
    lore: "Hatched beyond the last star. Every line it lands leaves stardust.",
    silhouette: "dragon", crest: "spikes", tail: "whip", eyes: 3, horns: 2,
    palette: ["#251C4A", "#0A0620", "#9DB8FF"] ,
    voice: ["Stardust on every landing. Every one.", "Beyond the last star, they felt that line."] },
];

export const MAX_LEVEL = 10;

/** What the next level costs. Flat-ish so levelling never blocks unlocking. */
export const levelCost = (currentLevel: number): number => 40 * currentLevel;

/** Can this monster go up a level with these coins? The shop tile wears a
 *  badge when it can (Andy, 2026-09-02: the mechanic was under-surfaced). */
export const canLevelUp = (level: number, coins: number): boolean =>
  level < MAX_LEVEL && coins >= levelCost(level);

/**
 * WHAT A LEVEL BUYS, in words the confirm sheet can say. Levels are for
 * looks and nothing else: the maths, the coins and the tricks never change
 * with level, and the sheet says so. Every level changes something the eye
 * can see (the number on the star goes up), and some levels bring a perk.
 */
export const LEVEL_PERKS: ReadonlyArray<{ level: number; perk: string }> = [
  { level: 2, perk: "a star sticker on its flank" },
  { level: 3, perk: "its level number on the star" },
  { level: 4, perk: "eyes that glow" },
  { level: 7, perk: "gold horns" },
  { level: 10, perk: "an aura all around it" },
];

/** What reaching `level` brings for this monster: the perk, else the number
 *  on the star ticking up. Hornless monsters get a gold star at 7. */
export const levelBrings = (c: Creature, level: number): string => {
  const perk = LEVEL_PERKS.find((p) => p.level === level)?.perk;
  if (perk === undefined) return `the number on its star goes up to ${level}`;
  if (level === 7 && c.horns === 0) return "a gold star";
  return perk;
};

export const creatureById = (id: string): Creature | undefined =>
  ROSTER.find((c) => c.id === id);

/** The cheapest monster he does not own yet: the home screen's default
 *  savings target. In the shop itself he buys whatever he wants. */
export const cheapestLocked = (owned: readonly string[]): Creature | null =>
  [...ROSTER].filter((c) => !owned.includes(c.id)).sort((a, b) => a.cost - b.cost)[0] ?? null;

/** Can he afford at least one monster he does not own? */
/** What the rider says after a run: day-rotated, so the two lines alternate. */
export const riderVoice = (c: Creature, day: number): string => c.voice[day % c.voice.length] ?? c.voice[0];

export const canAffordAny = (owned: readonly string[], coins: number): boolean =>
  ROSTER.some((c) => !owned.includes(c.id) && c.cost <= coins);

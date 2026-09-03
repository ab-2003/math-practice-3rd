/**
 * THE GEAR RACK, Andy 2026-09-01: "at least let them put on a cool helmet."
 *
 * Thirty-four helmets: seventeen SHAPES in two colourways each. A helmet is bought once
 * and lives in the locker; any owned monster can wear any owned helmet, and
 * each monster remembers its own. Pure data here; the drawing lives in the
 * UI renderer, keyed by shape.
 */

export type HelmetShape =
  | "half" | "cap" | "full" | "mohawk" | "viking"
  | "crown" | "beanie" | "samurai" | "goggle" | "cone"
  // The fighter-jet pilot's lid (Andy, 2026-09-02), with MACHFANG's jet.
  | "pilot"
  // The sports lids and the hard hat (Andy, 2026-09-03).
  | "soccer" | "basketball" | "hockey" | "hardhat"
  // The ninja's headband and the dark knight's great helm (Andy, 2026-09-03).
  | "headband" | "knight";

export interface Helmet {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly shape: HelmetShape;
  /** [shell, accent] */
  readonly colors: readonly [string, string];
}

export const HELMETS: readonly Helmet[] = [
  { id: "half-acid", name: "ACID SHELL", cost: 15, shape: "half", colors: ["#B6FF3C", "#05070A"] },
  { id: "half-hot", name: "HOT SHELL", cost: 15, shape: "half", colors: ["#FF3D8B", "#05070A"] },
  { id: "cap-street", name: "STREET CAP", cost: 25, shape: "cap", colors: ["#1E242C", "#B6FF3C"] },
  { id: "cap-fire", name: "FLAME CAP", cost: 25, shape: "cap", colors: ["#FF5A2A", "#FFE14D"] },
  { id: "beanie-frost", name: "FROST BEANIE", cost: 35, shape: "beanie", colors: ["#35E6FF", "#FFFFFF"] },
  { id: "beanie-mag", name: "MAGMA BEANIE", cost: 35, shape: "beanie", colors: ["#FF8A1F", "#3A0E00"] },
  // The sports lids are 40 coins, every one (Andy, 2026-09-03).
  { id: "soccer-pitch", name: "PITCH DOME", cost: 40, shape: "soccer", colors: ["#FFFFFF", "#05070A"] },
  { id: "soccer-neon", name: "NEON PITCH", cost: 40, shape: "soccer", colors: ["#B6FF3C", "#05070A"] },
  { id: "basketball-court", name: "COURT DOME", cost: 40, shape: "basketball", colors: ["#EE6730", "#05070A"] },
  { id: "basketball-purple", name: "PURPLE COURT", cost: 40, shape: "basketball", colors: ["#6B4BD6", "#F5C542"] },
  { id: "hockey-rink", name: "RINK HELMET", cost: 40, shape: "hockey", colors: ["#FFFFFF", "#D33A3A"] },
  { id: "hockey-stealth", name: "STEALTH RINK", cost: 40, shape: "hockey", colors: ["#22282F", "#35E6FF"] },
  { id: "goggle-sky", name: "SKY GOGGLES", cost: 50, shape: "goggle", colors: ["#2F7DFF", "#C8DDFF"] },
  { id: "goggle-night", name: "NIGHT GOGGLES", cost: 50, shape: "goggle", colors: ["#120826", "#6B4BD6"] },
  { id: "headband-red", name: "NINJA BAND", cost: 55, shape: "headband", colors: ["#E8483A", "#FFFFFF"] },
  { id: "headband-shadow", name: "SHADOW BAND", cost: 55, shape: "headband", colors: ["#0B0D12", "#B6FF3C"] },
  { id: "cone-classic", name: "THE CONE", cost: 60, shape: "cone", colors: ["#FF8A1F", "#FFFFFF"] },
  { id: "cone-void", name: "VOID CONE", cost: 60, shape: "cone", colors: ["#2A0016", "#FF3D8B"] },
  { id: "hardhat-site", name: "HARD HAT", cost: 70, shape: "hardhat", colors: ["#F5B400", "#05070A"] },
  { id: "hardhat-boss", name: "SITE BOSS", cost: 70, shape: "hardhat", colors: ["#FF8A1F", "#FFFFFF"] },
  { id: "mohawk-punk", name: "PUNK HAWK", cost: 80, shape: "mohawk", colors: ["#1E242C", "#FF3D8B"] },
  { id: "mohawk-toxic", name: "TOXIC HAWK", cost: 80, shape: "mohawk", colors: ["#0C2E0C", "#B6FF3C"] },
  { id: "full-moto", name: "MOTO DOME", cost: 110, shape: "full", colors: ["#C9D3DC", "#22282F"] },
  { id: "full-stealth", name: "STEALTH DOME", cost: 110, shape: "full", colors: ["#10151B", "#35E6FF"] },
  { id: "pilot-jet", name: "JET ACE", cost: 130, shape: "pilot", colors: ["#EDF2F7", "#2F7DFF"] },
  { id: "pilot-night", name: "NIGHT ACE", cost: 130, shape: "pilot", colors: ["#22282F", "#FF8A1F"] },
  { id: "viking-raid", name: "RAID HORNS", cost: 150, shape: "viking", colors: ["#8FB7D6", "#E4F2FC"] },
  { id: "viking-ember", name: "EMBER HORNS", cost: 150, shape: "viking", colors: ["#3A0E00", "#FF5A2A"] },
  { id: "knight-dark", name: "DARK HELM", cost: 180, shape: "knight", colors: ["#12141B", "#B33A6E"] },
  { id: "knight-steel", name: "STEEL HELM", cost: 180, shape: "knight", colors: ["#8FA0B4", "#6B4BD6"] },
  { id: "samurai-storm", name: "STORM KABUTO", cost: 200, shape: "samurai", colors: ["#22282F", "#FFE14D"] },
  { id: "samurai-tide", name: "TIDE KABUTO", cost: 200, shape: "samurai", colors: ["#001A45", "#2F7DFF"] },
  { id: "crown-gold", name: "GOLD CROWN", cost: 320, shape: "crown", colors: ["#F5C542", "#FFF3C4"] },
  { id: "crown-void", name: "VOID CROWN", cost: 320, shape: "crown", colors: ["#2A0016", "#FF3D8B"] },
];

export const helmetById = (id: string): Helmet | undefined => HELMETS.find((h) => h.id === id);

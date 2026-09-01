/**
 * THE GEAR RACK, Andy 2026-09-01: "at least let them put on a cool helmet."
 *
 * Twenty helmets: ten SHAPES in two colourways each. A helmet is bought once
 * and lives in the locker; any owned monster can wear any owned helmet, and
 * each monster remembers its own. Pure data here; the drawing lives in the
 * UI renderer, keyed by shape.
 */

export type HelmetShape =
  | "half" | "cap" | "full" | "mohawk" | "viking"
  | "crown" | "beanie" | "samurai" | "goggle" | "cone";

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
  { id: "goggle-sky", name: "SKY GOGGLES", cost: 50, shape: "goggle", colors: ["#2F7DFF", "#C8DDFF"] },
  { id: "goggle-night", name: "NIGHT GOGGLES", cost: 50, shape: "goggle", colors: ["#120826", "#6B4BD6"] },
  { id: "cone-classic", name: "THE CONE", cost: 60, shape: "cone", colors: ["#FF8A1F", "#FFFFFF"] },
  { id: "cone-void", name: "VOID CONE", cost: 60, shape: "cone", colors: ["#2A0016", "#FF3D8B"] },
  { id: "mohawk-punk", name: "PUNK HAWK", cost: 80, shape: "mohawk", colors: ["#1E242C", "#FF3D8B"] },
  { id: "mohawk-toxic", name: "TOXIC HAWK", cost: 80, shape: "mohawk", colors: ["#0C2E0C", "#B6FF3C"] },
  { id: "full-moto", name: "MOTO DOME", cost: 110, shape: "full", colors: ["#C9D3DC", "#22282F"] },
  { id: "full-stealth", name: "STEALTH DOME", cost: 110, shape: "full", colors: ["#10151B", "#35E6FF"] },
  { id: "viking-raid", name: "RAID HORNS", cost: 150, shape: "viking", colors: ["#8FB7D6", "#E4F2FC"] },
  { id: "viking-ember", name: "EMBER HORNS", cost: 150, shape: "viking", colors: ["#3A0E00", "#FF5A2A"] },
  { id: "samurai-storm", name: "STORM KABUTO", cost: 200, shape: "samurai", colors: ["#22282F", "#FFE14D"] },
  { id: "samurai-tide", name: "TIDE KABUTO", cost: 200, shape: "samurai", colors: ["#001A45", "#2F7DFF"] },
  { id: "crown-gold", name: "GOLD CROWN", cost: 320, shape: "crown", colors: ["#F5C542", "#FFF3C4"] },
  { id: "crown-void", name: "VOID CROWN", cost: 320, shape: "crown", colors: ["#2A0016", "#FF3D8B"] },
];

export const helmetById = (id: string): Helmet | undefined => HELMETS.find((h) => h.id === id);

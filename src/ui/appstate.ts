import type { Deck, FactState } from "../core/types";
import type { Meta, Profile, Registry } from "./store";

export type Route = "home" | "session" | "speed" | "park" | "collection" | "dashboard" | "profiles";

export interface App {
  deck: Deck;
  states: Map<string, FactState>;
  meta: Meta;
  day: number;
  /** The rider whose data is loaded, and everyone on this device. */
  profile: Profile;
  registry: Registry;
  go: (r: Route) => void;
  save: () => Promise<void>;
  /** Re-render the current screen in place. */
  refresh: () => void;
  /** The grown-ups' code is device-level, not per rider. */
  pin: () => string | null;
  setPin: (code: string) => void;
  saveRegistry: () => void;
  /** Make another rider the active one. Reloads: every screen assumes one
   *  profile for the life of the page. */
  switchProfile: (id: string) => void;
}

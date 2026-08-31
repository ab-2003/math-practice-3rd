import type { Deck, FactState } from "../core/types";
import type { Meta } from "./store";

export type Route = "home" | "session" | "collection" | "dashboard";

export interface App {
  deck: Deck;
  states: Map<string, FactState>;
  meta: Meta;
  day: number;
  go: (r: Route) => void;
  save: () => Promise<void>;
  /** Re-render the current screen in place. */
  refresh: () => void;
}

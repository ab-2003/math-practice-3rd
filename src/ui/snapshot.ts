/** A backup (cloud copy or file), shaped like a device's own data would be,
 *  so the one report draws from either. */

import type { Snapshot } from "../core/report";
import { allStates } from "../core/scheduler";
import type { Deck, FactState } from "../core/types";
import type { Backup } from "./store";

export const snapshotFromBackup = (deck: Deck, b: Backup): Snapshot => {
  const states = allStates(deck);
  for (const [id, s] of Object.entries(b.facts)) if (states.has(id)) states.set(id, s as FactState);
  return {
    deck, states, responses: b.responses ?? [], sessions: b.sessions ?? [],
    strands: b.meta.strands, caps: b.meta.caps,
  };
};

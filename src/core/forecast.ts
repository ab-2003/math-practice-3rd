/**
 * TOMORROW'S QUEUE. The parent question "what is he working on?" answered by
 * running the real planner one day ahead, so the answer is what the app will
 * actually do rather than a guess about it.
 */

import { planQueue } from "./session";
import type { Caps, Deck, Fact, States, Strands } from "./types";

export interface Forecast {
  /** Facts due for review. */
  due: number;
  /** New facts the planner would introduce. */
  fresh: Fact[];
  /** Weak facts pulled forward as top-up. */
  topUp: number;
  total: number;
}

export const forecast = (
  deck: Deck, states: States, day: number, strands: Strands, caps: Caps,
): Forecast => {
  const queue = planQueue(deck, states, day, strands, caps);
  let due = 0;
  let topUp = 0;
  const fresh: Fact[] = [];
  for (const id of queue) {
    const f = deck.get(id);
    const s = states.get(id);
    if (!f || !s) continue;
    if (!s.introduced) fresh.push(f);
    else if (s.dueOn <= day) due += 1;
    else topUp += 1;
  }
  return { due, fresh, topUp, total: queue.length };
};

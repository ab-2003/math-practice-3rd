/**
 * THE ONE PLACE COINS GO DOWN.
 *
 * LAW (Andy, 2026-09-02): any spend of coins requires confirmation. A monster,
 * a helmet, a board, a level: every one of them passes through this gate,
 * which shows the price, what would be left, and a Not-yet that costs
 * nothing. spend.test.ts proves no other file in src/ lowers the wallet.
 *
 * The gate never argues with an empty wallet: when the price is out of reach
 * it still opens, says what the thing is and what it costs, and offers only
 * a way back. Wanting a specific thing and saving for it IS the game.
 */

import type { App } from "./appstate";
import { el } from "./dom";
import { sheet } from "./sheet";

export interface SpendOpts {
  /** What is being bought, for the title: "Buy SKYHOOK?" / "SKYHOOK". */
  what: string;
  /** The verb on the confirm button: "Buy", "Level up". */
  verb: string;
  cost: number;
  /** Anything to show above the price line: art, lore, the perk ladder. */
  body?: Node;
  /** Runs AFTER the coins are taken and BEFORE the save. */
  onSpent: () => void;
  /** Not yet, Escape, or the scrim: nothing was taken. */
  onCancel?: () => void;
  /** For a probe to find the confirm. */
  probe?: string;
}

/** The price line, in the same words everywhere. */
export const priceLine = (cost: number, coins: number): string =>
  coins >= cost
    ? `${cost} coins. You have ${coins}, so you would have ${coins - cost} left.`
    : `${cost} coins. You have ${coins}, so keep landing tricks.`;

export const confirmSpend = (app: App, opts: SpendOpts): void => {
  const affordable = app.meta.coins >= opts.cost;
  const body = el("div", { class: "reveal", ...(opts.probe !== undefined ? { "data-probe": opts.probe } : {}) });
  if (opts.body !== undefined) body.append(opts.body);
  body.append(el("p", { class: "note", "data-probe": "price-line", text: priceLine(opts.cost, app.meta.coins) }));
  sheet({
    title: affordable ? `${opts.verb} ${opts.what}?` : opts.what,
    body,
    cancel: affordable ? "Not yet" : "OK",
    ...(opts.onCancel !== undefined ? { onCancel: opts.onCancel } : {}),
    ...(affordable ? {
      confirm: `${opts.verb} ◆${opts.cost}`,
      onConfirm: (): void => {
        // Re-check at the moment of truth: the sheet may have sat open.
        if (app.meta.coins < opts.cost) return;
        app.meta.coins -= opts.cost;
        opts.onSpent();
      },
    } : {}),
  });
};

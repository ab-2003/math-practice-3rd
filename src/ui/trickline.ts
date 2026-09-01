/**
 * THE TRICK LINE, ON SCREEN.
 *
 * The strip of five decks that fills as he lands tricks, and the LINE LANDED
 * banner, which exists because photographing the old build proved that
 * completing a line, the core act of an app named Trick Line, produced no
 * feedback at all: the strip silently reset and the +5 was invisible.
 *
 * LAW: coins bank at each landed trick and the banner is fixed-length
 * celebration, never a timer. It plays whether or not the ride animations
 * are switched on: the ride is decoration, the landed line is an EVENT.
 */

import type { Trick } from "../core/tricks";
import { LINE_LENGTH } from "../core/config";
import { el, svg } from "./dom";

const INK = "#05070A";

const deck = (state: "done" | "now" | "todo"): SVGElement => {
  const fill = state === "done" ? "#B6FF3C" : state === "now" ? "#FF8A1F" : "#1B2029";
  const stroke = state === "todo" ? "#2E3843" : INK;
  const g = svg("svg", { viewBox: "0 0 64 30", class: `deck ${state}` });
  g.append(svg("path", {
    d: "M8 6 C2 6 2 18 8 18 L56 18 C62 18 62 6 56 6 Z",
    fill, stroke, "stroke-width": 4, "stroke-linejoin": "round",
  }));
  g.append(svg("circle", { cx: 18, cy: 24, r: 5, fill: state === "todo" ? "#2E3843" : INK }));
  g.append(svg("circle", { cx: 46, cy: 24, r: 5, fill: state === "todo" ? "#2E3843" : INK }));
  return g;
};

/** The strip, drawn from THIS line's tricks: the vocabulary grows, so the
 *  names are data now, not constants. On phones, decks plus one label. */
export const lineStrip = (landed: number, tricks: readonly Trick[]): HTMLElement => {
  const wrap = el("div", { class: "line-wrap" });
  const row = el("div", { class: "line-strip", "aria-label": `${landed} of ${LINE_LENGTH} tricks landed` });
  for (let i = 0; i < LINE_LENGTH; i++) {
    const state = i < landed ? "done" : i === landed ? "now" : "todo";
    const cell = el("div", { class: `line-cell ${state}` }, deck(state));
    cell.append(el("span", { class: "trick-name", text: tricks[i]?.name ?? "" }));
    row.append(cell);
  }
  wrap.append(row);
  wrap.append(el("div", { class: "line-now", text: tricks[Math.min(landed, LINE_LENGTH - 1)]?.name ?? "" }));
  return wrap;
};

export interface BannerOpts {
  bonus: number;
  newTrick?: string | undefined;
}

/** LINE LANDED! Fixed ~1s, resolves when done, never trusts animationend
 *  alone (a backgrounded tab never fires it). */
export const playLineBanner = (host: HTMLElement, opts: BannerOpts): Promise<void> =>
  new Promise((resolve) => {
    const banner = el("div", { class: "line-banner", "data-probe": "line-banner" });
    banner.append(el("div", { class: "lb-title", text: "LINE LANDED!" }));
    banner.append(el("div", { class: "lb-coins", text: `+${opts.bonus}` }));
    if (opts.newTrick !== undefined) {
      banner.append(el("div", { class: "lb-new", text: `NEW TRICK: ${opts.newTrick}` }));
    }
    host.append(banner);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      banner.remove();
      resolve();
    };
    const timer = window.setTimeout(finish, opts.newTrick !== undefined ? 1500 : 1050);
    banner.addEventListener("animationend", () => { window.clearTimeout(timer); finish(); }, { once: true });
  });

/** The landing flourish used when ride animations are switched off. */
export const playLanding = (host: HTMLElement, name: string): Promise<void> =>
  new Promise((resolve) => {
    const pop = el("div", { class: "landing", text: name });
    host.append(pop);
    const done = (): void => { pop.remove(); resolve(); };
    const timer = window.setTimeout(done, 620);
    pop.addEventListener("animationend", () => { window.clearTimeout(timer); done(); }, { once: true });
  });

export const playBail = (host: HTMLElement): Promise<void> =>
  new Promise((resolve) => {
    const pop = el("div", { class: "bail", text: "BAIL" });
    host.append(pop);
    const done = (): void => { pop.remove(); resolve(); };
    const timer = window.setTimeout(done, 520);
    pop.addEventListener("animationend", () => { window.clearTimeout(timer); done(); }, { once: true });
  });

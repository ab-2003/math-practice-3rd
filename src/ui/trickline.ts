/**
 * THE TRICK LINE.
 *
 * Consecutive correct answers chain into a skate line. A wrong answer is a
 * BAIL, which is cheerful and expected: bailing is normal in skating, and
 * that framing is doing real work for a boy who avoids being wrong.
 *
 * LAW: coins are banked at each landed trick, never at the end of the line.
 * A bail costs the rest of the line and never takes back what he already
 * landed. Nothing in this app is ever removed from him.
 *
 * LAW: every animation here is FIXED duration regardless of how fast he
 * answered. A trick that plays faster when he is quicker is a visible timer
 * wearing a costume, and there are no timers in this app.
 */

import { LINE_LENGTH } from "../core/config";
import { el, svg } from "./dom";

export const TRICKS = ["OLLIE", "KICKFLIP", "GRIND", "360 SPIN", "BACKFLIP"] as const;

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

/** The row of five decks that fills as he lands tricks. */
export const lineStrip = (landed: number): HTMLElement => {
  const row = el("div", { class: "line-strip", "aria-label": `${landed} of ${LINE_LENGTH} tricks landed` });
  for (let i = 0; i < LINE_LENGTH; i++) {
    const state = i < landed ? "done" : i === landed ? "now" : "todo";
    const cell = el("div", { class: `line-cell ${state}` }, deck(state));
    cell.append(el("span", { class: "trick-name", text: TRICKS[i] ?? "" }));
    row.append(cell);
  }
  return row;
};

export const trickName = (index: number): string => TRICKS[index % TRICKS.length] ?? "TRICK";

/**
 * The landing flourish. Fixed 620ms, always, whatever the response time was.
 * Resolves when it is done so the caller can sequence rather than guess.
 */
export const playLanding = (host: HTMLElement, name: string): Promise<void> =>
  new Promise((resolve) => {
    const pop = el("div", { class: "landing", text: name });
    host.append(pop);
    const done = (): void => { pop.remove(); resolve(); };
    // Never depend on animationend alone: a suspended tab never fires it and
    // the session would wedge with no way forward.
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

/**
 * THE TRICK, PERFORMED.
 *
 * On a correct answer his creature rides across the stage and does the trick
 * the line is on: ollie, kickflip, grind, 360, backflip. The creature is the
 * newest one he owns, or a cameo of the one he is saving for, which is its own
 * kind of motivation.
 *
 * LAW (unchanged from the strip): the animation is FIXED DURATION regardless
 * of how fast he answered, plays identically for a retrieved and a derived
 * answer, and the next problem is not revealed until it is done. A kid-facing
 * toggle on the home screen turns it off entirely, same as sound.
 */

import type { Creature } from "../core/creatures";
import { creatureSvg } from "./creature-svg";
import { el, svg } from "./dom";

export const TRICK_MS = 760;

/** The board under his feet: chunky, acid, two fat wheels. */
const board = (): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 96 30", class: "trick-deck" });
  g.append(svg("path", {
    d: "M10 8 C2 8 2 20 10 20 L86 20 C94 20 94 8 86 8 Z",
    fill: "#B6FF3C", stroke: "#05070A", "stroke-width": 5, "stroke-linejoin": "round",
  }));
  g.append(svg("circle", { cx: 26, cy: 25, r: 6, fill: "#05070A" }));
  g.append(svg("circle", { cx: 70, cy: 25, r: 6, fill: "#05070A" }));
  return g;
};

/**
 * Play trick `index` (0..4) with `c` as the rider. Resolves when the run is
 * over; the caller reveals the next problem only after that. Never trusts
 * animationend alone: a backgrounded tab never fires it, and the session
 * would wedge with no way forward.
 */
export const playTrick = (host: HTMLElement, c: Creature, index: number, name: string): Promise<void> =>
  new Promise((resolve) => {
    // The answered problem ghosts out while the trick has the stage, and the
    // next one fades in after. Without this the rider hopped straight through
    // the old equation and the whole moment read as clutter.
    host.classList.add("riding");
    const run = el("div", { class: `trick-run trick-${index}` });
    const flip = el("div", { class: "trick-flip" });
    const art = creatureSvg(c);
    art.classList.add("trick-creature");
    flip.append(art, board());
    const rider = el("div", { class: "trick-rider" }, flip);
    if (index === 2) run.append(el("div", { class: "trick-rail" })); // the grind needs its rail
    run.append(rider);
    run.append(el("div", { class: "landing", text: name })); // the name still pops
    host.append(run);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      host.classList.remove("riding");
      run.remove();
      resolve();
    };
    const timer = window.setTimeout(finish, TRICK_MS + 160);
    rider.addEventListener("animationend", () => { window.clearTimeout(timer); finish(); }, { once: true });
  });

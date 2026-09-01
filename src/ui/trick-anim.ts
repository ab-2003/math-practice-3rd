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
import type { Helmet } from "../core/gear";
import type { Trick } from "../core/tricks";
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
export const playTrick = (host: HTMLElement, c: Creature, trick: Trick, level = 1, helmet?: Helmet): Promise<void> =>
  new Promise((resolve) => {
    // The answered problem ghosts out while the trick has the stage, and the
    // next one fades in after. Without this the rider hopped straight through
    // the old equation and the whole moment read as clutter.
    host.classList.add("riding");
    // The ride happens ON THE RAIL LANE, and the spot fades in dim just for
    // the trick, then vanishes. Andy's phone screenshot showed the scenery
    // tangled under the answer box during problems: the screen stays MINIMAL
    // while he thinks, and the world only appears when he lands something.
    const lane = host.parentElement ?? host;
    lane.classList.add("show-spot");
    const run = el("div", { class: `trick-run trick-${trick.anim}` });
    const flip = el("div", { class: "trick-flip" });
    const art = creatureSvg(c, { level, ...(helmet ? { helmet } : {}) });
    art.classList.add("trick-creature");
    flip.append(art, board());
    const rider = el("div", { class: "trick-rider" }, flip);
    if (trick.anim === 2 || trick.anim === 6) run.append(el("div", { class: "trick-rail" })); // grinds need their rail
    run.append(rider);
    run.append(el("div", { class: "landing", text: trick.name })); // the name still pops
    lane.append(run);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      host.classList.remove("riding");
      lane.classList.remove("show-spot");
      run.remove();
      resolve();
    };
    const timer = window.setTimeout(finish, TRICK_MS + 160);
    rider.addEventListener("animationend", (e) => {
      if (e.animationName !== "t-ride") return; // children's flips bubble here too
      window.clearTimeout(timer);
      finish();
    });
  });

/**
 * THE VICTORY LAP, Andy 2026-09-01: "you see him do all of the five tricks
 * on the rail start to finish" while the spot lights up.
 *
 * One continuous crossing, all five tricks in order, each name popping as it
 * lands, the landing sounds walking up the scale, and the backdrop blooming
 * from its working gray into color. The problems stay dim and gray on
 * purpose; the LAP is when the world lights.
 *
 * Fixed ~3.2s always, resolves when done, and the next problem waits for it.
 */
import { sfx } from "./sfx";

const LAP_MS = 3200;
const LAP_STEP = LAP_MS / 5;

export interface LapOpts {
  bonus: number;
  newTrick?: string | undefined;
}

export const playVictoryLap = (
  left: HTMLElement, stage: HTMLElement, c: Creature,
  tricks: readonly Trick[], level: number, opts: LapOpts, helmet?: Helmet,
): Promise<void> =>
  new Promise((resolve) => {
    const spot = left.querySelector(".spot");
    spot?.classList.add("lit");
    left.classList.add("show-spot"); // ghosts the equals row under the lap too
    stage.classList.add("riding");

    const run = el("div", { class: "lap-run" });
    const banner = el("div", { class: "lap-banner" });
    banner.append(el("div", { class: "lb-title", text: "LINE LANDED!" }));
    banner.append(el("div", { class: "lb-coins", text: `+${opts.bonus}` }));
    if (opts.newTrick !== undefined) banner.append(el("div", { class: "lb-new", text: `NEW TRICK: ${opts.newTrick}` }));
    run.append(banner);

    const flip = el("div", { class: "trick-flip" });
    const art = creatureSvg(c, { level, ...(helmet ? { helmet } : {}) });
    art.classList.add("trick-creature");
    flip.append(art, board());
    const label = el("div", { class: "lap-label" });
    const rider = el("div", { class: "lap-rider" }, flip, label);
    run.append(rider);
    left.append(run);

    const timers: number[] = [];
    tricks.forEach((trick, i) => {
      timers.push(window.setTimeout(() => {
        // Swap the trick class and force a restart, so each hop plays its
        // own keyframe mid-crossing.
        run.classList.remove(...Array.from(run.classList).filter((k) => k.startsWith("trick-")));
        void (flip as HTMLElement).offsetWidth;
        run.classList.add(`trick-${trick.anim}`);
        label.textContent = trick.name;
        label.classList.remove("pop");
        void (label as HTMLElement).offsetWidth;
        label.classList.add("pop");
        sfx.land(i);
      }, 60 + i * LAP_STEP));
    });

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      for (const t of timers) window.clearTimeout(t);
      spot?.classList.remove("lit");
      left.classList.remove("show-spot");
      stage.classList.remove("riding");
      run.remove();
      resolve();
    };
    const timer = window.setTimeout(finish, LAP_MS + 200);
    // animationend BUBBLES: the first 580ms trick hop was ending the whole
    // 3.2s lap, which cut the celebration to a single hop. Only the rider's
    // own crossing counts.
    rider.addEventListener("animationend", (e) => {
      if (e.animationName !== "lap-ride") return;
      window.clearTimeout(timer);
      finish();
    });
  });

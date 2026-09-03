/**
 * THE SKATE PARK, ON SCREEN (0.19.0). The rules live in core/park.ts; this
 * file draws them, listens to the finger, and makes the noises.
 *
 * The stage is a fixed-ratio box (PARK_W by PARK_H design units, scaled to
 * the width on hand). The world scrolls under a rider who stays put; his
 * height and his spin come from the model every frame. Obstacles are DOM
 * nodes born when the model lays them down and removed when they roll off
 * the left. The rider is the real thing: his monster, its board, its
 * helmet, drawn by the same renderers as everywhere else.
 *
 * INPUT is pointer events on the stage, nothing else: a press, and a
 * release that is either a tap (no travel), a hold (time), or a swipe
 * (travel, by its dominant axis). The model decides what those mean.
 *
 * THE CLOCK only runs while the run is live and the page is visible. A
 * sheet on top (leaving, the tutorial) pauses it; a hidden tab pauses it.
 * A token is spent the moment the run starts, never refunded.
 */

import { boardFor } from "../core/boards";
import { helmetById } from "../core/gear";
import {
  BASE_SPEED, chainLabel, gateWords, HOLD_MS, newRun, PARK_H, PARK_TRICKS, PARK_W, parkGate, press, release,
  RIDER_X, spendToken, spentToday, update, type Obstacle, type ParkEvent, type ParkState, type Swipe,
} from "../core/park";
import type { App } from "./appstate";
import { boardSvg } from "./board-svg";
import { creatureSvg } from "./creature-svg";
import { el, mount, on } from "./dom";
import { tokenIcon } from "./icons";
import { resolveRider } from "./screens";
import { sfx } from "./sfx";
import { sheet } from "./sheet";
import { toast } from "./toast";

const SWIPE_PX = 26;

/** Which way a finger went, by its dominant axis; null for a tap. */
export const swipeOf = (dx: number, dy: number): Swipe | null => {
  if (Math.hypot(dx, dy) < SWIPE_PX) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy < 0 ? "up" : "down";
};

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The quick tutorial: four cards, the first time and from the ? button. */
const tutorial = (onDone: () => void): void => {
  const cards: Array<{ title: string; body: string; pic: (g: HTMLElement) => void }> = [
    { title: "Tap to ollie", body: "TAP anywhere to jump. HOLD, then let go, for a bigger one.", pic: (g) => g.append(gesture("tap")) },
    { title: "Swipe in the air for a trick", body: "Up KICKFLIP · down NOSE GRAB · right 360 SPIN · left BACKFLIP. Swipe on the ground and you jump straight into it.", pic: (g) => g.append(gesture("swipe")) },
    { title: "Land it, or bail", body: "A trick takes time. Touch down before it is done and you bail. Longer tricks need bigger air: hold the ollie, or hit a kicker ramp.", pic: (g) => g.append(gesture("land")) },
    { title: "Rails and chains", body: "Ollie ONTO a rail to grind, tap to hop off. Every trick and grind before you touch flat ground joins one chain, and the chain pays its points TIMES its length.", pic: (g) => g.append(gesture("rail")) },
  ];
  let i = 0;
  const show = (): void => {
    const c = cards[i]!;
    const body = el("div", { class: "reveal tut", "data-probe": "park-tutorial" });
    const pic = el("div", { class: "tut-pic" });
    c.pic(pic);
    body.append(pic);
    body.append(el("p", { class: "mon-lore", text: c.body }));
    body.append(el("div", { class: "mon-sub", text: `${i + 1} of ${cards.length}` }));
    const last = i === cards.length - 1;
    sheet({
      title: c.title, body,
      ...(last ? {} : { cancel: "Skip" }),
      confirm: last ? "Let's skate" : "Next",
      onConfirm: () => { if (last) onDone(); else { i += 1; show(); } },
      onCancel: onDone,
    });
  };
  show();
};

/** Little ink pictograms for the tutorial: a finger, an arrow, a rail. */
const gesture = (kind: "tap" | "swipe" | "land" | "rail"): HTMLElement => {
  const wrap = el("div", { class: `tut-g tut-${kind}` });
  const finger = el("div", { class: "tut-finger" });
  if (kind === "tap") { wrap.append(finger, el("div", { class: "tut-ring" })); }
  else if (kind === "swipe") {
    wrap.append(el("div", { class: "tut-arrow up", text: "↑" }), el("div", { class: "tut-arrow down", text: "↓" }),
      el("div", { class: "tut-arrow left", text: "←" }), el("div", { class: "tut-arrow right", text: "→" }), finger);
  } else if (kind === "land") {
    wrap.append(el("div", { class: "tut-arc" }), el("div", { class: "tut-ground" }), el("div", { class: "tut-board" }));
  } else {
    wrap.append(el("div", { class: "tut-railbar" }), el("div", { class: "tut-ground" }), el("div", { class: "tut-board on-rail" }));
  }
  return wrap;
};

export const parkScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen park-screen" });
  const bar = el("div", { class: "topbar park-bar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  const tokens = el("span", { class: "tokens pill", "data-probe": "park-tokens" }, tokenIcon(), el("span", { class: "tok-n", text: String(app.meta.tokens) }));
  const help = el("button", { type: "button", class: "btn small ghost", "aria-label": "How to play", title: "How to play", "data-probe": "park-help" }, el("span", { text: "?" }));
  bar.append(back, el("div", { class: "grow" }, el("h2", { text: "Skate Park" })), tokens, help);
  root.append(bar);

  // ---- the gate ---------------------------------------------------------------
  const gate = parkGate(app.meta, app.day);
  if (!gate.ok) {
    const card = el("div", { class: "card reveal", "data-probe": "park-locked" });
    card.append(tokenIcon("token-big"));
    card.append(el("h2", { text: gate.why === "noToken" ? "No token yet" : "Park's closed for today" }));
    card.append(el("p", { class: "note", text: gateWords(gate, app.meta) }));
    if (gate.why === "noToken") {
      const go = el("button", { type: "button", class: "btn go big" }, el("span", { text: "Drop In" }));
      on(go, "click", () => app.go("session"));
      card.append(go);
    }
    root.append(card);
    on(back, "click", () => app.go("home"));
    on(help, "click", () => tutorial(() => undefined));
    return root;
  }

  // ---- the stage --------------------------------------------------------------
  const timer = el("div", { class: "speed-timer park-timer" });
  const fill = el("div", { class: "speed-fill" });
  timer.append(fill);
  const hud = el("div", { class: "park-hud" });
  const scoreEl = el("div", { class: "park-score", "data-probe": "park-score", text: "0" });
  const clockEl = el("div", { class: "park-clock", "data-probe": "park-clock", text: fmtTime(app.meta.parkMinutes * 60_000) });
  const chainEl = el("div", { class: "park-chain", "data-probe": "park-chain" });
  hud.append(scoreEl, chainEl, clockEl);

  const stage = el("div", { class: "park-stage", "data-probe": "park-stage" });
  // The backdrop: a far skyline that drifts, a ground band whose ticks
  // stream, so the eye reads SPEED even between obstacles.
  const far = el("div", { class: "park-far" });
  const skyline = (): HTMLElement => {
    const strip = el("div", { class: "park-skyline" });
    const heights = [28, 46, 36, 60, 30, 52, 40, 70, 34, 48, 58, 30, 44, 64, 38];
    for (const h of heights) strip.append(el("i", { style: `height:${h}%` }));
    return strip;
  };
  far.append(skyline(), skyline());
  far.append(el("div", { class: "park-moon" }));
  const world = el("div", { class: "park-world" });
  const ground = el("div", { class: "park-ground" });
  const riderEl = el("div", { class: "park-rider", "data-probe": "park-rider" });
  const flip = el("div", { class: "park-flip" });
  const riderC = resolveRider(app);
  const helmId = app.meta.gear[riderC.id];
  const helm = helmId !== undefined ? helmetById(helmId) : undefined;
  const deck = boardFor(app.meta.boardOf, riderC.id, app.meta.boardsOwned);
  const art = creatureSvg(riderC, { level: app.meta.levels[riderC.id] ?? 1, ...(helm ? { helmet: helm } : {}) });
  art.classList.add("park-creature");
  const board = boardSvg(deck, { riding: true, cls: "park-deck" });
  flip.append(art, board);
  const sparks = el("div", { class: "park-sparks" });
  const puff = el("div", { class: "park-puff" });
  riderEl.append(flip, sparks, puff);
  const pops = el("div", { class: "park-pops" });
  stage.append(far, ground, world, riderEl, pops);
  root.append(timer, hud, stage);

  // ---- state ------------------------------------------------------------------
  let s: ParkState | null = null;
  let scale = 1;
  let raf = 0;
  let last = 0;
  let paused = 0; // sheets open + hidden tab
  let manual = false; // a probe drives the clock by hand
  let finished = false;
  let grindBeat = 0;
  const nodes = new Map<number, HTMLElement>();
  const trickCls = PARK_TRICKS.map((t) => `pk-${t.id}`);

  // The stage fits the WIDTH on hand, unless the height on hand is shorter
  // (an iPad on its side): then it fits that and sits centred.
  const layout = (): void => {
    const w = root.clientWidth || 560;
    const top = stage.getBoundingClientRect().top;
    const avail = Math.max(160, window.innerHeight - top - 18);
    scale = Math.min(w / PARK_W, avail / PARK_H);
    stage.style.width = `${Math.round(PARK_W * scale)}px`;
    stage.style.height = `${Math.round(PARK_H * scale)}px`;
    riderEl.style.left = `${RIDER_X * scale}px`;
    riderEl.style.width = `${150 * scale}px`;
    far.style.setProperty("--strip", `${Math.round(PARK_W * scale * 1.4)}px`);
  };

  const px = (u: number): number => u * scale;

  const obstacleNode = (o: Obstacle): HTMLElement => {
    const n = el("div", { class: `park-ob park-${o.kind}`, "data-ob": o.kind });
    n.style.width = `${px(o.w)}px`;
    if (o.kind === "gap") { n.style.height = `${px(30)}px`; }
    else { n.style.height = `${px(o.h)}px`; }
    if (o.kind === "rail") {
      n.append(el("div", { class: "rail-bar" }), el("div", { class: "rail-leg l" }), el("div", { class: "rail-leg r" }));
    } else if (o.kind === "kicker") {
      n.append(el("div", { class: "kicker-face" }));
    } else if (o.kind === "box") {
      n.append(el("div", { class: "box-stripe" }));
    }
    return n;
  };

  const draw = (st: ParkState): void => {
    // The backdrop drifts at a quarter of the line; the ground ticks stream at full.
    const stripW = PARK_W * scale * 1.4;
    far.style.transform = `translateX(${-((st.scroll * 0.25 * scale) % stripW)}px)`;
    ground.style.backgroundPositionX = `${-((st.scroll * scale) % 80)}px`;
    // The world: every obstacle at (x - scroll).
    for (const o of st.obstacles) {
      let n = nodes.get(o.id);
      if (!n) { n = obstacleNode(o); nodes.set(o.id, n); world.append(n); }
      n.style.transform = `translateX(${px(o.x - st.scroll)}px)`;
    }
    for (const [id, n] of nodes) {
      if (!st.obstacles.some((o) => o.id === id)) { n.remove(); nodes.delete(id); }
    }
    // The rider: height, crouch, spin.
    const r = st.rider;
    riderEl.style.bottom = `calc(10% + ${px(r.y)}px)`;
    let t = "";
    if (r.mode === "bail") {
      const p = Math.min(1, r.bailT * 1000 / 900);
      t = `rotate(${-70 * Math.sin(p * Math.PI)}deg) translateY(${px(10 * Math.sin(p * Math.PI))}px)`;
    } else if (r.trick !== null) {
      const p = Math.min(1, r.trickT * 1000 / r.trick.ms);
      if (r.trick.id === "backflip") t = `rotate(${-360 * p}deg)`;
      else if (r.trick.id === "spin") t = `rotateY(${360 * p}deg)`;
      else if (r.trick.id === "grab") t = `scale(0.94, 0.86) rotate(${-14 * Math.sin(p * Math.PI)}deg)`;
      else t = `rotate(${-8 * Math.sin(p * Math.PI)}deg)`;
    } else if (r.holding && (r.mode === "ground" || r.mode === "grind")) {
      const c = Math.min(1, (r.holdT * 1000) / HOLD_MS);
      t = `scale(${1 + c * 0.04}, ${1 - c * 0.14})`;
    } else if (r.mode === "air") {
      t = `rotate(${Math.max(-10, Math.min(10, -r.vy / 70))}deg)`;
    }
    flip.style.transform = t;
    // The deck spins on its own for a kickflip.
    if (r.trick?.id === "kickflip") board.style.transform = `rotate(${360 * Math.min(1, r.trickT * 1000 / r.trick.ms)}deg)`;
    else board.style.transform = "";
    riderEl.classList.toggle("grinding", r.mode === "grind");
    riderEl.classList.toggle("bailed", r.mode === "bail");
    riderEl.classList.toggle("charging", r.holding && r.mode !== "air");
    for (const c of trickCls) riderEl.classList.remove(c);
    if (r.trick) riderEl.classList.add(`pk-${r.trick.id}`);
    // The HUD.
    scoreEl.textContent = String(st.score);
    clockEl.textContent = fmtTime(st.timeLeftMs);
    fill.style.width = `${(st.timeLeftMs / (app.meta.parkMinutes * 60_000)) * 100}%`;
    chainEl.textContent = st.chain.length > 0 ? `${chainLabel(st.chain)} ×${Math.min(5, st.chain.length)}` : "";
    chainEl.classList.toggle("on", st.chain.length > 0);
    stage.style.setProperty("--park-speed", `${(st.speed / BASE_SPEED).toFixed(2)}`);
  };

  const pop = (text: string, cls = ""): void => {
    const p = el("div", { class: `park-pop ${cls}`, text });
    // Stacked by how many are still up, so two pops never print over each other.
    const live = pops.childElementCount;
    p.style.top = `${(cls.includes("bank") ? 6 : 34) + live * 11}%`;
    if (!cls.includes("bank")) p.style.left = `${RIDER_X * scale}px`;
    pops.append(p);
    window.setTimeout(() => p.remove(), 1000);
  };

  const react = (ev: ParkEvent[]): void => {
    for (const e of ev) {
      switch (e.kind) {
        case "ollie": sfx.pop(e.charge); break;
        case "kick": sfx.launch(); pop("KICKER!", "warm"); break;
        case "trick": sfx.whoosh(e.trick.ms); break;
        case "trickDone": pop(e.trick.name); break;
        case "land": sfx.thud(); break;
        case "grind": sfx.grindTick(); grindBeat = 0; pop("GRIND"); break;
        case "grindEnd": break;
        case "bail": sfx.crash(); pop(e.why === "gap" ? "SPLASH!" : "BAIL!", "hot"); puff.classList.remove("go"); void puff.offsetWidth; puff.classList.add("go"); break;
        case "bank": sfx.bank(e.mult); pop(`+${e.points}`, `bank m${Math.min(5, e.mult)}`); scoreEl.classList.remove("bump"); void scoreEl.offsetWidth; scoreEl.classList.add("bump"); break;
        case "timeUp": void end(); break;
      }
    }
  };

  const frame = (now: number): void => {
    if (finished || s === null || manual) return;
    raf = requestAnimationFrame(frame);
    if (paused > 0) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
  };

  /** One tick of the real clock; the probe's __park.tick uses this too. */
  const step = (dt: number): void => {
    if (s === null) return;
    const ev = update(s, dt);
    if (s.rider.mode === "grind") { grindBeat += dt; if (grindBeat > 0.16) { grindBeat = 0; sfx.grindTick(); } }
    react(ev);
    draw(s);
  };

  // ---- input --------------------------------------------------------------------
  let pointer: { id: number; x: number; y: number } | null = null;
  on(stage, "pointerdown", (e) => {
    if (s === null || !s.running || paused > 0 || pointer !== null) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    stage.setPointerCapture?.(e.pointerId);
    press(s);
    e.preventDefault();
  });
  const up = (e: PointerEvent): void => {
    if (pointer === null || e.pointerId !== pointer.id || s === null) return;
    const sw = swipeOf(e.clientX - pointer.x, e.clientY - pointer.y);
    pointer = null;
    const ev: ParkEvent[] = [];
    release(s, sw, ev);
    react(ev);
    e.preventDefault();
  };
  on(stage, "pointerup", up);
  on(stage, "pointercancel", up);
  on(stage, "contextmenu", (e) => e.preventDefault());

  // ---- the run --------------------------------------------------------------------
  const begin = (): void => {
    spendToken(app.meta, app.day);
    void app.save();
    tokens.querySelector(".tok-n")!.textContent = String(app.meta.tokens);
    s = newRun(app.meta.parkMinutes, Math.floor(Math.random() * 1e9));
    layout();
    draw(s);
    mount(pops);
    // A short READY / GO beat, then the clock.
    stage.classList.add("ready");
    const call = el("div", { class: "park-call" }, el("span", { class: "bc-big", text: "DROP IN!" }), el("span", { class: "bc-sub", text: `${app.meta.parkMinutes} minutes · tap to ollie` }));
    stage.append(call);
    window.setTimeout(() => {
      call.remove();
      stage.classList.remove("ready");
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }, 1300);
  };

  const end = async (): Promise<void> => {
    if (finished || s === null) return;
    finished = true;
    cancelAnimationFrame(raf);
    sfx.horn();
    const st = s;
    const newBest = st.score > app.meta.parkBest;
    if (newBest) app.meta.parkBest = st.score;
    if (st.bestChain > app.meta.parkBestChain) app.meta.parkBestChain = st.bestChain;
    await app.save();
    const body = el("div", { class: "reveal", "data-probe": "park-results" });
    body.append(el("h2", { class: "park-final", text: String(st.score) }));
    const bits = [`${st.tricksLanded} ${st.tricksLanded === 1 ? "trick" : "tricks"} landed`, `best chain ${st.bestChain}`, `${st.bails} ${st.bails === 1 ? "bail" : "bails"}`];
    body.append(el("p", { class: "note", text: bits.join("  ·  ") }));
    if (newBest && st.score > 0) body.append(el("p", { class: "best-line", text: "NEW BEST!" }));
    else if (app.meta.parkBest > 0) body.append(el("p", { class: "note", text: `Best: ${app.meta.parkBest}` }));
    const again = parkGate(app.meta, app.day);
    body.append(el("p", { class: "note", text: gateWords(again, app.meta) }));
    sheet({
      title: "Time's up!", body,
      cancel: "Done", onCancel: () => app.go("home"),
      ...(again.ok ? { confirm: "Another token", onConfirm: () => app.go("park") } : {}),
    });
  };

  // Leaving mid-run: the clock keeps running against the token, so ask.
  on(back, "click", () => {
    if (s === null || finished || !s.running) { finished = true; cancelAnimationFrame(raf); app.go("home"); return; }
    paused += 1;
    sheet({
      title: "Leave the park?",
      body: `${fmtTime(s.timeLeftMs)} of this token is still on the clock, and it is not refunded.`,
      cancel: "Keep skating", confirm: "Leave", danger: true,
      onCancel: () => { paused -= 1; last = performance.now(); },
      onConfirm: () => { finished = true; cancelAnimationFrame(raf); app.go("home"); },
    });
  });
  on(help, "click", () => {
    paused += 1;
    tutorial(() => { paused -= 1; last = performance.now(); });
  });
  const onVis = (): void => {
    if (document.hidden) paused += 1; else { paused = Math.max(0, paused - 1); last = performance.now(); }
  };
  document.addEventListener("visibilitychange", onVis);
  const onResize = (): void => { layout(); if (s) draw(s); };
  window.addEventListener("resize", onResize);
  // Tear down with the screen: the observer notices when the root is gone.
  const watch = window.setInterval(() => {
    if (!root.isConnected) { window.clearInterval(watch); finished = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", onResize); }
  }, 500);

  // ---- entry: confirm the token, tutorial the first time -----------------------------
  const spendSheet = (): void => {
    const body = el("div", { class: "reveal", "data-probe": "park-gate" });
    body.append(tokenIcon("token-big"));
    body.append(el("p", { class: "mon-lore", text: `One Daily Token buys ${app.meta.parkMinutes} minutes in the park.` }));
    body.append(el("p", { class: "note", text: gateWords(gate, app.meta) }));
    sheet({
      title: "Spend a token?", body,
      cancel: "Not now", onCancel: () => app.go("home"),
      confirm: "Drop in", onConfirm: () => {
        if (!app.meta.parkSeen) {
          app.meta.parkSeen = true;
          void app.save();
          tutorial(begin);
        } else begin();
      },
    });
  };
  window.setTimeout(() => { layout(); spendSheet(); }, 30);
  void toast; void spentToday;

  (window as unknown as Record<string, unknown>).__park = {
    state: () => s,
    tick: (dt: number) => step(dt),
    /** Stop the real clock so a probe can drive time by hand. */
    hold: () => { manual = true; cancelAnimationFrame(raf); },
    swipe: swipeOf,
    end: () => { void end(); },
  };
  return root;
};

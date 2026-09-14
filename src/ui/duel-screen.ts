/**
 * HALF PIPE DUELS, ON SCREEN (0.23.0). The rules live in core/duel.ts; this
 * file draws them, listens to the finger and the keypad, and makes the
 * noises.
 *
 * Three views. THE PICK: 10, 15 or 20 rounds, each with today's plays and
 * the won/lost record. THE REVEAL: the opponent, a random monster from the
 * roster in a random lid on a random deck (never his own), and a line of
 * good-sport trash talk, narrated when the device can. THE DUEL: the half
 * pipe, a status strip (his score, the round, theirs), and THE DECK: his
 * hint on his runs; the problem, the meter and THE KEYPAD on the
 * computer's. The keypad is the session's own, the same three by four pad
 * with the same keys (Andy: "it can't be a different format").
 *
 * WHERE THE DECK GOES. On a tablet on its side it is a column beside the
 * pipe, so the pipe keeps the whole height and the pad its full size, and
 * nothing moves when the turn changes. On a phone or a portrait tablet it
 * sits under the pipe: the hint is one small block on his runs and the
 * pad rises for the computer's, and the stage takes what is left, laid
 * out again at the block change, under the TURN call. Either way the
 * stage is DUEL_H design units tall, as wide as its box's aspect (clamped
 * 1:1 to 2.2:1) makes it, always inside its box, never under the pad.
 *
 * INPUT on his runs is pointer events on the whole screen, buttons and
 * keys excepted: a tap or a swipe by its dominant axis, as in the park.
 * On the computer's runs the keypad is the input, and the answer submits
 * itself at the right length.
 */

import { boardFor, BOARDS, PLAIN_BOARD, type Board } from "../core/boards";
import { ROSTER, type Creature } from "../core/creatures";
import { HELMETS, helmetById, type Helmet } from "../core/gear";
import {
  ASK_MS, askClear, askKey, askSubmit, begin, courseFor, DUEL_H, DUEL_LENS, duelPlaysLeft, duelPlaysTotal, earnDuelToken, gesture, newDuel,
  recordDuel, surfaceSlope, surfaceY, trashTalk, update, useDuelPlay, type DuelEvent, type DuelLen, type DuelState, type Skater, type Who,
} from "../core/duel";
import { inPlay } from "../core/session";
import { PARK_TRICKS } from "../core/park";
import type { App } from "./appstate";
import { boardSvg } from "./board-svg";
import { creatureSvg } from "./creature-svg";
import { el, mount, on, svg } from "./dom";
import { duelIcon } from "./icons";
import { keypad, type Keypad } from "./keypad";
import { swipeOf } from "./park-screen";
import { doseDone, resolveRider } from "./screens";
import { sfx } from "./sfx";
import { sheet } from "./sheet";

/** The band under the flat, in design units. */
const GROUND = 18;
/** The skater's art, in design units of width. */
const SKATER_W = 116;
/** How long the winner dances before the screen goes home. */
const WIN_MS = 4600;

interface Rig { creature: Creature; helmet: Helmet | undefined; board: Board; level: number; name: string }

/** His own rig: the monster he rides, its lid, its deck, its level. */
const ownRig = (app: App): Rig => {
  const c = resolveRider(app);
  const helmId = app.meta.gear[c.id];
  return {
    creature: c,
    helmet: helmId !== undefined ? helmetById(helmId) : undefined,
    board: boardFor(app.meta.boardOf, c.id, app.meta.boardsOwned),
    level: app.meta.levels[c.id] ?? 1,
    name: app.meta.names[c.id] ?? c.name,
  };
};

const pickOne = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

/** An opponent: any monster, any lid, any deck, none of them his. */
const pickOpponent = (mine: Rig): Rig => {
  const creature = pickOne(ROSTER.filter((c) => c.id !== mine.creature.id));
  const helmet = pickOne(HELMETS.filter((h) => h.id !== mine.helmet?.id));
  const board = pickOne(BOARDS.filter((b) => b.id !== mine.board.id && b.id !== PLAIN_BOARD));
  return { creature, helmet, board, level: 1, name: creature.name };
};

/** Say it out loud where the device can, unless the sound is off. */
const narrate = (app: App, text: string): void => {
  try {
    if (app.meta.muted || typeof window.speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 1.15;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* no voice on this device */ }
};

const rigArt = (rig: Rig, cls: string): HTMLElement => {
  const flip = el("div", { class: `park-flip ${cls}` });
  const art = creatureSvg(rig.creature, { level: rig.level, ...(rig.helmet ? { helmet: rig.helmet } : {}) });
  art.classList.add("park-creature");
  flip.append(art, boardSvg(rig.board, { riding: true, cls: "park-deck" }));
  return flip;
};

export const duelScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen duel-screen" });
  const bar = el("div", { class: "topbar duel-bar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  const roundPill = el("span", { class: "pill duel-round", "data-probe": "duel-round" });
  // Two titles, one row: the phone's bar has no room for the long one
  // beside the round pill (the streak pill's own long/short pattern).
  bar.append(back, el("div", { class: "grow" }, el("h2", {}, el("span", { class: "long", text: "Half Pipe Duel" }), el("span", { class: "short", text: "Duel" }))), roundPill);
  root.append(bar);
  const body = el("div", { class: "duel-body" });
  root.append(body);

  const mine = ownRig(app);
  // The facts on offer are exactly the parent's practice settings.
  const facts = [...app.deck.values()].filter((f) => inPlay(f, app.meta.strands, app.meta.caps));
  // The day's work earns its token wherever the day was finished.
  if (doseDone(app)) { if (earnDuelToken(app.meta, app.day)) void app.save(); }

  let s: DuelState | null = null;
  let len: DuelLen = 10;
  let opp: Rig = mine;
  let finished = false;

  // ---- the pick ---------------------------------------------------------------
  const pickView = (): HTMLElement => {
    roundPill.hidden = true;
    const card = el("div", { class: "card duel-pick reveal", "data-probe": "duel-pick" });
    card.append(duelIcon("duel-big"));
    card.append(el("h2", { text: "Pick your duel" }));
    card.append(el("p", { class: "note", text: "Five runs of yours, then five problems to make them bail. Solve fast and they fall; skate big and you pull ahead. Tap on the flat to ollie, swipe in the air for tricks." }));
    const total = duelPlaysTotal(app.meta, app.day);
    card.append(el("p", { class: "mon-sub", "data-probe": "duel-plays", text: total === 0
      ? "No plays left today. Finish today's tricks for another duel token."
      : `${app.meta.duelTokens} duel ${app.meta.duelTokens === 1 ? "token" : "tokens"} today: one play of each length per token` }));
    if (facts.length === 0) card.append(el("p", { class: "note", "data-probe": "duel-no-facts", text: "Switch an operation on in the grown-ups' settings first." }));
    const lens = el("div", { class: "duel-lens" });
    for (const n of DUEL_LENS) {
      const left = duelPlaysLeft(app.meta, app.day, n);
      const rec = app.meta.duelRecord[n];
      const b = el("button", {
        type: "button", class: "btn big alt park-btn duel-len", "data-probe": `duel-len-${n}`,
        ...(left <= 0 || facts.length === 0 ? { disabled: true } : {}),
      }, el("span", { text: `${n} rounds` }),
        el("small", { class: "park-sub", text: `${left} ${left === 1 ? "play" : "plays"} left · won ${rec.won}, lost ${rec.lost}` }));
      on(b, "click", () => { len = n; mount(body, revealView()); });
      lens.append(b);
    }
    card.append(lens);
    return card;
  };

  // ---- the reveal -------------------------------------------------------------
  const revealView = (): HTMLElement => {
    opp = pickOpponent(mine);
    const line = trashTalk(Math.floor(Math.random() * 1e6));
    const card = el("div", { class: "card duel-reveal reveal", "data-probe": "duel-reveal" });
    card.append(el("h2", { text: `${opp.name} wants ${len} rounds` }));
    const face = el("div", { class: "duel-face", "data-probe": "duel-opponent", "data-mon": opp.creature.id, "data-helmet": opp.helmet?.id ?? "", "data-board": opp.board.id });
    face.append(rigArt(opp, "duel-face-rig"));
    card.append(face);
    card.append(el("div", { class: "duel-bubble", "data-probe": "trash-talk", text: line }));
    card.append(el("p", { class: "mon-sub", text: `${opp.name} · ${opp.helmet?.name ?? "no lid"} · ${opp.board.name}` }));
    const row = el("div", { class: "row duel-row" });
    const not = el("button", { type: "button", class: "btn ghost big", "data-probe": "duel-not-now" }, el("span", { text: "Not now" }));
    const go = el("button", { type: "button", class: "btn go big", "data-probe": "duel-go" }, el("span", { text: "Drop in" }));
    on(not, "click", () => mount(body, pickView()));
    on(go, "click", () => {
      if (!useDuelPlay(app.meta, app.day, len)) { mount(body, pickView()); return; }
      void app.save();
      mount(body, duelView());
    });
    row.append(not, go);
    card.append(row);
    narrate(app, line);
    return card;
  };

  // ---- the duel ---------------------------------------------------------------
  let scale = 1;
  let raf = 0;
  let last = 0;
  let paused = 0;
  let manual = false;
  let pointer: { id: number; x: number; y: number } | null = null;

  const duelView = (): HTMLElement => {
    roundPill.hidden = false;
    const wrap = el("div", { class: "duel-live" });
    const main = el("div", { class: "duel-main" });
    const arena = el("div", { class: "duel-arena" });
    const stage = el("div", { class: "duel-stage park-stage", "data-probe": "duel-stage" });
    const scene = el("div", { class: "park-scene duel-scene" });
    const pipe = svg("svg", { class: "duel-pipe", preserveAspectRatio: "none" });
    const you = el("div", { class: "duel-skater you", "data-probe": "duel-you-rig" });
    const them = el("div", { class: "duel-skater them", "data-probe": "duel-them-rig" });
    const youFlip = rigArt(mine, "");
    const themFlip = rigArt(opp, "");
    you.append(youFlip); them.append(themFlip);
    scene.append(pipe, them, you);
    const pops = el("div", { class: "park-pops" });
    const call = el("div", { class: "duel-call", "data-probe": "duel-call" });
    call.hidden = true;
    stage.append(scene, pops, call);
    arena.append(stage);

    // The status strip under the pipe; the deck is a hint or the ask.
    const status = el("div", { class: "duel-status", "data-probe": "duel-status" });
    const youScore = el("span", { class: "duel-score", "data-probe": "duel-you", text: "0" });
    const themScore = el("span", { class: "duel-score", "data-probe": "duel-them", text: "0" });
    status.append(
      el("div", { class: "duel-side you" }, el("b", { class: "duel-name", text: mine.name }), youScore),
      el("div", { class: "duel-vs", text: "vs" }),
      el("div", { class: "duel-side them" }, themScore, el("b", { class: "duel-name", text: opp.name })),
    );
    const deck = el("div", { class: "duel-deck", "data-probe": "duel-deck" });
    const hint = el("div", { class: "duel-hint", "data-probe": "duel-hint" });
    const hintBig = el("b", { class: "duel-hint-big" });
    const hintSub = el("span", { class: "duel-hint-sub" });
    const hintTricks = el("span", { class: "duel-tricks", text: PARK_TRICKS.map((t) => `${{ up: "↑", down: "↓", right: "→", left: "←" }[t.swipe]} ${t.name} ${t.points}`).join("  ·  ") });
    hint.append(hintBig, hintSub, hintTricks);
    const ask = el("div", { class: "duel-ask", "data-probe": "duel-ask" });
    const prob = el("span", { class: "duel-prob", "data-probe": "duel-problem" });
    const typed = el("span", { class: "duel-typed", "data-probe": "duel-typed" });
    const q = el("div", { class: "duel-q" }, prob, el("span", { class: "duel-eq", text: "=" }), typed);
    const meter = el("div", { class: "speed-timer duel-meter" });
    const fill = el("div", { class: "speed-fill", "data-probe": "duel-meter" });
    meter.append(fill);
    const pad: Keypad = keypad({
      onFirstKey: () => undefined,
      onChange: (v) => {
        if (s === null || s.ask === null) return;
        const ev: DuelEvent[] = [];
        if (v === "") askClear(s);
        else if (v.length > s.ask.typed.length) askKey(s, v[v.length - 1]!, ev);
        react(ev);
        draw();
      },
      onSubmit: () => { if (s === null) return; const ev: DuelEvent[] = []; askSubmit(s, ev); react(ev); draw(); },
    });
    ask.append(q, meter, pad.root);
    deck.append(ask, hint);
    main.append(arena, status);
    wrap.append(main, deck);

    // ---- layout: the stage fits its box, the course follows the stage -----------
    const layout = (): void => {
      // Measure the box with the stage let go of its old size, or the old
      // size is what gets measured and the deck's change never reaches it.
      stage.style.width = ""; stage.style.height = "";
      const bw = arena.clientWidth;
      const bh = arena.clientHeight;
      if (bw < 40 || bh < 40) return;
      const aspect = Math.max(1, Math.min(2.2, bw / bh));
      const w = Math.round(DUEL_H * aspect);
      // The stage fits INSIDE its box on both axes: a box taller than it
      // is wide fits by width, and the stage never pushes past the glass.
      scale = Math.min(bh / DUEL_H, bw / w);
      stage.style.width = `${Math.floor(w * scale)}px`;
      stage.style.height = `${Math.floor(DUEL_H * scale)}px`;
      if (s !== null && s.course.w !== w) {
        // Turned mid-duel: the skaters keep their place along the pipe.
        for (const sk of [s.you, s.them]) sk.x = (sk.x * w) / s.course.w;
        s.course = courseFor(w);
      }
      const c = s?.course ?? courseFor(w);
      drawPipe(c);
      for (const n of [you, them]) n.style.width = `${px(SKATER_W)}px`;
    };
    const px = (u: number): number => u * scale;

    const drawPipe = (c: { w: number; h: number; deck: number; wall: number; top: number }): void => {
      pipe.setAttribute("viewBox", `0 0 ${c.w} ${c.h}`);
      while (pipe.firstChild) pipe.removeChild(pipe.firstChild);
      const yOf = (x: number): number => c.h - GROUND - surfaceY(c, x);
      const pts: string[] = [];
      for (let x = 0; x <= c.w; x += 3) pts.push(`${x} ${yOf(x).toFixed(1)}`);
      pts.push(`${c.w} ${yOf(c.w).toFixed(1)}`);
      const line = `M${pts.join(" L")}`;
      pipe.append(svg("path", { d: `${line} L${c.w} ${c.h} L0 ${c.h} Z`, fill: "#232C3B", stroke: "#05070A", "stroke-width": 3, "vector-effect": "non-scaling-stroke" }));
      // The flat, a shade lighter, so the bottom reads as the floor it is.
      pipe.append(svg("rect", { x: c.deck + c.wall, y: c.h - GROUND - 3, width: Math.max(0, c.w - 2 * (c.deck + c.wall)), height: 3, fill: "#2E3A4B" }));
      pipe.append(svg("path", { d: line, fill: "none", stroke: "#8A97A6", "stroke-width": 3, "vector-effect": "non-scaling-stroke" }));
      // The coping at each lip, and the decks' edges.
      for (const x of [c.deck, c.w - c.deck]) {
        pipe.append(svg("circle", { cx: x, cy: yOf(x), r: 5, fill: "#8A97A6", stroke: "#05070A", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
      }
      pipe.append(svg("rect", { x: 0, y: c.h - GROUND, width: c.w, height: GROUND, fill: "#1B2029" }));
    };

    // ---- drawing -----------------------------------------------------------------
    const trickCls = PARK_TRICKS.map((t) => `pk-${t.id}`);
    const drawSkater = (sk: Skater, n: HTMLElement, flip: HTMLElement, who: Who): void => {
      if (s === null) return;
      const c = s.course;
      n.style.left = `${px(sk.x)}px`;
      n.style.bottom = `${px(GROUND + sk.y)}px`;
      let t = `scaleX(${sk.dir})`;
      if (sk.mode === "bail") {
        const p = Math.min(1, (sk.bailT * 1000) / 900);
        t += ` rotate(${-70 * Math.sin(p * Math.PI)}deg)`;
      } else if (sk.trick !== null) {
        const p = Math.min(1, (sk.trickT * 1000) / sk.trick.ms);
        if (sk.trick.id === "backflip") t += ` rotate(${-360 * p}deg)`;
        else if (sk.trick.id === "spin") t += ` rotateY(${360 * p}deg)`;
        else if (sk.trick.id === "grab") t += ` scale(0.94, 0.86) rotate(${-14 * Math.sin(p * Math.PI)}deg)`;
        else t += ` rotate(${-8 * Math.sin(p * Math.PI)}deg)`;
      } else if (sk.mode === "ride") {
        const slope = surfaceSlope(c, sk.x) * sk.dir;
        t += ` rotate(${(-Math.atan(slope) * 180 / Math.PI).toFixed(1)}deg)`;
      } else if (sk.mode === "air") {
        t += ` rotate(${Math.max(-10, Math.min(10, -sk.vy / 70))}deg)`;
      }
      flip.style.transform = t;
      const board = flip.querySelector<SVGElement>(".park-deck");
      if (board) board.style.transform = sk.trick?.id === "kickflip" ? `rotate(${360 * Math.min(1, (sk.trickT * 1000) / sk.trick.ms)}deg)` : "";
      n.classList.toggle("bailed", sk.mode === "bail");
      n.classList.toggle("active", s.phase === who);
      for (const cls of trickCls) n.classList.remove(cls);
      if (sk.trick) n.classList.add(`pk-${sk.trick.id}`);
    };

    let wasAsking = false;
    const draw = (): void => {
      if (s === null) return;
      // The deck changes shape at the block change where it sits under
      // the pipe; the stage is laid out again to whatever is left.
      const askingNow = s.phase === "them" && s.ask !== null;
      if (askingNow !== wasAsking) {
        wasAsking = askingNow;
        ask.classList.toggle("on", askingNow);
        hint.hidden = askingNow;
        layout();
      }
      drawSkater(s.you, you, youFlip, "you");
      drawSkater(s.them, them, themFlip, "them");
      // The scene pans down when the live skater flies above the stage.
      const live = s.phase === "them" ? s.them : s.you;
      const camY = Math.max(0, live.y + GROUND + 110 - DUEL_H);
      scene.style.transform = camY > 0 ? `translateY(${px(camY).toFixed(1)}px)` : "";
      youScore.textContent = String(s.yourScore);
      themScore.textContent = String(s.theirScore);
      const round = Math.min(s.len, Math.max(s.yourRuns, s.theirRuns) + (s.phase === "over" ? 0 : 1));
      roundPill.textContent = `Round ${round} of ${s.len}`;
      status.classList.toggle("you-up", s.phase === "you");
      status.classList.toggle("them-up", s.phase === "them");
      hintBig.textContent = s.phase === "you" ? "YOUR RUN" : s.phase === "them" ? `${opp.name.toUpperCase()}'S RUN` : "";
      hintSub.textContent = s.phase === "you" ? "tap on the flat to ollie, swipe in the air for tricks" : s.phase === "them" ? "solve it fast to make them bail" : "";
      hintTricks.hidden = s.phase !== "you";
      if (s.ask !== null) {
        const a = s.ask;
        prob.textContent = `${a.shown.a} ${a.shown.op} ${a.shown.b}`;
        prob.dataset["fact"] = a.fact.id;
        prob.dataset["expected"] = String(a.shown.expected);
        typed.textContent = a.typed;
        typed.classList.toggle("filled", a.typed !== "");
        typed.classList.toggle("good", a.state === "solved");
        typed.classList.toggle("bad", a.state === "missed" || a.state === "out");
        fill.style.width = `${(a.leftMs / ASK_MS) * 100}%`;
        fill.classList.toggle("low", a.state === "open" && a.leftMs < ASK_MS * 0.3);
        meter.classList.toggle("done", a.state !== "open");
        pad.setEnabled(a.state === "open");
      }
    };

    const pop = (text: string, cls = "", atX?: number): void => {
      const p = el("div", { class: `park-pop ${cls}`, text });
      const liveN = pops.childElementCount;
      p.style.top = `${(cls.includes("bank") ? 8 : 30) + liveN * 11}%`;
      if (atX !== undefined) p.style.left = `${px(atX)}px`;
      pops.append(p);
      window.setTimeout(() => p.remove(), 1000);
    };

    const showCall = (big: string, sub: string, ms = 1100): void => {
      call.replaceChildren(el("span", { class: "bc-big", text: big }), el("span", { class: "bc-sub", text: sub }));
      call.hidden = false;
      call.classList.remove("go"); void call.offsetWidth; call.classList.add("go");
      window.setTimeout(() => { call.hidden = true; }, ms);
    };

    const react = (ev: DuelEvent[]): void => {
      if (s === null) return;
      for (const e of ev) {
        const sk = "who" in e ? (e.who === "you" ? s.you : s.them) : null;
        const x = sk?.x;
        switch (e.kind) {
          case "turn": showCall(e.who === "you" ? "YOUR RUN!" : `${opp.name.toUpperCase()}'S TURN`, e.who === "you" ? "tap to ollie, swipe for tricks" : "solve it fast to make them bail"); break;
          case "dropIn": sfx.thud(); break;
          case "ollie": sfx.pop(0); break;
          case "launch": sfx.launch(); break;
          case "trick": sfx.whoosh(e.trick.ms); break;
          case "trickDone": pop(e.trick.name, "", x); break;
          case "land": sfx.thud(); break;
          case "bail": sfx.crash(); pop("BAIL!", "hot", x); break;
          case "bank": if (e.who === "you") { sfx.bank(e.mult); pop(`+${e.points}`, `bank m${Math.min(5, e.mult)}`); } break;
          case "runEnd": if (e.who === "them") { if (e.messed) { pop("MESSED UP!", "hot", x); } else { sfx.bank(1); pop(`+${e.score}`, "bank m1"); } } break;
          case "ask": pad.reset(); break;
          case "askSolved": sfx.askGood(); break;
          case "askMissed": sfx.askBad(); break;
          case "askOut": break;
          case "over": void winner(e.winner, e.yours, e.theirs); break;
        }
      }
    };

    const winner = async (who: Who, yours: number, theirs: number): Promise<void> => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      recordDuel(app.meta, len, who === "you");
      await app.save();
      const rig = who === "you" ? mine : opp;
      const win = el("div", { class: "duel-win", "data-probe": "duel-win", "data-winner": who });
      const dancer = rigArt(rig, "duel-dance");
      win.append(
        el("div", { class: "duel-win-big", text: who === "you" ? "YOU WIN!" : `${rig.name.toUpperCase()} WINS!` }),
        el("div", { class: "duel-dancer" }, dancer),
        el("div", { class: "duel-win-sub", "data-probe": "duel-final", text: `${yours} to ${theirs}` }),
      );
      for (const [x, y, d] of [[10, 20, 0], [86, 14, 160], [22, 78, 300], [74, 84, 440], [50, 6, 560]] as const) {
        win.append(el("span", { class: "sb-spark", style: `left:${x}%;top:${y}%;animation-delay:${d}ms` }));
      }
      stage.append(win);
      sfx.duelWin();
      window.setTimeout(() => { if (root.isConnected) app.go("home"); }, WIN_MS);
    };

    // ---- the clock -------------------------------------------------------------------
    const step = (dt: number): void => {
      if (s === null) return;
      react(update(s, dt));
      draw();
    };
    const frame = (now: number): void => {
      if (finished || s === null || manual) return;
      raf = requestAnimationFrame(frame);
      if (paused > 0) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
    };

    // ---- the finger ------------------------------------------------------------------
    on(root, "pointerdown", (e) => {
      if (s === null || finished || paused > 0 || pointer !== null) return;
      if (e.target instanceof Element && e.target.closest("button") !== null) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      root.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    const up = (e: PointerEvent): void => {
      if (pointer === null || e.pointerId !== pointer.id || s === null) return;
      const sw = swipeOf(e.clientX - pointer.x, e.clientY - pointer.y);
      pointer = null;
      const ev: DuelEvent[] = [];
      gesture(s, sw, ev);
      react(ev);
      draw();
      e.preventDefault();
    };
    on(root, "pointerup", up);
    on(root, "pointercancel", up);

    // ---- start: lay out, then the course, then the first block -------------------
    window.setTimeout(() => {
      layout();
      const w = Math.round(stage.getBoundingClientRect().width / scale) || 600;
      s = newDuel(len, courseFor(w), facts, Math.floor(Math.random() * 1e9));
      const ev: DuelEvent[] = [];
      begin(s, ev);
      draw();
      react(ev);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }, 30);
    const onResize = (): void => { layout(); draw(); };
    window.addEventListener("resize", onResize);
    const onVis = (): void => { if (document.hidden) paused += 1; else { paused = Math.max(0, paused - 1); last = performance.now(); } };
    document.addEventListener("visibilitychange", onVis);
    const watch = window.setInterval(() => {
      if (!root.isConnected) { window.clearInterval(watch); finished = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis); }
    }, 500);

    (window as unknown as Record<string, unknown>).__duel = {
      state: () => s,
      tick: (dt: number) => step(dt),
      hold: () => { manual = true; cancelAnimationFrame(raf); },
      /** The keypad's own path, one digit at a time. */
      key: (d: string) => { const b = pad.root.querySelector<HTMLButtonElement>(`[data-key="${d}"]`); b?.click(); },
      swipe: swipeOf,
      layout,
    };
    return wrap;
  };

  // Leaving mid-duel is a loss: the play is spent and the record says so.
  on(back, "click", () => {
    if (s === null || finished) { finished = true; cancelAnimationFrame(raf); app.go("home"); return; }
    paused += 1;
    sheet({
      title: "Leave the duel?",
      body: "The play is spent, and leaving counts as a loss.",
      cancel: "Keep going", confirm: "Leave", danger: true,
      onCancel: () => { paused -= 1; last = performance.now(); },
      onConfirm: () => { finished = true; cancelAnimationFrame(raf); recordDuel(app.meta, len, false); void app.save().then(() => app.go("home")); },
    });
  });

  mount(body, pickView());
  (window as unknown as Record<string, unknown>).__duelPick = {
    pick: (n: DuelLen) => { len = n; mount(body, revealView()); },
  };
  return root;
};

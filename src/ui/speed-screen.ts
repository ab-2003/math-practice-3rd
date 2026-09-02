/**
 * SPEED RUN (Andy 2026-09-01): how many correct in one minute.
 *
 * This is the ONE deliberate, bounded exception to the no-pressure law, and
 * its fences are the feature:
 *  - It is a separate mode he chooses, never the practice loop.
 *  - Its answers NEVER touch the Leitner scheduler, the response log, the
 *    histogram, or the teacher evidence. It is a game with a scoreboard.
 *  - It earns no coins, so it can never out-earn real practice.
 *  - One run is allowed before the day's work; the rest of the parent-set
 *    budget (default 10) opens after the dose is met.
 *  - The timer is a slim quiet bar, not ticking digits.
 *
 * High scores are kept PER SETUP (which operations and missing-number modes
 * are on), because a x-and-/ minute is a different sport from a plus minute.
 */

import { presentFact, type Presented } from "../core/present";
import type { Fact } from "../core/types";
import { deckInIntroOrder } from "../core/facts";
import { withinCap } from "../core/session";
import { lineTricks } from "../core/tricks";
import type { App } from "./appstate";
import { el, mount, on } from "./dom";
import { keypad, type Keypad } from "./keypad";
import { canSpeedRun, speedAttemptsToday, speedKey } from "./day";
import { resolveRider } from "./screens";
import { sfx } from "./sfx";
import { sheet } from "./sheet";
import { helmetById } from "../core/gear";
import { boardFor } from "../core/boards";
import { playVictoryLap } from "./trick-anim";

const RUN_MS = 60_000;

const keyLabel = (key: string): string =>
  key.replace("add", "+").replace("sub", "−").replace("mul", "×").replace("div", "÷").replace(/\+/g, " ");

export const speedScreen = (app: App): HTMLElement => {
  // Declared before the gate: the locked branch returns early, and the Back
  // button's handler closes over these. Referencing a later `let` from that
  // handler was a TDZ crash the probe caught on the locked screen.
  let running = false;
  let finished = false;
  const root = el("div", { class: "screen" });
  const bar = el("div", { class: "topbar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  on(back, "click", () => { finished = true; app.go("home"); });
  bar.append(back, el("div", { class: "grow" }, el("h2", { text: "Speed Run" })),
    el("span", { class: "pill", "data-probe": "speed-attempts", text: `${speedAttemptsToday(app)}/${app.meta.speedLimit} today` }));
  root.append(bar);

  const gate = canSpeedRun(app);
  if (!gate.ok) {
    const card = el("div", { class: "card reveal", "data-probe": "speed-locked" });
    card.append(el("h2", { text: "Not yet!" }));
    card.append(el("p", { class: "note", text: gate.why }));
    const go = el("button", { type: "button", class: "btn go big" }, el("span", { text: "Drop In" }));
    on(go, "click", () => app.go("session"));
    card.append(go);
    root.append(card);
    return root;
  }

  // ---- the run -------------------------------------------------------------
  const timer = el("div", { class: "speed-timer" });
  const fill = el("div", { class: "speed-fill" });
  timer.append(fill);
  root.append(timer);

  const wrap = el("div", { class: "session" });
  const left = el("div", { class: "left" });
  const stage = el("div", { class: "stage" });
  const slot = el("div", { class: "answer-slot", "data-probe": "answer" });
  const eq = el("div", { class: "eq" }, el("span", { class: "eq-sign", text: "=" }), slot);
  left.append(stage, eq);
  wrap.append(left);
  root.append(wrap);

  const rider = resolveRider(app);
  const riderLevel = app.meta.levels[rider.id] ?? 1;
  const riderGearId = app.meta.gear[rider.id];
  const riderHelmet = riderGearId !== undefined ? helmetById(riderGearId) : undefined;

  // The pool: everything he has met in the switched-on operations; a fresh
  // profile borrows the front of the curriculum so the minute is never empty.
  const pool: Fact[] = [];
  for (const f of deckInIntroOrder(app.deck)) {
    if (!app.meta.strands[f.kind] || !withinCap(f, app.meta.caps)) continue;
    if (app.states.get(f.id)?.introduced === true) pool.push(f);
  }
  if (pool.length < 12) {
    for (const f of deckInIntroOrder(app.deck)) {
      if (!app.meta.strands[f.kind] || !withinCap(f, app.meta.caps) || pool.includes(f)) continue;
      pool.push(f);
      if (pool.length >= 24) break;
    }
  }

  let score = 0;
  let asked = 0;
  let cur: Presented | null = null;
  let curFact: Fact | null = null;
  let mslot: HTMLElement | null = null;
  let startAt = 0;
  let salt = Math.floor(Math.random() * 100000);

  const pad: Keypad = keypad({
    maxDigits: 3,
    onFirstKey: () => undefined,
    onChange: (v) => {
      const target = cur?.format === "missing" && mslot ? mslot : slot;
      target.textContent = v;
      target.classList.toggle("filled", v !== "");
    },
    onSubmit: (v) => submit(Number(v)),
  });
  wrap.append(pad.root);

  const paint = (): void => {
    pad.reset();
    const f = pool[Math.floor(Math.random() * pool.length)]!;
    if (f === curFact && pool.length > 1) { paint(); return; }
    curFact = f;
    salt += 1;
    cur = presentFact(f, salt, app.meta.missing);
    const prob = el("div", {
      class: `problem${cur.format === "missing" ? " missing" : ""}`,
      "data-probe": "problem", "data-fact": f.id, "data-format": cur.format,
    });
    const operand = (which: "a" | "b"): HTMLElement => {
      if (cur!.blank === which) { mslot = el("span", { class: "mslot", "data-probe": "mslot" }); return mslot; }
      return el("span", { text: String(which === "a" ? cur!.a : cur!.b) });
    };
    mslot = null;
    prob.append(operand("a"), el("span", { class: "op", text: ` ${cur.op} ` }), operand("b"));
    if (cur.format === "missing") prob.append(el("span", { class: "op", text: " = " }), el("span", { text: String(cur.result) }));
    eq.hidden = cur.format === "missing";
    mount(stage, prob);
    pad.setEnabled(true);
  };

  /** No rides, no banners, no scaffolds: a flash and the next problem. The
   *  longer celebration waits for the end of the minute. */
  const submit = (given: number): void => {
    if (!running || cur === null) return;
    asked += 1;
    if (given === cur.expected) {
      score += 1;
      sfx.chime(score % 5);
      slot.classList.remove("locked");
      stage.classList.add("speed-hit");
      window.setTimeout(() => stage.classList.remove("speed-hit"), 160);
    } else {
      sfx.bail();
      stage.classList.add("speed-miss");
      window.setTimeout(() => stage.classList.remove("speed-miss"), 200);
    }
    paint();
  };

  const tick = (): void => {
    if (!running || finished) return;
    const leftMs = Math.max(0, RUN_MS - (Date.now() - startAt));
    fill.style.width = `${(leftMs / RUN_MS) * 100}%`;
    if (leftMs <= 0) { void end(); return; }
    window.setTimeout(tick, 200);
  };

  const end = async (): Promise<void> => {
    if (finished) return;
    finished = true;
    running = false;
    pad.setEnabled(false);
    const key = speedKey(app);
    const prev = app.meta.speedBest[key] ?? 0;
    const newBest = score > prev;
    if (newBest) app.meta.speedBest = { ...app.meta.speedBest, [key]: score };
    await app.save();

    sfx.speedFanfare();
    const total = app.meta.linesLanded;
    await playVictoryLap(left, stage, rider, lineTricks(total, total), riderLevel,
      { bonus: 0, title: "TIME!", sub: `${score} correct` }, riderHelmet, boardFor(app.meta.boardOf, rider.id, app.meta.boardsOwned));

    const body = el("div", { class: "reveal" });
    body.append(el("h2", { text: `${score} in a minute` }));
    body.append(el("p", { class: "note", text: `${asked} answered · setup: ${keyLabel(key)}` }));
    if (newBest && score > 0) body.append(el("p", { class: "best-line", text: "NEW BEST!" }));
    else if (prev > 0) body.append(el("p", { class: "note", text: `Best for this setup: ${prev}` }));
    const again = canSpeedRun(app);
    sheet({
      title: "Speed run over!",
      body,
      cancel: "Done",
      onCancel: () => app.go("home"),
      ...(again.ok ? { confirm: "Again!", onConfirm: () => app.go("speed") } : {}),
    });
  };

  // The attempt is spent the moment the run STARTS, so a bad minute cannot
  // be abandoned and retried for free.
  const begin = (): void => {
    app.meta.speedDay = app.day;
    app.meta.speedCount = speedAttemptsToday(app) + 1;
    void app.save();
    const pill = bar.querySelector('[data-probe="speed-attempts"]');
    if (pill) pill.textContent = `${speedAttemptsToday(app)}/${app.meta.speedLimit} today`;
    running = true;
    startAt = Date.now();
    paint();
    tick();
  };

  // A short READY / GO beat instead of a countdown clock.
  pad.setEnabled(false);
  mount(stage, el("div", { class: "bonus-callout" },
    el("span", { class: "bc-big", text: "READY?" }),
    el("span", { class: "bc-sub", text: "one minute, as many as you can" })));
  window.setTimeout(() => { if (!finished) begin(); }, 1400);

  // The kid-reachable reset, behind a confirm.
  const resetRow = el("div", { class: "dose-line" });
  const reset = el("button", { type: "button", class: "btn small ghost", "data-probe": "speed-reset" }, el("span", { text: "Reset best scores" }));
  on(reset, "click", () => sheet({
    title: "Reset all speed run bests?",
    body: "Every setup's best score goes back to zero. Coins and monsters are untouched.",
    cancel: "Keep them", confirm: "Reset", danger: true,
    onConfirm: () => { app.meta.speedBest = {}; void app.save(); },
  }));
  resetRow.append(reset);
  root.append(resetRow);

  (window as unknown as Record<string, unknown>).__speed = {
    end: () => { void end(); }, score: () => score, running: () => running,
  };
  return root;
};

/**
 * THE QUESTION LOOP.
 *
 * Everything the pedagogy asks for lands here, so the laws are restated where
 * they are enforced:
 *
 *  - The clock starts when the problem is PAINTED and the retrieval reading is
 *    taken at the FIRST DIGIT, not at submit.
 *  - Nothing on this screen ever distinguishes a derived answer from a
 *    retrieved one. Same words, same animation, same sound, same coins.
 *  - A wrong answer cannot be skipped. It shows his own strategy back to him
 *    and then asks him to type the number himself.
 *  - No timer is visible and none is implied. Every animation is fixed length.
 *  - A session is a run of LINES, not a list of questions, and after twenty
 *    items he is offered a real way out at every line break.
 */

import { COIN_PER_BONUS, COIN_PER_LINE, COIN_PER_TRICK, LINE_LENGTH, OFFER_EXIT_AFTER_ITEMS } from "../core/config";
import { classify } from "../core/classify";
import { makeElapsed, type ElapsedProblem } from "../core/elapsed";
import { nextLocked } from "../core/creatures";
import { currentFactId, recordResponse, sessionIsOver, startSession } from "../core/session";
import type { Fact, Response, SessionState } from "../core/types";
import type { App } from "./appstate";
import { el, mount, on } from "./dom";
import { keypad, type Keypad } from "./keypad";
import { scaffold } from "./scaffold";
import { sfx } from "./sfx";
import { sheet } from "./sheet";
import { appendResponses, appendSession, type SessionRecord } from "./store";
import { lineStrip, playBail, playLanding, trickName } from "./trickline";
import { revealSheet } from "./screens";

type Phase = "asking" | "bailed" | "retry";

/** Commutative facts are ONE fact with two presentations. The orientation is
 *  random so he meets both, without the deck doubling. */
const present = (f: Fact, salt: number): { a: number; b: number; op: string } => {
  const flip = (f.kind === "add" || f.kind === "mul") && ((salt * 2654435761) >>> 0) % 2 === 1;
  const op = f.kind === "add" ? "+" : f.kind === "sub" ? "−" : f.kind === "mul" ? "×" : "÷";
  return flip ? { a: f.b, b: f.a, op } : { a: f.a, b: f.b, op };
};

export const sessionScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const bar = el("div", { class: "topbar" });
  const strip = el("div", { class: "grow" });
  const quit = el("button", { type: "button", class: "btn small ghost", "data-probe": "quit" }, el("span", { text: "Take a breather" }));
  bar.append(strip, quit);
  root.append(bar);

  const wrap = el("div", { class: "session" });
  const left = el("div", { class: "left" });
  const stage = el("div", { class: "stage" });
  const slot = el("div", { class: "answer-slot", "data-probe": "answer" });
  // The answer sits on the same line as an equals sign, so the whole thing
  // reads as one equation rather than as a question and a separate box.
  const eq = el("div", { class: "eq" }, el("span", { class: "eq-sign", text: "=" }), slot);
  left.append(stage, eq);
  wrap.append(left);
  root.append(wrap);

  // ---- session state -----------------------------------------------------
  let session: SessionState = startSession(app.deck, app.states, app.day, app.meta.strands);
  const startedAt = Date.now();
  const collected: Response[] = [];
  let landed = 0;          // tricks in the CURRENT line
  let itemsDone = 0;       // real items answered, retries excluded
  let coins = 0;
  let phase: Phase = "asking";
  let paintedAt = 0;
  let firstKeyMs: number | null = null;
  let bonus: ElapsedProblem | null = null;
  let bonusLeft = 0;
  let finished = false;

  const pad: Keypad = keypad({
    maxDigits: 3,
    onFirstKey: () => { firstKeyMs ??= Math.round(performance.now() - paintedAt); },
    onChange: (v) => {
      slot.textContent = v === "" ? "" : v;
      slot.classList.toggle("filled", v !== "");
    },
    onSubmit: (v) => { void submit(Number(v)); },
  });
  wrap.append(pad.root);

  const redrawStrip = (): void => { mount(strip, lineStrip(landed)); };

  const paint = (): void => {
    pad.reset();
    slot.classList.remove("locked");
    firstKeyMs = null;
    phase = "asking";
    redrawStrip();

    if (bonus) {
      mount(stage, el("p", { class: "word-problem", "data-probe": "bonus", text: bonus.text }));
    } else {
      const id = currentFactId(session);
      if (id === null) { void finish(); return; }
      const f = app.deck.get(id);
      if (!f) { void finish(); return; }
      const p = present(f, itemsDone + f.a * 31 + f.b);
      mount(stage, el("div", { class: "problem", "data-probe": "problem", "data-fact": f.id },
        el("span", { text: String(p.a) }),
        el("span", { class: "op", text: ` ${p.op} ` }),
        el("span", { text: String(p.b) }),
      ));
    }
    pad.setEnabled(true);
    // The clock starts when it is on the glass, not when we decided to draw.
    requestAnimationFrame(() => { paintedAt = performance.now(); });
  };

  // ---- answering ---------------------------------------------------------

  const submit = async (given: number): Promise<void> => {
    if (finished) return;
    pad.setEnabled(false);
    const submitMs = Math.round(performance.now() - paintedAt);

    if (bonus) {
      const ok = given === bonus.answer;
      if (ok) { coins += COIN_PER_BONUS; sfx.land(); await playLanding(stage, `+${COIN_PER_BONUS}`); }
      else { sfx.bail(); await playBail(stage); }
      bonusLeft -= 1;
      bonus = bonusLeft > 0 ? makeElapsed(Date.now() + bonusLeft) : null;
      if (bonus === null) { await finish(); return; }
      paint();
      return;
    }

    const id = currentFactId(session);
    if (id === null) { await finish(); return; }
    const f = app.deck.get(id);
    if (!f) { await finish(); return; }

    if (phase === "retry") {
      // The forced re-entry. It closes the loop; it never scores.
      if (given !== f.answer) {
        slot.classList.add("locked");
        pad.setEnabled(true);
        pad.reset();
        return;
      }
      const r = mkResponse(f, given, submitMs, true, true);
      collected.push(r);
      const step = recordResponse(app.deck, app.states, session, r, app.meta.strands);
      session = step.session;
      app.states = step.states;
      sfx.recover();
      await advance();
      return;
    }

    const correct = given === f.answer;
    const cls = classify(correct, firstKeyMs);
    const r = mkResponse(f, given, submitMs, correct, false);
    collected.push(r);
    const step = recordResponse(app.deck, app.states, session, r, app.meta.strands);
    session = step.session;
    app.states = step.states;
    itemsDone += 1;

    if (correct) {
      // Identical treatment whether he retrieved it or worked it out. This is
      // the law the whole design rests on.
      coins += COIN_PER_TRICK;
      landed += 1;
      sfx.land();
      await playLanding(stage, trickName(landed - 1));
      if (landed >= LINE_LENGTH) {
        coins += COIN_PER_LINE;
        landed = 0;
        sfx.line();
        redrawStrip();
        await lineBreak();
        if (finished) return;
      }
      await advance();
    } else {
      landed = 0;
      sfx.bail();
      await playBail(stage);
      showScaffold(f, cls);
    }
  };

  const mkResponse = (f: Fact, given: number, submitMs: number, correct: boolean, isRetry: boolean): Response => ({
    factId: f.id, day: app.day, at: Date.now(),
    firstKeyMs, submitMs, correct, answered: given,
    cls: classify(correct, firstKeyMs), isRetry,
  });

  /** The bail: warm, brief, and then his own method handed back to him. */
  const showScaffold = (f: Fact, _cls: string): void => {
    phase = "bailed";
    const p = present(f, itemsDone);
    const box = el("div", {});
    box.append(el("p", { class: "scaf-head", text: "No worries. Roll it back." }));
    box.append(scaffold(f, p.a, p.b));
    box.append(el("p", { class: "retype", text: `Type ${f.answer} to roll on`, "data-probe": "retype" }));
    mount(stage, box);
    // pad.reset() rather than clearing the slot text by hand: the keypad holds
    // its OWN value, and blanking only the display left the wrong answer still
    // buffered, so his re-entry got silently prepended with it and rejected.
    pad.reset();
    slot.classList.add("locked");
    phase = "retry";
    firstKeyMs = null;
    paintedAt = performance.now();
    pad.setEnabled(true);
  };

  let bonusOffered = false;
  const advance = async (): Promise<void> => {
    if (sessionIsOver(session)) {
      // A run that reached its own end earns the bonus round. A run the
      // struggle detector cut short does not: he has had enough for today.
      const real = collected.filter((r) => !r.isRetry);
      const wentWell = real.length > 0 && real.filter((r) => r.correct).length / real.length >= 0.6;
      if (!bonusOffered && session.status === "complete" && wentWell) {
        bonusOffered = true;
        offerBonus();
        return;
      }
      await finish();
      return;
    }
    paint();
  };

  /** A real, celebrated way out at every line break once he has done enough. */
  const lineBreak = (): Promise<void> =>
    new Promise((resolve) => {
      if (itemsDone < OFFER_EXIT_AFTER_ITEMS || sessionIsOver(session)) { resolve(); return; }
      sheet({
        title: "Line landed!",
        body: `That is ${itemsDone} so far and ${coins} coins. Keep rolling, or call it a good run?`,
        cancel: "Call it",
        confirm: "Keep rolling",
        onConfirm: () => resolve(),
        // Calling it is his decision and it is not quitting. It is logged as
        // endedEarly so the dashboard can tell it apart from walking away.
        onCancel: () => { void finish("endedEarly"); resolve(); },
      });
    });

  // ---- ending ------------------------------------------------------------

  const finish = async (forced?: SessionRecord["status"]): Promise<void> => {
    if (finished) return;
    finished = true;
    pad.setEnabled(false);

    const real = collected.filter((r) => !r.isRetry);
    const status: SessionRecord["status"] =
      forced ?? (session.status === "endedEarly" ? "endedEarly" : "complete");

    app.meta.coins += coins;
    if (app.meta.lastSessionDay !== app.day) {
      app.meta.streak = app.meta.lastSessionDay === app.day - 1 ? app.meta.streak + 1 : 1;
      app.meta.lastSessionDay = app.day;
    }

    await appendResponses(collected);
    await appendSession({
      id: `s${startedAt}`, day: app.day, startedAt, endedAt: Date.now(),
      items: real.length,
      correct: real.filter((r) => r.correct).length,
      retrieved: real.filter((r) => r.cls === "retrieved").length,
      derived: real.filter((r) => r.cls === "derived").length,
      status, coins,
    });
    await app.save();

    const body = el("div", { class: "reveal" });
    body.append(el("h2", { text: `${coins} coins` }));
    body.append(el("p", { class: "note", text: `${real.length} tricks attempted. Every one of them counted.` }));
    const unlockable = nextLocked(app.meta.owned);
    if (unlockable && app.meta.coins >= unlockable.cost) {
      body.append(el("p", { class: "note", text: `You can unlock ${unlockable.name} now.` }));
    }
    sheet({
      title: status === "endedEarly" ? "Good run." : "Run finished!",
      body,
      confirm: "Done",
      onConfirm: () => {
        if (unlockable && app.meta.coins >= unlockable.cost) {
          app.meta.coins -= unlockable.cost;
          app.meta.owned.push(unlockable.id);
          app.meta.levels[unlockable.id] = 1;
          sfx.roar();
          void app.save().then(() => revealSheet(app, unlockable.id));
        }
        app.go("home");
      },
    });
  };

  /**
   * The bonus round. Elapsed time, which he is good at, offered as a reward
   * rather than as drill, and kept entirely out of the scheduler and out of
   * the retrieval percentage.
   */
  const offerBonus = (): void => {
    bonusLeft = 3;
    bonus = makeElapsed(Date.now());
    paint();
  };

  on(quit, "click", () => {
    sheet({
      title: "Take a breather?",
      body: "Everything you landed is saved. You can drop back in whenever.",
      cancel: "Keep rolling", confirm: "Take a breather",
      onConfirm: () => { void finish("endedEarly"); },
    });
  });

  // Hooks for the probes, so they drive the real UI rather than the internals.
  (window as unknown as Record<string, unknown>).__probe = {
    answer: (n: number) => submit(n),
    correctAnswer: (): number | null => {
      if (bonus) return bonus.answer;
      const id = currentFactId(session);
      return id === null ? null : (app.deck.get(id)?.answer ?? null);
    },
    phase: (): Phase => phase,
    items: (): number => itemsDone,
    coins: (): number => coins,
    bonus: offerBonus,
    over: (): boolean => finished,
  };

  if (session.queue.length === 0) {
    // Every switched-on operation has nothing to offer today. That is a real
    // state (a grown-up can switch division on before multiplication is ready
    // for it), and it must read as a sentence, not as a broken screen.
    mount(stage, el("div", { class: "reveal", "data-probe": "nothing" },
      el("h2", { text: "Nothing to practise yet" }),
      el("p", { class: "note", text: "The operations that are switched on have nothing due right now. A grown-up can switch more on from the settings screen." })));
    pad.setEnabled(false);
    pad.root.hidden = true;
    return root;
  }

  paint();
  return root;
};

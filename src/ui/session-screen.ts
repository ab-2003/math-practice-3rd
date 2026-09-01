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
import { canAffordAny } from "../core/creatures";
import { presentFact, type Presented } from "../core/present";
import { currentFactId, recordResponse, sessionIsOver, startSession } from "../core/session";
import type { Fact, Response, SessionState } from "../core/types";
import type { App } from "./appstate";
import { el, mount, on } from "./dom";
import { clockSvg } from "./clock-svg";
import { keypad, type Keypad } from "./keypad";
import { scaffold } from "./scaffold";
import { sfx } from "./sfx";
import { sheet } from "./sheet";
import { appendResponses, appendSession, type SessionRecord } from "./store";
import { lineTricks, spotForDay, spotUnlockedBetween, trickUnlockedBetween } from "../core/tricks";
import { lineStrip, playBail, playLanding, playLineBanner } from "./trickline";
import { playTrick, playVictoryLap } from "./trick-anim";
import { spotLayer } from "./spots";
import { helmetById } from "../core/gear";
import { resolveRider } from "./screens";

type Phase = "asking" | "bailed" | "retry";

export const sessionScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const bar = el("div", { class: "topbar" });
  // The coin chip: rewards must be VISIBLE while they happen, not a number
  // on the end sheet. It shows wallet plus this run, so it only counts up.
  const chip = el("div", { class: "coins session-coins", "data-probe": "session-coins" },
    el("span", { text: "◆" }), el("span", { class: "chip-n", text: String(app.meta.coins) }));
  const strip = el("div", { class: "grow" });
  const quit = el("button", { type: "button", class: "btn small ghost", "data-probe": "quit" }, el("span", { text: "Take a breather" }));
  bar.append(chip, strip, quit);
  root.append(bar);

  const wrap = el("div", { class: "session" });
  const left = el("div", { class: "left" });
  left.append(spotLayer(spotForDay(app.meta.linesLanded, app.day).id));
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
  let linesThisRun = 0;
  let tricksThisRun = 0;
  let chain = 0;           // consecutive correct, this run
  let bestChain = 0;
  let newTrickName: string | null = null;
  let newSpotName: string | null = null;

  /** Bank coins where he can SEE it: chip bump plus a floating +n. */
  const bank = (n: number): void => {
    coins += n;
    const num = chip.querySelector(".chip-n");
    if (num) num.textContent = String(app.meta.coins + coins);
    chip.classList.remove("bump");
    void (chip as HTMLElement).offsetWidth; // restart the animation
    chip.classList.add("bump");
    const float = el("span", { class: "coin-float", text: `+${n}` });
    chip.append(float);
    window.setTimeout(() => float.remove(), 900);
  };
  let phase: Phase = "asking";
  /** The current item as PRESENTED: format, orientation, and what he must
   *  type. Grading always compares against cur.expected, never f.answer
   *  directly, or every missing-number item would be graded wrong. */
  let cur: Presented | null = null;
  let mslot: HTMLElement | null = null;
  let paintedAt = 0;
  let firstKeyMs: number | null = null;
  let bonus: ElapsedProblem | null = null;
  let bonusLeft = 0;
  let finished = false;

  // The rider: the newest creature he owns, or a cameo of the one he is
  // saving for. Chosen once per session so it does not flicker between items.
  // The rider is HIS pick from the collection; the fallbacks only cover a
  // fresh profile. Chosen once per session so it does not flicker.
  const rider = resolveRider(app);
  const riderLevel = app.meta.levels[rider.id] ?? 1;
  const riderGearId = app.meta.gear[rider.id];
  const riderHelmet = riderGearId !== undefined ? helmetById(riderGearId) : undefined;

  const pad: Keypad = keypad({
    maxDigits: 3,
    onFirstKey: () => { firstKeyMs ??= Math.round(performance.now() - paintedAt); },
    onChange: (v) => {
      // A missing-number item types into its own inline blank; everything
      // else types into the slot under the equals sign.
      const target = cur?.format === "missing" && phase === "asking" && mslot ? mslot : slot;
      target.textContent = v;
      target.classList.toggle("filled", v !== "");
    },
    onSubmit: (v) => { void submit(Number(v)); },
  });
  wrap.append(pad.root);

  const currentTricks = (): ReturnType<typeof lineTricks> => {
    const total = app.meta.linesLanded + linesThisRun;
    return lineTricks(total, total);
  };
  const redrawStrip = (): void => { mount(strip, lineStrip(landed, currentTricks())); };

  const paint = (): void => {
    pad.reset();
    slot.classList.remove("locked");
    firstKeyMs = null;
    phase = "asking";
    redrawStrip();

    if (bonus) {
      cur = null;
      mslot = null;
      eq.hidden = false;
      if (app.meta.elapsedAnalog) {
        // Analog view: the times are FACES to read, never digits. The digital
        // labels ride along as data attributes so an instrument can verify
        // the faces without teaching the app to read its own hands.
        const wrap = el("div", { class: "bonus-analog", "data-probe": "bonus",
          "data-start": bonus.startLabel, "data-end": bonus.endLabel });
        const row = el("div", { class: "clock-row" });
        row.append(
          el("div", { class: "clock-fig" }, clockSvg(bonus.startMinutes), el("span", { class: "clock-cap", text: bonus.caps[0] })),
          el("div", { class: "clock-fig" }, clockSvg(bonus.endMinutes), el("span", { class: "clock-cap", text: bonus.caps[1] })),
        );
        wrap.append(row);
        wrap.append(el("p", { class: "word-problem", text: "How many minutes is that?" }));
        mount(stage, wrap);
      } else {
        mount(stage, el("p", { class: "word-problem", "data-probe": "bonus", text: bonus.text }));
      }
    } else {
      const id = currentFactId(session);
      if (id === null) { void finish(); return; }
      const f = app.deck.get(id);
      if (!f) { void finish(); return; }
      cur = presentFact(f, itemsDone + f.a * 31 + f.b, app.meta.missing);
      const prob = el("div", {
        class: `problem${cur.format === "missing" ? " missing" : ""}`,
        "data-probe": "problem", "data-fact": f.id, "data-format": cur.format,
      });
      const operand = (which: "a" | "b"): HTMLElement => {
        if (cur!.blank === which) {
          mslot = el("span", { class: "mslot", "data-probe": "mslot" });
          return mslot;
        }
        return el("span", { text: String(which === "a" ? cur!.a : cur!.b) });
      };
      mslot = null;
      prob.append(operand("a"), el("span", { class: "op", text: ` ${cur.op} ` }), operand("b"));
      if (cur.format === "missing") {
        prob.append(el("span", { class: "op", text: " = " }), el("span", { text: String(cur.result) }));
      }
      // The inline blank IS the answer slot for a missing item; two slots on
      // one screen would be a genuine puzzle about where the digits will land.
      eq.hidden = cur.format === "missing";
      mount(stage, prob);
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
      if (ok) { bank(COIN_PER_BONUS); sfx.land(4); await playLanding(stage, `+${COIN_PER_BONUS}`); }
      else { sfx.bail(); await playBail(stage); }
      bonusLeft -= 1;
      bonus = bonusLeft > 0 ? makeElapsed(Date.now() + bonusLeft, app.meta.elapsedLevel) : null;
      if (bonus === null) { await finish(); return; }
      paint();
      return;
    }

    const id = currentFactId(session);
    if (id === null) { await finish(); return; }
    const f = app.deck.get(id);
    if (!f) { await finish(); return; }

    const want = cur?.expected ?? f.answer;

    if (phase === "retry") {
      // The forced re-entry. It closes the loop; it never scores.
      if (given !== want) {
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

    const correct = given === want;
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
      const lineNow = currentTricks();
      const trick = lineNow[landed]!;
      const step = landed;
      const endsLine = landed + 1 >= LINE_LENGTH;
      bank(COIN_PER_TRICK);
      landed += 1;
      tricksThisRun += 1;
      chain += 1;
      bestChain = Math.max(bestChain, chain);
      // The chime and the landing walk UP the line in pitch, so a chain is
      // audible as a chain. Identical for retrieved and derived, always.
      sfx.chime(step);
      // On a line-ending answer with animations on, the VICTORY LAP plays all
      // five landings itself; a solo land here would double the first one.
      if (!(endsLine && app.meta.animations)) sfx.land(step);
      if (!endsLine) {
        if (app.meta.animations) await playTrick(stage, rider, trick, riderLevel, riderHelmet);
        else await playLanding(stage, trick.name);
      } else if (!app.meta.animations) {
        await playLanding(stage, trick.name);
      }
      if (endsLine) {
        // THE LINE IS AN EVENT. With animations on, his creature rides the
        // whole line start to finish while the spot lights up (Andy's ask);
        // with them off, the banner still fires, because a landed line must
        // never again pass in silence.
        const before = app.meta.linesLanded + linesThisRun;
        linesThisRun += 1;
        const after = before + 1;
        const tUn = trickUnlockedBetween(before, after);
        const sUn = spotUnlockedBetween(before, after);
        if (tUn) newTrickName = tUn.name;
        if (sUn) newSpotName = sUn.name;
        bank(COIN_PER_LINE);
        landed = 0;
        sfx.line();
        strip.classList.add("strip-flash");
        window.setTimeout(() => strip.classList.remove("strip-flash"), 950);
        if (app.meta.animations) {
          await playVictoryLap(left, stage, rider, lineNow, riderLevel, { bonus: COIN_PER_LINE, newTrick: tUn?.name }, riderHelmet);
        } else {
          await playLineBanner(left, { bonus: COIN_PER_LINE, newTrick: tUn?.name });
        }
        redrawStrip();
        await lineBreak();
        if (finished) return;
      }
      await advance();
    } else {
      landed = 0;
      chain = 0;
      sfx.bail();
      await playBail(stage);
      showScaffold(f, cls);
    }
  };

  const mkResponse = (f: Fact, given: number, submitMs: number, correct: boolean, isRetry: boolean): Response => ({
    factId: f.id, day: app.day, at: Date.now(),
    firstKeyMs, submitMs, correct, answered: given,
    cls: classify(correct, firstKeyMs), isRetry,
    format: cur?.format ?? "standard",
  });

  /** The bail: warm, brief, and then his own method handed back to him. */
  const showScaffold = (f: Fact, _cls: string): void => {
    phase = "bailed";
    const p = cur ?? presentFact(f, itemsDone, app.meta.missing);
    const box = el("div", {});
    box.append(el("p", { class: "scaf-head", text: "No worries. Roll it back." }));
    if (p.format === "missing") {
      // Reveal the whole fact first, so the blank stops being a mystery
      // before the picture explains why it is true.
      const a = p.blank === "a" ? p.expected : p.a;
      const b = p.blank === "b" ? p.expected : p.b;
      box.append(el("p", { class: "scaf-eq", text: `${a} ${p.op} ${b} = ${p.result}` }));
    }
    box.append(scaffold(f, p.a === 0 && p.blank === "a" ? p.expected : p.a, p.b));
    box.append(el("p", { class: "retype", text: `Type ${p.expected} to roll on`, "data-probe": "retype" }));
    eq.hidden = false;
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
    app.meta.linesLanded += linesThisRun;
    const newBestTricks = tricksThisRun > app.meta.bestTricksRun;
    if (newBestTricks) app.meta.bestTricksRun = tricksThisRun;
    const newBestLines = linesThisRun > app.meta.bestLinesRun;
    if (newBestLines) app.meta.bestLinesRun = linesThisRun;
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

    // The run's story, in his language. Personal bests only ever go up,
    // which is exactly what keeps them safe under the no-pressure laws.
    const body = el("div", { class: "reveal" });
    body.append(el("h2", { text: `${coins} coins` }));
    const story: string[] = [];
    story.push(`${tricksThisRun} tricks landed` + (linesThisRun > 0 ? ` · ${linesThisRun} full ${linesThisRun === 1 ? "line" : "lines"}` : ""));
    if (bestChain >= 3) story.push(`Longest chain: ${bestChain} in a row`);
    body.append(el("p", { class: "note", text: story.join("  ·  ") }));
    if (newBestTricks && tricksThisRun >= 5) body.append(el("p", { class: "best-line", text: "NEW BEST RUN!" }));
    else if (newBestLines && linesThisRun >= 2) body.append(el("p", { class: "best-line", text: "MOST LINES EVER!" }));
    if (newTrickName !== null) body.append(el("p", { class: "best-line", text: `NEW TRICK UNLOCKED: ${newTrickName}` }));
    if (newSpotName !== null) body.append(el("p", { class: "best-line", text: `NEW SPOT UNLOCKED: ${newSpotName}` }));
    const riderName = app.meta.names[rider.id] ?? rider.name;
    if (tricksThisRun > 0 && app.meta.owned.includes(rider.id)) {
      body.append(el("p", { class: "note", text: `${riderName} was riding.` }));
    }

    const inReach = canAffordAny(app.meta.owned, app.meta.coins);
    sheet({
      title: status === "endedEarly" ? "Good run." : "Run finished!",
      body,
      confirm: "Done",
      onConfirm: () => {
        app.go("home");
        // The shop is HIS: no auto-purchase, no picking for him. Just the
        // news that the crew has someone he can afford, whichever he wants.
        if (inReach) {
          sheet({
            title: "A new monster is in reach",
            body: `You have ${app.meta.coins} coins, enough for someone in the crew. Pick whichever one you want.`,
            cancel: "Later",
            confirm: "See the crew",
            onConfirm: () => app.go("collection"),
          });
        }
      },
    });
  };

  /**
   * The bonus round. Elapsed time, which he is good at, offered as a reward
   * rather than as drill, and kept entirely out of the scheduler and out of
   * the retrieval percentage.
   */
  const offerBonus = (): void => {
    pad.setEnabled(false);
    mount(stage, el("div", { class: "bonus-callout", "data-probe": "bonus-callout" },
      el("span", { class: "bc-big", text: "BONUS ROUND" }),
      el("span", { class: "bc-sub", text: "clock time!" })));
    sfx.bonusSting();
    window.setTimeout(() => {
      if (finished) return;
      bonusLeft = 3;
      bonus = makeElapsed(Date.now(), app.meta.elapsedLevel);
      paint();
    }, 950);
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
      if (cur) return cur.expected;
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

/**
 * PROBE: HALF PIPE DUELS (0.23.0). The door beside the park's, the pick
 * with today's plays and the record, the reveal with an opponent that is
 * never his own rig and a line of trash talk, the play spent on Drop in,
 * his runs driven through the real pointer path, the computer's turn with
 * the meter and the real keypad, a solve making them bail and a miss
 * letting them land, the winner's dance and the record, solving everything
 * as the guarantee, leaving as a loss, the day's work bringing a token, a
 * grown-up's gift, and the whole screen fitting a phone and a tablet on
 * its side with nothing overlapping and every key on the tap floor.
 */
import { answerN, closeSheets, goHome, openSettings, suite } from "./_shared.mjs";

const { page, step, must, done } = await suite("duel");

const meta = () => page.evaluate(() => window.__app.meta());
const duel = () => page.evaluate(() => window.__duel.state());
const tick = (secs) => page.evaluate((n) => { for (let t = 0; t < n; t += 1 / 60) window.__duel.tick(1 / 60); }, secs);
const stageBox = () => page.locator('[data-probe="duel-stage"]').boundingBox();
const tap = async () => { const b = await stageBox(); await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5); await page.mouse.down(); await page.mouse.up(); };
const swipe = async (dx, dy) => {
  const b = await stageBox();
  const x = b.x + b.width * 0.5, y = b.y + b.height * 0.5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up();
};
/** Tick until the predicate (run in the page) holds, or the budget runs out. */
const tickUntil = (pred, maxS = 30) => page.evaluate(([src, max]) => {
  const f = new Function("s", `return (${src})(s);`);
  const s = window.__duel.state();
  for (let t = 0; t < max; t += 1 / 60) { window.__duel.tick(1 / 60); if (f(s)) return true; }
  return false;
}, [pred.toString(), maxS]);
const onFlat = "(s) => { const c = s.course; return s.you.mode === 'ride' && s.you.dropped && s.you.x >= c.deck + c.wall && s.you.x <= c.w - c.deck - c.wall; }";
/** My rig, so the opponent can be checked against it. */
const myRig = () => page.evaluate(() => { const m = window.__app.meta(); m.owned = ["grindjaw"]; m.levels = { grindjaw: 2 }; m.helmetsOwned = ["pilot-jet"]; m.gear = { grindjaw: "pilot-jet" }; m.boardsOwned = ["ember"]; m.boardOf = { grindjaw: "ember" }; m.animations = false; m.strands = { add: true, sub: true, mul: false, div: false }; return window.__app.save(); });
/** Through the door, the pick and the reveal into a live duel, then hold the clock. */
const enterDuel = async (len) => {
  await goHome(page);
  await page.click('[data-probe="duel-open"]');
  await page.waitForSelector('[data-probe="duel-pick"]', { timeout: 4000 });
  await page.click(`[data-probe="duel-len-${len}"]`);
  await page.waitForSelector('[data-probe="duel-reveal"]', { timeout: 4000 });
  await page.click('[data-probe="duel-go"]');
  await page.waitForSelector('[data-probe="duel-stage"]', { timeout: 4000 });
  await page.waitForFunction(() => window.__duel && window.__duel.state() !== null, null, { timeout: 4000 });
  await page.evaluate(() => window.__duel.hold());
};

await step("the home door stands beside the park's, lit with today's plays, dim with none", async () => {
  await myRig();
  await goHome(page);
  must(await page.$('[data-probe="duel-open"]') !== null, "no Half Pipe Duel door on the home screen");
  must(((await page.textContent('[data-probe="duel-sub"]')) ?? "").includes("3 plays left today"), `the door does not count today's plays: "${await page.textContent('[data-probe="duel-sub"]')}"`);
  const row = await page.evaluate(() => {
    const a = document.querySelector('[data-probe="park-open"]').getBoundingClientRect();
    const b = document.querySelector('[data-probe="duel-open"]').getBoundingClientRect();
    const panel = document.querySelector(".home-panel").getBoundingClientRect();
    return { sameRow: Math.abs(a.top - b.top) < 4, apart: a.right <= b.left + 1, inside: b.right <= panel.right + 1 && a.left >= panel.left - 1 };
  });
  must(row.sameRow && row.apart && row.inside, `the two doors do not share a row cleanly: ${JSON.stringify(row)}`);
  // No plays left: the door dims and says how to earn one.
  await page.evaluate(() => { const m = window.__app.meta(); m.duelDay = window.__app.day(); m.duelTokens = 0; window.__app.go("home"); });
  await page.waitForTimeout(200);
  must(await page.$('[data-probe="duel-open"].dim') !== null, "the door is lit with no play left");
  must(((await page.textContent('[data-probe="duel-sub"]')) ?? "").includes("finish today's tricks"), "the dim door does not say how to earn a token");
  await page.evaluate(() => { const m = window.__app.meta(); m.duelDay = null; window.__app.go("home"); });
  await page.waitForTimeout(200);
  must(((await page.textContent('[data-probe="duel-sub"]')) ?? "").includes("3 plays left today"), "a fresh day did not bring the token back");
});

await step("the pick offers 10, 15 and 20 rounds with today's plays and the record, and refuses a spent length", async () => {
  await page.click('[data-probe="duel-open"]');
  await page.waitForSelector('[data-probe="duel-pick"]', { timeout: 4000 });
  for (const len of [10, 15, 20]) {
    const t = (await page.textContent(`[data-probe="duel-len-${len}"]`)) ?? "";
    must(t.includes(`${len} rounds`) && t.includes("1 play left") && t.includes("won 0, lost 0"), `the ${len} button reads "${t}"`);
  }
  await page.evaluate(() => { const m = window.__app.meta(); m.duelUsed[10] = 1; window.__app.go("duel"); });
  await page.waitForSelector('[data-probe="duel-pick"]', { timeout: 4000 });
  must(await page.$('[data-probe="duel-len-10"][disabled]') !== null, "a spent length is still offered");
  must(await page.$('[data-probe="duel-len-15"][disabled]') === null, "an unspent length is refused");
  await page.evaluate(() => { const m = window.__app.meta(); m.duelUsed[10] = 0; window.__app.go("duel"); });
  await page.waitForSelector('[data-probe="duel-pick"]', { timeout: 4000 });
});

await step("the reveal picks an opponent that is not my rig, in a lid and on a deck that are not mine, and talks trash", async () => {
  await page.click('[data-probe="duel-len-10"]');
  await page.waitForSelector('[data-probe="duel-reveal"]', { timeout: 4000 });
  const opp = await page.evaluate(() => { const f = document.querySelector('[data-probe="duel-opponent"]'); return { mon: f.dataset.mon, helmet: f.dataset.helmet, board: f.dataset.board }; });
  must(opp.mon && opp.mon !== "grindjaw", `the opponent is my own monster: ${opp.mon}`);
  must(opp.helmet && opp.helmet !== "pilot-jet", `the opponent wears my lid: ${opp.helmet}`);
  must(opp.board && opp.board !== "ember" && opp.board !== "plain", `the opponent rides my deck: ${opp.board}`);
  must(await page.$('[data-probe="duel-opponent"] .park-creature') !== null && await page.$('[data-probe="duel-opponent"] .park-deck') !== null, "the opponent is not drawn on its board");
  const talk = (await page.textContent('[data-probe="trash-talk"]')) ?? "";
  must(talk.length > 10 && !/[—–]/.test(talk), `the trash talk reads "${talk}"`);
  // Not now keeps the play.
  await page.click('[data-probe="duel-not-now"]');
  await page.waitForSelector('[data-probe="duel-pick"]', { timeout: 4000 });
  must((await meta()).duelUsed[10] === 0, "Not now spent the play");
});

await step("Drop in spends the play, and his runs go there and back through the real pointer path", async () => {
  await enterDuel(10);
  const m = await meta();
  must(m.duelUsed[10] === 1 && m.duelTokens === 1, `after Drop in used=${JSON.stringify(m.duelUsed)} tokens=${m.duelTokens}`);
  let st = await duel();
  must(st.phase === "you" && st.len === 10, `the duel did not open on his block: ${st.phase}`);
  must(((await page.textContent('[data-probe="duel-round"]')) ?? "").includes("Round 1 of 10"), "the round pill does not read round 1 of 10");
  // Across the flat: a real tap ollies.
  must(await tickUntil(onFlat, 6), "he never reached the flat");
  await tap();
  st = await duel();
  must(st.you.mode === "air" && st.you.vy > 0, `a tap on the flat did not ollie (${st.you.mode})`);
  must(await tickUntil("(s) => s.you.mode !== 'air'", 3), "the ollie never came down");
  // Out of the lip: a real swipe up is a kickflip, and it lands.
  must(await tickUntil("(s) => s.you.mode === 'air' && s.you.lipAir", 6), "he never launched out of the lip");
  await swipe(0, -70);
  st = await duel();
  must(st.you.trick !== null && st.you.trick.id === "kickflip", `a swipe up in the lip air did not start a kickflip (${JSON.stringify(st.you.trick)})`);
  must(await tickUntil("(s) => s.you.mode === 'done'", 6), "the run never ended");
  st = await duel();
  must(st.yourScore >= 100 && st.you.side === 1, `after the first run score=${st.yourScore} side=${st.you.side}`);
  must(((await page.textContent('[data-probe="duel-you"]')) ?? "") === String(st.yourScore), "the status strip does not show his score");
  // The rest of his block, hands off: five runs end on the far side, then it is their turn.
  must(await tickUntil("(s) => s.phase === 'them'", 40), "the block never passed to the computer");
  st = await duel();
  must(st.yourRuns === 5 && st.theirRuns === 0, `after his block runs=${st.yourRuns}/${st.theirRuns}`);
  must(st.you.side === 1 && st.you.mode === "done", `he did not end his block on the far deck (${st.you.side}, ${st.you.mode})`);
});

await step("the computer's turn: the problem shows over a draining meter, the real keypad answers, and a solve makes them bail", async () => {
  let st = await duel();
  must(st.ask !== null && st.ask.state === "open", "no problem on the computer's turn");
  must(await page.$('[data-probe="duel-ask"].on') !== null, "the ask is not on the glass");
  const shown = (await page.textContent('[data-probe="duel-problem"]')) ?? "";
  must(shown === `${st.ask.shown.a} ${st.ask.shown.op} ${st.ask.shown.b}`, `the problem reads "${shown}"`);
  must(st.ask.shown.format === "standard" && st.ask.fact.kind !== "mul" && st.ask.fact.kind !== "div", `a problem outside the settings: ${st.ask.fact.id} ${st.ask.shown.format}`);
  await tick(0.5);
  const w = await page.evaluate(() => parseFloat(document.querySelector('[data-probe="duel-meter"]').style.width));
  must(w > 50 && w < 95, `after half a second the meter is at ${w}%`);
  // The answer, one real key at a time.
  const expected = await page.getAttribute('[data-probe="duel-problem"]', "data-expected");
  for (const d of expected) await page.evaluate((k) => window.__duel.key(k), d);
  st = await duel();
  must(st.ask.state === "solved" && st.solved === 1, `after typing ${expected} the ask is ${st.ask.state}`);
  must(await page.$('[data-probe="duel-typed"].good') !== null, "a solve is not shown green");
  must(await tickUntil("(s) => s.theirRuns === 1", 12), "their run never ended");
  st = await duel();
  must(st.theirScore === 0, `a solved problem still let them score ${st.theirScore}`);
});

await step("a miss lets them land and score, and so does the meter running out", async () => {
  must(await tickUntil("(s) => s.ask !== null && s.ask.state === 'open'", 5), "no second problem");
  const expected = await page.getAttribute('[data-probe="duel-problem"]', "data-expected");
  const wrong = expected[0] === "9" ? "8" : "9";
  await page.evaluate((k) => window.__duel.key(k), wrong);
  if (expected.length > 1) for (const d of expected.slice(1)) await page.evaluate((k) => window.__duel.key(k), d);
  let st = await duel();
  must(st.ask.state === "missed", `a wrong answer left the ask ${st.ask.state}`);
  must(await page.$('[data-probe="duel-typed"].bad') !== null, "a miss is not shown");
  must(await tickUntil("(s) => s.theirRuns === 2", 12), "their second run never ended");
  st = await duel();
  const after2 = st.theirScore;
  must(after2 > 0, "a missed problem still made them bail");
  // Hands off: the meter runs out, and they land.
  must(await tickUntil("(s) => s.ask !== null && s.ask.state === 'open'", 5), "no third problem");
  must(await tickUntil("(s) => s.ask !== null && s.ask.state === 'out'", 6), "the meter never ran out");
  must(await page.evaluate(() => parseFloat(document.querySelector('[data-probe="duel-meter"]').style.width)) === 0, "the meter is not empty when out");
  must(await tickUntil("(s) => s.theirRuns === 3", 12), "their third run never ended");
  st = await duel();
  must(st.theirScore > after2, "a run with the meter out scored nothing");
});

await step("the duel ends with the winner's dance and the record, then the screen goes home", async () => {
  must(await tickUntil("(s) => s.phase === 'over'", 200), "the duel never ended");
  await page.waitForSelector('[data-probe="duel-win"]', { timeout: 5000 });
  const st = await duel();
  const who = await page.getAttribute('[data-probe="duel-win"]', "data-winner");
  must(who === st.winner, `the dance is ${who}'s, the winner is ${st.winner}`);
  must(((await page.textContent('[data-probe="duel-final"]')) ?? "") === `${st.yourScore} to ${st.theirScore}`, "the final score is not shown");
  must(await page.$('[data-probe="duel-win"] .duel-dance .park-creature') !== null, "the winner is not dancing on its board");
  const m = await meta();
  const rec = m.duelRecord[10];
  must((st.winner === "you" ? rec.won : rec.lost) === 1 && rec.won + rec.lost === 1, `the record reads ${JSON.stringify(rec)} for a ${st.winner} win`);
  await page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
});

await step("solve every problem and the duel is his, whatever the computer planned", async () => {
  await enterDuel(15);
  const out = await page.evaluate(() => {
    const s = window.__duel.state();
    for (let i = 0; i < 40000; i++) {
      window.__duel.tick(1 / 60);
      if (s.ask !== null && s.ask.state === "open") for (const d of String(s.ask.shown.expected)) window.__duel.key(d);
      if (s.phase === "over") break;
    }
    return { winner: s.winner, yours: s.yourScore, theirs: s.theirScore, solved: s.solved, asked: s.asked, runs: [s.yourRuns, s.theirRuns] };
  });
  must(out.winner === "you" && out.theirs === 0 && out.solved === 15 && out.asked === 15, `solving everything gave ${JSON.stringify(out)}`);
  await page.waitForSelector('[data-probe="duel-win"][data-winner="you"]', { timeout: 5000 });
  must((await meta()).duelRecord[15].won === 1, "the win is not on the record");
  await page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
});

await step("leaving mid-duel asks first, and counts as a loss", async () => {
  await enterDuel(20);
  await page.click('[data-probe="back"]');
  await page.waitForSelector(".sheet", { timeout: 3000 });
  must(((await page.textContent(".sheet")) ?? "").includes("counts as a loss"), "the leave sheet does not say it is a loss");
  await page.click(".sheet .btn.ghost"); // Keep going
  await page.waitForTimeout(250);
  must(await page.$('[data-probe="duel-stage"]') !== null, "Keep going left the duel");
  await page.click('[data-probe="back"]');
  await page.waitForSelector(".sheet", { timeout: 3000 });
  await page.click(".sheet .row .btn.warm"); // Leave (a danger confirm)
  await page.waitForSelector('[data-probe="start"]', { timeout: 5000 });
  const m = await meta();
  must(m.duelRecord[20].lost === 1 && m.duelUsed[20] === 1, `after leaving record=${JSON.stringify(m.duelRecord[20])} used=${m.duelUsed[20]}`);
});

await step("the day's work brings a duel token along with the Daily Token, once", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.animations = false;
    m.strands = { add: true, sub: false, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 0 };
    m.dailyGoal = 3; m.doseDay = window.__app.day(); m.doseCount = 0;
    m.tokens = 0; m.tokenDay = null; m.tokensToday = 0;
    m.duelDay = window.__app.day(); m.duelTokens = 1; m.duelWorkDay = null;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 3);
  await page.waitForSelector('[data-probe="duel-token-drop"]', { timeout: 8000 });
  const m = await meta();
  must(m.duelTokens === 2 && m.duelWorkDay === m.duelDay, `after the day's work duel tokens=${m.duelTokens} workDay=${m.duelWorkDay}`);
  await page.waitForSelector('[data-probe="daily-banner"]', { state: "detached", timeout: 8000 });
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  // Out of the session the way the juice probe leaves one: the breather,
  // then the run's own end sheets, then the day put back for the rest.
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await closeSheets(page);
  await closeSheets(page);
  await page.evaluate(() => { const m = window.__app.meta(); m.dailyGoal = 40; m.doseDay = null; m.doseCount = 0; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  // Three plays were spent above, one of each length: with one token the
  // door was dark, and the earned one lights it with a play of each.
  must(((await page.textContent('[data-probe="duel-sub"]')) ?? "").includes("3 plays left today"), `the door does not count the earned token: "${await page.textContent('[data-probe="duel-sub"]')}"`);
  must((await meta()).duelTokens === 2, "the earned token did not survive the reload");
});

await step("a grown-up can give a duel token from the token card", async () => {
  await openSettings(page);
  must(((await page.textContent('[data-probe="duel-token-count"]')) ?? "").includes("2 duel tokens"), "the token card does not count the duel tokens");
  await page.click('[data-probe="grant-duel"]');
  await page.waitForTimeout(300);
  must((await meta()).duelTokens === 3, "the gift did not land");
  must(((await page.textContent('[data-probe="duel-token-count"]')) ?? "").includes("3 duel tokens"), "the card did not follow the gift");
  await goHome(page);
});

await step("the duel fits a phone and a tablet on its side, ask and all: no scroll, keys on the tap floor, nothing overlapping", async () => {
  for (const vp of [{ width: 390, height: 664 }, { width: 1180, height: 740 }, { width: 820, height: 1180 }]) {
    const ctxP = await page.context().browser().newContext({ viewport: vp, hasTouch: true });
    const pp = await ctxP.newPage();
    await pp.goto(page.url().split("?")[0].replace(/\/[^/]*$/, "/"), { waitUntil: "networkidle" });
    await pp.waitForSelector('[data-probe="start"]');
    await pp.evaluate(() => { const m = window.__app.meta(); m.owned = ["grindjaw"]; m.animations = false; m.strands = { add: true, sub: true, mul: false, div: false }; window.__app.go("duel"); });
    await pp.waitForSelector('[data-probe="duel-pick"]');
    const pick = await pp.evaluate(() => ({ page: document.documentElement.scrollHeight, glass: innerHeight, last: document.querySelector('[data-probe="duel-len-20"]').getBoundingClientRect().bottom }));
    must(pick.last <= pick.glass, `${vp.width}x${vp.height}: the pick's last button ends at ${Math.round(pick.last)} of ${pick.glass}`);
    await pp.click('[data-probe="duel-len-10"]');
    await pp.waitForSelector('[data-probe="duel-reveal"]');
    const rev = await pp.evaluate(() => ({ glass: innerHeight, go: document.querySelector('[data-probe="duel-go"]').getBoundingClientRect(), not: document.querySelector('[data-probe="duel-not-now"]').getBoundingClientRect() }));
    must(rev.go.bottom <= rev.glass && rev.go.left >= rev.not.right - 1, `${vp.width}x${vp.height}: the reveal's buttons overrun (${JSON.stringify({ go: rev.go, not: rev.not })})`);
    await pp.click('[data-probe="duel-go"]');
    await pp.waitForSelector('[data-probe="duel-stage"]');
    await pp.waitForFunction(() => window.__duel && window.__duel.state() !== null, null, { timeout: 4000 });
    await pp.evaluate(() => { window.__duel.hold(); for (let i = 0; i < 60; i++) window.__duel.tick(1 / 60); });
    const look = () => pp.evaluate(() => {
      const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
      const stage = rect('[data-probe="duel-stage"]'), status = rect('[data-probe="duel-status"]'), deck = rect('[data-probe="duel-deck"]'), bar = rect(".duel-bar");
      const keys = [...document.querySelectorAll('[data-probe="duel-ask"] .key')].map((k) => ({ r: k.getBoundingClientRect(), cls: k.className, key: k.dataset.key }));
      const arena = rect(".duel-arena");
      const beside = deck.left >= stage.right - 1;
      return {
        page: document.documentElement.scrollHeight, glass: innerHeight, vw: innerWidth, beside,
        stageTop: stage.top, stageBottom: stage.bottom, stageLeft: stage.left, stageRight: stage.right, stageW: stage.width, stageH: stage.height, arenaH: arena.height, arenaW: arena.width,
        barBottom: bar.bottom, statusTop: status.top, statusBottom: status.bottom, deckTop: deck.top, deckBottom: deck.bottom,
        keys: keys.map((k) => ({ w: k.r.width, h: k.r.height, left: Math.round(k.r.left), bottom: k.r.bottom, right: k.r.right, cls: k.cls, key: k.key })),
        askOn: !!document.querySelector('[data-probe="duel-ask"].on'), course: window.__duel.state().course,
      };
    });
    const tag = `${vp.width}x${vp.height}`;
    // His run: the pipe is the screen.
    const his = await look();
    must(his.page <= his.glass, `${tag}, his run: the duel screen scrolls (${his.page} of page in ${his.glass} of glass)`);
    must(!his.askOn, `${tag}: the keypad is up on his run`);
    must(his.stageH >= his.glass * 0.45, `${tag}, his run: the stage is only ${Math.round(his.stageH)} tall on ${his.glass}`);
    must(his.stageTop >= his.barBottom - 1 && his.stageBottom <= his.statusTop + 1, `${tag}, his run: the stage overlaps the bar or the status`);
    // The computer's turn: the session's own keypad, and everything still on the glass.
    await pp.evaluate(() => { const s = window.__duel.state(); for (let i = 0; i < 12000; i++) { window.__duel.tick(1 / 60); if (s.ask) break; } for (let i = 0; i < 30; i++) window.__duel.tick(1 / 60); });
    const r = await look();
    must(r.page <= r.glass, `${tag}, the ask: the duel screen scrolls (${r.page} of page in ${r.glass} of glass)`);
    must(r.askOn, `${tag}: the ask is not on`);
    must(r.stageTop >= r.barBottom - 1 && r.stageBottom <= r.statusTop + 1, `${tag}: the stage overlaps the bar or the status (${Math.round(r.barBottom)} / ${Math.round(r.stageTop)} .. ${Math.round(r.stageBottom)} / ${Math.round(r.statusTop)})`);
    must(r.deckBottom <= r.glass + 0.5, `${tag}: the deck ends at ${Math.round(r.deckBottom)} of ${r.glass}`);
    // THE PAD IS THE SESSION'S PAD (Andy): twelve keys, three columns, the
    // digits, clear and enter, each on the tap floor and on the glass.
    must(r.keys.length === 12, `${tag}: the pad has ${r.keys.length} keys`);
    must(new Set(r.keys.map((k) => k.left)).size === 3, `${tag}: the pad is not three columns (${[...new Set(r.keys.map((k) => k.left))].join(",")})`);
    must(r.keys.map((k) => k.key).join(" ") === "1 2 3 4 5 6 7 8 9 clear 0 enter", `${tag}: the keys read ${r.keys.map((k) => k.key).join(" ")}`);
    must(r.keys.every((k) => k.w >= 44 && k.h >= 44 && k.bottom <= r.glass + 0.5 && k.right <= r.vw), `${tag}: a key is under the tap floor or off the glass: ${JSON.stringify(r.keys.map((k) => [Math.round(k.w), Math.round(k.h), Math.round(k.bottom)]))}`);
    must(r.keys.every((k) => k.cls.includes("key")), `${tag}: the keys are not the session's keys`);
    if (vp.width >= 900 && vp.height <= 900) {
      must(r.beside && r.stageH >= r.glass * 0.45, `${tag}: on a tablet on its side the pad should stand beside a full-height pipe (beside=${r.beside}, stage ${Math.round(r.stageH)} of ${r.glass})`);
      must(Math.abs(r.stageH - his.stageH) < 2, `${tag}: the stage changed size at the block change (${Math.round(his.stageH)} -> ${Math.round(r.stageH)})`);
    } else {
      must(!r.beside && r.deckTop >= r.statusBottom - 1 && r.stageH >= 150, `${tag}: under the pipe the deck should follow the status (deckTop ${Math.round(r.deckTop)}, status ${Math.round(r.statusBottom)}, stage ${Math.round(r.stageH)})`);
    }
    must(r.stageW <= r.vw && r.stageW <= r.arenaW + 1 && r.stageH <= r.arenaH + 1, `${tag}: the stage does not fit its arena (${Math.round(r.stageW)}x${Math.round(r.stageH)} in ${Math.round(r.arenaW)}x${Math.round(r.arenaH)})`);
    must(r.course.w >= 400 && r.course.w <= 880, `${tag}: the course is ${r.course.w} wide`);
    await ctxP.close();
  }
});

await done();

/**
 * PROBE-LOOP — the functional playtest.
 *
 * Drives the real UI with real taps. Every bug ever fixed earns a permanent
 * step here.
 */
import { chromium } from "playwright";
import { answerOf, fail, missingExpected, ok, typeAnswer } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const step = async (label, fn) => {
  try { await fn(); ok(label); }
  catch (e) { fail(`${label}: ${String(e).split("\n")[0]}`); }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

await page.goto(BASE, { waitUntil: "networkidle" });

await step("the app boots to a home screen with a way in", async () => {
  await page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
  must((await page.textContent("h1"))?.includes("Trick Line"), "no title");
});

await step("a session starts and shows a problem", async () => {
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  must(typeof id === "string" && id.includes(":"), `bad fact id ${id}`);
});

await step("typing on the keypad fills the answer slot, one digit at a time", async () => {
  await page.click('.keypad .key[data-key="4"]');
  must((await page.textContent('[data-probe="answer"]'))?.trim() === "4", "4 did not appear");
  await page.click('.keypad .key[data-key="7"]');
  must((await page.textContent('[data-probe="answer"]'))?.trim() === "47", "47 did not appear");
});

await step("clear empties the slot", async () => {
  await page.click(".keypad .key.clear");
  must((await page.textContent('[data-probe="answer"]'))?.trim() === "", "clear left something behind");
});

await step("enter does nothing on an empty slot", async () => {
  const before = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await page.click(".keypad .key.enter");
  await page.waitForTimeout(200);
  must(await page.getAttribute('[data-probe="problem"]', "data-fact") === before, "an empty enter advanced the problem");
});

await step("there is no native text input anywhere in the session", async () => {
  // The iOS keyboard would cover the problem and resize the viewport under us.
  must(await page.$("input, textarea") === null, "a native input exists on the session screen");
});

await step("a correct answer lands a trick and moves on", async () => {
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id));
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  must(await page.$('[data-probe="retype"]') === null, "a correct answer raised the scaffold");
});

await step("a wrong answer shows the strategy scaffold and blocks the skip", async () => {
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id) + 3);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 });
  must((await page.textContent(".scaf-head"))?.length > 0, "the scaffold has no heading");
  must((await page.$$(".step")).length >= 2, "the scaffold has no steps");
});

await step("the scaffold never shows a red X or the word wrong", async () => {
  const text = ((await page.textContent(".stage")) ?? "").toLowerCase();
  for (const banned of ["wrong", "incorrect", "failed", "❌"]) {
    must(!text.includes(banned), `the scaffold says "${banned}"`);
  }
});

await step("the correct re-entry clears the scaffold", async () => {
  const shown = (await page.textContent('[data-probe="retype"]')) ?? "";
  const want = Number(shown.replace(/\D+/g, ""));
  await typeAnswer(page, want);
  await page.waitForSelector('[data-probe="retype"]', { state: "detached", timeout: 6000 });
});

await step("take a breather ends the session and keeps what was landed", async () => {
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  while (await page.$(".sheet") !== null) { await page.click(".sheet .btn.go"); await page.waitForTimeout(300); }
  await page.waitForSelector('[data-probe="start"]', { timeout: 6000 });
});

await step("progress survives a reload", async () => {
  const before = await page.evaluate(() => window.__app.meta().coins);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  const after = await page.evaluate(() => window.__app.meta().coins);
  must(after === before, `coins were ${before} and came back ${after}`);
  must(after > 0, "no coins were banked at all");
});

await step("the shop shows all twenty monsters by name, no mysteries", async () => {
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must((await page.$$(".mon")).length === 20, "the roster is not twenty");
  const text = (await page.textContent(".roster")) ?? "";
  must(!text.includes("???"), "a monster is still a mystery");
  must(text.includes("CINDERWYRM") && text.includes("GILDEDWYRM"), "the dragons are not on display");
  must((await page.$$(".helm-tile")).length === 20, "the gear rack is not twenty helmets");
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
});

await step("the parent dashboard is behind a PIN", async () => {
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  must((await page.textContent("h2"))?.toLowerCase().includes("code"), "no PIN prompt on first entry");
});

await step("setting the PIN opens the dashboard, and the charts render", async () => {
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector(".chart", { timeout: 6000 });
  must((await page.$$(".heat-cell")).length > 100, "the heat map is thin");
  const text = (await page.textContent(".screen")) ?? "";
  must(text.includes("2.CE.1") && text.includes("3.CE.2"), "the SOL standards are not reported");
  must(text.includes("FIRST DIGIT"), "the measurement definition is not stated on screen");
});

await step("the wrong PIN does not open the dashboard", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["9", "9", "9", "9"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForTimeout(400);
  must(await page.$(".chart") === null, "a wrong PIN opened the dashboard");
});

await step("the CSV export carries its own measurement definition", async () => {
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`).catch(() => undefined);
  await page.waitForSelector(".pinpad");
  await page.click(".pinpad .btn.ghost").catch(() => undefined);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-probe="csv"]', { timeout: 6000 });
  const dl = page.waitForEvent("download", { timeout: 8000 });
  await page.click('[data-probe="csv"]');
  const file = await dl;
  const stream = await file.createReadStream();
  let body = "";
  for await (const chunk of stream) body += chunk;
  must(body.includes("FIRST DIGIT"), "the CSV does not carry the measurement definition");
  must(body.includes("first_key_ms") && body.includes("submit_ms"), "the CSV is missing the raw timings");
  must(body.split("\n").length > 4, "the CSV has no rows");
});

await step("a correct answer plays the trick before the next problem appears", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id));
  // The rider must exist mid-run and be gone before the keypad wakes.
  const seen = await page.waitForSelector(".trick-run .trick-creature", { timeout: 1200 }).catch(() => null);
  must(seen !== null, "no trick animation appeared on a correct answer");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  must(await page.$(".trick-run") === null, "the trick run outlived its own animation");
});

await step("the kid can switch the tricks off, and the switch persists", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-probe="anim-toggle"]');
  await page.waitForTimeout(250);
  must(await page.evaluate(() => window.__app.meta().animations) === false, "the toggle did not take");
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().animations) === false, "the toggle did not persist");
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id));
  const ride = await page.waitForSelector(".trick-run", { timeout: 900 }).catch(() => null);
  must(ride === null, "the trick still played with the toggle off");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-probe="anim-toggle"]'); // back on for the rest
  await page.waitForTimeout(250);
  // The steps that follow expect to find the dashboard open, as it was before
  // this block navigated away. Put it back the way we found it.
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector(".chart", { timeout: 6000 });
});

// ---- the practice-focus switches -----------------------------------------

await step("a fresh install practises addition and subtraction only", async () => {
  // He is at the start of third grade and his class has not reached
  // multiplication. Drilling it would not be practice.
  const strands = await page.evaluate(() => window.__app.meta().strands);
  must(strands.add === true && strands.sub === true, `add/sub not on: ${JSON.stringify(strands)}`);
  must(strands.mul === false && strands.div === false, `mul/div should start off: ${JSON.stringify(strands)}`);
});

await step("the settings card shows a switch for every operation", async () => {
  await page.waitForSelector('[data-strand="add"]');
  for (const k of ["add", "sub", "mul", "div"]) {
    must(await page.$(`[data-strand="${k}"]`) !== null, `no switch for ${k}`);
  }
  must(await page.getAttribute('[data-strand="mul"]', "aria-pressed") === "false", "multiplication reads as on");
});

await step("the standards card says a switched-off standard is not a result", async () => {
  const text = (await page.textContent(".screen")) ?? "";
  must(text.includes("switched off in settings"), "a switched-off standard is reported as if it were a score");
});

await step("a session asks nothing but addition and subtraction", async () => {
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const kinds = new Set();
  for (let i = 0; i < 14; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 }).catch(() => undefined);
    if (await page.$(".sheet") !== null) break;
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact").catch(() => null);
    if (!id) break;
    kinds.add(id.split(":")[0]);
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
  must(kinds.size > 0, "no problems were asked at all");
  for (const k of kinds) must(k === "add" || k === "sub", `a ${k} problem was asked while it is switched off`);
});

await step("switching multiplication on takes effect and survives a reload", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-strand="mul"]', { timeout: 6000 });
  await page.click('[data-strand="mul"]');
  await page.waitForTimeout(400);
  must(await page.evaluate(() => window.__app.meta().strands.mul) === true, "the switch did not take");
  // And it must not have demanded the code again just to flip a switch.
  must(await page.$('[data-strand="sub"]') !== null, "flipping a switch threw us back to the PIN pad");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  must(await page.evaluate(() => window.__app.meta().strands.mul) === true, "the switch did not persist");
});

await step("switching an operation off keeps everything already learned in it", async () => {
  const before = await page.evaluate(() => {
    const st = window.__app.states();
    return [...st.values()].filter((s) => s.introduced).length;
  });
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-strand="add"]', { timeout: 6000 });
  await page.click('[data-strand="add"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const st = window.__app.states();
    return [...st.values()].filter((s) => s.introduced).length;
  });
  must(after === before, `switching addition off changed the progress (${before} -> ${after})`);
});

await step("the last operation cannot be switched off", async () => {
  // The app would have nothing to ask.
  for (const k of ["sub", "mul"]) {
    const el = await page.$(`[data-strand="${k}"]`);
    if (el && (await page.getAttribute(`[data-strand="${k}"]`, "aria-pressed")) === "true") {
      await page.click(`[data-strand="${k}"]`);
      await page.waitForTimeout(300);
      while (await page.$(".sheet") !== null) { await page.click(".sheet .btn.go"); await page.waitForTimeout(250); }
    }
  }
  const strands = await page.evaluate(() => window.__app.meta().strands);
  must(Object.values(strands).some(Boolean), `every operation got switched off: ${JSON.stringify(strands)}`);
  const remaining = await page.$(`[data-strand="${Object.keys(strands).find((k) => strands[k])}"]`);
  must(remaining !== null, "the settings card vanished");
});

// ---- missing number --------------------------------------------------------

await step("missing number starts OFF for all four operations", async () => {
  const m = await page.evaluate(() => window.__app.meta().missing);
  must(m.add === false && m.sub === false && m.mul === false && m.div === false, JSON.stringify(m));
  must(m.pct === 20, `default mix is ${m.pct}, not 20`);
});

await step("each operation has its own missing-number switch, plus the mix stepper", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-missing="add"]', { timeout: 6000 });
  for (const k of ["add", "sub", "mul", "div"]) {
    must(await page.$(`[data-missing="${k}"]`) !== null, `no missing switch for ${k}`);
  }
  // The stepper only appears once something is on: a mix of nothing is noise.
  must(await page.$('[data-probe="missing-pct"]') === null, "the stepper shows while everything is off");
  await page.click('[data-missing="add"]');
  await page.waitForSelector('[data-probe="missing-pct"]', { timeout: 4000 });
  must(await page.evaluate(() => window.__app.meta().missing.add) === true, "the switch did not take");
});

await step("the mix percentage steps and persists", async () => {
  await page.click('[data-probe="missing-plus"]');
  await page.waitForTimeout(300);
  must((await page.textContent('[data-probe="missing-pct"]'))?.trim() === "25%", "plus did not step to 25");
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().missing.pct) === 25, "the mix did not persist");
});

await step("a missing item types into its own inline blank and grades on the operand", async () => {
  // Everything is set AFTER the reload: a mutation on the live meta object
  // does not survive page.goto, and the first draft of this step set the
  // strands before one, so only multiplication was on and no missing item
  // could ever appear.
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: true, sub: true, mul: false, div: false, pct: 100 };
    m.animations = false;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"][data-format="missing"]', { timeout: 6000 });
  const text = (await page.textContent('[data-probe="problem"]')) ?? "";
  const wantNum = missingExpected(text);
  await page.click(`.keypad .key[data-key="${String(wantNum)[0]}"]`);
  const inBlank = (await page.textContent('[data-probe="mslot"]'))?.trim() ?? "";
  must(inBlank === String(wantNum)[0], `typed into the blank but it shows "${inBlank}"`);
  for (const d of String(wantNum).slice(1)) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.click(".keypad .key.enter");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  must(await page.$('[data-probe="retype"]') === null, `the operand ${wantNum} was graded wrong for "${text}"`);
});

await step("a wrong missing answer reveals the whole fact and demands the operand", async () => {
  await page.waitForSelector('[data-probe="problem"][data-format="missing"]', { timeout: 6000 });
  const text = (await page.textContent('[data-probe="problem"]')) ?? "";
  const wantNum = missingExpected(text);
  await typeAnswer(page, wantNum + 1);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 });
  must(await page.$(".scaf-eq") !== null, "the completed equation is not revealed");
  const retype = (await page.textContent('[data-probe="retype"]')) ?? "";
  must(Number(retype.replace(/\D+/g, "")) === wantNum, `retype asks for "${retype}", not ${wantNum}`);
  await typeAnswer(page, wantNum);
  await page.waitForSelector('[data-probe="retype"]', { state: "detached", timeout: 6000 });
});

await step("switching missing number back off returns every item to standard", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.animations = false;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  for (let i = 0; i < 8; i++) {
    if (await page.$(".sheet") !== null) break;
    const fmt = await page.getAttribute('[data-probe="problem"]', "data-format").catch(() => null);
    if (fmt === null) break;
    must(fmt === "standard", "a missing item appeared with everything off");
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 }).catch(() => undefined);
  }
});

// ---- elapsed time levels and the analog view -------------------------------

await step("the bonus round defaults to level 1, digital", async () => {
  const m = await page.evaluate(() => window.__app.meta());
  must(m.elapsedLevel === 1, `default level is ${m.elapsedLevel}`);
  must(m.elapsedAnalog === false, "analog is on by default");
});

await step("the settings offer three explained levels and picking one persists", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('.topbar .btn.ghost:last-of-type');
  await page.waitForSelector(".pinpad");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-probe="elapsed-level-1"]', { timeout: 6000 });
  for (const n of [1, 2, 3]) must(await page.$(`[data-probe="elapsed-level-${n}"]`) !== null, `no level ${n} row`);
  await page.click('[data-probe="elapsed-level-3"]');
  await page.waitForTimeout(350);
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().elapsedLevel) === 3, "the level did not persist");
});

await step("the analog view shows two clock faces and not a single digital time", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.elapsedAnalog = true;
    m.animations = false;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"], [data-probe="bonus"]');
  await page.evaluate(() => window.__probe.bonus());
  await page.waitForSelector(".bonus-analog", { timeout: 4000 });
  must((await page.$$(".bonus-analog .clock")).length === 2, "there are not two clock faces");
  const visible = (await page.textContent(".stage")) ?? "";
  must(!/\d{1,2}:\d{2}/.test(visible), `a digital time leaked into the analog view: "${visible.trim()}"`);
  // Solve it from the data attributes, which exist for exactly this check.
  const startL = await page.getAttribute('[data-probe="bonus"]', "data-start");
  const endL = await page.getAttribute('[data-probe="bonus"]', "data-end");
  const toMin = (l) => (Number(l.split(":")[0]) % 12) * 60 + Number(l.split(":")[1]);
  const mins = ((toMin(endL) - toMin(startL)) + 720) % 720;
  await typeAnswer(page, mins);
  await page.waitForTimeout(250);
  must(await page.$('[data-probe="retype"]') === null, `the analog answer ${mins} was graded wrong`);
});

// ---- the juice and the agency ---------------------------------------------

const calmMeta = () => page.evaluate(() => {
  const m = window.__app.meta();
  m.strands = { add: true, sub: true, mul: false, div: false };
  m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
  m.animations = false;
});
const answerN = async (n) => {
  for (let i = 0; i < n; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
};

await step("the session coin chip counts up the moment a trick lands", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await calmMeta();
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const before = Number((await page.textContent('[data-probe="session-coins"] .chip-n')) ?? "-1");
  await answerN(1);
  const after = Number((await page.textContent('[data-probe="session-coins"] .chip-n')) ?? "-1");
  must(after === before + 1, `chip went ${before} -> ${after}, wanted +1`);
});

await step("landing a full line raises the LINE LANDED banner", async () => {
  // Photographing the old build proved a landed line produced no feedback at
  // all. The banner plays even with the ride animations switched off.
  await answerN(3);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id));
  await page.waitForSelector('[data-probe="line-banner"]', { timeout: 4000 });
  await page.waitForSelector('[data-probe="line-banner"]', { state: "detached", timeout: 4000 });
});

await step("the run's end offers the shop, and Later spends nothing", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.coins = 5000; m.owned = []; });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go"); // confirm the breather
  await page.waitForSelector(".sheet .btn.go", { timeout: 5000 });
  await page.click(".sheet .btn.go"); // Done on the run sheet
  await page.waitForSelector(".sheet", { timeout: 5000 });
  const text = (await page.textContent(".sheet")) ?? "";
  must(text.includes("Later") && text.includes("See the crew"), "the shop offer is missing its choices");
  const coinsBefore = await page.evaluate(() => window.__app.meta().coins);
  await page.click(".sheet .btn.ghost"); // Later
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().coins) === coinsBefore, "Later spent his coins");
  must(await page.evaluate(() => window.__app.meta().owned.length) === 0, "Later bought a monster anyway");
});

await step("after a run, home says today is done", async () => {
  must(await page.$('[data-probe="done-today"]') !== null, "no done-today pill");
  const label = (await page.textContent('[data-probe="start"]')) ?? "";
  must(label.toUpperCase().includes("ANOTHER"), `the button still says "${label}"`);
  must(await page.$('[data-probe="unlock-progress"]') !== null, "no progress toward the next monster on home");
});

await step("landing a line with animations on plays the victory lap and lights the spot", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.animations = true;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  // THE MINIMAL-SCREEN CONTRACT (Andy's phone report): while he is thinking,
  // the scenery is INVISIBLE; it appears dim for a solo trick and vanishes
  // again before the next problem.
  must(await page.evaluate(() => getComputedStyle(document.querySelector(".spot")).opacity) === "0",
    "the rail is visible during a problem");
  {
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForSelector(".left.show-spot", { timeout: 2500 });
    await page.waitForSelector(".left.show-spot", { state: "detached", timeout: 6000 })
      .catch(async () => { must(await page.$(".left.show-spot") === null, "the rail never faded back out"); });
  }
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
  // The show class is the contract; the 300ms fade tail after it is the
  // transition doing its job, so judge the CLASS, not a mid-fade opacity.
  must(await page.$(".left.show-spot") === null, "the rail did not clear off before the next problem");
  const id5 = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id5));
  await page.waitForSelector(".lap-run", { timeout: 4000 });
  must(await page.$(".spot.lit") !== null, "the spot did not light for the lap");
  must(await page.$(".lap-run .trick-creature") !== null, "no rider on the lap");
  await page.waitForSelector(".lap-run", { state: "detached", timeout: 7000 });
  must(await page.$(".spot.lit") === null, "the spot stayed lit after the lap");
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForTimeout(400);
  while (await page.$(".scrim") !== null) { await page.click(".sheet .btn.go").catch(() => {}); await page.waitForTimeout(250); }
});

await step("send out picks who rides, and the collection says so", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.owned = ["grindjaw", "voltmaw"];
    m.levels = { grindjaw: 1, voltmaw: 1 };
    m.rider = null;
    window.__app.go("collection");
  });
  await page.waitForTimeout(250);
  await page.click('[data-mon="grindjaw"]');
  await page.waitForSelector('[data-probe="send-out"]', { timeout: 4000 });
  await page.click('[data-probe="send-out"]');
  await page.waitForTimeout(350);
  must(await page.evaluate(() => window.__app.meta().rider) === "grindjaw", "send out did not set the rider");
  while (await page.$(".scrim") !== null) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  const badges = await page.$$(".riding-badge");
  must(badges.length === 1, `${badges.length} RIDING badges, wanted exactly 1`);
});

await step("he buys the dragon he WANTS, not the cheapest", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.coins = 5000; m.owned = []; m.rider = null;
    window.__app.go("collection");
  });
  await page.waitForTimeout(250);
  await page.click('[data-mon="cinderwyrm"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go"); // Buy
  await page.waitForSelector(".sheet", { timeout: 4000 }); // the reveal
  await page.click(".sheet .btn.go"); // Nice
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => window.__app.meta());
  must(m.owned.includes("cinderwyrm"), "the chosen dragon was not bought");
  must(!m.owned.includes("grindjaw"), "the shop bought the cheapest instead of his pick");
  must(m.coins === 5000 - 350, `coins went to ${m.coins}, wanted 4650`);
});

await step("a helmet is bought once and lands on the monster he puts it on", async () => {
  await page.click('[data-helm="cap-fire"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go"); // Buy
  await page.waitForTimeout(350);
  must(await page.evaluate(() => window.__app.meta().helmetsOwned.includes("cap-fire")), "the helmet is not in the locker");
  await page.click('[data-mon="cinderwyrm"]');
  await page.waitForSelector('[data-equip="cap-fire"]', { timeout: 4000 });
  await page.click('[data-equip="cap-fire"]');
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().gear["cinderwyrm"]) === "cap-fire", "the helmet did not go on");
  // And the monster's art in the open card is wearing it.
  must(await page.$(".sheet .creature .helm") !== null, "the worn helmet is not drawn on the card");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
});

if (errors.length > 0) fail(`uncaught page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
console.log(process.exitCode ? "PROBE-LOOP RED" : "PROBE-LOOP GREEN");

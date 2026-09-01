/**
 * PROBE-LOOP — the functional playtest.
 *
 * Drives the real UI with real taps. Every bug ever fixed earns a permanent
 * step here.
 */
import { chromium } from "playwright";
import { answerOf, fail, ok, typeAnswer } from "./lib/drive.mjs";

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

await step("the collection screen opens and shows the roster", async () => {
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must((await page.$$(".mon")).length === 12, "the roster is not twelve");
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

if (errors.length > 0) fail(`uncaught page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
console.log(process.exitCode ? "PROBE-LOOP RED" : "PROBE-LOOP GREEN");

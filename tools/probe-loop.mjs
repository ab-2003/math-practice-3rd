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

if (errors.length > 0) fail(`uncaught page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
console.log(process.exitCode ? "PROBE-LOOP RED" : "PROBE-LOOP GREEN");

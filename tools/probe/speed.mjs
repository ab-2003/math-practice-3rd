/**
 * PROBE: SPEED RUN. One before the day's work, per-setup bests, the reset
 * behind a confirm, the budget's end.
 */
import { answerOf, goHome, suite, typeAnswer } from "./_shared.mjs";

const { page, step, must, done } = await suite("speed");

await step("speed run: one before the day's work, per-setup bests, then the budget", async () => {
  await page.waitForSelector('[data-probe="start"]');
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.animations = false;
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.doseDay = window.__app.day(); m.doseCount = 0;
    m.speedDay = null; m.speedCount = 0; m.speedBest = {}; m.speedLimit = 10;
    window.__app.go("home");
  });
  await page.waitForTimeout(250);
  const cell = (await page.textContent('[data-probe="speed-open"]')) ?? "";
  must(cell.includes("0/10"), `the speed cell says "${cell}"`);
  await page.click('[data-probe="speed-open"]');
  await page.waitForSelector('[data-probe="problem"]', { timeout: 4000 });
  must(await page.$(".speed-timer") !== null, "no quiet timer bar");
  must(await page.evaluate(() => window.__app.meta().speedCount) === 1, "the attempt was not spent at the start");
  for (let i = 0; i < 3; i++) {
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.__speed.end());
  await page.waitForSelector(".sheet", { timeout: 8000 });
  const sheetText = (await page.textContent(".sheet")) ?? "";
  must(sheetText.includes("3 in a minute"), "the finale does not report the score");
  must(sheetText.includes("NEW BEST"), "a first score is not a new best");
  must(!sheetText.includes("Again"), "a pre-dose run offered a second attempt");
  const best = await page.evaluate(() => window.__app.meta().speedBest);
  must(best["add+sub"] === 3, `the scoreboard holds ${JSON.stringify(best)}`);
  await page.click(".sheet .btn.ghost");
  await page.waitForSelector('[data-probe="speed-open"]', { timeout: 4000 });

  await page.click('[data-probe="speed-open"]');
  await page.waitForSelector('[data-probe="speed-locked"]', { timeout: 4000 });
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="speed-open"]');

  await page.evaluate(() => { const m = window.__app.meta(); m.doseCount = m.dailyGoal; });
  await page.click('[data-probe="speed-open"]');
  await page.waitForSelector('[data-probe="problem"]', { timeout: 4000 });
  await page.click('[data-probe="speed-reset"]');
  await page.waitForSelector(".sheet .btn.warm", { timeout: 4000 });
  await page.click(".sheet .btn.warm");
  await page.waitForTimeout(300);
  must(Object.keys(await page.evaluate(() => window.__app.meta().speedBest)).length === 0, "reset kept the bests");
  await page.evaluate(() => window.__speed.end());
  await page.waitForSelector(".sheet", { timeout: 8000 });
  await page.click(".sheet .btn.ghost");
  await page.waitForSelector('[data-probe="speed-open"]', { timeout: 4000 });

  await page.evaluate(() => { const m = window.__app.meta(); m.speedCount = m.speedLimit; });
  await page.click('[data-probe="speed-open"]');
  await page.waitForSelector('[data-probe="speed-locked"]', { timeout: 4000 });
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="speed-open"]');
});

await step("speed runs never touch the response log", async () => {
  await goHome(page);
  const n = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("trickline", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res) => { const t = db.transaction("responses", "readonly").objectStore("responses").get("all"); t.onsuccess = () => res((t.result ?? []).length); });
  });
  must(n === 0, `${n} responses were logged by speed runs alone`);
});

await done();

/**
 * PROBE: THE DAY'S GAME TIME (Andy, 2026-09-03). Off by default; on, never
 * under 15; every screen but the grown-ups' counts; a toast at three
 * minutes and one; the end of the day sends the shop and the park home
 * with the word, lets a session finish its line first, and closes every
 * door on the home screen but the grown-ups'. The clock is driven by hand
 * through the same path the ticker takes.
 */
import { answerN, calmMeta, closeSheets, escapeAll, goHome, openSettings, suite, toasts } from "./_shared.mjs";

const { page, step, must, done } = await suite("limit");
const meta = () => page.evaluate(() => window.__app.meta());
const advance = (ms) => page.evaluate((ms) => window.__app.playAdvance(ms), ms);

await step("the daily time limit is off by default, and switching it on lands at 30, never under 15", async () => {
  await page.waitForSelector('[data-probe="start"]');
  await openSettings(page);
  must(await page.$('[data-probe="day-limit"][aria-pressed="false"]') !== null, "the limit is on by default");
  must(await page.$('[data-probe="day-limit-minutes"]') === null, "the minutes stepper shows with the limit off");
  await page.click('[data-probe="day-limit"]');
  await page.waitForTimeout(300);
  must((await meta()).dayLimitMinutes === 30, "switching on did not land at 30");
  for (let i = 0; i < 5; i++) { await page.click('[data-probe="day-limit-minutes-minus"]'); await page.waitForTimeout(200); }
  must((await meta()).dayLimitMinutes === 15, `the floor is not 15 (${(await meta()).dayLimitMinutes})`);
  must(await page.evaluate(() => window.__app.set("dayLimitMinutes", 10)) === false || (await meta()).dayLimitMinutes === 15, "a value under 15 was accepted");
});

await step("the grown-ups screen does not count; the home screen does, and says what is left", async () => {
  const before = (await meta()).playMs;
  await advance(60_000); // on the grown-ups screen
  must((await meta()).playMs === before, "time on the grown-ups screen counted");
  await goHome(page);
  must(((await page.textContent('[data-probe="time-left"]')) ?? "").includes("15 minutes"), "home does not say the minutes left");
  await advance(60_000);
  must((await meta()).playMs >= 60_000, "time on the home screen did not count");
  await goHome(page);
  must(((await page.textContent('[data-probe="time-left"]')) ?? "").includes("14 minutes"), "home does not follow the tally");
});

await step("three minutes and one minute left each get a toast, once", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.playMs = 15 * 60_000 - 3 * 60_000 - 2000; });
  await advance(3000);
  must((await toasts(page)).some((t) => t.includes("3 minutes")), `no three-minute toast: ${JSON.stringify(await toasts(page))}`);
  await advance(1000);
  must((await toasts(page)).filter((t) => t.includes("3 minutes")).length === 1, "the three-minute toast repeated");
  await page.evaluate(() => { const m = window.__app.meta(); m.playMs = 15 * 60_000 - 60_000 - 1000; });
  await advance(2000);
  must((await toasts(page)).some((t) => t.includes("1 minute")), "no one-minute toast");
});

await step("in the shop, the end of the day sends the rider home with the word, and the doors close", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal; m.playMs = 15 * 60_000 - 3000; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  await advance(4000);
  await page.waitForSelector('[data-probe="day-closed"]', { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("Come back tomorrow"), "no come-back-tomorrow sheet");
  await closeSheets(page);
  for (const probe of ["start", "collection", "park-open", "speed-open"]) {
    must(await page.$(`[data-probe="${probe}"][disabled]`) !== null, `${probe} is still open after the day closed`);
  }
  // Straight to the shop by hand: refused, home again.
  await page.evaluate(() => window.__app.go("collection"));
  await page.waitForTimeout(200);
  must(await page.$(".roster") === null && (await page.$('[data-probe="day-closed"]')) !== null, "a closed day still opens the shop");
  // The grown-ups' screen stays open.
  await page.click('[data-probe="grownups"]');
  await page.waitForSelector(".pinpad, [data-probe='tab-progress']", { timeout: 4000 });
  await goHome(page);
});

await step("in a session, the end of the day waits for the line to finish, then home", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.playMs = 0; m.playWarned = 0; });
  await calmMeta(page);
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 1);
  // The day ends mid-line: the run keeps going for the rest of the line.
  await page.evaluate(() => { const m = window.__app.meta(); m.playMs = 15 * 60_000 - 500; });
  await advance(1000);
  await page.waitForTimeout(300);
  must(await page.$('[data-probe="problem"]') !== null, "the session was cut mid-line");
  await answerN(page, 4);
  // The run's own story first, then Done lands home with the day's word.
  await page.waitForSelector(".sheet", { timeout: 15000 });
  must(!((await page.textContent(".sheet")) ?? "").includes("Come back tomorrow"), "the day's word came before the run's story");
  await page.click(".sheet .row .btn.go");
  await page.waitForSelector('[data-probe="day-closed"]', { timeout: 6000 });
  must(((await page.textContent(".sheet")) ?? "").includes("Come back tomorrow"), "Done did not land on come back tomorrow");
  await closeSheets(page);
  const rec = await page.evaluate(async () => { const db = await new Promise((res) => { const r = indexedDB.open("trickline", 1); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const t = db.transaction("sessions", "readonly").objectStore("sessions").get("all"); t.onsuccess = () => res(t.result ?? []); }); });
  must(rec.length > 0 && rec[rec.length - 1].reason === "limit", `the run was not logged as ended by the limit: ${JSON.stringify(rec[rec.length - 1])}`);
});

await step("a new day reopens everything", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.playDay = window.__app.day() - 1; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  must(await page.$('[data-probe="day-closed"]') === null, "the closed card survived a new day");
  must(await page.$('[data-probe="start"][disabled]') === null, "Drop In is still closed on a new day");
  await escapeAll(page);
});

await done();

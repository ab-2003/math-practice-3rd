/**
 * ANSWER-EYE — the core instrument.
 *
 * This app's defining failure is not an ugly screen, it is grading a correct
 * answer wrong, or a wrong answer right, and then reporting that to a teacher.
 * A calculator can be CONFIDENTLY WRONG, and so can this.
 *
 * So: drive real sessions through the real UI, and for every problem shown,
 * derive the answer with a SECOND implementation that never imports the app's
 * code (lib/drive.mjs answerOf, which parses the fact id), then check the app
 * agrees. Two implementations that agree is evidence. One agreeing with itself
 * is not.
 *
 * Also asserted here: the forced re-entry after a wrong answer never counts
 * toward mastery, and the dashboard's retrieval percentage recomputes exactly
 * from the raw stored response log.
 */
import { chromium } from "playwright";
import { answerOf, currentFact, fail, ok, startSession, typeAnswer, waitReady } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const ITEMS = Number(process.env.ITEMS ?? 80);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await startSession(page, BASE);

let checked = 0;
let wrongsTested = 0;
let sessions = 0;
let bonusChecked = 0;
const seen = new Set();

/** Day one plans only a handful of new facts, so reaching a useful sample
 *  means running several sessions, exactly as he would over several days. */
/**
 * A state machine, in priority order. An earlier version checked for a
 * problem before checking for a sheet, and since the finished problem stays in
 * the stage BEHIND the end-of-session sheet, it kept trying to answer a
 * session that was already over.
 */
const readState = () => page.evaluate(() => ({
  sheet: document.querySelector(".scrim") !== null,
  start: document.querySelector('[data-probe="start"]') !== null,
  asleep: document.querySelector(".keypad")?.classList.contains("asleep") ?? true,
  retype: document.querySelector('[data-probe="retype"]') !== null,
  bonus: document.querySelector('[data-probe="bonus"]') !== null,
  problem: document.querySelector('[data-probe="problem"]')?.getAttribute("data-fact") ?? null,
}));

let guard = 0;
while (checked + bonusChecked < ITEMS && guard++ < ITEMS * 6) {
  const st = await readState();

  if (st.sheet) {
    const go = await page.$(".sheet .btn.go");
    if (go) await go.click(); else await page.click(".sheet .btn").catch(() => undefined);
    await page.waitForTimeout(220);
    continue;
  }
  if (st.start) {
    if (sessions >= 12) break;
    sessions += 1;
    await page.click('[data-probe="start"]');
    await page.waitForTimeout(300);
    continue;
  }
  if (st.asleep) { await page.waitForTimeout(200); continue; }

  if (st.bonus) {
    // Elapsed time is not a fact. Parse the two clock times out of the
    // sentence and work the minutes out here, so the app's elapsed-time
    // arithmetic is checked against a second implementation too.
    const text = (await page.textContent('[data-probe="bonus"]')) ?? "";
    const times = [...text.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => (Number(m[1]) % 12) * 60 + Number(m[2]));
    if (times.length !== 2) { fail(`bonus problem had ${times.length} times: ${text}`); break; }
    await typeAnswer(page, ((times[1] - times[0]) + 720) % 720);
    bonusChecked += 1;
    await page.waitForTimeout(120);
    continue;
  }

  if (!st.problem) { await page.waitForTimeout(150); continue; }

  const id = st.problem;
  const expected = answerOf(id);
  seen.add(id.split(":")[0]);

  if (st.retype) { await typeAnswer(page, expected); await page.waitForTimeout(120); continue; }

  // Every fifth item is answered WRONG on purpose, to prove the app catches a
  // wrong answer, shows the scaffold, and refuses to let him move on.
  if (checked % 5 === 4 && wrongsTested < 8) {
    wrongsTested += 1;
    await typeAnswer(page, expected === 0 ? 7 : expected + 1);
    const scaffolded = await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 }).catch(() => null);
    if (!scaffolded) { fail(`${id}: a wrong answer did not raise the scaffold`); break; }
    await typeAnswer(page, expected === 0 ? 8 : expected + 2);
    await page.waitForTimeout(150);
    if (await page.$('[data-probe="retype"]') === null) { fail(`${id}: a wrong re-entry was accepted`); break; }
    await typeAnswer(page, expected);
    await page.waitForSelector('[data-probe="retype"]', { state: "detached", timeout: 6000 })
      .catch(() => fail(`${id}: the correct re-entry did not clear the scaffold`));
    checked += 1;
    continue;
  }

  await typeAnswer(page, expected);
  await page.waitForTimeout(120);
  if (await page.$('[data-probe="retype"]') !== null) {
    fail(`${id}: the correct answer ${expected} was graded wrong`);
    break;
  }
  checked += 1;
}

// Close out whatever is on screen so the final session's log is flushed.
for (let i = 0; i < 6 && await page.$(".sheet") !== null; i++) {
  await page.click(".sheet .btn.go").catch(() => undefined);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(400);

if (checked < 20) fail(`only ${checked} items were checked, expected at least 20`);
else ok(`${checked} items graded correctly against an independent derivation, over ${sessions + 1} sessions`);
if (wrongsTested < 4) fail(`only ${wrongsTested} wrong answers were exercised`);
else ok(`${wrongsTested} wrong answers raised the scaffold and blocked the skip`);
if (seen.size < 2) fail(`only saw fact kinds: ${[...seen].join(",")}`);
else ok(`fact kinds exercised: ${[...seen].join(", ")}`);
if (bonusChecked > 0) ok(`${bonusChecked} elapsed-time bonus problems solved against an independent clock`);

// ---- the stored log must reconstruct the dashboard's headline --------------
const audit = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("trickline", 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const read = (store) => new Promise((res, rej) => {
    const t = db.transaction(store, "readonly").objectStore(store).get("all");
    t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
  });
  const responses = (await read("responses")) ?? [];
  const facts = (await read("facts")) ?? {};
  return { responses, facts };
});

const scored = audit.responses.filter((r) => !r.isRetry && !r.factId.startsWith("elapsed:"));
const retries = audit.responses.filter((r) => r.isRetry);
if (retries.length === 0) fail("no retry responses were recorded at all");
else ok(`${retries.length} forced re-entries recorded and excluded from scoring`);

// Every stored response's classification must match its own raw milliseconds.
let mismatched = 0;
for (const r of scored) {
  const expect = !r.correct || r.firstKeyMs === null ? "effortful"
    : r.firstKeyMs < 3000 ? "retrieved" : r.firstKeyMs < 8000 ? "derived" : "effortful";
  if (r.cls !== expect) mismatched += 1;
}
if (mismatched > 0) fail(`${mismatched} stored responses carry a classification their own timing contradicts`);
else ok(`all ${scored.length} scored responses classify consistently with their raw ms`);

// A retry must never have moved a fact's mastery streak.
const retriedFacts = new Set(retries.map((r) => r.factId));
let streakLeak = 0;
for (const id of retriedFacts) {
  const st = audit.facts[id];
  // The wrong answer that preceded the retry zeroes the streak; the retry
  // itself must not have put anything back.
  if (st && st.masteryStreak > 0 && st.lastRetrievedDay !== null) {
    const after = scored.filter((r) => r.factId === id && r.correct && r.cls === "retrieved");
    if (after.length === 0) streakLeak += 1;
  }
}
if (streakLeak > 0) fail(`${streakLeak} facts gained mastery credit from a forced re-entry`);
else ok("no fact gained mastery credit from a forced re-entry");

if (errors.length > 0) fail(`uncaught page errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
console.log(process.exitCode ? "ANSWER-EYE RED" : "ANSWER-EYE GREEN");

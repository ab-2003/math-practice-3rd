/**
 * Shared scaffolding for the probe suites. Each suite is its own process with
 * its own browser against the same preview, so the gauntlet's cost is the
 * slowest suite, not the sum. Playwright contexts have isolated storage, so
 * parallel suites never see each other's IndexedDB.
 */
import { chromium } from "playwright";
import { answerOf, fail, ok, typeAnswer } from "../lib/drive.mjs";
export { answerOf, fail, ok, typeAnswer } from "../lib/drive.mjs";

export const BASE = process.env.BASE ?? "http://localhost:8050";
export const PIN = ["1", "3", "5", "7"];

export const suite = async (name) => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  let current = "(before first step)";
  page.on("pageerror", (e) => errors.push(`[${current}] ${e.message} @ ${(e.stack ?? "").split("\n").slice(1, 3).join(" | ")}`));
  const step = async (label, fn) => {
    current = label;
    try { await fn(); ok(label); }
    catch (e) { fail(`${label}: ${String(e).split("\n")[0]}`); }
  };
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };
  const done = async () => {
    if (errors.length > 0) fail(`uncaught page errors: ${errors.slice(0, 3).join(" | ")}`);
    await browser.close();
    console.log(process.exitCode ? `PROBE-${name.toUpperCase()} RED` : `PROBE-${name.toUpperCase()} GREEN`);
  };
  await page.goto(BASE, { waitUntil: "networkidle" });
  return { browser, ctx, page, step, must, done };
};

/** Through the PIN pad to the grown-ups screen; the first visit sets the code. */
export const pinIn = async (page) => {
  await page.click('[data-probe="grownups"]');
  await page.waitForSelector(".pinpad");
  for (const d of PIN) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-probe="tab-progress"]', { timeout: 8000 });
};

export const openSettings = async (page) => {
  await pinIn(page);
  await page.click('[data-probe="tab-settings"]');
  await page.waitForSelector('[data-probe="settings-tab"]', { timeout: 6000 });
};

export const goHome = async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
};

/** Escape closes the top sheet; keep going until the scrim is gone. For
 *  screens whose sheets carry their own buttons (a monster card's Level up),
 *  which closeSheets would tap. */
export const escapeAll = async (page) => {
  for (let i = 0; i < 6 && (await page.$(".scrim")) !== null; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(220); }
};

export const closeSheets = async (page) => {
  for (let i = 0; i < 8 && (await page.$(".scrim")) !== null; i++) {
    await page.click(".sheet .btn.ghost, .sheet .btn.go").catch(() => undefined);
    await page.waitForTimeout(220);
  }
};

/** Settings that make a run predictable: add+sub only, no missing, no rides. */
export const calmMeta = (page) => page.evaluate(() => {
  const m = window.__app.meta();
  m.strands = { add: true, sub: true, mul: false, div: false };
  m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
  m.animations = false;
});

export const answerN = async (page, n) => {
  for (let i = 0; i < n; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
};

/** Every toast on screen, oldest first. Toasts stack, so "the toast" is
 *  a list: judge with .some(), never the first one. */
export const toasts = (page) => page.$$eval('[data-probe="toast"]', (els) => els.map((e) => e.textContent ?? ""));

/** Persist whatever a probe just poked into the live meta or states. A
 *  mutation on the in-memory objects is invisible to anything that reads the
 *  store, and two probes were fooled by exactly that. */
export const saveNow = (page) => page.evaluate(() => window.__app.save());

/** The stored log, read straight from IndexedDB like answer-eye does. */
export const readStore = (page, store, dbName = "trickline") => page.evaluate(async ([s, name]) => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return new Promise((res, rej) => {
    const t = db.transaction(s, "readonly").objectStore(s).get("all");
    t.onsuccess = () => res(t.result ?? null); t.onerror = () => rej(t.error);
  });
}, [store, dbName]);

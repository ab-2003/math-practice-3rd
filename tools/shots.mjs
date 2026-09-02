// Screenshots for the human eye. Visual QA is part of done in this house, so
// this drives the real UI into each state and writes a picture of it.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const OUT = new URL("../.shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SHAPES = {
  "ipad-portrait": { width: 820, height: 1180 },
  "ipad-landscape": { width: 1180, height: 820 },
  phone: { width: 390, height: 844 },
};

const browser = await chromium.launch();
for (const [shapeName, viewport] of Object.entries(SHAPES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  await page.screenshot({ path: `${OUT}${shapeName}-home.png` });

  // Into a session, answer one, land a trick.
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await page.screenshot({ path: `${OUT}${shapeName}-question.png` });

  // A deliberate wrong answer, to photograph the scaffold.
  const correct = await page.evaluate(() => window.__probe.correctAnswer());
  await page.evaluate((c) => window.__probe.answer(c === 1 ? 2 : 1), correct);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 });
  await page.screenshot({ path: `${OUT}${shapeName}-scaffold.png` });

  if (errors.length) console.log(`  ${shapeName} PAGE ERRORS:`, errors.slice(0, 3));
  await ctx.close();
}

// Collection, with a few monsters granted so the art is visible.
const ctx = await browser.newContext({ viewport: SHAPES["ipad-portrait"], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="collection"]');
await page.evaluate(async () => {
  const m = window.__app.meta();
  m.coins = 400;
  m.owned = ["grindjaw", "skathorn", "voltmaw", "magmaspyne"];
  m.levels = { grindjaw: 3, skathorn: 1, voltmaw: 2, magmaspyne: 1 };
  window.__app.go("collection");
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}collection.png`, fullPage: true });

// The grown-ups screen, both tabs, full length.
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="start"]');
await page.click('[data-probe="grownups"]');
await page.waitForSelector(".pinpad");
for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
await page.waitForSelector('[data-probe="progress-tab"]', { timeout: 6000 });
await page.screenshot({ path: `${OUT}dash-progress.png`, fullPage: true });
await page.click('[data-probe="tab-settings"]');
await page.waitForSelector('[data-probe="settings-tab"]', { timeout: 6000 });
await page.screenshot({ path: `${OUT}dash-settings.png`, fullPage: true });
const ptable = await page.$(".ptable");
const card = await ptable.evaluateHandle((e) => e.closest(".card"));
await card.asElement().screenshot({ path: `${OUT}settings.png` });

await browser.close();
console.log("shots written");

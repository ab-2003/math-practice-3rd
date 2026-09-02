/**
 * OFFLINE-CHECK — offline is a tested claim, not a checkbox.
 *
 * Register the worker, wait for it to control the page, cut the network,
 * reload, and assert the app boots and a full session still runs. Then assert
 * the precache list covers every URL the app actually requested online, so a
 * new file can never be silently left out of the cache.
 */
import { chromium } from "playwright";
import { answerOf, fail, ok, typeAnswer } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
const page = await ctx.newPage();

const requested = new Set();
page.on("request", (r) => {
  const u = new URL(r.url());
  if (u.origin === new URL(BASE).origin) requested.add(u.pathname);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="start"]');

// Exercise the whole app online first, so every asset it needs gets requested.
await page.click('[data-probe="start"]');
await page.waitForSelector('[data-probe="problem"]');
const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
await typeAnswer(page, answerOf(id));
await page.waitForTimeout(800);
await page.evaluate(() => { const m = window.__app.meta(); m.owned = ["grindjaw"]; window.__app.go("collection"); });
await page.waitForTimeout(300);
// The grown-ups' door, so its files are requested and must be covered too.
await page.goto(BASE.replace(/\/$/, "") + "/parent/", { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="start"]');

const controlled = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return { controlled: navigator.serviceWorker.controller !== null, scope: reg.scope };
});
if (!controlled.controlled) fail("the service worker never took control of the page");
else ok(`the service worker controls the page (${controlled.scope})`);

const precache = await page.evaluate(async () => {
  const keys = await caches.keys();
  const cache = await caches.open(keys[0]);
  return (await cache.keys()).map((r) => new URL(r.url).pathname);
});
ok(`${precache.length} files precached`);

// Every same-origin thing the app asked for must be in the cache.
const missing = [...requested].filter((p) => {
  if (p.endsWith("/sw.js")) return false;
  const norm = p.endsWith("/") ? `${p}index.html` : p;
  return !precache.some((c) => c === norm || c === p || (norm === "/index.html" && c.endsWith("/index.html")));
});
if (missing.length > 0) fail(`requested but not precached: ${missing.slice(0, 5).join(", ")}`);
else ok(`all ${requested.size} requested URLs are covered by the precache`);

// ---- now cut the wire -----------------------------------------------------
await ctx.setOffline(true);
await page.goto(BASE, { waitUntil: "domcontentloaded" }).catch(() => undefined);
const booted = await page.waitForSelector('[data-probe="start"]', { timeout: 10000 }).catch(() => null);
if (!booted) { fail("the app did not boot offline"); }
else {
  ok("the app boots with the network cut");
  // Not just a shell: a real session has to run.
  await page.click('[data-probe="start"]');
  const prob = await page.waitForSelector('[data-probe="problem"]', { timeout: 6000 }).catch(() => null);
  if (!prob) fail("a session would not start offline");
  else {
    const id2 = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id2));
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 }).catch(() => undefined);
    if (await page.$('[data-probe="retype"]') !== null) fail("grading is wrong offline");
    else ok("a full question was asked, answered and graded offline");
  }
  // The creatures are drawn, so they must render with no network at all.
  await page.evaluate(() => { const m = window.__app.meta(); m.owned = ["grindjaw", "voltmaw"]; window.__app.go("collection"); });
  await page.waitForTimeout(300);
  const drawn = await page.evaluate(() => document.querySelectorAll(".creature path").length);
  if (drawn < 10) fail(`the creatures did not draw offline (${drawn} paths)`);
  else ok(`the creatures draw offline (${drawn} paths, zero image requests)`);
  // The grown-ups' door boots offline as well (a remembered code would then
  // say the cloud is not answering, which is the honest offline answer).
  await page.goto(BASE.replace(/\/$/, "") + "/parent/", { waitUntil: "domcontentloaded" }).catch(() => undefined);
  const door = await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 }).catch(() => null);
  if (!door) fail("the grown-ups' door did not boot offline");
  else ok("the grown-ups' door boots with the network cut");
}

await ctx.setOffline(false);
await browser.close();
console.log(process.exitCode ? "OFFLINE-CHECK RED" : "OFFLINE-CHECK GREEN");

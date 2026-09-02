/** LIVE-SMOKE — the real production URL, after the edge has converged. */
import { chromium } from "playwright";
import { answerOf, fail, ok, typeAnswer } from "./lib/drive.mjs";

const URL_ = process.env.LIVE_URL ?? "https://math-practice-3rd.pages.dev";
const WANT = process.env.WANT_VERSION ?? null;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 820, height: 1180 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL_, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector('[data-probe="start"]', { timeout: 20000 })
  .catch(() => fail("the live site never showed a way in"));

const stamp = (await page.textContent("#stamp")) ?? "";
ok(`live stamp: ${stamp.trim()}`);
if (WANT && !stamp.includes(WANT)) fail(`the live site is serving "${stamp.trim()}", not ${WANT}`);

await page.click('[data-probe="start"]');
await page.waitForSelector('[data-probe="problem"]', { timeout: 15000 });
const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
await typeAnswer(page, answerOf(id));
await page.waitForSelector(".keypad:not(.asleep)", { timeout: 10000 });
if (await page.$('[data-probe="retype"]') !== null) fail("the live site graded a correct answer wrong");
else ok(`a real question was asked, answered and graded live (${id})`);

// The icons must actually exist. Pages answers an unknown path with
// index.html at status 200, so only the CONTENT TYPE can tell the truth.
for (const p of ["icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
                 "icons/icon-192-maskable.png", "icons/icon-512-maskable.png", "manifest.webmanifest"]) {
  const res = await page.request.get(`${URL_.replace(/\/$/, "")}/${p}`);
  const ct = res.headers()["content-type"] ?? "";
  const want = p.endsWith(".png") ? "image/png" : "json";
  if (!ct.includes(want)) fail(`${p} served as "${ct}" — it never shipped`);
}
if (!process.exitCode) ok("all icons and the manifest are really there (checked by content type)");

// The grown-ups' door serves as its own page, not the root index in disguise.
await page.goto(`${URL_.replace(/\/$/, "")}/parent/`, { waitUntil: "networkidle", timeout: 45000 });
const door = await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 20000 }).catch(() => null);
if (!door) fail("the grown-ups' door at /parent/ did not come up live");
else ok("the grown-ups' door is live at /parent/");
{
  const res = await page.request.get(`${URL_.replace(/\/$/, "")}/parent/manifest.webmanifest`);
  const ct = res.headers()["content-type"] ?? "";
  if (!ct.includes("json")) fail(`parent/manifest.webmanifest served as "${ct}"`);
}
await page.screenshot({ path: new URL("../.shots/live-smoke.png", import.meta.url).pathname });
if (errors.length > 0) fail(`uncaught page errors live: ${errors.slice(0, 2).join(" | ")}`);
await browser.close();
console.log(process.exitCode ? "LIVE-SMOKE RED" : "LIVE-SMOKE GREEN");

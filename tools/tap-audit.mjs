/**
 * TAP-AUDIT — every element gets its own finger.
 *
 * human-eye can see that two things overlap. Only this can say which one wins
 * the tap. It synthesises a real touch at each element's centre and asserts
 * that THAT element received it and nothing else ate it.
 *
 * It exists because of the scar this house names first: buttons colliding and
 * stealing each other's input, and an invisible closed panel that ate board
 * taps for three releases. On this app the stakes are the keypad, which is the
 * entire interface.
 */
import { chromium } from "playwright";
import { SHAPES, fail, ok } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const MIN_TOUCH = 44;

const browser = await chromium.launch();
let tested = 0;
let small = 0;

for (const [name, viewport] of Object.entries(SHAPES)) {
  const ctx = await browser.newContext({ viewport, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });

  const screens = [
    ["home", async () => { await page.evaluate(() => window.__app.go("home")); }],
    ["session", async () => { await page.evaluate(() => window.__app.go("home")); await page.click('[data-probe="start"]'); await page.waitForSelector('[data-probe="problem"]'); }],
    ["collection", async () => {
      await page.evaluate(() => { const m = window.__app.meta(); m.coins = 5000; m.owned = ["grindjaw", "voltmaw"]; window.__app.go("collection"); });
    }],
    ["parent-door", async () => {
      await page.goto(BASE.replace(/\/$/, "") + "/parent/", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
    }],
  ];

  for (const [screen, go] of screens) {
    await go();
    await page.waitForTimeout(220);

    const report = await page.evaluate((MIN) => {
      const out = { stolen: [], small: [], count: 0 };
      const targets = [...document.querySelectorAll("button, .mon")].filter((e) => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0
          && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
      });
      for (const e of targets) {
        const r = e.getBoundingClientRect();
        out.count += 1;
        const label = `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ").slice(0, 2).join(".")}`;
        // Who actually receives a finger at this element's centre?
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit !== e && !e.contains(hit)) {
          out.stolen.push(`${label} <- ${hit ? `${hit.tagName.toLowerCase()}.${(hit.className || "").toString().split(" ")[0]}` : "nothing"}`);
        }
        // A finger is 44px. Anything smaller is a mis-tap waiting to happen,
        // and this is an eight year old's hands on a tablet.
        if (r.width < MIN - 0.5 || r.height < MIN - 0.5) {
          out.small.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    }, MIN_TOUCH);

    tested += report.count;
    small += report.small.length;
    if (report.stolen.length > 0) fail(`${name}/${screen}: taps stolen: ${report.stolen.slice(0, 3).join("; ")}`);
    if (report.small.length > 0) fail(`${name}/${screen}: below 44px: ${report.small.slice(0, 4).join("; ")}`);
  }

  // The keypad is the interface. Prove a real synthesised touch on a digit
  // actually enters that digit, on every shape.
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  await page.evaluate(() => window.__app.go("home"));
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const box = await page.locator('.keypad .key[data-key="7"]').boundingBox();
  if (!box) fail(`${name}: the 7 key has no box`);
  else {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
    const shown = (await page.textContent('[data-probe="answer"]')) ?? "";
    if (shown.trim() !== "7") fail(`${name}: tapping the 7 key put "${shown}" in the answer slot`);
  }
  await ctx.close();
}
await browser.close();
if (!process.exitCode) ok(`${tested} elements hit-tested across ${Object.keys(SHAPES).length} shapes, all at least ${MIN_TOUCH}px`);
console.log(process.exitCode ? "TAP-AUDIT RED" : "TAP-AUDIT GREEN");

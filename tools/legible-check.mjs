/**
 * LEGIBLE-CHECK — measured, not eyeballed.
 *
 * Contrast of every text run against its effective background, and a floor on
 * font size. He is eight and reads every problem unaided, so this is not a
 * checkbox.
 */
import { chromium } from "playwright";
import { SHAPES, fail, ok } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";

const audit = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return { r: 11, g: 13, b: 16, a: 1 };
  };
  const bad = [];
  let checked = 0;
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.5) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0);
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fg = parse(s.color);
    if (!fg) continue;
    const size = parseFloat(s.fontSize);
    const weight = Number(s.fontWeight) || 400;
    checked += 1;
    const tag = `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`;
    // The build stamp is deliberately near-invisible chrome for a grown-up.
    if (el.id === "stamp") continue;
    if (size < 13) bad.push(`${tag} font ${size.toFixed(0)}px`);
    const large = size >= 24 || (size >= 19 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bgOf(el));
    if (got < need) bad.push(`${tag} contrast ${got.toFixed(2)} needs ${need} (${size.toFixed(0)}px)`);
  }
  return { bad, checked };
};

const browser = await chromium.launch();
let total = 0;
for (const [name, viewport] of Object.entries(SHAPES)) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const screens = [
    ["home", () => page.evaluate(() => window.__app.go("home"))],
    ["session", async () => { await page.evaluate(() => window.__app.go("home")); await page.click('[data-probe="start"]'); await page.waitForSelector('[data-probe="problem"]'); }],
    ["collection", () => page.evaluate(() => { const m = window.__app.meta(); m.coins = 5000; m.owned = ["grindjaw", "voltmaw"]; window.__app.go("collection"); })],
    ["parent-door", async () => {
      await page.goto(BASE.replace(/\/$/, "") + "/parent/", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
    }],
  ];
  for (const [screen, go] of screens) {
    await go();
    await page.waitForTimeout(220);
    const { bad, checked } = await page.evaluate(audit);
    total += checked;
    const unique = [...new Set(bad)];
    if (unique.length > 0) fail(`${name}/${screen}: ${unique.slice(0, 5).join("; ")}`);
  }
  await ctx.close();
}
await browser.close();
if (!process.exitCode) ok(`${total} text runs measured for contrast and size`);
console.log(process.exitCode ? "LEGIBLE-CHECK RED" : "LEGIBLE-CHECK GREEN");

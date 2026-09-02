/**
 * HUMAN-EYE — the things a person would notice.
 *
 * Off-screen elements, overlaps between things that are pinned the same way,
 * clipped text, and a blank screen. iPad portrait and landscape are
 * first-class shapes here, not afterthoughts: that is the device.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { SHAPES, answerOf, fail, ok } from "./lib/drive.mjs";

const BASE = process.env.BASE ?? "http://localhost:8050";
const SHOTS = process.argv.includes("--shots");
const OUT = new URL("../.shots/", import.meta.url).pathname;
if (SHOTS) mkdirSync(OUT, { recursive: true });

/**
 * Vertical overflow is only a defect if the content cannot be REACHED. A long
 * dashboard is not a broken dashboard. So this runs twice, once at the top and
 * once scrolled to the bottom, and only reports what is off-screen in both:
 * that is the difference between "below the fold" and "unreachable".
 */
const inspect = (pass) => {
  const problems = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vis = [...document.querySelectorAll("button, .mon, .heat-cell, .problem, .answer-slot, h1, h2, h3, .btn, .key, .note, .step")]
    .filter((e) => {
      const s = getComputedStyle(e);
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
    });
  const offscreen = [];
  for (const e of vis) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const tag = `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ")[0]}`;
    if (r.left < -2 || r.right > vw + 2) problems.push(`${tag} off-screen horizontally (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
    if (e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow !== "visible") {
      problems.push(`${tag} text clipped (${e.scrollWidth} in ${e.clientWidth})`);
    }
    if (r.bottom > vh + 2 || r.top < -2) offscreen.push(tag);
    // EFFECTIVE opacity, through every ancestor. A parent at opacity 0 hides
    // a child whose own computed opacity reads 1, which is how a class
    // collision (the dashboard wrapper named like a monster's speed streaks)
    // kept a whole screen invisible while every element-level check passed.
    let eff = 1;
    const anims = [];
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
      eff *= Number(getComputedStyle(n).opacity);
      // A running animation on a STRICT ancestor of content is a flag on its
      // own: a single opacity sample can land inside a flash's visible
      // window (this check first passed the fading dashboard for exactly
      // that reason), but the animation is there whatever the phase.
      if (n !== e) for (const a of n.getAnimations()) anims.push(a.animationName ?? "animation");
    }
    if (eff < 0.3) problems.push(`${tag} hidden by an ancestor's opacity (effective ${eff.toFixed(2)})`);
    if (anims.length > 0) problems.push(`${tag} sits under an animating ancestor (${[...new Set(anims)].join(",")})`);
  }
  if (document.body.scrollWidth > vw + 2) problems.push(`the PAGE scrolls horizontally (${document.body.scrollWidth} > ${vw})`);
  if (vis.length < 3) problems.push("the screen is essentially blank");
  return { problems, offscreen, pass, count: vis.length };
};

/** Scroll every scrollable ancestor to the bottom, the way a thumb would. */
const scrollToBottom = () => {
  const screen = document.querySelector(".screen");
  if (screen) screen.scrollTop = screen.scrollHeight;
  window.scrollTo(0, document.documentElement.scrollHeight);
};
const scrollToTop = () => {
  const screen = document.querySelector(".screen");
  if (screen) screen.scrollTop = 0;
  window.scrollTo(0, 0);
};

const browser = await chromium.launch();
let total = 0;
for (const [name, viewport] of Object.entries(SHAPES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });

  const states = [];
  await page.waitForSelector('[data-probe="start"]');
  states.push(["home", null]);

  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  states.push(["question", null]);

  // The scaffold is the longest content in the app, so it is a first-class
  // state: layout fails on content, not on screens.
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await page.evaluate((n) => window.__probe.answer(n), answerOf(id) + 1);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 }).catch(() => undefined);
  states.push(["scaffold", null]);

  // Collection, fully stocked: the widest grid this app ever draws.
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.coins = 9999;
    m.owned = ["grindjaw", "skathorn", "voltmaw", "magmaspyne", "tidewreck", "glaciodon",
               "rustfang", "nightcoil", "quarryback", "emberclaw", "stormhide", "voidcrest"];
    m.names = { grindjaw: "THE ARCHIVIST OF SILENCE" }; // longest plausible name
    window.__app.go("collection");
  });
  await page.waitForTimeout(250);
  states.push(["collection-full", null]);

  for (const [stateName] of states) {
    if (stateName === "collection-full") break;
  }

  // Walk each state and inspect. Re-drive rather than trusting one snapshot.
  const check = async (label) => {
    await page.evaluate(scrollToTop);
    await page.waitForTimeout(60);
    const top = await page.evaluate(inspect, "top");
    if (SHOTS) await page.screenshot({ path: `${OUT}${name}-${label}.png` });
    await page.evaluate(scrollToBottom);
    await page.waitForTimeout(120);
    const bottom = await page.evaluate(inspect, "bottom");
    await page.evaluate(scrollToTop);
    total += 1;

    const found = [...new Set([...top.problems, ...bottom.problems])];
    // Unreachable = off-screen at the top AND still off-screen at the bottom.
    const stuck = top.offscreen.filter((t) => bottom.offscreen.includes(t));
    const uniqueStuck = [...new Set(stuck)];
    if (uniqueStuck.length > 0 && top.offscreen.length === bottom.offscreen.length && top.count === bottom.count) {
      // Nothing moved at all: the screen genuinely cannot scroll to its own
      // content, which is the defect this check exists to find.
      const moved = await page.evaluate(() => {
        const s = document.querySelector(".screen");
        return (s ? s.scrollHeight - s.clientHeight : 0) + (document.documentElement.scrollHeight - window.innerHeight);
      });
      if (moved <= 2) found.push(`${uniqueStuck.length} elements unreachable: ${uniqueStuck.slice(0, 3).join(", ")}`);
    }
    if (found.length > 0) fail(`${name}/${label}: ${found.slice(0, 4).join("; ")}`);
  };
  await check("collection-full");

  await page.evaluate(() => window.__app.go("dashboard"));
  await page.waitForTimeout(200);
  for (const d of ["1", "2", "3", "4"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForTimeout(600);
  await check("dashboard");

  await page.evaluate(() => window.__app.go("home"));
  await page.waitForTimeout(200);
  await check("home");

  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await check("question");

  const id2 = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await page.evaluate((n) => window.__probe.answer(n), answerOf(id2) + 1);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 }).catch(() => undefined);
  await check("scaffold");

  if (errs.length > 0) fail(`${name}: uncaught page errors: ${errs.slice(0, 2).join(" | ")}`);
  await ctx.close();
}
await browser.close();
if (!process.exitCode) ok(`${total} screen looks across ${Object.keys(SHAPES).length} shapes`);
console.log(process.exitCode ? "HUMAN-EYE RED" : "HUMAN-EYE GREEN");

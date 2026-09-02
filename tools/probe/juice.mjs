/**
 * PROBE: JUICE. The coin chip, the line, the dose, the lap, the exit offers,
 * the streak stamp, the rider's line, and the seasonal spot.
 */
import { answerN, answerOf, calmMeta, closeSheets, goHome, readStore, suite, typeAnswer } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("juice");

await step("the session coin chip counts up the moment a trick lands", async () => {
  await page.waitForSelector('[data-probe="start"]');
  await calmMeta(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const before = Number((await page.textContent('[data-probe="session-coins"] .chip-n')) ?? "-1");
  await answerN(page, 1);
  const after = Number((await page.textContent('[data-probe="session-coins"] .chip-n')) ?? "-1");
  must(after === before + 1, `chip went ${before} -> ${after}, wanted +1`);
});

await step("landing a full line raises the LINE LANDED banner", async () => {
  await answerN(page, 3);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id));
  await page.waitForSelector('[data-probe="line-banner"]', { timeout: 4000 });
  await page.waitForSelector('[data-probe="line-banner"]', { state: "detached", timeout: 4000 });
});

await step("the run's end offers the shop, and Later spends nothing", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.coins = 5000; m.owned = []; });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForSelector(".sheet .btn.go", { timeout: 5000 });
  await page.click(".sheet .btn.go");
  await page.waitForSelector(".sheet", { timeout: 5000 });
  const text = (await page.textContent(".sheet")) ?? "";
  must(text.includes("Later") && text.includes("See the crew"), "the shop offer is missing its choices");
  const coinsBefore = await page.evaluate(() => window.__app.meta().coins);
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().coins) === coinsBefore, "Later spent the coins");
  must(await page.evaluate(() => window.__app.meta().owned.length) === 0, "Later bought a monster anyway");
});

await step("a short run is NOT the day's work: no badge until the dose", async () => {
  must(await page.$('[data-probe="daily-badge"]') === null, "the badge showed before the dose was met");
  must(await page.$('[data-probe="dose-progress"]') !== null, "no dose progress line on home");
  const label = (await page.textContent('[data-probe="start"]')) ?? "";
  must(label.toUpperCase().includes("DROP"), `the button says "${label}" before the dose is done`);
  must(await page.$('[data-probe="unlock-progress"]') !== null, "no progress toward the next monster on home");
});

await step("meeting the dose raises the big badge and flips to extra practice", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.doseDay = window.__app.day();
    m.doseCount = m.dailyGoal;
    window.__app.go("home");
  });
  await page.waitForTimeout(300);
  must(await page.$('[data-probe="daily-badge"]') !== null, "no DONE badge after the dose");
  const label = (await page.textContent('[data-probe="start"]')) ?? "";
  must(label.toUpperCase().includes("EXTRA"), `the button says "${label}" after the dose`);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  must(await page.$('[data-probe="extra-tag"]') !== null, "the session does not say EXTRA PRACTICE");
  // Past the dose the chip stands down: the tag carries the state.
  must(await page.evaluate(() => document.querySelector('[data-probe="dose-chip"]').hidden), "the dose chip shows after the dose");
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForTimeout(400);
  await closeSheets(page);
});

await step("crossing the dose mid-session plays the banner moment", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.animations = false;
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.doseDay = window.__app.day();
    m.doseCount = m.dailyGoal - 2;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const chip = (await page.textContent('[data-probe="dose-chip"]')) ?? "";
  must(chip.trim().startsWith("38 /"), `the dose chip reads "${chip}" two away from done`);
  await answerN(page, 2);
  await page.waitForSelector('[data-probe="daily-banner"]', { timeout: 5000 });
  await page.waitForSelector('[data-probe="daily-banner"]', { state: "detached", timeout: 6000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForTimeout(400);
  const endText = (await page.textContent(".sheet").catch(() => "")) ?? "";
  must(endText.includes("TODAY'S WORK: DONE"), "the end sheet does not carry the DONE line");
  await closeSheets(page);
});

await step("landing a line with animations on plays the victory lap and lights the spot", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.animations = true;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  must(await page.evaluate(() => getComputedStyle(document.querySelector(".spot")).opacity) === "0", "the rail is visible during a problem");
  {
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForSelector(".left.show-spot", { timeout: 2500 });
    await page.waitForSelector(".left.show-spot", { state: "detached", timeout: 6000 })
      .catch(async () => { must(await page.$(".left.show-spot") === null, "the rail never faded back out"); });
  }
  await answerN(page, 3);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
  must(await page.$(".left.show-spot") === null, "the rail did not clear off before the next problem");
  const id5 = await page.getAttribute('[data-probe="problem"]', "data-fact");
  await typeAnswer(page, answerOf(id5));
  await page.waitForSelector(".lap-run", { timeout: 4000 });
  must(await page.$(".spot.lit") !== null, "the spot did not light for the lap");
  must(await page.$(".lap-run .trick-creature") !== null, "no rider on the lap");
  await page.waitForSelector(".lap-run", { state: "detached", timeout: 7000 });
  must(await page.$(".spot.lit") === null, "the spot stayed lit after the lap");
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForTimeout(400);
  await closeSheets(page);
});

await step("the rider speaks on the end sheet, and a streak milestone is stamped", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.owned = ["puckjaw"]; m.levels = { puckjaw: 1 }; m.rider = "puckjaw";
    m.animations = false;
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    // Six days running, yesterday the last: today makes seven.
    m.streak = 6; m.lastSessionDay = window.__app.day() - 1;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 2);
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForSelector('[data-probe="rider-quip"]', { timeout: 5000 });
  const quip = (await page.textContent('[data-probe="rider-quip"]')) ?? "";
  must(quip.startsWith("PUCKJAW:") && quip.includes('"'), `the rider's line reads "${quip}"`);
  must(!quip.includes("—"), "an em-dash in user copy");
  const stamp = (await page.textContent('[data-probe="streak-stamp"]').catch(() => null));
  must(stamp === "7 DAY STREAK!", `the streak stamp reads "${stamp}"`);
  await closeSheets(page);
  must(await page.$('[data-probe="streak-pill"].streak-hot') !== null, "the home streak pill is not hot at seven");
});

await step("the exit is offered earlier when the clock says the rider is tiring, in the same words", async () => {
  // Drive the timings by hand: eight quick, then eight slow correct answers,
  // through the real submit path so nothing but the clock differs.
  await goHome(page);
  await calmMeta(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const answerWithDelay = async (ms) => {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
    if (await page.$(".sheet") !== null) return false;
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await page.waitForTimeout(ms);
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(80);
    return true;
  };
  for (let i = 0; i < 8; i++) await answerWithDelay(60);
  must(await page.evaluate(() => window.__probe.tired()) === false, "eight quick answers already read as tired");
  // 2.6s first-digit times: over the floor and well past 1.5x the opening.
  for (let i = 0; i < 8; i++) { const ok = await answerWithDelay(2600); if (!ok) break; }
  must(await page.evaluate(() => window.__probe.tired()) === true, "sixteen items with a creeping clock did not read as tired");
  // Sixteen items is past the tired threshold (10) and short of the normal
  // one (20): the next line break must offer the exit.
  const items = await page.evaluate(() => window.__probe.items());
  must(items < 20, `already at ${items} items; the normal offer would fire anyway`);
  let offered = false;
  for (let i = 0; i < 6 && !offered; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 }).catch(() => undefined);
    if (await page.$(".sheet") !== null) { offered = true; break; }
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact").catch(() => null);
    if (!id) break;
    await page.waitForTimeout(2600);
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(300);
    if (await page.$(".sheet") !== null) offered = true;
  }
  must(offered, "no exit was offered at the line break while tiring");
  const text = (await page.textContent(".sheet")) ?? "";
  must(text.includes("Line landed!") && text.includes("Keep rolling"), `the tired offer reads "${text.slice(0, 60)}"`);
  const lower = text.toLowerCase();
  for (const banned of ["tired", "slow", "speed", "time"]) must(!lower.includes(banned), `the offer mentions "${banned}"`);
  await page.click(".sheet .btn.ghost"); // Call it
  await page.waitForTimeout(500);
  await closeSheets(page);
  const sessions = await readStore(page, "sessions");
  const last = sessions[sessions.length - 1];
  must(last.status === "endedEarly" && last.reason === "tired", `logged as ${last.status}/${last.reason}`);
});

await step("on a phone in extra practice, the five decks, the tag and the way out all fit", async () => {
  // Andy's phone: the strip had collapsed behind the breather button and the
  // EXTRA PRACTICE pill. The bar wraps; nothing is squeezed to nothing.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p2 = await ctx2.newPage();
  await p2.goto(page.url().split("?")[0].replace(/\/[^/]*$/, "/"), { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="start"]');
  await p2.evaluate(() => {
    const m = window.__app.meta();
    m.animations = false; m.strands = { add: true, sub: true, mul: false, div: false };
    m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal; // extra practice
  });
  await p2.click('[data-probe="start"]');
  await p2.waitForSelector('[data-probe="problem"]');
  const geo = await p2.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height, top: b.top, bottom: b.bottom, hidden: e.hidden || getComputedStyle(e).display === "none" }; };
    const cells = [...document.querySelectorAll(".line-cell")].map((c) => c.getBoundingClientRect().width);
    const bar = document.querySelector(".session-bar").getBoundingClientRect();
    return { cells, quit: r('[data-probe="quit"]'), tag: r('[data-probe="extra-tag"]'), chip: r('[data-probe="dose-chip"]'), barH: bar.height, vw: window.innerWidth,
      tagText: document.querySelector('[data-probe="extra-tag"]').innerText.trim() };
  });
  must(geo.cells.length === 5 && geo.cells.every((w) => w >= 40), `deck cells are ${geo.cells.map(Math.round).join(",")}px wide`);
  must(geo.quit.r <= geo.vw && geo.quit.l >= 0 && geo.quit.w >= 44, `the breather button sits at ${Math.round(geo.quit.l)}..${Math.round(geo.quit.r)} of ${geo.vw}`);
  must(!geo.tag.hidden && geo.tag.r <= geo.vw, "the extra tag is off screen or hidden");
  must(geo.tagText === "EXTRA", `the phone tag reads "${geo.tagText}"`);
  must(geo.chip.hidden, "the dose chip shows during extra practice");
  must(geo.barH < 120, `the session bar is ${geo.barH}px tall on a phone`);
  // Nothing overlaps: the strip row sits below the controls row.
  const stripTop = await p2.evaluate(() => document.querySelector(".line-strip").getBoundingClientRect().top);
  must(stripTop >= geo.quit.bottom - 1, "the strip shares a row with the breather button on a phone");
  await ctx2.close();
});

await step("today's spot is the street or the season's, by the day, and never a third thing", async () => {
  await goHome(page);
  await page.evaluate(() => { window.__app.meta().linesLanded = 0; });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const spot = await page.getAttribute(".spot-art", "data-spot");
  const day = await page.evaluate(() => window.__app.day());
  const month = new Date().getMonth();
  const seasonal = [11, 0, 1].includes(month) ? "frostpark" : [5, 6, 7].includes(month) ? "boardwalk" : null;
  const open = seasonal === null ? ["street"] : ["street", seasonal];
  const want = open[day % open.length];
  must(spot === want, `today's spot is ${spot}, an independent calendar says ${want}`);
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.warm, .sheet .btn.go");
  await page.waitForTimeout(300);
  await closeSheets(page);
});

await done();

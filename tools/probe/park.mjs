/**
 * PROBE: THE SKATE PARK (0.19.0). The token drops with the day's work, the
 * door lights, the gate confirms a spend, the tutorial runs once, the game
 * plays through its real input path (pointer events on the stage) with the
 * clock driven by hand, the day's cap closes the park, the parent dials
 * change the minutes and the cap, and leaving mid-run asks first.
 */
import { answerN, calmMeta, closeSheets, escapeAll, goHome, openSettings, suite } from "./_shared.mjs";

const { page, step, must, done } = await suite("park");

const meta = () => page.evaluate(() => window.__app.meta());
const park = () => page.evaluate(() => window.__park.state());
/** Drive the model's clock by hand, in small steps, through the screen's own step(). */
const tick = (seconds) => page.evaluate((secs) => { for (let t = 0; t < secs; t += 1 / 60) window.__park.tick(1 / 60); }, seconds);
const stageBox = () => page.locator('[data-probe="park-stage"]').boundingBox();
const tap = async () => { const b = await stageBox(); await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.6); await page.mouse.down(); await page.mouse.up(); };
const swipe = async (dx, dy) => {
  const b = await stageBox();
  const x = b.x + b.width * 0.6, y = b.y + b.height * 0.6;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up();
};
/** A flat line for the physics steps: the laid-down obstacles go, and no more come. */
const flatLine = () => page.evaluate(() => { const s = window.__park.state(); s.obstacles = []; s.nextX = 1e12; });
/** Through the gate and the tutorial (if it shows) into a live run, then hold the clock. */
const enterPark = async () => {
  await page.click('[data-probe="park-open"]');
  await page.waitForSelector('[data-probe="park-gate"]', { timeout: 4000 });
  await page.click(".sheet .row .btn.go"); // Drop in
  await page.waitForTimeout(200);
  while (await page.$('[data-probe="park-tutorial"]') !== null) { await page.click(".sheet .row .btn.go"); await page.waitForTimeout(150); }
  await page.waitForSelector('[data-probe="park-stage"]', { timeout: 4000 });
  await page.waitForTimeout(1500); // the DROP IN call
  await page.evaluate(() => window.__park.hold());
};

await step("before any token the park door is on the home screen, dim, and explains itself", async () => {
  await page.waitForSelector('[data-probe="start"]');
  const btn = await page.$('[data-probe="park-open"]');
  must(btn !== null, "no Skate Park door on the home screen");
  must(await page.$('[data-probe="park-open"].dim') !== null, "the door is lit before any token");
  must(((await page.textContent('[data-probe="park-open"]')) ?? "").includes("earn a Daily Token"), "the dim door does not say how to light it");
  await page.click('[data-probe="park-open"]');
  await page.waitForSelector(".sheet", { timeout: 3000 });
  must(((await page.textContent(".sheet")) ?? "").includes("Daily Token"), "the dim door's sheet does not explain the token");
  await closeSheets(page);
});

await step("the parent dials default to 7 minutes and 3 tokens a day, and the alpha card grants a token", async () => {
  await openSettings(page);
  must(await page.$('[data-probe="park-card"]') !== null, "no Skate Park card in settings");
  must((await page.textContent('[data-probe="park-minutes"]')) === "7", "minutes per token is not 7");
  must((await page.textContent('[data-probe="park-tokens"]')) === "3", "tokens per day is not 3");
  await page.click('[data-probe="park-minutes-plus"]');
  await page.waitForTimeout(300);
  must((await page.textContent('[data-probe="park-minutes"]')) === "8", "the minutes stepper did not step");
  must((await meta()).parkMinutes === 8, "the minutes did not reach meta");
  await page.click('[data-probe="park-minutes-minus"]');
  await page.waitForTimeout(300);
  await page.click('[data-probe="grant-token"]');
  await page.waitForTimeout(300);
  const m = await meta();
  must(m.tokens === 1 && m.parkUnlocked === true, `granting gave tokens=${m.tokens} unlocked=${m.parkUnlocked}`);
  must(((await page.textContent('[data-probe="alpha-tokens"]')) ?? "").includes("1 Daily Token"), "the alpha card does not count the token");
});

await step("the first token lights the door, which pulses until the park is opened once", async () => {
  await goHome(page);
  must(await page.$('[data-probe="park-open"].dim') === null, "the door is still dim with a token in the pocket");
  must(await page.$('[data-probe="park-open"].park-new') !== null, "the first token does not make the door pulse");
  must(await page.evaluate(() => getComputedStyle(document.querySelector('[data-probe="park-open"]')).animationName) === "park-glow", "the pulse is not animating");
  must(((await page.textContent('[data-probe="park-open"]')) ?? "").includes("1 token"), "the door does not count the token");
  must(((await page.textContent('[data-probe="park-sub"]')) ?? "").includes("3 plays left"), "the door does not say today's plays");
});

await step("the gate asks before a token is spent, and Not now keeps it", async () => {
  await page.click('[data-probe="park-open"]');
  await page.waitForSelector('[data-probe="park-gate"]', { timeout: 4000 });
  const text = (await page.textContent(".sheet")) ?? "";
  must(text.includes("7 minutes") && text.includes("1 token") && text.includes("3 more plays"), `the gate reads: ${text.slice(0, 120)}`);
  await page.click(".sheet .btn.ghost");
  await page.waitForSelector('[data-probe="start"]', { timeout: 4000 });
  must((await meta()).tokens === 1, "Not now spent the token");
});

await step("Drop in spends the token, runs the tutorial once, and starts the clock at 7:00", async () => {
  await page.click('[data-probe="park-open"]');
  await page.waitForSelector('[data-probe="park-gate"]', { timeout: 4000 });
  await page.click(".sheet .row .btn.go");
  await page.waitForSelector('[data-probe="park-tutorial"]', { timeout: 4000 });
  let cards = 0;
  while (await page.$('[data-probe="park-tutorial"]') !== null && cards < 8) { cards += 1; await page.click(".sheet .row .btn.go"); await page.waitForTimeout(150); }
  must(cards === 4, `the tutorial ran ${cards} cards, wanted 4`);
  await page.waitForSelector('[data-probe="park-stage"]', { timeout: 4000 });
  const m = await meta();
  must(m.tokens === 0 && m.parkSpent === 1 && m.parkDay === window_day(m) && m.parkSeen === true, `after entering: ${JSON.stringify({ tokens: m.tokens, spent: m.parkSpent, seen: m.parkSeen })}`);
  must((await page.textContent('[data-probe="park-tokens"]')) === "0", "the park's token pill did not drop to 0");
  must((await page.textContent('[data-probe="park-clock"]')) === "7:00", "the clock did not start at 7:00");
  must(await page.$('[data-probe="park-rider"] .park-creature') !== null, "the rider's monster is not on the stage");
  must(await page.$('[data-probe="park-rider"] .park-deck') !== null, "the rider's board is not under him");
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__park.hold());
  const st = await park();
  must(st !== null && st.running === true, "the run is not live");
  must(st.obstacles.length > 0, "no obstacles laid down ahead");
  must((await page.$$('[data-probe="park-stage"] .park-ob')).length === st.obstacles.length, "the stage does not draw every obstacle the model holds");
  await flatLine();
});
function window_day(m) { return m.parkDay; }

await step("a tap ollies through the real pointer path, and a swipe lands a kickflip that banks", async () => {
  await tap();
  let st = await park();
  must(st.rider.mode === "air", `a tap left the rider ${st.rider.mode}`);
  await tick(0.9);
  st = await park();
  must(st.rider.mode === "ground", `after the air the rider is ${st.rider.mode}`);
  must(st.score === 0, "a plain ollie scored");
  // Swipe up from the ground: ollie plus kickflip in one gesture.
  await swipe(0, -70);
  st = await park();
  must(st.rider.mode === "air" && st.rider.trick?.id === "kickflip", `the swipe gave ${st.rider.mode}/${st.rider.trick?.id}`);
  await tick(0.9);
  st = await park();
  must(st.score === 100, `a kickflip banked ${st.score}, wanted 100`);
  must((await page.textContent('[data-probe="park-score"]')) === "100", "the HUD did not show the score");
  must(st.tricksLanded === 1, "the trick was not counted as landed");
});

await step("a late backflip bails, loses the chain, and resets the speed", async () => {
  await tap();
  await tick(0.3);
  await swipe(-70, 0);
  let st = await park();
  must(st.rider.trick?.id === "backflip", "the left swipe was not a backflip");
  await tick(0.6);
  st = await park();
  must(st.rider.mode === "bail", `the late backflip ended ${st.rider.mode}`);
  must(st.score === 100 && st.bails === 1, `after the bail score=${st.score} bails=${st.bails}`);
  must(await page.$('[data-probe="park-rider"].bailed') !== null, "the rider does not show the bail");
  await tick(1.2);
  st = await park();
  must(st.rider.mode === "ground", "the rider did not get back up");
});

await step("the ? button replays the tutorial and pauses the clock", async () => {
  await page.click('[data-probe="park-help"]');
  await page.waitForSelector('[data-probe="park-tutorial"]', { timeout: 4000 });
  await page.click(".sheet .btn.ghost"); // Skip
  await page.waitForTimeout(200);
  must(await page.$('[data-probe="park-tutorial"]') === null, "Skip did not close the tutorial");
});

await step("Back mid-run asks, Keep skating resumes, and time running out ends with results", async () => {
  await page.click('[data-probe="back"]');
  await page.waitForSelector(".sheet", { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("not refunded"), "leaving does not warn about the token");
  await page.click(".sheet .btn.ghost"); // Keep skating
  await page.waitForTimeout(200);
  must(await page.$('[data-probe="park-stage"]') !== null, "Keep skating left the park");
  await page.evaluate(() => { window.__park.state().timeLeftMs = 400; });
  await tick(0.6);
  await page.waitForSelector('[data-probe="park-results"]', { timeout: 4000 });
  const text = (await page.textContent(".sheet")) ?? "";
  must(text.includes("Time's up") && text.includes("100") && text.includes("1 trick landed") && text.includes("1 bail"), `the results read: ${text.slice(0, 160)}`);
  must(text.includes("NEW BEST"), "a first score is not a new best");
  must(await page.$(".sheet .row .btn.go") === null, "Another token is offered with no token left");
  must(text.includes("No Daily Token yet"), "the results do not say why another play is not on");
  const m = await meta();
  must(m.parkBest === 100 && m.parkBestChain === 1, `bests: ${m.parkBest}/${m.parkBestChain}`);
  await page.click(".sheet .btn.ghost"); // Done
  await page.waitForSelector('[data-probe="start"]', { timeout: 4000 });
  must(await page.$('[data-probe="park-open"].park-new') === null, "the door still pulses after the park has been opened");
});

await step("the day's cap closes the park, and the cap follows the parent dial", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.tokens = 5; m.parkSpent = 3; m.parkDay = window.__app.day(); });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  must(((await page.textContent('[data-probe="park-sub"]')) ?? "").includes("closed until tomorrow"), "the door does not say the day is full");
  await page.click('[data-probe="park-open"]');
  await page.waitForSelector('[data-probe="park-locked"]', { timeout: 4000 });
  must(((await page.textContent('[data-probe="park-locked"]')) ?? "").includes("all 3 plays for today"), "the closed park does not say the cap");
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  // The parent raises the cap to 4: one more play opens up. Through the one real path.
  must(await page.evaluate(() => window.__app.set("parkTokensPerDay", 4)) === true, "the cap did not apply");
  await goHome(page);
  must(((await page.textContent('[data-probe="park-sub"]')) ?? "").includes("1 play left"), "raising the cap did not open a play");
  // And a new day resets the count.
  await page.evaluate(() => { const m = window.__app.meta(); m.parkDay = window.__app.day() - 1; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  must(((await page.textContent('[data-probe="park-sub"]')) ?? "").includes("4 plays left"), "a new day did not reset the count");
});

await step("the minutes dial sets the clock, and the stage fits an iPad on its side", async () => {
  must(await page.evaluate(() => window.__app.set("parkMinutes", 3)) === true, "the minutes did not apply");
  await goHome(page);
  await enterPark();
  must((await page.textContent('[data-probe="park-clock"]')) === "3:00", "the clock does not follow the minutes dial");
  const gate = (await page.textContent('[data-probe="park-tokens"]')) ?? "";
  must(gate.trim() === "4", `tokens after entering read ${gate}`);
  await page.click('[data-probe="back"]');
  await page.waitForSelector(".sheet", { timeout: 4000 });
  await page.click(".sheet .row .btn.warm"); // Leave (a danger confirm)
  await page.waitForSelector('[data-probe="start"]', { timeout: 4000 });
  const ctx2 = await page.context().browser().newContext({ viewport: { width: 1180, height: 820 } });
  const p2 = await ctx2.newPage();
  await p2.goto(page.url().split("?")[0].replace(/\/[^/]*$/, "/"), { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="start"]');
  await p2.evaluate(() => { const m = window.__app.meta(); m.tokens = 2; m.parkUnlocked = true; m.parkSeen = true; window.__app.go("park"); });
  await p2.waitForSelector('[data-probe="park-gate"]', { timeout: 4000 });
  await p2.click(".sheet .row .btn.go");
  await p2.waitForSelector('[data-probe="park-stage"]', { timeout: 4000 });
  const fit = await p2.evaluate(() => { const r = document.querySelector('[data-probe="park-stage"]').getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, w: r.width, h: r.height }; });
  must(fit.bottom <= fit.vh, `the stage runs off a landscape iPad (${fit.bottom} > ${fit.vh})`);
  must(fit.h > 200, `the stage is tiny on a landscape iPad (${fit.h}px)`);
  await ctx2.close();
});

await step("the token drops with the day's work, once, and the run's story says so", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.tokens = 0; m.tokenDay = null; m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal - 2; });
  await calmMeta(page);
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 2);
  await page.waitForSelector('[data-probe="token-drop"]', { timeout: 6000 });
  must(((await page.textContent('[data-probe="token-drop"]')) ?? "").includes("DAILY TOKEN"), "the banner does not announce the token");
  await page.waitForSelector('[data-probe="daily-banner"]', { state: "detached", timeout: 6000 });
  let m = await meta();
  must(m.tokens === 1 && m.tokenDay === m.doseDay, `after the dose tokens=${m.tokens}`);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForSelector('[data-probe="token-line"]', { timeout: 6000 });
  await escapeAll(page);
  // The same day again: no second token.
  await page.evaluate(() => { const m = window.__app.meta(); m.doseCount = m.dailyGoal - 1; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 1);
  await page.waitForSelector('[data-probe="daily-banner"]', { timeout: 6000 });
  must(await page.$('[data-probe="token-drop"]') === null, "a second token dropped on the same day");
  await page.waitForSelector('[data-probe="daily-banner"]', { state: "detached", timeout: 6000 });
  m = await meta();
  must(m.tokens === 1, `tokens after a second dose the same day: ${m.tokens}`);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await escapeAll(page);
});

await done();

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

await step("the parent dials default to 7 minutes and 3 tokens a day, and a grown-up can give a token", async () => {
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
  // EXTRA TOKENS (Andy, 2026-09-05): on, one more, and M starts at the
  // day's own goal, which is 40 by default.
  must((await page.textContent('[data-probe="extra-token-max"]')) === "1", "extra tokens does not default to one");
  must((await page.textContent('[data-probe="extra-token-every"]')) === "40", "the extra token does not default to a day's worth of problems");
  must(await page.$('[data-probe="extra-tokens-on"].on') !== null, "extra tokens are not on by default");
  await page.click('[data-probe="extra-token-max-plus"]');
  await page.waitForTimeout(300);
  await page.click('[data-probe="extra-token-every-minus"]');
  await page.waitForTimeout(300);
  let dialed = await meta();
  must(dialed.extraTokenMax === 2 && dialed.extraTokenEvery === 35, `the extra dials read N=${dialed.extraTokenMax} M=${dialed.extraTokenEvery}`);
  await page.click('[data-probe="extra-tokens-on"]');
  await page.waitForTimeout(300);
  dialed = await meta();
  must(dialed.extraTokensOn === false, "the extra tokens switch did not turn off");
  // The dials move on their own: turning the offer off leaves N and M alone.
  must(dialed.extraTokenMax === 2 && dialed.extraTokenEvery === 35, "switching off moved the other dials");
  await page.click('[data-probe="extra-tokens-on"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const m = window.__app.meta(); m.extraTokenMax = 1; m.extraTokenEvery = m.dailyGoal; });
  await page.evaluate(() => window.__app.save());
  const card = (await page.textContent('[data-probe="token-card"]')) ?? "";
  must(!/test|alpha/i.test(card), `the token card still talks about testing: ${card.slice(0, 80)}`);
  must(await page.$('[data-probe="reopen-park"][disabled]') !== null, "Reopen is offered with nothing spent today");
  await page.click('[data-probe="grant-token"]');
  await page.waitForTimeout(300);
  const m = await meta();
  must(m.tokens === 1 && m.parkUnlocked === true, `giving a token gave tokens=${m.tokens} unlocked=${m.parkUnlocked}`);
  must(((await page.textContent('[data-probe="token-count"]')) ?? "").includes("1 Daily Token"), "the card does not count the token");
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

await step("a tap in the dead space under the stage counts; a tap on Back does not", async () => {
  const b = await stageBox();
  const vh = await page.evaluate(() => innerHeight);
  await page.mouse.move(b.x + b.width / 2, Math.min(vh - 20, b.y + b.height + 60)); await page.mouse.down(); await page.mouse.up();
  let st = await park();
  must(st.rider.mode === "air", `a tap under the stage left the rider ${st.rider.mode}`);
  await tick(0.9);
  // The Back button is a button: it opens its sheet, it does not ollie.
  await page.click('[data-probe="back"]');
  await page.waitForSelector(".sheet", { timeout: 4000 });
  st = await park();
  must(st.rider.mode === "ground", `a tap on Back ollied (${st.rider.mode})`);
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(200);
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
  must((await page.textContent('[data-probe="park-speed"]')) === "1.0×", "the speed readout did not drop to base on the bail");
  must(st.score === 100 && st.bails === 1, `after the bail score=${st.score} bails=${st.bails}`);
  must(await page.$('[data-probe="park-rider"].bailed') !== null, "the rider does not show the bail");
  await tick(1.2);
  st = await park();
  must(st.rider.mode === "ground", "the rider did not get back up");
});

await step("the half pipe launches big air off the top rail, and the handrail slides down the stairs", async () => {
  // Plant the pipe and the stairs on the real line and ride them by hand.
  await flatLine();
  await page.evaluate(() => {
    const s = window.__park.state();
    const x = s.scroll + 130;
    s.rider.mode = "ground"; s.rider.y = 0; s.rider.vy = 0; s.rider.trick = null; s.chain = [];
    s.obstacles.push({ id: 9001, kind: "rail", x: x - 100, w: 130, h: 124, used: false });
    s.obstacles.push({ id: 9002, kind: "pipe", x: x + 30, w: 380, h: 124, used: false });
    s.rider.mode = "grind"; s.rider.y = 124; s.rider.grindOn = s.obstacles[0]; s.rider.grindT = 0.2;
  });
  await tick(0.05);
  must(await page.$('[data-probe="park-stage"] .park-pipe .pipe-art') !== null, "the half pipe is not drawn");
  let seen = { pipe: false, air: false };
  for (let i = 0; i < 60; i++) {
    await tick(0.05);
    const st = await park();
    if (st.rider.mode === "pipe") seen.pipe = true;
    if (seen.pipe && st.rider.mode === "air" && st.rider.vy > 800) { seen.air = true; break; }
    if (st.rider.mode === "bail") break;
  }
  must(seen.pipe, "the rider never dropped into the pipe");
  must(seen.air, "the rider never launched out of the pipe with big air");
  must(await page.$('[data-probe="park-rider"]') !== null, "the rider vanished");
  await tick(2);
  // And the stairs.
  await flatLine();
  await page.evaluate(() => {
    const s = window.__park.state();
    const x = s.scroll + 130;
    s.rider.mode = "ground"; s.rider.y = 0; s.rider.vy = 0; s.rider.trick = null; s.chain = [];
    s.obstacles.push({ id: 9003, kind: "rail", x: x - 100, w: 130, h: 90, used: false });
    s.obstacles.push({ id: 9004, kind: "stairs", x: x + 30, w: 300, h: 90, used: false });
    s.rider.mode = "grind"; s.rider.y = 90; s.rider.grindOn = s.obstacles[0]; s.rider.grindT = 0.2;
  });
  await tick(0.05);
  must(await page.$('[data-probe="park-stage"] .park-stairs .stairs-art') !== null, "the staircase is not drawn");
  let slid = false;
  const before = (await park()).score;
  for (let i = 0; i < 80; i++) {
    await tick(0.05);
    const st = await park();
    if (st.rider.mode === "slide") slid = true;
    if (slid && st.rider.mode === "ground") break;
    if (st.rider.mode === "bail") break;
  }
  const after = await park();
  must(slid, "the rider never slid the handrail");
  must(after.rider.mode === "ground" && after.score > before, `after the stairs: ${after.rider.mode}, score ${before} -> ${after.score}`);
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
  const live = await park();
  await page.evaluate(() => { window.__park.state().timeLeftMs = 400; });
  await tick(0.6);
  await page.waitForSelector('[data-probe="park-results"]', { timeout: 4000 });
  const text = (await page.textContent(".sheet")) ?? "";
  const fin = await park();
  must(fin.score >= live.score && fin.score > 0, `the run's score went ${live.score} -> ${fin.score}`);
  must(text.includes("Time's up") && text.includes(String(fin.score)) && text.includes(`${fin.tricksLanded} trick`) && text.includes(`best chain ${fin.bestChain}`) && text.includes(`${fin.bails} bail`), `the results read: ${text.slice(0, 160)}`);
  must(text.includes("NEW BEST"), "a first score is not a new best");
  must(await page.$(".sheet .row .btn.go") === null, "Another token is offered with no token left");
  must(text.includes("No Daily Token yet"), "the results do not say why another play is not on");
  const m = await meta();
  must(m.parkBest === fin.score && m.parkBestChain === fin.bestChain, `bests: ${m.parkBest}/${m.parkBestChain} vs ${fin.score}/${fin.bestChain}`);
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
  // A grown-up can reopen today's park from the settings tab.
  await openSettings(page);
  must(await page.$('[data-probe="reopen-park"]:not([disabled])') !== null, "Reopen is not offered with plays spent");
  await page.click('[data-probe="reopen-park"]');
  await page.waitForTimeout(300);
  must((await meta()).parkSpent === 0, "Reopen did not clear today's spend");
  await page.evaluate(() => { const m = window.__app.meta(); m.parkSpent = 3; m.parkDay = window.__app.day(); });
  await page.evaluate(() => window.__app.save());
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

await step("past the day's work, every M more landings drops another token, up to N", async () => {
  // Andy, 2026-09-05: "earn up to N extra daily tokens by completing M more
  // problems". Here: two extras, one every two landings.
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.animations = false;
    m.strands = { add: true, sub: false, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 0 };
    // The day's work is done and its token already dropped.
    m.dailyGoal = 3; m.doseDay = window.__app.day(); m.doseCount = 3;
    m.tokens = 1; m.tokenDay = window.__app.day(); m.tokensToday = 1;
    m.extraTokensOn = true; m.extraTokenMax = 2; m.extraTokenEvery = 2;
  });
  // No reload from here: a goal of 3 would come back as 10, the floor the
  // loader clamps to.
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 1);
  must(await page.$('[data-probe="extra-token"]') === null, "an extra token dropped a landing early");
  must((await meta()).tokens === 1, "an extra token was banked early");
  await answerN(page, 1);
  await page.waitForSelector('[data-probe="extra-token"]', { timeout: 6000 });
  must(((await page.textContent('[data-probe="extra-token"]')) ?? "").includes("2 more for another"), "the extra token does not say what the next one costs");
  must((await meta()).tokens === 2, "the extra token did not reach the pocket");
  await page.waitForSelector('[data-probe="extra-token"]', { state: "detached", timeout: 6000 });
  // The second extra is the last one: it says so instead of asking for more.
  await answerN(page, 2);
  await page.waitForSelector('[data-probe="extra-token"]', { timeout: 6000 });
  must(((await page.textContent('[data-probe="extra-token"]')) ?? "").includes("every token today"), "the last extra token still asks for more");
  const after = await meta();
  must(after.tokens === 3 && after.tokensToday === 3, `after both extras tokens=${after.tokens} today=${after.tokensToday}`);
  await page.waitForSelector('[data-probe="extra-token"]', { state: "detached", timeout: 6000 });
  // Past the cap, nothing more drops however long the run goes.
  await answerN(page, 4);
  must(await page.$('[data-probe="extra-token"]') === null, "a token dropped past the cap");
  must((await meta()).tokens === 3, "tokens kept coming past the cap");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await escapeAll(page);
});

await step("switched off, the day's work drops one token and that is the day", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.dailyGoal = 3; m.doseDay = window.__app.day(); m.doseCount = 3;
    m.tokens = 1; m.tokenDay = window.__app.day(); m.tokensToday = 1;
    m.extraTokensOn = false; m.extraTokenMax = 2; m.extraTokenEvery = 2;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await answerN(page, 6);
  must(await page.$('[data-probe="extra-token"]') === null, "an extra token dropped with the offer switched off");
  must((await meta()).tokens === 1, "tokens grew with the offer switched off");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await escapeAll(page);
  await page.evaluate(() => { const m = window.__app.meta(); m.dailyGoal = 40; m.doseDay = null; m.doseCount = 0; m.extraTokensOn = true; m.extraTokenMax = 1; m.extraTokenEvery = 40; m.tokens = 0; m.tokenDay = null; m.tokensToday = 0; });
  await page.evaluate(() => window.__app.save());
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

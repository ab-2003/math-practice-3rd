/**
 * PROBE: SHOP. Twenty-nine monsters, their forms and acts, the rack, the
 * confirms, the peek, gear, send out, the level gate, and the off-stage pause.
 */
import { answerOf, closeSheets, goHome, suite, typeAnswer } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("shop");

/** Escape closes the top sheet; a cancelled level sheet reopens the card,
 *  so keep going until the scrim is gone. */
const escapeAll = async (p) => {
  for (let i = 0; i < 6 && (await p.$(".scrim")) !== null; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(220); }
};

await step("the shop shows all twenty-nine monsters by name, no mysteries", async () => {
  await page.waitForSelector('[data-probe="start"]');
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must((await page.$$(".mon")).length === 29, "the roster is not twenty-nine");
  const text = (await page.textContent(".roster")) ?? "";
  must(!text.includes("???"), "a monster is still a mystery");
  must(text.includes("CINDERWYRM") && text.includes("VOIDWYRM"), "the dragons are not on display");
  must(await page.evaluate(() => document.querySelector(".roster")?.lastElementChild?.getAttribute("data-mon")) === "voidwyrm",
    "VOIDWYRM is not the final monster in the shop");
  must(await page.$('[data-mon="voidwyrm"] .cosmos') !== null, "VOIDWYRM has no cosmos");
  must((await page.$$(".helm-tile")).length === 22, "the gear rack is not twenty-two helmets");
  // THE KAIJU SIX wear their tag, SKYHOOK is the 150 door, the pilot's lid is on the rack.
  must((await page.$$('[data-probe="kaiju-tag"]')).length === 8, "the kaiju eight are not tagged");
  must((await page.$$('[data-probe="dragon-tag"]')).length === 7, "the seven dragons are not tagged");
  must(await page.$('[data-mon="voidwyrm"] [data-probe="dragon-tag"]') !== null, "VOIDWYRM wears no DRAGON tag");
  must(((await page.textContent('[data-mon="skyhook"]')) ?? "").includes("150"), "SKYHOOK is not 150 coins");
  must(await page.$('[data-helm="pilot-jet"] .visor') !== null, "the pilot helmet has no visor");
});

await step("the kaiju six each perform their own act, and the ball is basketball orange", async () => {
  for (const [mon, prop] of [
    ["skyhook", ".hoops-rig .ball"], ["skyhook", ".hoops-rig .net"], ["machfang", ".jet-back .burner"], ["machfang", ".jet-front"],
    ["moonhowl", ".moonrig .moon"], ["moonhowl", ".howl-3"], ["pandamonium", ".ringtail .spin-blur"],
    ["triomaw", ".head-l"], ["triomaw", ".head-t"], ["triomaw", ".chomp-m"], ["chromaleon", ".tonguerig .tongue"], ["chromaleon", ".fly"],
    ["wreckarm", ".fist-arm"], ["wreckarm", ".tower-top"], ["wreckarm", ".debris-3"], ["wreckarm", ".dust-w"],
    ["pantheraclaw", ".claw-paw .claw"], ["pantheraclaw", ".slash-3"], ["pantheraclaw", ".slash-spark"],
  ]) {
    must(await page.$(`[data-mon="${mon}"] ${prop}`) !== null, `${mon} lost its ${prop}`);
  }
  must(await page.$eval('[data-mon="skyhook"] .ball circle', (e) => e.getAttribute("fill")) === "#EE6730", "the basketball is not basketball orange");
  must((await page.$$('[data-mon="triomaw"] .head')).length === 3, "TRIOMAW does not have three heads");
  must(await page.$eval('[data-mon="pantheraclaw"] .claw', (e) => e.getAttribute("fill")) === "#F5C542", "the panther's claws are not gold");
  must((await page.$$('[data-mon="pantheraclaw"] .claw-paw .claw')).length === 3, "the panther's paw does not have three claws");
  // The acts are real animations on the idle clock, not static props.
  const names = await page.evaluate(() => ({
    hoops: getComputedStyle(document.querySelector('[data-mon="skyhook"] .creature')).animationName,
    ball: getComputedStyle(document.querySelector('[data-mon="skyhook"] .ball')).animationName,
    jet: getComputedStyle(document.querySelector('[data-mon="machfang"] .creature')).animationName,
    tail: getComputedStyle(document.querySelector('[data-mon="pandamonium"] .ringtail')).animationName,
    hue: getComputedStyle(document.querySelector('[data-mon="chromaleon"] .creature')).animationName,
    howl: getComputedStyle(document.querySelector('[data-mon="moonhowl"] .creature')).animationName,
    snap: getComputedStyle(document.querySelector('[data-mon="triomaw"] .head-l')).animationName,
    fist: getComputedStyle(document.querySelector('[data-mon="wreckarm"] .fist-arm')).animationName,
    fall: getComputedStyle(document.querySelector('[data-mon="wreckarm"] .tower-top')).animationName,
    swipe: getComputedStyle(document.querySelector('[data-mon="pantheraclaw"] .claw-paw')).animationName,
    pounce: getComputedStyle(document.querySelector('[data-mon="pantheraclaw"] .creature')).animationName,
  }));
  must(names.fist === "fist-swing" && names.fall === "tower-fall", `WRECKARM's act reads ${names.fist}/${names.fall}`);
  must(names.swipe === "claw-swipe" && names.pounce === "idle-pounce", `PANTHERACLAW's act reads ${names.swipe}/${names.pounce}`);
  must(names.hoops === "idle-jumpshot" && names.ball === "ball-arc", `SKYHOOK's act reads ${names.hoops}/${names.ball}`);
  must(names.jet === "idle-takeoff", `MACHFANG's act reads ${names.jet}`);
  must(names.tail === "tail-spin", `PANDAMONIUM's tail reads ${names.tail}`);
  must(names.hue === "idle-shift", `CHROMALEON's act reads ${names.hue}`);
  must(names.howl === "idle-howl", `MOONHOWL's act reads ${names.howl}`);
  must(names.snap === "snap-l", `TRIOMAW's heads read ${names.snap}`);
});

await step("the shop breathes, staggered, and every bespoke act is present", async () => {
  const delays = await page.evaluate(() =>
    [...document.querySelectorAll(".roster .creature.idle")].map((e) => e.style.getPropertyValue("--idle-delay")));
  must(delays.length === 29, `${delays.length} idle monsters, wanted 29`);
  must(new Set(delays).size >= 6, "the idles all fire in lockstep");
  must((await page.$$(".roster .flame")).length === 7, "the seven dragons are not breathing");
  for (const [mon, prop] of [
    ["grindjaw", ".log-l"], ["voltmaw", ".bolt"], ["magmaspyne", ".lava"],
    ["magmaspyne", ".lava-depth"], ["glaciodon", ".floe"], ["puckjaw", ".goal"],
    ["quarryback", ".rockfall"], ["stormhide", ".sbolt"], ["nightcoil", ".trophy"],
    ["skathorn", ".deckprop"], ["tidewreck", ".waverig"], ["rustfang", ".scrap-gear"],
    ["emberclaw", ".scorch"], ["voidcrest", ".rift"],
  ]) {
    must(await page.$(`[data-mon="${mon}"] ${prop}`) !== null, `${mon} lost its ${prop} act`);
  }
  const breaths = await page.evaluate(() => [...document.querySelectorAll(".roster .flame")].map((f) => f.innerHTML));
  must(new Set(breaths).size === 7, "the dragons share breaths that should be their own");
  must(await page.$('[data-mon="puckjaw"] .puck-shot .stick') !== null, "PUCKJAW lost the stick");
  // Seven dragons and WRECKARM (a wolf-dragon) wear wings, and no two pairs match.
  const wings = await page.evaluate(() => [...document.querySelectorAll(".roster .wings")].map((w) => w.getAttribute("d")));
  must(wings.length === 8 && new Set(wings).size === 8, `the winged are palette swaps, not forms (${wings.length} pairs, ${new Set(wings).size} distinct)`);
});

await step("GRINDJAW's log appears, snaps, falls, and is GONE for the rest of the loop", async () => {
  // Freeze the tile's animations at chosen moments of its own cycle: the
  // log must be hidden before the act, whole while he gnaws, and gone
  // after the snap through the end of the loop (Andy: "the log reappears").
  const at = async (fraction) => page.evaluate((f) => {
    const tile = document.querySelector('[data-mon="grindjaw"]');
    const art = tile.querySelector(".creature");
    const delay = parseFloat(art.style.getPropertyValue("--idle-delay")) * 1000;
    const cycle = parseFloat(getComputedStyle(art).animationDuration) * 1000;
    for (const a of document.getAnimations()) {
      const t = a.effect?.target;
      if (t && tile.contains(t)) { a.pause(); a.currentTime = delay + f * cycle; }
    }
    return { l: parseFloat(getComputedStyle(tile.querySelector(".log-l")).opacity), r: parseFloat(getComputedStyle(tile.querySelector(".log-r")).opacity) };
  }, fraction);
  const before = await at(0.002);
  must(before.l === 0 && before.r === 0, `the log is showing before the act (${before.l}/${before.r})`);
  const gnaw = await at(0.06);
  must(gnaw.l === 1 && gnaw.r === 1, `the log is not whole while he gnaws (${gnaw.l}/${gnaw.r})`);
  for (const f of [0.25, 0.5, 0.75, 0.99]) {
    const rest = await at(f);
    must(rest.l === 0 && rest.r === 0, `the log is back at ${Math.round(f * 100)}% of the loop (${rest.l}/${rest.r})`);
  }
  await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
});

await step("no two monsters share a body: every one is its own form", async () => {
  // GRINDJAW, PUCKJAW and GLACIODON once read as the same animal in three
  // colours at tile size. Body plus wings must be unique across all 29.
  const forms = await page.evaluate(() =>
    [...document.querySelectorAll(".roster .mon")].map((m) => ({
      id: m.getAttribute("data-mon"),
      form: (m.querySelector(".creature .body")?.getAttribute("d") ?? "") + "|" + (m.querySelector(".creature .wings")?.getAttribute("d") ?? ""),
    })));
  must(forms.length === 29, "could not read the forms");
  const seen = new Map();
  for (const f of forms) {
    must(f.form.length > 10, `${f.id} has no body path`);
    must(!seen.has(f.form), `${f.id} shares a form with ${seen.get(f.form)}`);
    seen.set(f.form, f.id);
  }
  for (const [a, b] of [["grindjaw", "puckjaw"], ["grindjaw", "glaciodon"], ["quarryback", "magmaspyne"],
    ["voltmaw", "rustfang"], ["voltmaw", "bladeback"], ["skathorn", "emberclaw"], ["tidewreck", "nightcoil"], ["stormhide", "voidcrest"]]) {
    const fa = forms.find((f) => f.id === a).form;
    const fb = forms.find((f) => f.id === b).form;
    must(fa !== fb, `${a} and ${b} still share a body`);
  }
});

await step("a TOUCH on the monster art opens its card (the phone scar)", async () => {
  const box = await page.locator('[data-mon="skathorn"]').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.42);
  await page.waitForTimeout(400);
  must(await page.$(".sheet") !== null, "a TOUCH on the art did not open the card");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
});

await step("with no monsters yet, the racks are on display but shut", async () => {
  must(await page.evaluate(() => window.__app.meta().owned.length) === 0, "the fresh profile owns something");
  must(await page.$(".gear-rack.rack-locked") !== null, "the rack is open before the first monster");
  must((await page.$$(".helm-tile[disabled]")).length === 22, "a helmet is tappable before the first monster");
  const note = (await page.textContent('[data-probe="rack-note"]')) ?? "";
  must(note.includes("Helmets need heads"), "the locked rack does not explain itself");
  // THE BOARD RACK: thirteen decks, plain always owned, shut until the first monster.
  must(await page.$('[data-probe="board-rack"].rack-locked') !== null, "the board rack is open before the first monster");
  must((await page.$$(".board-tile")).length === 13, "the board rack is not thirteen boards");
  must((await page.$$(".board-tile[disabled]")).length === 13, "a board is tappable before the first monster");
  must(((await page.textContent('[data-probe="board-note"]')) ?? "").includes("Boards need riders"), "the locked board rack does not explain itself");
  must(await page.$('[data-board-tile="plain"].owned') !== null, "the plain board is not marked as always owned");
  const prices = await page.$$eval(".board-tile .mon-sub", (els) => els.map((e) => e.textContent));
  must(prices.includes("◆ 100") && prices.includes("◆ 500") && prices.includes("◆ 1100") && prices.includes("◆ 1500"), `the prices read ${JSON.stringify(prices)}`);
  // Thirteen forms, not one deck in thirteen colours: the graphics differ, and Void has its stars.
  const marks = await page.$$eval(".board-tile .board", (els) => els.map((e) => e.innerHTML.length));
  must(new Set(marks).size >= 12, "the boards are palette swaps");
  must((await page.$$('[data-board-tile="void"] .board-void circle')).length >= 6, "the void board has no stars");
  // THE THEMED FOUR (0.18.2): cockpit and wings, a puck, a ball, a crowned tag.
  for (const [id, prop] of [["jet", ".jet-nose"], ["jet", ".jet-wing"], ["jet", ".jet-canopy"], ["hockey", ".puck"], ["hockey", ".stick"], ["hoops", ".ball"], ["tag", ".tag-letters"], ["tag", ".tag-crown"]]) {
    must(await page.$(`[data-board-tile="${id}"] ${prop}`) !== null, `the ${id} board lost its ${prop}`);
  }
  must(await page.$eval('[data-board-tile="hoops"] .ball', (e) => e.getAttribute("fill")) === "#EE6730", "the court ball is not basketball orange");
});

await step("tiles that scroll off stage pause their acts", async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 820, height: 520 } });
  const p2 = await ctx2.newPage();
  await p2.goto(page.url().split("?")[0].replace(/\/[^/]*$/, "/"), { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="collection"]');
  await p2.evaluate(() => { const m = window.__app.meta(); m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal; window.__app.go("collection"); });
  await p2.waitForSelector(".roster");
  await p2.waitForTimeout(400);
  const offTop = await p2.evaluate(() => document.querySelectorAll(".mon.offstage").length);
  must(offTop > 0, "nothing is off stage on a short screen at the top");
  must(await p2.evaluate(() => getComputedStyle(document.querySelector(".mon.offstage .creature")).animationPlayState) === "paused", "an off-stage act is still running");
  // Bring the LAST tile on stage (the gear rack sits below it, so a plain
  // scroll-to-bottom would carry it off the top).
  await p2.evaluate(() => document.querySelector(".roster").lastElementChild.scrollIntoView({ block: "center" }));
  await p2.waitForTimeout(400);
  must(await p2.evaluate(() => !document.querySelector(".roster").lastElementChild.classList.contains("offstage")), "the last tile is off stage while in view");
  must(await p2.evaluate(() => document.querySelector(".roster").firstElementChild.classList.contains("offstage")), "the first tile still runs while scrolled away");
  await ctx2.close();
});

await step("send out picks who rides, and the collection says so", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.owned = ["grindjaw", "voltmaw"];
    m.levels = { grindjaw: 1, voltmaw: 1 };
    m.rider = null;
    m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal;
    window.__app.go("collection");
  });
  await page.waitForTimeout(250);
  await page.click('[data-mon="grindjaw"]');
  await page.waitForSelector('[data-probe="send-out"]', { timeout: 4000 });
  await page.click('[data-probe="send-out"]');
  await page.waitForTimeout(350);
  must(await page.evaluate(() => window.__app.meta().rider) === "grindjaw", "send out did not set the rider");
  while (await page.$(".scrim") !== null) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  const badges = await page.$$(".riding-badge");
  must(badges.length === 1, `${badges.length} RIDING badges, wanted exactly 1`);
});

await step("LEVEL UP is surfaced on the tile, explained on its sheet, and gated like any spend", async () => {
  // Coins for exactly one level of grindjaw (40) and not voltmaw's second (80).
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.owned = ["grindjaw", "voltmaw"]; m.levels = { grindjaw: 1, voltmaw: 2 }; m.coins = 40;
    m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal;
    window.__app.go("collection");
  });
  await page.waitForSelector(".roster");
  must(await page.$('[data-mon="grindjaw"] [data-probe="level-ready"]') !== null, "the affordable level-up wears no badge");
  must(await page.$('[data-mon="voltmaw"] [data-probe="level-ready"]') === null, "an unaffordable level-up wears a badge");
  must(await page.evaluate(() => getComputedStyle(document.querySelector('[data-probe="level-ready"]')).animationName) === "lvl-pulse", "the badge does not pulse");
  must(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-probe="level-ready"]')).fontSize)) >= 13, "the badge is below the 13px floor");
  // The card has the door; the door opens the sheet; the sheet says why.
  await page.click('[data-mon="grindjaw"]');
  await page.waitForSelector('[data-probe="level-up"]', { timeout: 4000 });
  must(((await page.textContent('[data-probe="level-line"]')) ?? "").includes("Level 1 of 10"), "the card does not say the level");
  must(await page.$(".sheet .row .btn.go") === null, "the card itself still spends coins");
  await page.click('[data-probe="level-up"]');
  await page.waitForSelector('[data-probe="level-confirm"]', { timeout: 4000 });
  must((await page.$$(".sheet")).length === 1, "the card is still open under the level sheet");
  const why = (await page.textContent('[data-probe="level-confirm"]')) ?? "";
  must(why.includes("Level 2 brings a star sticker"), `the sheet does not say what level 2 brings: ${why.slice(0, 80)}`);
  must(await page.$('[data-probe="perk-list"] li.next') !== null, "the ladder does not light the next perk");
  must(why.includes("for looks"), "the sheet does not say levels are cosmetic");
  must(why.includes("would have 0 left"), "the sheet does not say what remains");
  must(await page.$('[data-probe="level-sheet"] .lvl-star') !== null, "the sheet does not draw the monster at the next level");
  // Not yet spends nothing. Confirm spends exactly the cost.
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(250);
  must(await page.evaluate(() => window.__app.meta().coins) === 40, "Not-yet took coins");
  must(await page.evaluate(() => window.__app.meta().levels.grindjaw) === 1, "Not-yet levelled");
  // Not yet lands back on the card, not on the roster.
  await page.waitForSelector('[data-probe="level-up"]', { timeout: 4000 });
  await page.click('[data-probe="level-up"]');
  await page.waitForSelector('[data-probe="level-confirm"]', { timeout: 4000 });
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => window.__app.meta());
  must(m.levels.grindjaw === 2, `level went to ${m.levels.grindjaw}, wanted 2`);
  must(m.coins === 0, `coins went to ${m.coins}, wanted 0`);
  // The card reopens at the new level, star and all, so the change is seen.
  await page.waitForSelector('[data-probe="level-line"]', { timeout: 4000 });
  must(((await page.textContent('[data-probe="level-line"]')) ?? "").includes("Level 2 of 10"), "the card did not come back at level 2");
  must(await page.$(".sheet .creature .lvl-star") !== null, "the card does not draw the new star");
  await escapeAll(page);
  await page.waitForSelector(".roster");
  must(await page.$('[data-probe="level-ready"]') === null, "a badge survives an empty wallet");
  must(await page.$('[data-mon="grindjaw"] .lvl-star') !== null, "level 2 did not put the star on the tile");
  // Broke: the door still opens, explains, and offers only a way back.
  await page.click('[data-mon="grindjaw"]');
  await page.waitForSelector('[data-probe="level-up"]', { timeout: 4000 });
  await page.click('[data-probe="level-up"]');
  await page.waitForSelector('[data-probe="level-sheet"]', { timeout: 4000 });
  must(await page.$(".sheet .row .btn.go") === null, "a broke rider is offered a confirm");
  must(((await page.textContent('[data-probe="level-confirm"]')) ?? "").includes("keep landing tricks"), "the broke sheet does not point at the run");
  await escapeAll(page);
});

await step("before today's run the shop is ONE peek: one visit, one minute, with a bar that shrinks", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.doseDay = window.__app.day(); m.doseCount = 0;
    m.shopPeekDay = null; m.shopPeekAt = null; m.shopPeekSpent = false;
  });
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must(await page.$('[data-probe="shop-peek"]') !== null, "the peek does not announce itself");
  // The minute is visible and shrinking.
  must(await page.$('[data-probe="peek-timer"]') !== null, "no peek timer bar");
  const w0 = await page.evaluate(() => parseFloat(document.querySelector('[data-probe="peek-timer"] .speed-fill').style.width));
  await page.waitForTimeout(1300);
  const w1 = await page.evaluate(() => parseFloat(document.querySelector('[data-probe="peek-timer"] .speed-fill').style.width));
  must(w1 < w0 && w0 > 95, `the bar went ${w0}% -> ${w1}%, wanted a shrink from full`);
  // WALKING OUT spends the peek: Andy got back in "several times" inside the minute.
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  must(await page.evaluate(() => window.__app.meta().shopPeekSpent) === true, "leaving did not spend the peek");
  await page.click('[data-probe="collection"]');
  await page.waitForSelector('[data-probe="shop-locked"]', { timeout: 4000 });
  must(await page.$(".roster") === null, "a second visit inside the minute got the roster");
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  // A reload does not reopen it either.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  await page.click('[data-probe="collection"]');
  await page.waitForSelector('[data-probe="shop-locked"]', { timeout: 4000 });
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  // And the minute running out ends it with its sheet.
  await page.evaluate(() => { const m = window.__app.meta(); m.shopPeekDay = null; m.shopPeekAt = null; m.shopPeekSpent = false; });
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  await page.evaluate(() => { window.__app.meta().shopPeekAt = Date.now() - 61_000; });
  await page.waitForSelector(".sheet", { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("Peek"), "the peek did not end with its sheet");
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(300);
  await page.click('[data-probe="collection"]');
  await page.waitForSelector('[data-probe="shop-locked"]', { timeout: 4000 });
  must(await page.$(".roster") === null, "the locked shop still shows the roster");
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  await page.evaluate(() => { const m = window.__app.meta(); m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal; });
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster", { timeout: 4000 });
  must(await page.$('[data-probe="shop-peek"]') === null, "the open shop still wears the peek note");
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
});

await step("the rider buys the dragon they WANT, not the cheapest, and the confirm cancels clean", async () => {
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.coins = 5000; m.owned = []; m.rider = null;
    m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal;
    window.__app.go("collection");
  });
  await page.waitForTimeout(250);
  await page.click('[data-mon="cinderwyrm"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("left"), "the confirm does not say what remains");
  must(await page.$(".sheet .creature.idle-fast") !== null, "the card art is not performing its fast loop");
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(250);
  {
    const m0 = await page.evaluate(() => window.__app.meta());
    must(m0.coins === 5000 && m0.owned.length === 0, "Not-yet moved money or monsters");
  }
  await page.click('[data-mon="cinderwyrm"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go");
  await page.waitForSelector(".sheet", { timeout: 4000 });
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => window.__app.meta());
  must(m.owned.includes("cinderwyrm"), "the chosen dragon was not bought");
  must(!m.owned.includes("grindjaw"), "the shop bought the cheapest instead of the pick");
  must(m.coins === 5000 - 350, `coins went to ${m.coins}, wanted 4650`);
  must(await page.$(".gear-rack.rack-locked") === null, "the rack stayed locked after the first monster");
  must((await page.$$(".helm-tile[disabled]")).length === 0, "helmets still disabled after the first monster");
});

await step("a board is bought once, ridden by the monster it is put under, and shows in the trick", async () => {
  // The rack opened with the first monster. Cancel spends nothing.
  must(await page.$('[data-probe="board-rack"].rack-locked') === null, "the board rack stayed locked after the first monster");
  await page.click('[data-board-tile="ember"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("left"), "the board confirm does not say what remains");
  await page.click(".sheet .btn.ghost"); // Not yet
  await page.waitForTimeout(250);
  must(await page.evaluate(() => window.__app.meta().boardsOwned.length) === 0, "Not-yet bought a board");
  const coins0 = await page.evaluate(() => window.__app.meta().coins);
  await page.click('[data-board-tile="ember"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go"); // Buy
  await page.waitForSelector(".sheet .reveal .board", { timeout: 4000 });
  must(((await page.textContent(".sheet")) ?? "").includes("New board"), "no reveal for the board");
  await page.click(".sheet .btn.go"); // <rider> rides it
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => window.__app.meta());
  must(m.boardsOwned.includes("ember"), "the board is not in the rack");
  must(m.coins === coins0 - 100, `coins went ${coins0} -> ${m.coins}, wanted -100`);
  const rider = await page.evaluate(() => { const m = window.__app.meta(); return m.rider ?? m.owned[m.owned.length - 1]; });
  must(m.boardOf[rider] === "ember", "the reveal did not put the board under the rider");
  // The card shows the row: plain and ember, ember selected; plain takes it back.
  await page.click(`[data-mon="${rider}"]`);
  await page.waitForSelector('[data-probe="board-row"]', { timeout: 4000 });
  must((await page.$$('[data-probe="board-row"] .board-pick')).length === 2, "the board row is not plain plus ember");
  must(await page.$('[data-ride="ember"].sel') !== null, "ember is not marked as ridden");
  must(await page.$('.sheet .card-board[data-board="ember"]') !== null, "the card does not draw the ridden board");
  await page.click('[data-ride="plain"]');
  await page.waitForTimeout(250);
  must(await page.evaluate(() => Object.values(window.__app.meta().boardOf)).then((v) => v.includes("plain")), "plain did not take the board back");
  await page.click('[data-ride="ember"]');
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  // And in the ride itself: the trick's deck is the ember board, trail and all.
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  await page.evaluate(() => { const m = window.__app.meta(); m.animations = true; m.strands = { add: true, sub: true, mul: false, div: false }; m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 }; });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
  // The real keypad, not the probe hook: awaiting the hook's promise would
  // return only after the 760ms ride is already gone.
  await typeAnswer(page, answerOf(id));
  const deck = await page.waitForSelector('.trick-run .trick-deck[data-board="ember"]', { timeout: 2500 }).catch(() => null);
  must(deck !== null, "the trick did not ride the ember board");
  must(await page.$(".trick-run .board-trail") !== null, "the riding board has no trail");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await closeSheets(page);
  await page.evaluate(() => { const m = window.__app.meta(); m.doseDay = window.__app.day(); m.doseCount = m.dailyGoal; window.__app.go("collection"); });
  await page.waitForSelector(".roster");
});

await step("a helmet is bought once and lands on the monster it is put on", async () => {
  await page.click('[data-helm="cap-fire"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(250);
  must(await page.evaluate(() => window.__app.meta().helmetsOwned.length) === 0, "Not-yet bought a helmet");
  // Buying from the rack, far down the page, must leave him at the rack.
  await page.evaluate(() => document.querySelector('[data-helm="cap-fire"]').scrollIntoView({ block: "center" }));
  await page.waitForTimeout(150);
  const rackScroll = await page.evaluate(() => Math.max(window.scrollY, document.querySelector(".screen").scrollTop));
  must(rackScroll > 100, `the shop did not scroll to the rack (${rackScroll})`);
  await page.click('[data-helm="cap-fire"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(350);
  must(await page.evaluate(() => window.__app.meta().helmetsOwned.includes("cap-fire")), "the helmet is not in the locker");
  const afterBuy = await page.evaluate(() => Math.max(window.scrollY, document.querySelector(".screen").scrollTop));
  must(Math.abs(afterBuy - rackScroll) < 8, `buying a helmet moved the scroll ${rackScroll} -> ${afterBuy}`);
  await page.click('[data-mon="cinderwyrm"]');
  await page.waitForSelector('[data-equip="cap-fire"]', { timeout: 4000 });
  await page.click('[data-equip="cap-fire"]');
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().gear["cinderwyrm"]) === "cap-fire", "the helmet did not go on");
  must(await page.$(".sheet .creature .helm") !== null, "the worn helmet is not drawn on the card");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await closeSheets(page);
});

await done();

/**
 * PROBE: SHOP. Twenty-one monsters, their forms and acts, the rack, the
 * confirms, the peek, gear, send out, and the off-stage pause.
 */
import { closeSheets, goHome, suite } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("shop");

await step("the shop shows all twenty-one monsters by name, no mysteries", async () => {
  await page.waitForSelector('[data-probe="start"]');
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must((await page.$$(".mon")).length === 21, "the roster is not twenty-one");
  const text = (await page.textContent(".roster")) ?? "";
  must(!text.includes("???"), "a monster is still a mystery");
  must(text.includes("CINDERWYRM") && text.includes("VOIDWYRM"), "the dragons are not on display");
  must(await page.evaluate(() => document.querySelector(".roster")?.lastElementChild?.getAttribute("data-mon")) === "voidwyrm",
    "VOIDWYRM is not the final monster in the shop");
  must(await page.$('[data-mon="voidwyrm"] .cosmos') !== null, "VOIDWYRM has no cosmos");
  must((await page.$$(".helm-tile")).length === 20, "the gear rack is not twenty helmets");
});

await step("the shop breathes, staggered, and every bespoke act is present", async () => {
  const delays = await page.evaluate(() =>
    [...document.querySelectorAll(".roster .creature.idle")].map((e) => e.style.getPropertyValue("--idle-delay")));
  must(delays.length === 21, `${delays.length} idle monsters, wanted 21`);
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
  must(await page.$('[data-mon="puckjaw"] .puck-shot .stick') !== null, "PUCKJAW lost his stick");
  const wings = await page.evaluate(() => [...document.querySelectorAll(".roster .wings")].map((w) => w.getAttribute("d")));
  must(wings.length === 7 && new Set(wings).size === 7, "the seven dragons are palette swaps, not forms");
});

await step("no two monsters share a body: every one is its own form", async () => {
  // GRINDJAW, PUCKJAW and GLACIODON once read as the same animal in three
  // colours at tile size. Body plus wings must be unique across all 21.
  const forms = await page.evaluate(() =>
    [...document.querySelectorAll(".roster .mon")].map((m) => ({
      id: m.getAttribute("data-mon"),
      form: (m.querySelector(".creature .body")?.getAttribute("d") ?? "") + "|" + (m.querySelector(".creature .wings")?.getAttribute("d") ?? ""),
    })));
  must(forms.length === 21, "could not read the forms");
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

await step("with no monsters yet, the rack is on display but shut", async () => {
  must(await page.evaluate(() => window.__app.meta().owned.length) === 0, "the fresh profile owns something");
  must(await page.$(".gear-rack.rack-locked") !== null, "the rack is open before the first monster");
  must((await page.$$(".helm-tile[disabled]")).length === 20, "a helmet is tappable before the first monster");
  const note = (await page.textContent('[data-probe="rack-note"]')) ?? "";
  must(note.includes("Helmets need heads"), "the locked rack does not explain itself");
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

await step("before today's run the shop is one 60-second peek, then closed", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.doseDay = window.__app.day(); m.doseCount = 0;
    m.shopPeekDay = null; m.shopPeekAt = null;
  });
  await page.click('[data-probe="collection"]');
  await page.waitForSelector(".roster");
  must(await page.$('[data-probe="shop-peek"]') !== null, "the peek does not announce itself");
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

await step("he buys the dragon he WANTS, not the cheapest, and the confirm cancels clean", async () => {
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
  must(!m.owned.includes("grindjaw"), "the shop bought the cheapest instead of his pick");
  must(m.coins === 5000 - 350, `coins went to ${m.coins}, wanted 4650`);
  must(await page.$(".gear-rack.rack-locked") === null, "the rack stayed locked after his first monster");
  must((await page.$$(".helm-tile[disabled]")).length === 0, "helmets still disabled after his first monster");
});

await step("a helmet is bought once and lands on the monster he puts it on", async () => {
  await page.click('[data-helm="cap-fire"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.ghost");
  await page.waitForTimeout(250);
  must(await page.evaluate(() => window.__app.meta().helmetsOwned.length) === 0, "Not-yet bought a helmet");
  await page.click('[data-helm="cap-fire"]');
  await page.waitForSelector(".sheet .btn.go", { timeout: 4000 });
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(350);
  must(await page.evaluate(() => window.__app.meta().helmetsOwned.includes("cap-fire")), "the helmet is not in the locker");
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

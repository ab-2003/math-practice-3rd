/**
 * PROBE: SETTINGS. The practice table, the caps, missing number, the elapsed
 * ladder, and every parent switch surviving a reload.
 */
import { answerN, answerOf, calmMeta, closeSheets, goHome, openSettings, pinIn, suite, typeAnswer } from "./_shared.mjs";
import { missingExpected } from "../lib/drive.mjs";

const { page, step, must, done } = await suite("settings");

await step("a fresh install practises addition and subtraction only", async () => {
  await page.waitForSelector('[data-probe="start"]');
  const strands = await page.evaluate(() => window.__app.meta().strands);
  must(strands.add === true && strands.sub === true, `add/sub not on: ${JSON.stringify(strands)}`);
  must(strands.mul === false && strands.div === false, `mul/div should start off: ${JSON.stringify(strands)}`);
});

await step("the practice table has one row per operation with three controls each", async () => {
  await openSettings(page);
  for (const k of ["add", "sub", "mul", "div"]) {
    must(await page.$(`[data-strand-row="${k}"]`) !== null, `no row for ${k}`);
    must(await page.$(`[data-strand="${k}"]`) !== null, `no switch for ${k}`);
    must(await page.$(`[data-missing="${k}"]`) !== null, `no missing switch for ${k}`);
    must(await page.$(`[data-probe="cap-${k}"]`) !== null, `no cap chip for ${k}`);
  }
  must(await page.getAttribute('[data-strand="mul"]', "aria-pressed") === "false", "multiplication reads as on");
  // The whole card fits in well under one iPad screen; it was 1,452px.
  const h = await page.evaluate(() => document.querySelector(".ptable").closest(".card").getBoundingClientRect().height);
  must(h < 700, `the practice card is ${h}px tall`);
});

await step("the report says a switched-off standard is not a result", async () => {
  await page.click('[data-probe="tab-progress"]');
  await page.waitForSelector('[data-probe="progress-tab"]');
  const text = (await page.textContent(".screen")) ?? "";
  must(text.includes("switched off in settings"), "a switched-off standard is reported as if it were a score");
});

await step("a session asks nothing but addition and subtraction", async () => {
  await page.click('[data-probe="back"]');
  await page.waitForSelector('[data-probe="start"]');
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  const kinds = new Set();
  for (let i = 0; i < 14; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 }).catch(() => undefined);
    if (await page.$(".sheet") !== null) break;
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact").catch(() => null);
    if (!id) break;
    kinds.add(id.split(":")[0]);
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
  must(kinds.size > 0, "no problems were asked at all");
  for (const k of kinds) must(k === "add" || k === "sub", `a ${k} problem was asked while it is switched off`);
});

await step("switching multiplication on takes effect and survives a reload", async () => {
  await goHome(page);
  await openSettings(page);
  await page.click('[data-strand="mul"]');
  await page.waitForTimeout(400);
  must(await page.evaluate(() => window.__app.meta().strands.mul) === true, "the switch did not take");
  must(await page.$('[data-strand="sub"]') !== null, "flipping a switch threw us back to the PIN pad");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  must(await page.evaluate(() => window.__app.meta().strands.mul) === true, "the switch did not persist");
});

await step("switching an operation off keeps everything already learned in it", async () => {
  const before = await page.evaluate(() => [...window.__app.states().values()].filter((s) => s.introduced).length);
  await openSettings(page);
  await page.click('[data-strand="add"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => [...window.__app.states().values()].filter((s) => s.introduced).length);
  must(after === before, `switching addition off changed the progress (${before} -> ${after})`);
});

await step("the last operation cannot be switched off", async () => {
  for (const k of ["sub", "mul"]) {
    if ((await page.getAttribute(`[data-strand="${k}"]`, "aria-pressed")) === "true") {
      await page.click(`[data-strand="${k}"]`);
      await page.waitForTimeout(300);
      await closeSheets(page);
    }
  }
  const strands = await page.evaluate(() => window.__app.meta().strands);
  must(Object.values(strands).some(Boolean), `every operation got switched off: ${JSON.stringify(strands)}`);
});

await step("missing number starts OFF for all four operations", async () => {
  const m = await page.evaluate(() => window.__app.meta().missing);
  must(m.add === false && m.sub === false && m.mul === false && m.div === false, JSON.stringify(m));
  must(m.pct === 20, `default mix is ${m.pct}, not 20`);
});

await step("the mix stepper appears only once a missing switch is on, then steps and persists", async () => {
  await goHome(page);
  await openSettings(page);
  must(await page.$('[data-probe="missing-pct"]') === null, "the stepper shows while everything is off");
  await page.click('[data-missing="add"]');
  await page.waitForSelector('[data-probe="missing-pct"]', { timeout: 4000 });
  must(await page.evaluate(() => window.__app.meta().missing.add) === true, "the switch did not take");
  await page.click('[data-probe="missing-pct-plus"]');
  await page.waitForTimeout(300);
  must((await page.textContent('[data-probe="missing-pct"]'))?.trim() === "25%", "plus did not step to 25");
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().missing.pct) === 25, "the mix did not persist");
});

await step("a missing item types into its own inline blank and grades on the operand", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.strands = { add: true, sub: true, mul: false, div: false };
    m.missing = { add: true, sub: true, mul: false, div: false, pct: 100 };
    m.animations = false;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"][data-format="missing"]', { timeout: 6000 });
  const text = (await page.textContent('[data-probe="problem"]')) ?? "";
  const wantNum = missingExpected(text);
  await page.click(`.keypad .key[data-key="${String(wantNum)[0]}"]`);
  const inBlank = (await page.textContent('[data-probe="mslot"]'))?.trim() ?? "";
  must(inBlank === String(wantNum)[0], `typed into the blank but it shows "${inBlank}"`);
  for (const d of String(wantNum).slice(1)) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.click(".keypad .key.enter");
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  must(await page.$('[data-probe="retype"]') === null, `the operand ${wantNum} was graded wrong for "${text}"`);
});

await step("a wrong missing answer reveals the whole fact and demands the operand", async () => {
  await page.waitForSelector('[data-probe="problem"][data-format="missing"]', { timeout: 6000 });
  const text = (await page.textContent('[data-probe="problem"]')) ?? "";
  const wantNum = missingExpected(text);
  await typeAnswer(page, wantNum + 1);
  await page.waitForSelector('[data-probe="retype"]', { timeout: 5000 });
  must(await page.$(".scaf-eq") !== null, "the completed equation is not revealed");
  const retype = (await page.textContent('[data-probe="retype"]')) ?? "";
  must(Number(retype.replace(/\D+/g, "")) === wantNum, `retype asks for "${retype}", not ${wantNum}`);
  await typeAnswer(page, wantNum);
  await page.waitForSelector('[data-probe="retype"]', { state: "detached", timeout: 6000 });
});

await step("switching missing number back off returns every item to standard", async () => {
  await goHome(page);
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.animations = false;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  for (let i = 0; i < 8; i++) {
    if (await page.$(".sheet") !== null) break;
    const fmt = await page.getAttribute('[data-probe="problem"]', "data-format").catch(() => null);
    if (fmt === null) break;
    must(fmt === "standard", "a missing item appeared with everything off");
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact");
    await typeAnswer(page, answerOf(id));
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 }).catch(() => undefined);
  }
});

await step("the bonus round defaults to level 1, digital", async () => {
  const m = await page.evaluate(() => window.__app.meta());
  must(m.elapsedLevel === 1, `default level is ${m.elapsedLevel}`);
  must(m.elapsedAnalog === false, "analog is on by default");
});

await step("the bonus round can be switched off altogether; a finished run then ends without it, and with it on, offers it", async () => {
  // Andy, 2026-09-03: "a toggle to turn off the bonus round altogether ... for the younger kids."
  await goHome(page);
  await openSettings(page);
  must(await page.$('[data-probe="elapsed-on"][aria-pressed="true"]') !== null, "the bonus round is not on by default");
  await page.click('[data-probe="elapsed-on"]');
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().elapsedOn) === false, "the switch did not persist");
  must(await page.$('[data-probe="elapsed-level-1"]') === null, "the level control is still shown with the round off");
  must(((await page.textContent('[data-probe="bonus-card"]')) ?? "").includes("off"), "the card does not say the round is off");
  // A whole run, every answer right, through the real keypad: no bonus at the end.
  const runThrough = async () => {
    await calmMeta(page);
    await page.evaluate(() => window.__app.save());
    await goHome(page);
    await page.click('[data-probe="start"]');
    await page.waitForSelector('[data-probe="problem"]');
    let n = 0;
    while (n < 90) {
      // Wait for whichever comes first: the bonus, the end of the run, or
      // the next problem's keypad; the rides and banners between take time.
      await page.waitForFunction(() =>
        document.querySelector('[data-probe="bonus-callout"], [data-probe="bonus"]') !== null
        || document.querySelector(".sheet") !== null || window.__probe.over()
        || document.querySelector(".keypad:not(.asleep)") !== null, null, { timeout: 15000 });
      if (await page.$('[data-probe="bonus-callout"], [data-probe="bonus"]') !== null) return { bonus: true, n };
      if (await page.evaluate(() => window.__probe.over())) return { bonus: false, n };
      if ((await page.$(".sheet")) !== null) {
        // The line-break offer: keep rolling. Anything else is the end.
        if (((await page.textContent(".sheet")) ?? "").includes("Keep rolling")) { await page.click(".sheet .row .btn.go"); await page.waitForTimeout(250); continue; }
        return { bonus: false, n };
      }
      await answerN(page, 1);
      n += 1;
    }
    return { bonus: false, n: -1 };
  };
  const off = await runThrough();
  must(off.n !== -1, "the run never ended");
  must(off.bonus === false, "the bonus round ran with the switch off");
  await closeSheets(page);
  // Back on, the same kind of run offers it.
  must(await page.evaluate(() => window.__app.set("elapsedOn", true)) === true, "the switch did not go back on");
  const on = await runThrough();
  must(on.bonus === true, `with the round on, a finished run did not offer it (${on.n} answers)`);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__app.go("home"));
  await page.waitForSelector('[data-probe="start"]');
  await openSettings(page);
  await page.evaluate(() => document.querySelector('[data-probe="elapsed-level-1"]')?.scrollIntoView({ block: "center" }));
});

await step("addition as dots: off by default, on shows green plus blue groups in place of the numbers", async () => {
  // Andy, 2026-09-03: "show addition problems as groups of different colored dots ... only addition".
  await goHome(page);
  await openSettings(page);
  must(await page.$('[data-probe="add-dots"][aria-pressed="false"]') !== null, "dots are on by default");
  await page.click('[data-probe="add-dots"]');
  await page.waitForTimeout(300);
  must(await page.evaluate(() => window.__app.meta().addDots) === true, "the switch did not persist");
  await page.evaluate(() => { const m = window.__app.meta(); m.animations = false; m.strands = { add: true, sub: false, mul: false, div: false }; m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 }; });
  await page.evaluate(() => window.__app.save());
  await goHome(page);
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"].dots', { timeout: 6000 });
  const d = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[data-probe="dot-group"]')];
    return { n: groups.length, counts: groups.map((g) => [Number(g.dataset.n), g.querySelectorAll("i").length]), fact: document.querySelector('[data-probe="problem"]').dataset.fact, digits: /\d/.test(document.querySelector('[data-probe="problem"]').textContent ?? "") };
  });
  must(d.n === 2, `${d.n} dot groups, wanted 2`);
  must(d.counts.every(([n, dots]) => n === dots), `the dots do not count the operands: ${JSON.stringify(d.counts)}`);
  const [a, b] = d.fact.replace("add:", "").split("+").map(Number);
  must(d.counts[0][0] + d.counts[1][0] === a + b, `the groups (${d.counts}) do not sum to the fact ${d.fact}`);
  must(!d.digits || (a === 0 || b === 0), "numerals show alongside the dots");
  // The answer still grades the same through the keypad.
  await answerN(page, 1);
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 8000 });
  await page.click('[data-probe="quit"]');
  await page.waitForSelector(".sheet");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(400);
  await closeSheets(page);
  must(await page.evaluate(() => window.__app.set("addDots", false)) === true, "the switch did not go back off");
  await goHome(page);
  await openSettings(page);
  await page.evaluate(() => document.querySelector('[data-probe="elapsed-level-1"]')?.scrollIntoView({ block: "center" }));
});

await step("the elapsed levels are one segmented control, and picking one persists", async () => {
  await goHome(page);
  await openSettings(page);
  must((await page.$$(".seg [data-probe^='elapsed-level-']")).length === 3, "the levels are not a segmented control");
  must(await page.getAttribute('[data-probe="elapsed-level-1"]', "aria-checked") === "true", "level 1 is not marked");
  // Scroll down to the control first: changing it must not throw the parent
  // back to the top of the list (Andy, 2026-09-02).
  await page.evaluate(() => document.querySelector('[data-probe="elapsed-level-3"]').scrollIntoView({ block: "center" }));
  await page.waitForTimeout(150);
  const scrollBefore = await page.evaluate(() => Math.max(window.scrollY, document.querySelector(".screen").scrollTop));
  must(scrollBefore > 100, `the settings list did not scroll (${scrollBefore})`);
  await page.click('[data-probe="elapsed-level-3"]');
  await page.waitForTimeout(350);
  const scrollAfter = await page.evaluate(() => Math.max(window.scrollY, document.querySelector(".screen").scrollTop));
  must(Math.abs(scrollAfter - scrollBefore) < 8, `changing a setting moved the scroll ${scrollBefore} -> ${scrollAfter}`);
  must(((await page.textContent('[data-probe="elapsed-hint"]')) ?? "").includes("level 3"), "the hint did not follow the pick");
  must(await page.getAttribute('[data-probe="elapsed-level-1"]', "aria-checked") === "false", "two levels read as chosen");
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().elapsedLevel) === 3, "the level did not persist");
});

await step("the analog view shows two clock faces and not a single digital time", async () => {
  await page.evaluate(() => { const m = window.__app.meta(); m.elapsedAnalog = true; m.animations = false; });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"], [data-probe="bonus"]');
  await page.evaluate(() => window.__probe.bonus());
  await page.waitForSelector(".bonus-analog", { timeout: 4000 });
  must((await page.$$(".bonus-analog .clock")).length === 2, "there are not two clock faces");
  const visible = (await page.textContent(".stage")) ?? "";
  must(!/\d{1,2}:\d{2}/.test(visible), `a digital time leaked into the analog view: "${visible.trim()}"`);
  const startL = await page.getAttribute('[data-probe="bonus"]', "data-start");
  const endL = await page.getAttribute('[data-probe="bonus"]', "data-end");
  const toMin = (l) => (Number(l.split(":")[0]) % 12) * 60 + Number(l.split(":")[1]);
  const mins = ((toMin(endL) - toMin(startL)) + 720) % 720;
  await typeAnswer(page, mins);
  await page.waitForTimeout(250);
  must(await page.$('[data-probe="retype"]') === null, `the analog answer ${mins} was graded wrong`);
});

await step("a cap is set from chips or the fine stepper, and keeps every problem inside it", async () => {
  await goHome(page);
  await openSettings(page);
  must(((await page.textContent('[data-probe="cap-add"]')) ?? "").includes("no limit"), "the cap does not default to no limit");
  await page.click('[data-probe="cap-add"]');
  await page.waitForSelector('[data-cap-chip="10"]', { timeout: 4000 });
  await page.click('[data-cap-chip="10"]');
  await page.waitForTimeout(200);
  // Then down to 6 on the fine stepper: Andy's own example.
  for (let i = 0; i < 4; i++) { await page.click('[data-probe="cap-add-minus"]'); await page.waitForTimeout(160); }
  must((await page.textContent('[data-probe="cap-add-value"]'))?.trim() === "6", "the stepper did not reach 6");
  await page.click(".sheet .btn.go"); // Done
  await page.waitForTimeout(300);
  must((await page.textContent('[data-probe="cap-add"]'))?.trim() === "6", `the chip reads "${await page.textContent('[data-probe="cap-add"]')}", wanted 6`);
  await page.reload({ waitUntil: "networkidle" });
  must(await page.evaluate(() => window.__app.meta().caps.add) === 6, "the cap did not persist");
  await page.evaluate(() => {
    const m = window.__app.meta();
    m.strands = { add: true, sub: false, mul: false, div: false };
    m.missing = { add: false, sub: false, mul: false, div: false, pct: 20 };
    m.animations = false;
    m.doseDay = window.__app.day(); m.doseCount = 0;
  });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector(".keypad:not(.asleep)", { timeout: 9000 });
    if (await page.$(".sheet") !== null) break;
    const id = await page.getAttribute('[data-probe="problem"]', "data-fact").catch(() => null);
    if (!id) break;
    must(id.startsWith("add:") && answerOf(id) <= 6, `${id} is outside the cap of 6`);
    await typeAnswer(page, answerOf(id));
    await page.waitForTimeout(120);
  }
  // Plus past the top returns to no limit; the No-limit chip does too.
  await goHome(page);
  await openSettings(page);
  await page.click('[data-probe="cap-add"]');
  await page.waitForSelector('[data-cap-chip="20"]', { timeout: 4000 });
  await page.click('[data-cap-chip="20"]');
  await page.waitForTimeout(150);
  await page.click('[data-probe="cap-add-plus"]');
  await page.waitForTimeout(150);
  must(((await page.textContent('[data-probe="cap-add-value"]')) ?? "").includes("no limit"), "plus past the top did not return to no limit");
  await page.click(".sheet .btn.go");
  await page.waitForTimeout(250);
  must(((await page.textContent('[data-probe="cap-add"]')) ?? "").includes("no limit"), "the chip did not follow");
});

await step("the tomorrow card runs the planner a day ahead", async () => {
  await page.click('[data-probe="tab-progress"]');
  await page.waitForSelector('[data-probe="tomorrow"]');
  const text = (await page.textContent('[data-probe="tomorrow"]')) ?? "";
  must(/\d+ due for review, \d+ new/.test(text), `tomorrow reads "${text}"`);
});

await done();
void pinIn; void calmMeta;

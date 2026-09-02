/**
 * PROBE: SETTINGS SYNC on the rider's device. A newer field in the cloud is
 * applied at boot through the real settings path (with its revive), said
 * out loud, and stamped so it is not pushed back; a local change goes up as
 * one stamped field; an older cloud field is ignored; a device with nothing
 * of its own is offered its record back.
 */
import { goHome, openSettings, saveNow, suite } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("sync");
const CODE = "ABCDEFGHJKMNPQRSTVWX";

let settingsDoc = { app: "trickline", version: 1, fields: {} };
const puts = [];
const record = { app: "trickline", version: 1, name: "KALLEN", device: "iPad", savedAt: new Date().toISOString(),
  meta: { version: 1, coins: 5, strands: { add: true, sub: true, mul: false, div: false }, caps: { add: null, sub: null, mul: null, div: null }, missing: { add: false, sub: false, mul: false, div: false, pct: 20 } },
  facts: { "add:2+3": { introduced: true, box: 2, dueOn: 1, masteryStreak: 0, lastRetrievedDay: null, mastered: false, seen: 2, correct: 2 } },
  responses: [{ factId: "add:2+3", day: 20000, at: 1_700_000_000_000, firstKeyMs: 900, submitMs: 2000, correct: true, answered: 5, cls: "retrieved", isRetry: false }],
  sessions: [{ id: "s1", day: 20000, startedAt: 1_700_000_000_000, endedAt: 1_700_000_300_000, items: 1, correct: 1, retrieved: 1, derived: 0, status: "complete", coins: 1 }] };

const route = (p) => p.route("**/math-pra3-cloudshare**", (r) => {
  const m = r.request().method();
  const url = r.request().url();
  if (url.endsWith("/settings")) {
    if (m === "GET") return r.fulfill({ status: Object.keys(settingsDoc.fields).length ? 200 : 404, contentType: "application/json", body: JSON.stringify(settingsDoc) });
    if (m === "PUT") {
      const body = JSON.parse(r.request().postData() ?? "{}");
      puts.push(body);
      // The worker's merge, imitated: later stamp wins per field.
      for (const [k, f] of Object.entries(body.fields ?? {})) {
        const have = settingsDoc.fields[k];
        if (!have || f.at > have.at || (f.at === have.at && f.by > have.by)) settingsDoc.fields[k] = f;
      }
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(settingsDoc) });
    }
  }
  if (m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(record) });
  return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
});
await route(page);

await step("a newer field in the cloud is applied at boot, with its revive, and said out loud", async () => {
  await page.waitForSelector('[data-probe="start"]');
  // Link the device, give it some data so no restore is offered, and put a
  // multiplication fact far overdue so the revive has something to do.
  await page.evaluate((code) => {
    localStorage.setItem("tl-cloud-code", code);
    const st = window.__app.states();
    st.set("add:2+3", { ...st.get("add:2+3"), introduced: true, seen: 2, correct: 2, box: 2, dueOn: 0 });
    st.set("mul:3x4", { ...st.get("mul:3x4"), introduced: true, seen: 3, correct: 3, box: 3, dueOn: 5 });
    return window.__app.save();
  }, CODE);
  settingsDoc = { app: "trickline", version: 1, fields: {
    strands: { v: { add: true, sub: true, mul: true, div: false }, at: Date.now(), by: "phone" },
    dailyGoal: { v: 30, at: Date.now(), by: "phone" },
  } };
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="start"]');
  await page.waitForFunction(() => window.__app.meta().strands.mul === true, null, { timeout: 8000 });
  const m = await page.evaluate(() => window.__app.meta());
  must(m.dailyGoal === 30, `the goal is ${m.dailyGoal}, wanted 30`);
  must(m.settingsStamps.strands.by === "phone", "the applied field did not adopt the remote stamp");
  // The revive: a multiplication fact overdue by weeks is due today, not by a term.
  const due = await page.evaluate(() => window.__app.states().get("mul:3x4").dueOn);
  must(due === await page.evaluate(() => window.__app.day()), `mul:3x4 is due on ${due}, not today`);
  const t = (await page.textContent('[data-probe="toast"]').catch(() => "")) ?? "";
  must(t.includes("grown-ups' page") && t.includes("multiplication") && t.includes("30 problems"), `the toast reads "${t}"`);
  // Nothing was pushed back: the device adopted the stamps, it did not claim them.
  must(puts.length === 0, `${puts.length} pushes went up on an apply`);
});

await step("a change made on this device goes up as one stamped field", async () => {
  await openSettings(page);
  await page.click('[data-probe="speed-limit-plus"]');
  await page.waitForTimeout(500);
  const last = puts[puts.length - 1];
  must(last !== undefined && last.fields.speedLimit?.v === 11, `the push was ${JSON.stringify(last)}`);
  must(Object.keys(last.fields).length === 1, "more than the changed field went up");
  must(typeof last.fields.speedLimit.at === "number" && last.fields.speedLimit.by.startsWith("d"), "the field is not stamped by this device");
  const m = await page.evaluate(() => window.__app.meta());
  must(m.settingsStamps.speedLimit.by === last.fields.speedLimit.by, "the local stamp does not match the pushed one");
});

await step("an older cloud field never overrides a newer local one", async () => {
  settingsDoc.fields.speedLimit = { v: 3, at: 1, by: "phone" };
  const changed = await page.evaluate(() => window.__sync.pull());
  must(Array.isArray(changed) && changed.length === 0, `an older field was applied: ${JSON.stringify(changed)}`);
  must(await page.evaluate(() => window.__app.meta().speedLimit) === 11, "an older cloud stamp overrode the local change");
});

await step("a device with nothing of its own is offered its record back", async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const p2 = await ctx2.newPage();
  await route(p2);
  await p2.goto(page.url().split("?")[0].replace(/\/[^/]*$/, "/"), { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="start"]');
  must(await p2.$(".sheet") === null, "a fresh unlinked device was offered a restore");
  await p2.evaluate((code) => localStorage.setItem("tl-cloud-code", code), CODE);
  await p2.reload({ waitUntil: "networkidle" });
  await p2.waitForSelector(".sheet", { timeout: 8000 });
  const text = (await p2.textContent(".sheet")) ?? "";
  must(text.includes("Restore from the cloud") && text.includes("KALLEN"), `the offer reads "${text.slice(0, 80)}"`);
  await p2.click(".sheet .btn.go"); // Restore
  await p2.waitForSelector('[data-probe="start"]', { timeout: 10000 });
  await p2.waitForFunction(() => window.__app.meta().coins === 5, null, { timeout: 8000 });
  const t = (await p2.textContent('[data-probe="toast"]').catch(() => "")) ?? "";
  must(t.includes("Restored") && t.includes("KALLEN"), `the restore toast reads "${t}"`);
  await ctx2.close();
});

await goHome(page);
await saveNow(page);
await done();

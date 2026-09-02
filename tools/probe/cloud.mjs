/**
 * PROBE: CLOUD AND RIDERS. The share code, the throttled auto-push, VIEWER
 * MODE on a device with nothing of its own, and profiles: add, pick at
 * launch, isolated data, remove.
 */
import { closeSheets, goHome, openSettings, pinIn, saveNow, suite } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("cloud");

/** A believable cloud envelope for a rider called KALLEN with a week of work. */
const fakeBackup = () => {
  const facts = {};
  const responses = [];
  const day = 20_000;
  for (let i = 0; i < 12; i++) {
    const id = `add:${i % 6}+${5 + (i % 5)}`;
    facts[id] = { introduced: true, box: 4, dueOn: day + 8, masteryStreak: 3, lastRetrievedDay: day, mastered: i < 6, seen: 4, correct: 4 };
    responses.push({ factId: id, day, at: 1_700_000_000_000 + i * 1000, firstKeyMs: 900 + i * 50, submitMs: 2000, correct: true, answered: 1, cls: "retrieved", isRetry: false, ...(i < 3 ? { cold: true } : {}) });
  }
  return {
    app: "trickline", version: 1, exportedAt: new Date().toISOString(), name: "KALLEN",
    device: "iPad", savedAt: new Date().toISOString(),
    meta: { version: 1, coins: 321, owned: ["grindjaw"], strands: { add: true, sub: true, mul: false, div: false }, caps: { add: null, sub: null, mul: null, div: null }, missing: { add: false, sub: false, mul: false, div: false, pct: 20 } },
    facts, responses,
    sessions: [{ id: "s1", day, startedAt: 1_700_000_000_000, endedAt: 1_700_000_400_000, items: 12, correct: 12, retrieved: 12, derived: 0, status: "complete", coins: 15 }],
  };
};

await step("cloud share: create, QR, save-now, and the throttled auto-push", async () => {
  let puts = 0;
  await page.route("**/math-pra3-cloudshare**", (route) => {
    const m = route.request().method();
    if (m === "PUT") { puts += 1; void route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); }
    else if (m === "GET") void route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"nothing"}' });
    else void route.fulfill({ status: 204, body: "" });
  });
  await page.waitForSelector('[data-probe="start"]');
  await openSettings(page);
  await page.waitForSelector('[data-probe="cloud-create"]', { timeout: 6000 });
  await page.click('[data-probe="cloud-create"]');
  await page.waitForSelector('[data-probe="cloud-qr"]', { timeout: 6000 });
  must(puts === 1, `creating pushed ${puts} times, wanted 1`);
  const codeText = (await page.textContent('[data-probe="cloud-code"]')) ?? "";
  must(codeText.startsWith("MATH-PRA3-"), `the code reads "${codeText.slice(0, 14)}…", wanted the MATH-PRA3 prefix`);
  must(await page.evaluate(() => localStorage.getItem("tl-cloud-code") !== null), "the device did not remember its code");
  await page.click('[data-probe="cloud-save-now"]');
  await page.waitForTimeout(600);
  must(puts >= 2, "save-now did not push");
  await page.evaluate(() => { window.__app.go("home"); });
  await page.waitForTimeout(200);
  await page.click('[data-probe="anim-toggle"]');
  await page.waitForTimeout(400);
  const pending = await page.evaluate(() => window.__cloud.pending());
  must(pending === true || puts >= 3, "an in-throttle save neither pushed nor booked a trailing push");
  await page.click('[data-probe="anim-toggle"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.removeItem("tl-cloud-code"));
  await page.unroute("**/math-pra3-cloudshare**");
});

await step("viewer mode: a device with nothing of its own shows the cloud copy, read-only", async () => {
  // A brand new device: fresh context, no practice, no code.
  const ctx2 = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const p2 = await ctx2.newPage();
  const errs = [];
  p2.on("pageerror", (e) => errs.push(String(e)));
  await p2.route("**/math-pra3-cloudshare**", (route) => {
    const m = route.request().method();
    if (m === "GET") void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeBackup()) });
    else void route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  const base = page.url().split("?")[0].replace(/\/[^/]*$/, "/");
  await p2.goto(base, { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="start"]');
  await pinIn(p2);
  // With nothing here, the report says so and points at the code.
  must(await p2.$('[data-probe="dash-empty"]') !== null, "an empty device does not say it is empty");
  await p2.click('[data-probe="empty-connect"]');
  await p2.waitForSelector('[data-probe="cloud-card"]', { timeout: 4000 });
  await p2.click('[data-probe="cloud-card"] .btn:not(.alt)'); // Connect a code
  await p2.waitForSelector(".cloud-input", { timeout: 4000 });
  await p2.fill(".cloud-input", "MATH-PRA3-ABCDE-FGHJK-MNPQR-STVWX");
  await p2.click('[data-probe="cloud-connect"]');
  await p2.waitForSelector(".sheet", { timeout: 6000 });
  const offer = (await p2.textContent(".sheet")) ?? "";
  must(offer.includes("KALLEN"), "the connect sheet does not say whose record it is");
  must(offer.includes("Just view"), "no way to view without loading");
  await p2.click(".sheet .btn.ghost"); // Just view
  await p2.waitForSelector('[data-probe="viewer-banner"]', { timeout: 6000 });
  const banner = (await p2.textContent('[data-probe="viewer-banner"]')) ?? "";
  must(banner.includes("KALLEN") && banner.includes("Read only"), `the banner reads "${banner}"`);
  // It SAYS it connected, and the "asking" note is gone with the form.
  const t1 = (await p2.textContent('[data-probe="toast"]').catch(() => "")) ?? "";
  must(t1.includes("Connected") && t1.includes("KALLEN") && t1.includes("1 session"), `the connect toast reads "${t1}"`);
  must(await p2.$(".note.warn:not(:empty)") === null || !((await p2.textContent(".note.warn")) ?? "").includes("Asking"), "the asking note lingered");
  // REFRESH: an icon, a busy state, and a verdict: already the latest.
  must(await p2.$('[data-probe="viewer-refresh"] svg') !== null, "the refresh button has no icon");
  await p2.waitForTimeout(3000); // let the connect toast go
  await p2.click('[data-probe="viewer-refresh"]');
  await p2.waitForSelector('[data-probe="toast"]', { timeout: 6000 });
  const t2 = (await p2.textContent('[data-probe="toast"]')) ?? "";
  must(t2.includes("Already the latest"), `refreshing unchanged data said "${t2}"`);
  // The cloud moves on: two more sessions saved later. Refresh must say so.
  await p2.unroute("**/math-pra3-cloudshare**");
  await p2.route("**/math-pra3-cloudshare**", (route) => {
    const b = fakeBackup();
    b.savedAt = new Date(Date.now() + 60_000).toISOString();
    b.sessions.push({ ...b.sessions[0], id: "s2" }, { ...b.sessions[0], id: "s3" });
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  });
  await p2.waitForTimeout(3000);
  await p2.click('[data-probe="viewer-refresh"]');
  await p2.waitForSelector('[data-probe="toast"]', { timeout: 6000 });
  const t3 = (await p2.textContent('[data-probe="toast"]')) ?? "";
  must(t3.includes("Updated") && t3.includes("2 new sessions"), `refreshing changed data said "${t3}"`);
  await p2.unroute("**/math-pra3-cloudshare**");
  await p2.route("**/math-pra3-cloudshare**", (route) => {
    const m = route.request().method();
    if (m === "GET") void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeBackup()) });
    else void route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  // The report is drawn from the cloud copy, not this empty device.
  const text = (await p2.textContent('[data-probe="progress-tab"]')) ?? "";
  must(text.includes("Of 12 correct answers"), "the headline is not the cloud copy's");
  must(await p2.$('[data-probe="cold-empty"]') === null, "the cloud copy's cold series did not draw");
  must(text.includes("Latest: 100% from memory on 3 cold items"), "the cold figure is not the cloud copy's");
  // This device's own data was never touched.
  must(await p2.evaluate(() => window.__app.meta().coins) === 0, "viewing loaded the copy over this device");
  // A refresh re-reads; and on the next visit the viewer comes up by itself.
  await p2.click('[data-probe="viewer-refresh"]');
  await p2.waitForSelector('[data-probe="viewer-banner"]', { timeout: 6000 });
  await p2.reload({ waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="start"]');
  await pinIn(p2);
  await p2.waitForSelector('[data-probe="viewer-banner"]', { timeout: 6000 });
  must(await p2.$('[data-probe="viewer-exit"]') === null, "an empty device offers to show its own nothing");
  // Settings still belong to this device: the cloud card is reachable to disconnect.
  await p2.click('[data-probe="tab-settings"]');
  await p2.waitForSelector('[data-probe="cloud-card"]', { timeout: 4000 });
  must(((await p2.textContent('[data-probe="cloud-code"]')) ?? "").includes("MATH-PRA3-ABCDE"), "the linked code is not shown");
  if (errs.length > 0) throw new Error(`page errors: ${errs.slice(0, 2).join(" | ")}`);
  await ctx2.close();
});

await step("the View button opens the cloud copy on a device that has its own data too", async () => {
  await page.route("**/math-pra3-cloudshare**", (route) => {
    const m = route.request().method();
    if (m === "GET") void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeBackup()) });
    else void route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await goHome(page);
  // Give this device some data of its own, so the viewer must be explicit.
  await page.evaluate(() => { const st = window.__app.states(); const id = [...st.keys()][0]; st.set(id, { ...st.get(id), introduced: true, seen: 1 }); });
  await saveNow(page);
  await page.evaluate(() => localStorage.setItem("tl-cloud-code", "ABCDEFGHJKMNPQRSTVWX"));
  await openSettings(page);
  await page.waitForSelector('[data-probe="cloud-view"]', { timeout: 6000 });
  await page.click('[data-probe="cloud-view"]');
  await page.waitForSelector('[data-probe="viewer-banner"]', { timeout: 6000 });
  must(await page.$('[data-probe="viewer-exit"]') !== null, "no way back to this device's own report");
  await page.click('[data-probe="viewer-exit"]');
  // The old pane stays mounted while the report re-reads the store; judge
  // the banner's DEPARTURE, not a snapshot taken mid-fetch.
  await page.waitForSelector('[data-probe="viewer-banner"]', { state: "detached", timeout: 6000 });
  await page.waitForSelector('[data-probe="progress-tab"]', { timeout: 6000 });
  must(await page.$('[data-probe="viewer-banner"]') === null, "the banner stayed after exiting the viewer");
  await page.evaluate(() => localStorage.removeItem("tl-cloud-code"));
  await page.unroute("**/math-pra3-cloudshare**");
});

await step("riders: a second profile is added, picked at launch, and keeps its own data", async () => {
  await goHome(page);
  await page.evaluate(() => { window.__app.meta().coins = 777; });
  await saveNow(page);
  await openSettings(page);
  must(await page.$('[data-probe="riders-card"]') !== null, "no riders card");
  must(await page.$('[data-probe="switch-rider"]') === null, "a switch button with one rider");
  page.once("dialog", (d) => d.accept("Maya"));
  await page.click('[data-probe="add-rider"]');
  await page.waitForTimeout(400);
  const reg = await page.evaluate(() => window.__app.registry());
  must(reg.profiles.length === 2 && reg.profiles[1].name === "MAYA", `registry holds ${JSON.stringify(reg.profiles.map((p) => p.name))}`);
  must(await page.$('[data-probe="switch-rider"]') !== null, "no switch button with two riders");
  // The rename and remove controls exist for each.
  must((await page.$$("[data-rename]")).length === 2 && (await page.$$("[data-remove]")).length === 2, "rider rows are missing controls");
  // Next launch asks who is riding.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="profile-grid"]', { timeout: 6000 });
  must((await page.$$(".profile-tile")).length === 2, "the picker does not show both riders");
  await page.waitForSelector(".profile-tile .profile-art", { timeout: 4000 });
  const mayaId = reg.profiles[1].id;
  await page.click(`[data-profile="${mayaId}"]`);
  await page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
  must(await page.evaluate(() => window.__app.profile().name) === "MAYA", "the pick did not switch riders");
  must(await page.evaluate(() => window.__app.meta().coins) === 0, "MAYA inherited the first rider's coins");
  must(((await page.textContent('[data-probe="name-chip"]')) ?? "").includes("MAYA"), "home does not say who is riding");
  // The first rider's data is untouched, and the PIN still opens without being set again.
  await page.click('[data-probe="grownups"]');
  await page.waitForSelector(".pinpad");
  must(!((await page.textContent("h2")) ?? "").toLowerCase().includes("set"), "the PIN was asked to be set again for a second rider");
  for (const d of ["1", "3", "5", "7"]) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-probe="tab-progress"]', { timeout: 6000 });
  await page.click('[data-probe="tab-settings"]');
  await page.waitForSelector('[data-probe="settings-tab"]');
  await page.click(`[data-remove="${mayaId}"]`);
  await page.waitForSelector(".sheet .btn.warm", { timeout: 4000 });
  await page.click(".sheet .btn.warm");
  await page.waitForTimeout(1500);
  await page.waitForSelector('[data-probe="start"], [data-probe="profile-grid"]', { timeout: 8000 });
  await closeSheets(page);
  const after = await page.evaluate(() => window.__app.registry());
  must(after.profiles.length === 1, "the rider was not removed");
  must(await page.evaluate(() => window.__app.meta().coins) === 777, "the first rider's coins did not survive the second rider");
});

await done();

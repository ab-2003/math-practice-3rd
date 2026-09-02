/**
 * LOOP-EYE: the parent-and-player data loop, proven in every direction.
 *
 * Several browser contexts play the devices: the rider's iPad (and a second
 * rider on it), a viewer iPad, a parent phone, a teacher laptop. They all
 * talk to ONE in-memory cloud that runs the worker's production request
 * handling (cloudshare/logic.ts), so the merge under test is the merge that
 * ships. Each of the seven synced settings crosses in both directions;
 * conflicts resolve the same way from every side; an offline change heals;
 * restore is offered once; nothing the door does ever writes the record;
 * nothing that must not sync ever does.
 *
 *   BASE=http://localhost:8350 npx vite-node tools/loop-eye.ts
 */
import { chromium, type BrowserContext, type Page, type Route } from "playwright";
import { handle, MemKV, FUTURE_GRACE_MS } from "../cloudshare/logic";
import { SYNCED_KEYS, type Fields, type SyncKey } from "../src/core/sync";

const BASE = (process.env["BASE"] ?? "http://localhost:8050").replace(/\/$/, "");
const CODE = "ABCDEFGHJKMNPQRSTVWX";
const CODE2 = "BBBBBBBBBBBBBBBBBBBB";

// ---- the cloud: one store, the production handler, a request ledger --------
const kv = new MemKV();
const offline = new Set<BrowserContext>();
const ledger: Array<{ role: string; method: string; path: string }> = [];
const cloudRoute = (role: string, ctx: BrowserContext) => async (route: Route): Promise<void> => {
  if (offline.has(ctx)) { await route.abort("internetdisconnected"); return; }
  const req = route.request();
  const url = new URL(req.url());
  ledger.push({ role, method: req.method(), path: url.pathname });
  if (req.method() === "OPTIONS") { await route.fulfill({ status: 204 }); return; }
  const res = await handle({ method: req.method(), path: url.pathname, body: req.postData() ?? "" }, kv);
  await route.fulfill({ status: res.status, contentType: "application/json", body: res.body ?? "" });
};
const settingsDoc = (code = CODE): Fields => { const raw = kv.map.get(`${code}:settings`); return raw ? (JSON.parse(raw) as { fields: Fields }).fields : {}; };
const record = (code = CODE): { meta: Record<string, unknown> } | null => { const raw = kv.map.get(code); return raw ? (JSON.parse(raw) as { meta: Record<string, unknown> }) : null; };

// ---- the harness --------------------------------------------------------------
let failed = 0;
const ok = (m: string): void => { console.log(`  ok  ${m}`); };
const fail = (m: string): void => { console.error(`FAIL ${m}`); failed += 1; };
let watch: Page | null = null; // the page a failing step should describe
const step = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try { await fn(); ok(label); } catch (e) {
    let extra = "";
    if (watch !== null) {
      try {
        const seen = await watch.evaluate(() => ({ sheet: document.querySelector(".sheet")?.textContent?.slice(0, 80) ?? null, toasts: [...document.querySelectorAll(".toast")].map((t) => t.textContent), url: location.href }));
        extra = ` | page: ${JSON.stringify(seen)} | cloud: ${JSON.stringify(ledger.slice(-4))}`;
      } catch { /* the page may be gone */ }
    }
    fail(`${label}: ${String(e).split("\n")[0]}${extra}`);
  }
};
const must = (cond: boolean, msg: string): void => { if (!cond) throw new Error(msg); };
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const browser = await chromium.launch();
interface Device { role: string; ctx: BrowserContext; page: Page }
const device = async (role: string, path = "/"): Promise<Device> => {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  await ctx.route("**/math-pra3-cloudshare**", cloudRoute(role, ctx));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`${role}: page error ${e.message}`));
  page.on("dialog", (d) => { void d.accept("MAYA"); });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  return { role, ctx, page };
};

// Browser-side hooks, typed loosely: they are the app's probe surface.
type Hooks = {
  __app: { meta: () => Record<string, unknown> & { settingsStamps: Record<string, { at: number; by: string }> }; states: () => Map<string, Record<string, unknown>>; day: () => number; save: () => Promise<void>; set: (k: string, v: unknown) => Promise<boolean>; registry: () => { profiles: Array<{ id: string; name: string }>; pin: string | null }; profile: () => { id: string } };
  __sync: { pull: () => Promise<string[]> };
  __cloud: { pushNow: () => Promise<boolean> };
  __parent: { settings: () => Fields | null };
};
const hooks = (page: Page) => ({
  meta: () => page.evaluate(() => (window as unknown as Hooks).__app.meta()),
  set: (k: SyncKey, v: unknown) => page.evaluate(([kk, vv]) => (window as unknown as Hooks).__app.set(kk, vv), [k, v] as const),
  pull: () => page.evaluate(() => (window as unknown as Hooks).__sync.pull()),
  pushNow: () => page.evaluate(() => (window as unknown as Hooks).__cloud.pushNow()),
  running: () => page.evaluate(() => {
    const m = (window as unknown as Hooks).__app.meta();
    return { strands: m["strands"], caps: m["caps"], missing: m["missing"], dailyGoal: m["dailyGoal"], speedLimit: m["speedLimit"], elapsedLevel: m["elapsedLevel"], elapsedAnalog: m["elapsedAnalog"] } as Record<SyncKey, unknown>;
  }),
  deviceId: () => page.evaluate(() => localStorage.getItem("tl-device-id")),
});

const PIN = ["1", "3", "5", "7"];
const pinIn = async (page: Page): Promise<void> => {
  await page.click('[data-probe="grownups"]');
  await page.waitForSelector(".pinpad");
  for (const d of PIN) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.waitForSelector('[data-probe="tab-progress"]', { timeout: 8000 });
};
const toasts = (page: Page): Promise<string[]> => page.$$eval('[data-probe="toast"]', (els) => els.map((e) => e.textContent ?? ""));

/** Seed the rider with practice, link the code, push the record. The save
 *  itself schedules a push; wait for the record to LAND rather than for the
 *  call to return, or the first check races the flight. */
const seedRider = async (d: Device, code = CODE): Promise<void> => {
  await d.page.waitForSelector('[data-probe="start"]');
  await d.page.evaluate((c) => {
    localStorage.setItem("tl-cloud-code", c);
    localStorage.setItem("tl-cloud-role", "owner"); // the rider's own device
    const h = window as unknown as Hooks;
    const st = h.__app.states();
    for (const id of ["add:2+3", "add:4+5", "sub:9-4"]) st.set(id, { ...st.get(id)!, introduced: true, seen: 3, correct: 3, box: 3, dueOn: 0 });
    h.__app.meta()["coins"] = 77;
  }, code);
  await d.page.evaluate(() => (window as unknown as Hooks).__app.save());
  for (let i = 0; i < 40 && record(code) === null; i++) { await hooks(d.page).pushNow(); await d.page.waitForTimeout(150); }
};
/** A record push that is really there before we look. */
const mirror = async (d: Device): Promise<void> => {
  const before = kv.map.get(CODE);
  for (let i = 0; i < 40; i++) {
    await hooks(d.page).pushNow();
    await d.page.waitForTimeout(120);
    if (kv.map.get(CODE) !== before) return;
  }
};

/** The door connects to a code and lands on the record. */
const doorConnect = async (d: Device, code = CODE): Promise<void> => {
  await d.page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
  await d.page.fill(".cloud-input", code);
  await d.page.click('[data-probe="cloud-connect"]');
  await d.page.waitForSelector('[data-probe="parent-view"]', { timeout: 8000 });
};
const doorTab = async (d: Device, tab: "progress" | "trends" | "settings"): Promise<void> => {
  await d.page.click(`[data-probe="tab-${tab}"]`);
  await d.page.waitForSelector(`[data-probe="${tab}-tab"]`, { timeout: 6000 });
};
const doorRefresh = async (d: Device): Promise<void> => {
  await d.page.click('[data-probe="viewer-refresh"]');
  await d.page.waitForFunction(() => (document.querySelector('[data-probe="viewer-refresh"]')?.textContent ?? "").includes("Refresh") && !document.querySelector('[data-probe="viewer-refresh"].busy'), null, { timeout: 8000 });
  await d.page.waitForTimeout(150);
};
const doorPending = async (d: Device): Promise<string | null> => {
  await doorTab(d, "settings");
  return d.page.$eval('[data-probe="settings-pending"]', (e) => e.textContent).catch(() => null);
};
/** Set a field from the door's own controls. */
const doorSet = async (d: Device, key: SyncKey): Promise<void> => {
  await doorTab(d, "settings");
  const p = d.page;
  switch (key) {
    case "strands": await p.click('[data-strand="mul"]'); break;
    case "missing": await p.click('[data-missing="add"]'); break;
    case "caps": await p.click('[data-probe="cap-add"]'); await p.waitForSelector('[data-cap-chip="10"]'); await p.click('[data-cap-chip="10"]'); await p.waitForTimeout(150); await p.click(".sheet .btn.go"); break;
    case "dailyGoal": await p.click('[data-probe="dose-goal-minus"]'); break;
    case "speedLimit": await p.click('[data-probe="speed-limit-minus"]'); break;
    case "elapsedLevel": await p.click('[data-probe="elapsed-level-2"]'); break;
    case "elapsedAnalog": await p.click('[data-probe="elapsed-analog"]'); break;
  }
  await p.waitForTimeout(400);
};
/** What doorSet should have produced, given the rider's defaults. */
const doorExpect: Record<SyncKey, unknown> = {
  strands: { add: true, sub: true, mul: true, div: false },
  missing: { add: true, sub: false, mul: false, div: false, pct: 20 },
  caps: { add: 10, sub: null, mul: null, div: null },
  dailyGoal: 35, speedLimit: 9, elapsedLevel: 2, elapsedAnalog: true,
};
/** A second, different value per field, for the rider's own changes. */
const riderValues: Record<SyncKey, unknown> = {
  strands: { add: true, sub: false, mul: true, div: false },
  missing: { add: true, sub: true, mul: false, div: false, pct: 30 },
  caps: { add: 12, sub: 10, mul: null, div: null },
  dailyGoal: 55, speedLimit: 4, elapsedLevel: 3, elapsedAnalog: false,
};

// =============================================================================
const rider = await device("rider");
await step("A. the rider's device mirrors its record to the cloud", async () => {
  await seedRider(rider);
  must(record() !== null, "no record in the cloud after a push");
  must(record()!.meta["coins"] === 77, "the record does not carry the rider's coins");
});

const phone = await device("phone", "/parent/");
await step("B. the door reads the record, and never writes it", async () => {
  await doorConnect(phone);
  const text = (await phone.page.textContent('[data-probe="progress-tab"]')) ?? "";
  must(text.includes("The headline"), "the door did not draw the report");
  must(!ledger.some((l) => l.role === "phone" && l.method === "PUT" && !l.path.endsWith("/settings")), "the door PUT the record");
});

await step("C. every synced field set on the door reaches the device, is said, and reads as running", async () => {
  for (const key of SYNCED_KEYS) {
    await doorSet(phone, key);
    const f = settingsDoc()[key];
    must(f !== undefined && eq(f.v, doorExpect[key]), `${key}: the cloud holds ${JSON.stringify(f)}`);
    must(typeof f!.by === "string" && f!.by !== "", `${key}: no device on the stamp`);
    const pend = await doorPending(phone);
    must(pend !== null, `${key}: the door does not say it is waiting`);
    const changed = await hooks(rider.page).pull();
    must(changed.includes(key), `${key}: the device did not apply it (applied ${JSON.stringify(changed)})`);
    const run = await hooks(rider.page).running();
    must(eq(run[key], doorExpect[key]), `${key}: the device runs ${JSON.stringify(run[key])}`);
    const stamps = (await hooks(rider.page).meta()).settingsStamps;
    must(stamps[key]?.by === f!.by, `${key}: the device did not adopt the door's stamp`);
    const ts = await toasts(rider.page);
    must(ts.some((t) => t.includes("grown-ups' page")), `${key}: no toast on the device (${JSON.stringify(ts)})`);
    await mirror(rider);
    await doorRefresh(phone);
    must((await doorPending(phone)) === null, `${key}: still waiting after the device mirrored`);
  }
});

await step("D. every synced field set on the device reaches the door as running, with the device's stamp", async () => {
  for (const key of SYNCED_KEYS) {
    const changed = await hooks(rider.page).set(key, riderValues[key]);
    must(changed === true, `${key}: the device refused its own change`);
    await rider.page.waitForTimeout(250);
    const id = await hooks(rider.page).deviceId(); // minted on the first local stamp
    const f = settingsDoc()[key];
    must(f !== undefined && eq(f.v, riderValues[key]) && f.by === id, `${key}: the cloud holds ${JSON.stringify(f)}, device ${id}`);
    await mirror(rider);
    await doorRefresh(phone);
    must((await doorPending(phone)) === null, `${key}: the door thinks it is waiting`);
    const shown = await phone.page.evaluate(() => (window as unknown as Hooks).__parent.settings());
    must(shown !== null && eq(shown[key]?.v, riderValues[key]), `${key}: the door shows ${JSON.stringify(shown?.[key])}`);
  }
});

await step("E. the same field changed on both sides: the later change wins everywhere, in both orders", async () => {
  await doorTab(phone, "settings");
  await phone.page.click('[data-probe="dose-goal-minus"]'); // door first: 55 -> 50
  await phone.page.waitForTimeout(300);
  await hooks(rider.page).set("dailyGoal", 60); // device later
  await rider.page.waitForTimeout(250);
  must(settingsDoc()["dailyGoal"]?.v === 60, "the device's later change did not win in the cloud");
  must((await hooks(rider.page).pull()).length === 0, "the device took back an older value");
  await mirror(rider);
  await doorRefresh(phone);
  must((await doorPending(phone)) === null && (await hooks(rider.page).running())["dailyGoal"] === 60, "the door and the device disagree after the device won");
  // Reverse: device first, door later. The door steps from the value IT last
  // saw, so the expectation is whatever it wrote, read back from the cloud.
  await hooks(rider.page).set("dailyGoal", 70);
  await rider.page.waitForTimeout(300);
  await doorTab(phone, "settings");
  await phone.page.click('[data-probe="dose-goal-plus"]');
  await phone.page.waitForTimeout(300);
  const wrote = settingsDoc()["dailyGoal"]!;
  must(wrote.v !== 70 && wrote.at > (await hooks(rider.page).meta()).settingsStamps["dailyGoal"]!.at, `the door's write did not land later (${JSON.stringify(wrote)})`);
  const changed = await hooks(rider.page).pull();
  must(changed.includes("dailyGoal") && (await hooks(rider.page).running())["dailyGoal"] === wrote.v, "the door's later change did not win on the device");
});

await step("F. equal stamps break by device id the same way on both sides", async () => {
  const stamps = (await hooks(rider.page).meta()).settingsStamps;
  const at = stamps["speedLimit"]!.at;
  const id = (await hooks(rider.page).deviceId())!;
  const running = (await hooks(rider.page).running())["speedLimit"] as number;
  const above = { app: "trickline", version: 1, fields: { speedLimit: { v: running === 9 ? 8 : 9, at, by: "zzzz" } } };
  await handle({ method: "PUT", path: `/v1/share/${CODE}/settings`, body: JSON.stringify(above) }, kv);
  must((await hooks(rider.page).pull()).includes("speedLimit"), `a tie broken by a higher device id ("zzzz" > "${id}") was not applied`);
  const below = { app: "trickline", version: 1, fields: { elapsedLevel: { v: 1, at: stamps["elapsedLevel"]!.at, by: "0000" } } };
  await handle({ method: "PUT", path: `/v1/share/${CODE}/settings`, body: JSON.stringify(below) }, kv);
  must(!(await hooks(rider.page).pull()).includes("elapsedLevel"), "a tie broken by a lower device id was applied");
  must(settingsDoc()["elapsedLevel"]?.by === id, "the cloud did not settle on the device's own field after the tie");
});

await step("G. an older stamp arriving late is ignored, and the cloud heals to the newer value", async () => {
  const stamps = (await hooks(rider.page).meta()).settingsStamps;
  const local = (await hooks(rider.page).running())["elapsedAnalog"] as boolean;
  const stale = { app: "trickline", version: 1, fields: { elapsedAnalog: { v: !local, at: stamps["elapsedAnalog"]!.at - 1000, by: "phone" } } };
  kv.map.set(`${CODE}:settings`, JSON.stringify({ app: "trickline", version: 1, fields: { ...settingsDoc(), ...stale.fields } }));
  const changed = await hooks(rider.page).pull();
  must(!changed.includes("elapsedAnalog"), "a stale field was applied");
  const healed = settingsDoc()["elapsedAnalog"];
  must(healed !== undefined && healed.v === local && healed.at === stamps["elapsedAnalog"]!.at, "the cloud kept the stale field after the device pulled");
});

await step("H. a clock in the future is clamped by the worker", async () => {
  const now = Date.now();
  const res = await handle({ method: "PUT", path: `/v1/share/${CODE}/settings`, body: JSON.stringify({ app: "trickline", version: 1, fields: { speedLimit: { v: 2, at: now + 365 * 86_400_000, by: "wrong" } } }) }, kv, now);
  const f = (JSON.parse(res.body!) as { fields: Fields }).fields["speedLimit"]!;
  must(f.at <= now + FUTURE_GRACE_MS, `a future stamp survived: ${f.at - now}ms ahead`);
  // Bring speedLimit back under the device's control for the steps below.
  await hooks(rider.page).set("speedLimit", 6);
});

const laptop = await device("laptop", "/parent/");
await step("I. two doors editing different fields converge, and both see both", async () => {
  await doorConnect(laptop);
  await doorTab(phone, "settings");
  await phone.page.click('[data-probe="dose-goal-minus"]');
  await phone.page.waitForTimeout(300);
  await doorTab(laptop, "settings");
  await laptop.page.click('[data-probe="speed-limit-plus"]');
  await laptop.page.waitForTimeout(300);
  const doc = settingsDoc();
  must(doc["dailyGoal"]?.by !== doc["speedLimit"]?.by, "the two doors share a device id");
  await doorRefresh(phone);
  const seen = await phone.page.evaluate(() => (window as unknown as Hooks).__parent.settings());
  must(seen !== null && eq(seen["speedLimit"]?.v, doc["speedLimit"]!.v), "the phone did not see the laptop's field");
  const changed = await hooks(rider.page).pull();
  must(changed.includes("dailyGoal") && changed.includes("speedLimit"), `the device applied ${JSON.stringify(changed)}`);
});

await step("J. a change made offline heals when the device comes back, and the door stops waiting", async () => {
  offline.add(rider.ctx);
  await hooks(rider.page).set("elapsedLevel", 1); // the push fails silently
  await rider.page.waitForTimeout(300);
  must(settingsDoc()["elapsedLevel"]?.v !== 1, "an offline push reached the cloud");
  offline.delete(rider.ctx);
  await hooks(rider.page).pull();
  must(settingsDoc()["elapsedLevel"]?.v === 1, "the offline change never healed into the cloud");
  await mirror(rider);
  await doorRefresh(phone);
  must((await doorPending(phone)) === null, "the door is still waiting after the heal");
});

await step("K. a device with nothing of its own is offered its record once, and remembers a decline", async () => {
  const fresh = await device("fresh-decline");
  watch = fresh.page;
  await fresh.page.waitForSelector('[data-probe="start"]');
  must(await fresh.page.$(".sheet") === null, "an unlinked device was offered a restore");
  await fresh.page.evaluate((c) => localStorage.setItem("tl-cloud-code", c), CODE);
  await fresh.page.reload({ waitUntil: "networkidle" });
  await fresh.page.waitForSelector(".sheet", { timeout: 8000 });
  await fresh.page.click(".sheet .btn.ghost"); // Start fresh
  await fresh.page.reload({ waitUntil: "networkidle" });
  await fresh.page.waitForSelector('[data-probe="start"]');
  await fresh.page.waitForTimeout(800);
  must(await fresh.page.$(".sheet") === null, "a declined restore was offered again");
  await fresh.ctx.close();
  const again = await device("fresh-restore");
  watch = again.page;
  await again.page.evaluate((c) => localStorage.setItem("tl-cloud-code", c), CODE);
  await again.page.reload({ waitUntil: "networkidle" });
  await again.page.waitForSelector(".sheet", { timeout: 8000 });
  await again.page.click(".sheet .btn.go"); // Restore
  await again.page.waitForFunction(() => (window as unknown as Hooks).__app.meta()["coins"] === 77, null, { timeout: 10000 });
  await again.ctx.close();
});

await step("L. erasing everything forgets the code, so a fresh start is not offered its past", async () => {
  const wipe = await device("wipe");
  await seedRider(wipe);
  await pinIn(wipe.page);
  await wipe.page.click('[data-probe="tab-settings"]');
  await wipe.page.waitForSelector('[data-probe="settings-tab"]');
  await wipe.page.click(".btn.warm"); // Erase everything
  await wipe.page.waitForSelector(".sheet .btn.warm");
  await wipe.page.click(".sheet .btn.warm");
  await wipe.page.waitForSelector('[data-probe="start"]', { timeout: 10000 });
  await wipe.page.waitForTimeout(800);
  must(await wipe.page.evaluate(() => localStorage.getItem("tl-cloud-code")) === null, "erase kept the code");
  must(await wipe.page.$(".sheet") === null, "an erased device was offered its old record");
  await wipe.ctx.close();
});

await step("M. a second rider on the same device has its own code and its own settings", async () => {
  await pinIn(rider.page);
  await rider.page.click('[data-probe="tab-settings"]');
  await rider.page.waitForSelector('[data-probe="add-rider"]');
  await rider.page.click('[data-probe="add-rider"]'); // the dialog answers MAYA
  await rider.page.waitForTimeout(400);
  const reg = await rider.page.evaluate(() => (window as unknown as Hooks).__app.registry());
  const maya = reg.profiles.find((p) => p.name === "MAYA");
  must(maya !== undefined, "the second rider was not added");
  await rider.page.evaluate(() => sessionStorage.clear());
  await rider.page.reload({ waitUntil: "networkidle" });
  await rider.page.waitForSelector('[data-probe="profile-grid"]', { timeout: 8000 });
  await rider.page.click(`[data-profile="${maya!.id}"]`);
  await rider.page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
  must((await hooks(rider.page).running())["dailyGoal"] === 40, "the second rider inherited the first rider's settings");
  must((await hooks(rider.page).pull()).length === 0, "an unlinked second rider pulled the first rider's settings");
  // Link MAYA to her own code with her own document.
  await handle({ method: "PUT", path: `/v1/share/${CODE2}/settings`, body: JSON.stringify({ app: "trickline", version: 1, fields: { dailyGoal: { v: 20, at: Date.now(), by: "teacher" } } }) }, kv);
  await rider.page.evaluate((c) => localStorage.setItem(`tl-cloud-code:${(window as unknown as Hooks).__app.profile().id}`, c), CODE2);
  const changed = await hooks(rider.page).pull();
  must(changed.includes("dailyGoal") && (await hooks(rider.page).running())["dailyGoal"] === 20, "MAYA did not apply her own document");
  must(settingsDoc(CODE)["dailyGoal"]?.v !== 20, "MAYA's change leaked into the first rider's document");
  // Back to the first rider: untouched.
  const first = reg.profiles.find((p) => p.name !== "MAYA")!;
  await rider.page.evaluate(() => sessionStorage.clear());
  await rider.page.reload({ waitUntil: "networkidle" });
  await rider.page.waitForSelector('[data-probe="profile-grid"]', { timeout: 8000 });
  await rider.page.click(`[data-profile="${first.id}"]`);
  await rider.page.waitForSelector('[data-probe="start"]', { timeout: 8000 });
  must((await hooks(rider.page).running())["dailyGoal"] !== 20, "the first rider took MAYA's setting");
});

await step("N. a backup from before stamps existed adopts the cloud's fields cleanly", async () => {
  const legacy = await device("legacy");
  watch = legacy.page;
  await legacy.page.waitForSelector('[data-probe="start"]');
  await legacy.page.evaluate((c) => localStorage.setItem("tl-cloud-code", c), CODE);
  const backup = { app: "trickline", version: 1, exportedAt: new Date().toISOString(),
    meta: { version: 1, pin: null, muted: false, animations: true, rider: null, dailyGoal: 40, doseDay: null, doseCount: 0, speedBest: {}, speedDay: null, speedCount: 0, speedLimit: 10, shopPeekDay: null, shopPeekAt: null, helmetsOwned: [], gear: {}, linesLanded: 3, bestTricksRun: 0, bestLinesRun: 0, coins: 9, owned: [], levels: {}, names: {}, lastSessionDay: null, streak: 0, backupNudgedOn: null, strands: { add: true, sub: true, mul: false, div: false }, caps: { add: null, sub: null, mul: null, div: null }, missing: { add: false, sub: false, mul: false, div: false, pct: 20 }, elapsedLevel: 1, elapsedAnalog: false },
    facts: { "add:2+3": { introduced: true, box: 2, dueOn: 1, masteryStreak: 0, lastRetrievedDay: null, mastered: false, seen: 1, correct: 1 } }, responses: [], sessions: [] };
  await legacy.page.reload({ waitUntil: "networkidle" });
  await legacy.page.waitForSelector(".sheet", { timeout: 8000 }); // restore offer: decline, we load a file instead
  await legacy.page.click(".sheet .btn.ghost");
  await pinIn(legacy.page);
  await legacy.page.click('[data-probe="tab-settings"]');
  await legacy.page.waitForSelector('input[type="file"]', { state: "attached" }); // it is display:none by design
  await legacy.page.setInputFiles('input[type="file"]', { name: "old.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await legacy.page.waitForSelector(".sheet .btn.go", { timeout: 6000 });
  await legacy.page.click(".sheet .btn.go"); // OK, reload
  await legacy.page.waitForSelector('[data-probe="start"]', { timeout: 10000 });
  await legacy.page.waitForFunction(() => (window as unknown as Hooks).__app.meta()["coins"] === 9, null, { timeout: 8000 });
  const m = await hooks(legacy.page).meta();
  must(typeof m.settingsStamps === "object", "a legacy meta has no stamps object");
  await legacy.page.waitForFunction(() => (window as unknown as Hooks).__app.meta()["dailyGoal"] !== 40, null, { timeout: 8000 }).catch(() => undefined);
  const run = await hooks(legacy.page).running();
  must(eq(run["dailyGoal"], settingsDoc()["dailyGoal"]?.v), `a legacy device runs ${JSON.stringify(run["dailyGoal"])} against the cloud's ${JSON.stringify(settingsDoc()["dailyGoal"]?.v)}`);
  await legacy.ctx.close();
});

await step("O. nothing that must not sync ever did, and the door never wrote the record", async () => {
  for (const k of Object.keys(settingsDoc())) must((SYNCED_KEYS as readonly string[]).includes(k), `a foreign field is in the cloud: ${k}`);
  must(!Object.keys(settingsDoc()).some((k) => /pin|mute|anim|coin|owned/i.test(k)), "a device-level or progress field synced");
  const doorRecordPuts = ledger.filter((l) => (l.role === "phone" || l.role === "laptop") && l.method === "PUT" && !l.path.endsWith("/settings"));
  must(doorRecordPuts.length === 0, `the doors wrote the record ${doorRecordPuts.length} times`);
  // Only OWNERS write the record: the rider, the wiped rider before its wipe,
  // and the device that restored. Never a viewer, never the legacy device
  // that only opened a file beside a linked code.
  const writers = new Set(ledger.filter((l) => l.method === "PUT" && !l.path.endsWith("/settings") && l.path.endsWith(CODE)).map((l) => l.role));
  for (const w of writers) must(["rider", "wipe", "fresh-restore"].includes(w), `a non-owner wrote the record: ${w}`);
  must(record()!.meta["coins"] === 77, `the rider's record was overwritten (coins ${String(record()!.meta["coins"])})`);
  const reg = await rider.page.evaluate(() => (window as unknown as Hooks).__app.registry());
  must(reg.pin === "1357", "the device PIN changed");
  must(record()!.meta["pin"] === null || record()!.meta["pin"] === "1357", "the record's legacy pin field was touched by settings sync");
});

await browser.close();
console.log(failed === 0 ? `LOOP-EYE GREEN (${ledger.length} cloud requests)` : `LOOP-EYE RED (${failed} failed)`);
process.exitCode = failed === 0 ? 0 : 1;

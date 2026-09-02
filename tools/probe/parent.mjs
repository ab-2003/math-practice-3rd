/**
 * PROBE: THE GROWN-UPS' DOOR at /parent/. No PIN, no game; connect a code
 * or open a file; the report; refresh with a verdict; the code remembered.
 */
import { BASE, suite } from "./_shared.mjs";

const { page, step, must, done, browser } = await suite("parent");
const DOOR = BASE.replace(/\/$/, "") + "/parent/";

const fakeBackup = (sessions = 1) => {
  const facts = {};
  const responses = [];
  const day = 20_000;
  for (let i = 0; i < 12; i++) {
    const id = `add:${i % 6}+${5 + (i % 5)}`;
    facts[id] = { introduced: true, box: 4, dueOn: day + 8, masteryStreak: 3, lastRetrievedDay: day, mastered: i < 6, seen: 4, correct: 4 };
    responses.push({ factId: id, day, at: 1_700_000_000_000 + i * 1000, firstKeyMs: 900 + i * 50, submitMs: 2000, correct: true, answered: 1, cls: "retrieved", isRetry: false });
  }
  return {
    app: "trickline", version: 1, exportedAt: new Date().toISOString(), name: "KALLEN",
    device: "iPad", savedAt: new Date().toISOString(),
    meta: { version: 1, coins: 321, owned: ["grindjaw"], strands: { add: true, sub: true, mul: false, div: false }, caps: { add: null, sub: null, mul: null, div: null }, missing: { add: false, sub: false, mul: false, div: false, pct: 20 } },
    facts, responses,
    sessions: Array.from({ length: sessions }, (_, i) => ({ id: `s${i}`, day, startedAt: 1_700_000_000_000, endedAt: 1_700_000_400_000, items: 12, correct: 12, retrieved: 12, derived: 0, status: "complete", coins: 15 })),
  };
};

let cloud = fakeBackup(1);
await page.route("**/math-pra3-cloudshare**", (route) => {
  if (route.request().method() === "GET") void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cloud) });
  else void route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
});

await step("the door opens on a connect form: no PIN, no game, no shop", async () => {
  await page.goto(DOOR, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
  must(await page.$('[data-probe="start"]') === null, "the kid's Drop In is on the grown-ups' door");
  must(await page.$(".pinpad") === null, "a PIN pad on the grown-ups' door");
  must(await page.$(".keypad") === null, "a keypad on the grown-ups' door");
  must(await page.$('[data-probe="connect-form"]') !== null, "no connect form");
  must(await page.$('[data-probe="parent-open-file"]') !== null, "no way to open a backup file");
  must(((await page.textContent("title")) ?? "").includes("Grown-ups"), "the page title does not say Grown-ups");
});

await step("connecting a code lands on the report, says so, and remembers the code", async () => {
  await page.fill(".cloud-input", "MATH-PRA3-ABCDE-FGHJK-MNPQR-STVWX");
  await page.click('[data-probe="cloud-connect"]');
  await page.waitForSelector('[data-probe="parent-view"]', { timeout: 8000 });
  const banner = (await page.textContent('[data-probe="viewer-banner"]')) ?? "";
  must(banner.includes("KALLEN") && banner.includes("Read only"), `the banner reads "${banner}"`);
  const t = (await page.textContent('[data-probe="toast"]').catch(() => "")) ?? "";
  must(t.includes("Connected") && t.includes("KALLEN"), `the toast reads "${t}"`);
  const text = (await page.textContent('[data-probe="progress-tab"]')) ?? "";
  must(text.includes("Of 12 correct answers"), "the report is not the cloud copy's");
  must(await page.evaluate(() => window.__parent.code()) === "ABCDEFGHJKMNPQRSTVWX", "the code was not remembered");
  must(await page.$('[data-probe="viewer-refresh"] svg') !== null, "the refresh button has no icon");
  must(await page.$('[data-probe="csv"]') !== null, "no CSV export on the record");
});

await step("refresh says already the latest, then says what changed", async () => {
  await page.waitForTimeout(3000);
  await page.click('[data-probe="viewer-refresh"]');
  await page.waitForSelector('[data-probe="toast"]', { timeout: 6000 });
  must(((await page.textContent('[data-probe="toast"]')) ?? "").includes("Already the latest"), "unchanged data did not read as the latest");
  cloud = fakeBackup(4);
  await page.waitForTimeout(3000);
  await page.click('[data-probe="viewer-refresh"]');
  await page.waitForSelector('[data-probe="toast"]', { timeout: 6000 });
  const t = (await page.textContent('[data-probe="toast"]')) ?? "";
  must(t.includes("Updated") && t.includes("3 new sessions"), `changed data read as "${t}"`);
});

await step("the CSV export carries the measurement definition", async () => {
  const dl = page.waitForEvent("download", { timeout: 8000 });
  await page.click('[data-probe="csv"]');
  const file = await dl;
  const stream = await file.createReadStream();
  let body = "";
  for await (const chunk of stream) body += chunk;
  must(body.includes("FIRST DIGIT") && body.includes("first_key_ms"), "the CSV is missing its definition or timings");
  must(body.split("\n").length > 10, "the CSV has no rows");
});

await step("the next launch opens straight onto the record", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="parent-view"]', { timeout: 10000 });
  must(await page.$('[data-probe="parent-connect"]') === null, "a remembered code still showed the connect form");
  const t = (await page.textContent('[data-probe="toast"]').catch(() => "")) ?? "";
  must(t.includes("Viewing KALLEN"), `the launch toast reads "${t}"`);
});

await step("forgetting the code returns to the door and stays forgotten", async () => {
  await page.click('[data-probe="parent-forget"]');
  await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 6000 });
  must(await page.evaluate(() => window.__parent.code()) === null, "the code is still remembered");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
});

await step("a backup file opens into the same report, read only", async () => {
  const backup = fakeBackup(2);
  await page.setInputFiles('[data-probe="parent-file"]', { name: "trickline-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForSelector('[data-probe="parent-view"]', { timeout: 8000 });
  const banner = (await page.textContent('[data-probe="viewer-banner"]')) ?? "";
  must(banner.includes("backup file") && banner.includes("KALLEN"), `the file banner reads "${banner}"`);
  must(await page.$('[data-probe="viewer-refresh"]') === null, "a file offers a cloud refresh");
  must(await page.evaluate(() => window.__parent.kind()) === "file", "the source is not the file");
  // Nothing on this door writes a rider's data: no kid database was created.
  const dbs = await page.evaluate(async () => (await indexedDB.databases?.())?.map((d) => d.name) ?? []);
  must(!dbs.includes("trickline") || (await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open("trickline", 1); r.onsuccess = () => res(r.result); });
    return new Promise((res) => { const t = db.transaction("meta", "readonly").objectStore("meta").get("meta"); t.onsuccess = () => res(t.result === undefined); });
  })), "the grown-ups' door wrote a rider's data");
});

await step("a bad file is refused with a reason, not a blank screen", async () => {
  await page.click('[data-probe="parent-change"]');
  await page.waitForSelector('[data-probe="parent-connect"]');
  await page.setInputFiles('[data-probe="parent-file"]', { name: "nope.json", mimeType: "application/json", buffer: Buffer.from('{"app":"other"}') });
  // The previous step's toast may still be up: wait for THIS one's words.
  await page.waitForFunction(() => (document.querySelector('[data-probe="toast"]')?.textContent ?? "").includes("Could not"), null, { timeout: 6000 });
  must(((await page.textContent('[data-probe="toast"]')) ?? "").includes("different app"), "the refusal does not say why");
  must(await page.$('[data-probe="parent-connect"]') !== null, "the door vanished on a bad file");
});

await step("the door fits a phone", async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p2 = await ctx2.newPage();
  await p2.goto(DOOR, { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-probe="parent-connect"]', { timeout: 8000 });
  const wide = await p2.evaluate(() => document.body.scrollWidth > window.innerWidth + 2);
  must(!wide, "the door scrolls horizontally on a phone");
  await ctx2.close();
});

await done();

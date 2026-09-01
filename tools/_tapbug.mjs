import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
await page.goto("http://localhost:8050", { waitUntil: "networkidle" });
await page.waitForSelector('[data-probe="start"]');
await page.evaluate(() => { const m = window.__app.meta(); m.coins = 40; window.__app.go("collection"); });
await page.waitForTimeout(400);
// A real TOUCH on GRINDJAW's tile, the way a thumb does it.
const box = await page.locator('[data-mon="grindjaw"]').boundingBox();
console.log("tile box:", JSON.stringify(box));
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(600);
console.log("sheet after center tap:", await page.$(".sheet") !== null);
if (await page.$(".sheet") === null) {
  // Diagnose: who actually wins the finger at that point?
  const who = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName}.${(el.className.baseVal ?? el.className ?? "").toString().slice(0, 40)}` : "none";
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  console.log("elementFromPoint at center:", who);
  // Try tapping on the NAME text instead of the art.
  const name = await page.locator('[data-mon="grindjaw"] .mon-name').boundingBox();
  await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
  await page.waitForTimeout(600);
  console.log("sheet after name tap:", await page.$(".sheet") !== null);
}
await b.close();

// Shared Playwright helpers. Everything here drives the REAL UI: real taps on
// real keys, never a call into the app's internals. A harness that calls the
// model is a harness that agrees with itself.
export const SHAPES = {
  "ipad-portrait": { width: 820, height: 1180 },
  "ipad-landscape": { width: 1180, height: 820 },
  "ipad-mini": { width: 744, height: 1133 },
  phone: { width: 390, height: 844 },
};

/** Independently derive the answer from the fact id. This is the SECOND
 *  implementation: it never imports the app's code. */
export const answerOf = (factId) => {
  const [kind, rest] = factId.split(":");
  if (kind === "add") { const [a, b] = rest.split("+").map(Number); return a + b; }
  if (kind === "sub") { const [a, b] = rest.split("-").map(Number); return a - b; }
  if (kind === "mul") { const [a, b] = rest.split("x").map(Number); return a * b; }
  if (kind === "div") { const [a, b] = rest.split("/").map(Number); return a / b; }
  throw new Error(`unknown fact kind in ${factId}`);
};

/** The keypad sleeps while a landing animation plays. Waiting for it to wake
 *  is how a probe knows the app is ready for the next answer; reading the
 *  problem before that races the paint and reads the PREVIOUS fact. */
export const waitReady = async (page) => {
  await page.waitForSelector(".keypad:not(.asleep)", { timeout: 10000 });
};

/** Type a number on the app's own keypad, one real tap per digit. */
export const typeAnswer = async (page, n) => {
  for (const d of String(n)) await page.click(`.keypad .key[data-key="${d}"]`);
  await page.click(".keypad .key.enter");
};

export const currentFact = async (page) =>
  page.getAttribute('[data-probe="problem"]', "data-fact");

export const startSession = async (page, base) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.click('[data-probe="start"]');
  await page.waitForSelector('[data-probe="problem"]');
  await waitReady(page);
};

export const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
export const ok = (msg) => console.log(`  ok  ${msg}`);

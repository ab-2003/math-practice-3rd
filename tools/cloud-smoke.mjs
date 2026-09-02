// CLOUD-SMOKE: the real worker, a real roundtrip, cleaned up after itself.
// Runs at release time next to live-smoke: our infra is part of the product.
// Two documents per code since 0.16.0: the record, and the merged settings.
const BASE = "https://math-pra3-cloudshare.beyer-games.workers.dev";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = Array.from({ length: 20 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join("");
const fail = (m) => { console.error(`FAIL ${m}`); process.exit(1); };

const health = await fetch(`${BASE}/v1/health`).then((r) => r.json()).catch(() => null);
if (health?.ok !== true) fail("health did not answer ok");
if (health?.settings !== true) fail("the live worker does not know the settings route: deploy it (npx wrangler deploy --config cloudshare/wrangler.jsonc)");

const env = { app: "trickline", version: 1, meta: { coins: 1 }, sessions: [], device: "smoke", savedAt: new Date().toISOString() };
const put = await fetch(`${BASE}/v1/share/${code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(env) });
if (!put.ok) fail(`put ${put.status}`);
// KV is EVENTUALLY consistent: a read straight after a write can be stale
// for up to ~60s at an edge. Poll rather than judging the first answer.
const poll = async (path, want) => {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${BASE}${path}`);
    if (want === "present" && r.ok) return r;
    if (want === "gone" && r.status === 404) return r;
    await new Promise((res) => setTimeout(res, 4000));
  }
  return null;
};
const gotR = await poll(`/v1/share/${code}`, "present");
if (!gotR) fail("the envelope never became readable");
const got = await gotR.json();
if (got?.device !== "smoke") fail("get did not hand back the envelope");
const foreign = await fetch(`${BASE}/v1/share/${code}`, { method: "PUT", body: '{"app":"other","version":1,"meta":{}}' });
if (foreign.status !== 400) fail(`foreign data was accepted (${foreign.status})`);

// ---- settings: merged on write, later stamp wins, bad shapes refused ------
const sput = (fields, writer = "smoke") => fetch(`${BASE}/v1/share/${code}/settings`, {
  method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ app: "trickline", version: 1, writer, fields }),
});
const r1 = await sput({ dailyGoal: { v: 30, at: 100, by: "phone" } }, "phone");
if (!r1.ok) fail(`settings put ${r1.status}`);
const m1 = await r1.json();
if (m1?.fields?.dailyGoal?.v !== 30) fail("the first settings write did not come back merged");
// An OLDER stamp for the same field must not win; a new field must join.
const r2 = await sput({ dailyGoal: { v: 80, at: 50, by: "ipad" }, speedLimit: { v: 3, at: 60, by: "ipad" } }, "ipad");
const m2 = await r2.json();
if (m2?.fields?.dailyGoal?.v !== 30) fail(`an older stamp overrode a newer field (${JSON.stringify(m2?.fields?.dailyGoal)})`);
if (m2?.fields?.speedLimit?.v !== 3) fail("a new field did not join the merge");
// Equal stamps break by device id; a future clock is clamped; case is normalised.
// KV reads can be STALE for a moment after a write, so between two WRITERS
// the smoke waits for the first write to be readable before the second lands;
// racing them would test KV's propagation, not the merge. (Clients send their
// whole field set on every write for the same reason.)
const tie = await sput({ elapsedLevel: { v: 2, at: 70, by: "bbb" } }, "bbb");
if ((await tie.json())?.fields?.elapsedLevel?.v !== 2) fail("the first tie write did not land");
let seen = false;
for (let i = 0; i < 12 && !seen; i++) {
  const r = await fetch(`${BASE}/v1/share/${code}/settings`);
  if (r.ok && (await r.json())?.fields?.elapsedLevel?.by === "bbb") seen = true; else await new Promise((res) => setTimeout(res, 3000));
}
if (!seen) fail("the first tie write never became readable");
const tie2 = await sput({ elapsedLevel: { v: 3, at: 70, by: "aaa" } }, "aaa");
if ((await tie2.json())?.fields?.elapsedLevel?.v !== 2) fail("an equal-stamp tie did not break by device id");
const future = await sput({ elapsedAnalog: { v: true, at: Date.now() + 365 * 86_400_000, by: "wrong-clock" } }, "wrong-clock");
const fj = await future.json();
if (!(fj?.fields?.elapsedAnalog?.at <= Date.now() + 6 * 60_000)) fail("a future stamp was not clamped by the live worker");
const lower = await fetch(`${BASE}/v1/share/${code.toLowerCase()}/settings`);
if (!lower.ok) fail(`a lowercase code was not normalised (${lower.status})`);
const bad = await sput({ pin: { v: "1234", at: 999, by: "x" } });
if (bad.status !== 400) fail(`a foreign settings field was accepted (${bad.status})`);
const bad2 = await sput({ dailyGoal: { v: 999, at: 999, by: "x" } });
if (bad2.status !== 400) fail(`an out-of-range value was accepted (${bad2.status})`);
// The settled read: every writer's document, merged. KV may lag a little,
// so poll for the merge rather than judging the first answer.
let settled = null;
for (let i = 0; i < 15 && settled === null; i++) {
  const r = await fetch(`${BASE}/v1/share/${code}/settings`);
  const j = r.ok ? await r.json() : null;
  if (j?.fields?.dailyGoal?.v === 30 && j?.fields?.speedLimit?.v === 3 && j?.fields?.elapsedLevel?.v === 2) settled = j;
  else await new Promise((res) => setTimeout(res, 4000));
}
if (settled === null) fail("the held settings never settled on the merge of every writer");

const del = await fetch(`${BASE}/v1/share/${code}`, { method: "DELETE" });
if (!(del.ok || del.status === 404)) fail(`delete ${del.status}`);
const gone = await poll(`/v1/share/${code}`, "gone");
if (!gone) console.log("NOTE: delete not yet visible at this edge (KV propagates within ~60s); delete itself returned ok");
const sgone = await poll(`/v1/share/${code}/settings`, "gone");
if (!sgone) console.log("NOTE: settings delete not yet visible at this edge");
console.log("CLOUD-SMOKE GREEN");

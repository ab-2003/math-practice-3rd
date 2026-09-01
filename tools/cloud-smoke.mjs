// CLOUD-SMOKE: the real worker, a real roundtrip, cleaned up after itself.
// Runs at release time next to live-smoke: our infra is part of the product.
const BASE = "https://math-pra3-cloudshare.beyer-games.workers.dev";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = Array.from({ length: 20 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join("");
const fail = (m) => { console.error(`FAIL ${m}`); process.exit(1); };

const health = await fetch(`${BASE}/v1/health`).then((r) => r.json()).catch(() => null);
if (health?.ok !== true) fail("health did not answer ok");

const env = { app: "trickline", version: 1, meta: { coins: 1 }, sessions: [], device: "smoke", savedAt: new Date().toISOString() };
const put = await fetch(`${BASE}/v1/share/${code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(env) });
if (!put.ok) fail(`put ${put.status}`);
// KV is EVENTUALLY consistent: a read straight after a write can be stale
// for up to ~60s at an edge. Poll rather than judging the first answer.
const poll = async (want) => {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${BASE}/v1/share/${code}`);
    if (want === "present" && r.ok) return r;
    if (want === "gone" && r.status === 404) return r;
    await new Promise((res) => setTimeout(res, 4000));
  }
  return null;
};
const gotR = await poll("present");
if (!gotR) fail("the envelope never became readable");
const got = await gotR.json();
if (got?.device !== "smoke") fail("get did not hand back the envelope");
const foreign = await fetch(`${BASE}/v1/share/${code}`, { method: "PUT", body: '{"app":"other","version":1,"meta":{}}' });
if (foreign.status !== 400) fail(`foreign data was accepted (${foreign.status})`);
const del = await fetch(`${BASE}/v1/share/${code}`, { method: "DELETE" });
if (!(del.ok || del.status === 404)) fail(`delete ${del.status}`);
const gone = await poll("gone");
if (!gone) console.log("NOTE: delete not yet visible at this edge (KV propagates within ~60s); delete itself returned ok");
console.log("CLOUD-SMOKE GREEN");

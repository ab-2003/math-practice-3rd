// cloudshare/logic.ts — the worker's whole behaviour as a pure function, so
// the loop instrument (tools/loop-eye.ts) can run the PRODUCTION request
// handling against an in-memory store. An instrument that mimics the merge
// vouches for a different worker; this one imports it.
import { isSettingsDoc, mergeDocs, type SettingsDoc } from "../src/core/sync";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Req { method: string; path: string; body: string }
export interface Res { status: number; body: string | null }

// Crockford base32: no I, L, O, U — matches what the client generates.
export const CODE = /^[0-9A-HJKMNP-TV-Z]{20}$/;
// A school year of responses is ~1-2MB of JSON; 8MB is generous headroom.
export const MAX_BYTES = 8_000_000;
export const MAX_SETTINGS_BYTES = 20_000;
/**
 * A device whose clock runs in the future would win every merge forever.
 * Stamps are clamped to a little past the worker's own now; a real device
 * a few minutes fast still behaves, a device a year fast does not rule.
 */
export const FUTURE_GRACE_MS = 5 * 60_000;

const json = (status: number, body: unknown): Res => ({ status, body: JSON.stringify(body) });

export const clampStamps = (doc: SettingsDoc, now: number): SettingsDoc => {
  const ceiling = now + FUTURE_GRACE_MS;
  const fields = { ...doc.fields };
  for (const [k, f] of Object.entries(fields)) {
    if (f && f.at > ceiling) (fields as Record<string, unknown>)[k] = { ...f, at: ceiling };
  }
  return { app: "trickline", version: 1, fields };
};

export const handle = async (req: Req, kv: KVLike, now: number = Date.now()): Promise<Res> => {
  if (req.path === "/v1/health") return json(200, { ok: true, service: "math-pra3-cloudshare", settings: true });
  const m = req.path.match(/^\/v1\/share\/([0-9A-Za-z]+)(\/settings)?$/);
  if (!m) return json(404, { error: "no such road" });
  const code = m[1]!.toUpperCase();
  if (!CODE.test(code)) return json(400, { error: "that is not a share code" });
  const isSettings = m[2] !== undefined;

  if (isSettings) {
    const key = `${code}:settings`;
    if (req.method === "GET") {
      const held = await kv.get(key);
      if (held === null) return json(404, { error: "no settings under that code" });
      return { status: 200, body: held };
    }
    if (req.method === "PUT") {
      if (req.body.length > MAX_SETTINGS_BYTES) return json(413, { error: "that is too large for settings" });
      let incoming: unknown;
      try { incoming = JSON.parse(req.body); } catch { return json(400, { error: "not a settings document" }); }
      if (!isSettingsDoc(incoming)) return json(400, { error: "not Trick Line settings" });
      const heldRaw = await kv.get(key);
      let held: SettingsDoc | null = null;
      if (heldRaw !== null) {
        try { const parsed: unknown = JSON.parse(heldRaw); held = isSettingsDoc(parsed) ? parsed : null; } catch { held = null; }
      }
      const merged = mergeDocs(held, clampStamps(incoming, now));
      await kv.put(key, JSON.stringify(merged));
      return json(200, merged);
    }
    if (req.method === "DELETE") {
      await kv.delete(key);
      return { status: 204, body: null };
    }
    return json(405, { error: "method not allowed" });
  }

  if (req.method === "GET") {
    const held = await kv.get(code);
    // 404 IS the "invalid code" answer: a code is only real once data lives under it.
    if (held === null) return json(404, { error: "nothing under that code" });
    return { status: 200, body: held };
  }
  if (req.method === "PUT") {
    if (req.body.length > MAX_BYTES) return json(413, { error: "that data is too large" });
    let file: { app?: string; version?: number; meta?: unknown };
    try { file = JSON.parse(req.body) as typeof file; } catch { return json(400, { error: "not a data file" }); }
    if (file?.app !== "trickline" || file.version !== 1 || !file.meta) return json(400, { error: "not Trick Line data" });
    await kv.put(code, req.body);
    return json(200, { ok: true });
  }
  if (req.method === "DELETE") {
    // The code stops working everywhere: record and settings both go.
    await kv.delete(code);
    await kv.delete(`${code}:settings`);
    return { status: 204, body: null };
  }
  return json(405, { error: "method not allowed" });
};

/** An in-memory store, for the instrument and the unit tests. */
export class MemKV implements KVLike {
  readonly map = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.map.get(key) ?? null; }
  async put(key: string, value: string): Promise<void> { this.map.set(key, value); }
  async delete(key: string): Promise<void> { this.map.delete(key); }
}

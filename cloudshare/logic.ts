// cloudshare/logic.ts — the worker's whole behaviour as a pure function, so
// the loop instrument (tools/loop-eye.ts) can run the PRODUCTION request
// handling against an in-memory store. An instrument that mimics the merge
// vouches for a different worker; this one imports it.
//
// SETTINGS ARE STORED PER WRITER, MERGED ON READ (0.17.0). The first design
// kept one merged document and did a read-modify-write on every PUT. KV
// reads can be stale for a moment after a write, and the live smoke caught
// a merge that read a stale document and dropped a field another writer had
// landed a second earlier. Now each writer owns its own key and only ever
// overwrites itself; GET lists the writers and merges them under the same
// rules. Nothing is ever read-modify-written, so nothing can be lost to a
// stale read: a write is either not yet visible or fully visible.
import { isSettingsDoc, mergeFields, type Fields, type SettingsDoc } from "../src/core/sync";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
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
  return { app: "trickline", version: 1, ...(doc.writer !== undefined ? { writer: doc.writer } : {}), fields };
};

/** A writer id as a key segment: letters and digits only, bounded. */
const writerKey = (w: string | undefined): string => (w ?? "anon").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "anon";

/** Every writer's document under a code, plus the pre-0.17 single document
 *  if one is still there, merged field by field. */
const mergedSettings = async (kv: KVLike, code: string): Promise<Fields | null> => {
  let fields: Fields = {};
  let any = false;
  const legacy = await kv.get(`${code}:settings`);
  if (legacy !== null) {
    try { const d: unknown = JSON.parse(legacy); if (isSettingsDoc(d)) { fields = mergeFields(fields, d.fields); any = true; } } catch { /* ignore a garbled legacy doc */ }
  }
  const listed = await kv.list({ prefix: `${code}:settings:` });
  for (const k of listed.keys) {
    const raw = await kv.get(k.name);
    if (raw === null) continue;
    try { const d: unknown = JSON.parse(raw); if (isSettingsDoc(d)) { fields = mergeFields(fields, d.fields); any = true; } } catch { /* ignore */ }
  }
  return any ? fields : null;
};

export const handle = async (req: Req, kv: KVLike, now: number = Date.now()): Promise<Res> => {
  if (req.path === "/v1/health") return json(200, { ok: true, service: "math-pra3-cloudshare", settings: true, perWriter: true });
  const m = req.path.match(/^\/v1\/share\/([0-9A-Za-z]+)(\/settings)?$/);
  if (!m) return json(404, { error: "no such road" });
  const code = m[1]!.toUpperCase();
  if (!CODE.test(code)) return json(400, { error: "that is not a share code" });
  const isSettings = m[2] !== undefined;

  if (isSettings) {
    if (req.method === "GET") {
      const fields = await mergedSettings(kv, code);
      if (fields === null) return json(404, { error: "no settings under that code" });
      return json(200, { app: "trickline", version: 1, fields } satisfies SettingsDoc);
    }
    if (req.method === "PUT") {
      if (req.body.length > MAX_SETTINGS_BYTES) return json(413, { error: "that is too large for settings" });
      let incoming: unknown;
      try { incoming = JSON.parse(req.body); } catch { return json(400, { error: "not a settings document" }); }
      if (!isSettingsDoc(incoming)) return json(400, { error: "not Trick Line settings" });
      const clamped = clampStamps(incoming, now);
      // This writer's own document, and nobody else's: no read, no race.
      await kv.put(`${code}:settings:${writerKey(clamped.writer)}`, JSON.stringify(clamped));
      const fields = await mergedSettings(kv, code);
      return json(200, { app: "trickline", version: 1, fields: mergeFields(fields ?? {}, clamped.fields) } satisfies SettingsDoc);
    }
    if (req.method === "DELETE") {
      await kv.delete(`${code}:settings`);
      for (const k of (await kv.list({ prefix: `${code}:settings:` })).keys) await kv.delete(k.name);
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
    // The code stops working everywhere: record and every settings document go.
    await kv.delete(code);
    await kv.delete(`${code}:settings`);
    for (const k of (await kv.list({ prefix: `${code}:settings:` })).keys) await kv.delete(k.name);
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
  async list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }> {
    return { keys: [...this.map.keys()].filter((k) => k.startsWith(opts.prefix)).map((name) => ({ name })) };
  }
}

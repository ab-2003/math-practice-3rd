// cloudshare/worker.ts — TRICK LINE's cloud share, cloned from the proven
// War of 4 pattern (tactics/cloudshare, 3.9.0): anonymous cross-device data.
// The CODE is the whole identity: no accounts, no PII, one KV entry per code.
// CORS deliberately permissive — the unguessable 100-bit code is the auth.
// The on-device data remains the gold standard; this is a best-effort mirror
// so a parent or teacher can see the practice record from their own device.
//
// Deploy: npx wrangler deploy --config cloudshare/wrangler.jsonc
interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface Env { SHARES: KVLike }

// Crockford base32: no I, L, O, U — matches what the client generates.
const CODE = /^[0-9A-HJKMNP-TV-Z]{20}$/;
// A school year of responses is ~1-2MB of JSON; 8MB is generous headroom.
const MAX_BYTES = 8_000_000;

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === "/v1/health") return json(200, { ok: true, service: "math-pra3-cloudshare" });
    const m = url.pathname.match(/^\/v1\/share\/([0-9A-Za-z]+)$/);
    if (!m) return json(404, { error: "no such road" });
    const code = m[1].toUpperCase();
    if (!CODE.test(code)) return json(400, { error: "that is not a share code" });

    if (req.method === "GET") {
      const held = await env.SHARES.get(code);
      // 404 IS the "invalid code" answer: a code is only real once data lives under it.
      if (held === null) return json(404, { error: "nothing under that code" });
      return new Response(held, { status: 200, headers: { "content-type": "application/json", ...CORS } });
    }
    if (req.method === "PUT") {
      const body = await req.text();
      if (body.length > MAX_BYTES) return json(413, { error: "that data is too large" });
      let file: { app?: string; version?: number; meta?: unknown };
      try { file = JSON.parse(body) as typeof file; } catch { return json(400, { error: "not a data file" }); }
      if (file?.app !== "trickline" || file.version !== 1 || !file.meta) return json(400, { error: "not Trick Line data" });
      await env.SHARES.put(code, body);
      return json(200, { ok: true });
    }
    if (req.method === "DELETE") {
      await env.SHARES.delete(code);
      return new Response(null, { status: 204, headers: CORS });
    }
    return json(405, { error: "method not allowed" });
  },
};

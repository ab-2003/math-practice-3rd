// cloudshare/worker.ts — TRICK LINE's cloud share, cloned from the proven
// War of 4 pattern (tactics/cloudshare, 3.9.0): anonymous cross-device data.
// The CODE is the whole identity: no accounts, no PII, one KV entry per code.
// CORS deliberately permissive — the unguessable 100-bit code is the auth.
// The on-device data remains the gold standard; this is a best-effort mirror
// so a parent or teacher can see the practice record from their own device.
//
// TWO DOCUMENTS PER CODE (0.16.0): the RECORD, written by the rider's device,
// and the SETTINGS, written by either side and MERGED here on every write
// (later stamp wins per field, future clocks clamped). All of the behaviour
// lives in logic.ts so the loop instrument runs exactly this code.
//
// Deploy: npx wrangler deploy --config cloudshare/wrangler.jsonc
import { handle, type KVLike } from "./logic";

export interface Env { SHARES: KVLike }

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const body = req.method === "PUT" ? await req.text() : "";
    const res = await handle({ method: req.method, path: url.pathname, body }, env.SHARES);
    if (res.body === null) return new Response(null, { status: res.status, headers: CORS });
    return new Response(res.body, { status: res.status, headers: { "content-type": "application/json", ...CORS } });
  },
};

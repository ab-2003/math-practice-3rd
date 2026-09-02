/**
 * CLOUD SHARE, cloned from the proven War of 4 pattern (Andy 2026-09-01):
 * anonymous cross-device data behind a 100-bit bearer code. No accounts, no
 * PII. A parent or teacher loads the code on their own device and sees the
 * practice record.
 *
 * LAWS:
 *  - THE ON-DEVICE DATA IS THE GOLD STANDARD. The cloud is a best-effort
 *    mirror. A push that fails, hangs, or finds no network NEVER blocks or
 *    interrupts the app; it just tries again another time.
 *  - Auto-push is throttled (one flight at a time, at most one per interval,
 *    with a trailing push so the LAST state always gets mirrored).
 *  - The QR carries the CODE, not a URL (the WO4 ruling): scanning never
 *    launches a browser window.
 */

import { currentProfileId, exportAll, importAll, MAIN_PROFILE, type Backup } from "./store";

export const CLOUD_URL = "https://math-pra3-cloudshare.beyer-games.workers.dev";

// Crockford base32: no I, L, O, U. Typeable on a phone, unambiguous aloud.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LEN = 20;
const PREFIX = "MATHPRA3";

export const genCode = (): string => {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
};

/** Forgive everything a phone keyboard does: case, dashes, spaces, the
 *  decorative MATH-PRA3 prefix, and the classic O/I/L/U confusions. */
export const normalizeCode = (raw: string): string | null => {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  if (s.length === CODE_LEN + PREFIX.length && s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  if (s.length !== CODE_LEN) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
};

export const fmtCode = (code: string): string =>
  "MATH-PRA3-" + (code.match(/.{5}/g) ?? []).join("-");

const device = (): string => {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad|Macintosh.*Mobile/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "another device";
};

export interface CloudMeta {
  savedAt?: string;
  device?: string;
  name?: string;
  sessions?: number;
  coins?: number;
}
export type CloudResult =
  | { kind: "ok"; backup: Backup; meta: CloudMeta }
  | { kind: "missing" }
  | { kind: "offline" }
  | { kind: "bad" };

const timedFetch = (url: string, init: RequestInit = {}, ms = 8000): Promise<Response> => {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(t));
};

export const getShare = async (code: string): Promise<CloudResult> => {
  try {
    const r = await timedFetch(`${CLOUD_URL}/v1/share/${code}`);
    if (r.status === 404) return { kind: "missing" };
    if (!r.ok) return { kind: "offline" };
    const raw = (await r.json()) as Backup & { savedAt?: string; device?: string };
    if (raw?.app !== "trickline" || raw.version !== 1 || !raw.meta) return { kind: "bad" };
    return {
      kind: "ok", backup: raw,
      meta: { ...(raw.savedAt !== undefined ? { savedAt: raw.savedAt } : {}),
        ...(raw.device !== undefined ? { device: raw.device } : {}),
        ...(raw.name !== undefined ? { name: raw.name } : {}),
        sessions: raw.sessions?.length ?? 0, coins: raw.meta.coins },
    };
  } catch { return { kind: "offline" }; }
};

export const putShare = async (code: string, backup: Backup): Promise<boolean> => {
  try {
    const body = JSON.stringify({ ...backup, device: device(), savedAt: new Date().toISOString() });
    const r = await timedFetch(`${CLOUD_URL}/v1/share/${code}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body,
    });
    return r.ok;
  } catch { return false; }
};

export const deleteShare = async (code: string): Promise<boolean> => {
  try {
    const r = await timedFetch(`${CLOUD_URL}/v1/share/${code}`, { method: "DELETE" });
    return r.ok || r.status === 404;
  } catch { return false; }
};

export const loadBackup = (b: Backup): Promise<void> => importAll(b);

// ---- the device's memory of its share (plain localStorage, WO4 precedent) --
// One code PER RIDER: the first profile keeps the original key, so a device
// linked before profiles existed stays linked.
const keyFor = (base: string): string => {
  const id = currentProfileId();
  return id === MAIN_PROFILE ? base : `${base}:${id}`;
};
const KEY = "tl-cloud-code";
const STATUS = "tl-cloud-status";
export const connectedCode = (): string | null => { try { return localStorage.getItem(keyFor(KEY)); } catch { return null; } };
export const rememberCode = (code: string): void => { try { localStorage.setItem(keyFor(KEY), code); } catch { /* private mode */ } };
export const forgetCode = (): void => { try { localStorage.removeItem(keyFor(KEY)); } catch { /* */ } };

export interface PushStatus { at: number; ok: boolean }
export const lastPush = (): PushStatus | null => {
  try { return JSON.parse(localStorage.getItem(keyFor(STATUS)) ?? "null") as PushStatus | null; } catch { return null; }
};
const recordPush = (ok: boolean): void => {
  try { localStorage.setItem(keyFor(STATUS), JSON.stringify({ at: Date.now(), ok })); } catch { /* */ }
};

// ---- the auto-push: throttled, trailing, fire-and-forget -------------------
const THROTTLE_MS = 45_000;
let inFlight = false;
let lastAttempt = 0;
let trailing: number | null = null;

export const cloudPushNow = async (): Promise<boolean> => {
  const code = connectedCode();
  if (code === null || inFlight) return false;
  inFlight = true;
  lastAttempt = Date.now();
  try {
    const ok = await putShare(code, await exportAll());
    recordPush(ok);
    return ok;
  } catch { recordPush(false); return false; }
  finally { inFlight = false; }
};

/** Call after any data-changing save. Never throws, never blocks, never
 *  interrupts: offline and flaky internet simply mean the mirror is stale
 *  until the next quiet success. */
export const cloudAutoPush = (): void => {
  if (connectedCode() === null) return;
  const since = Date.now() - lastAttempt;
  if (since >= THROTTLE_MS && !inFlight) { void cloudPushNow(); return; }
  if (trailing !== null) return; // one trailing push already booked
  trailing = window.setTimeout(() => { trailing = null; void cloudPushNow(); }, Math.max(500, THROTTLE_MS - since));
};

export const cloudPending = (): boolean => trailing !== null || inFlight;

// The probe's window into the machinery, and a manual "save now".
(window as unknown as Record<string, unknown>).__cloud = {
  pushNow: cloudPushNow, pending: cloudPending, code: connectedCode,
};

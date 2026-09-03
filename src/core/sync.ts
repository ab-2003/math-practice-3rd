/**
 * SETTINGS SYNC: the rules for two writers and one small document.
 *
 * The rider's device and the grown-ups' door can both change what he is
 * practising. Each synced setting is a FIELD carrying its value, when it was
 * set, and by which device. Merging takes the later stamp per field, the
 * device id as a tiebreak. That is a last-writer-wins register per field:
 * enough for two writers on a dozen independent dials, and it needs no
 * coordination, which is what an eventually consistent KV store and a phone
 * that was offline both need. It is not a vector clock on purpose: a vector
 * clock could DETECT two devices editing the same field at once, and the
 * honest answer there is still "the later one wins".
 *
 * Pure: shared by the app, the grown-ups' door, and the worker itself, which
 * merges on every write so a stale device can never clobber a newer field.
 */

import type { Caps, Strands } from "./types";

/** The dials a grown-up may set from anywhere. Never the PIN (device-level),
 *  never the kid's own controls (mute, animations), never progress. */
export const SYNCED_KEYS = ["strands", "caps", "missing", "dailyGoal", "speedLimit", "elapsedOn", "elapsedLevel", "elapsedAnalog", "parkMinutes", "parkTokensPerDay"] as const;
export type SyncKey = typeof SYNCED_KEYS[number];

export interface MissingLike { add: boolean; sub: boolean; mul: boolean; div: boolean; pct: number }

export interface SyncedSettings {
  strands: Strands;
  caps: Caps;
  missing: MissingLike;
  dailyGoal: number;
  speedLimit: number;
  /** The bonus round at all (Andy, 2026-09-03: off for the younger kids). */
  elapsedOn: boolean;
  elapsedLevel: 1 | 2 | 3;
  elapsedAnalog: boolean;
  /** THE SKATE PARK: minutes one Daily Token buys, and tokens a day. */
  parkMinutes: number;
  parkTokensPerDay: number;
}

export interface Stamp { at: number; by: string }
export interface Field<T = unknown> extends Stamp { v: T }
export type Fields = Partial<Record<SyncKey, Field>>;

export interface SettingsDoc {
  app: "trickline";
  version: 1;
  /** The device that wrote this document. The worker stores one document
   *  per writer and merges on read, so no writer ever overwrites another. */
  writer?: string;
  fields: Fields;
}

export const isSyncKey = (k: string): k is SyncKey => (SYNCED_KEYS as readonly string[]).includes(k);

/** Later stamp wins; equal stamps fall to the device id, so the answer is
 *  the same whichever side asks. */
export const newer = (a: Stamp, b: Stamp): boolean => a.at > b.at || (a.at === b.at && a.by > b.by);

/**
 * A TOTAL order over fields: stamp, then device, then the value itself. The
 * property tests found that two writes from one device in one millisecond
 * with different values had no order, so the merge depended on which
 * arrived first. Rare in practice; not allowed in a merge that calls itself
 * order-independent.
 */
export const newerField = (a: Field, b: Field): boolean =>
  a.at !== b.at ? a.at > b.at : a.by !== b.by ? a.by > b.by : JSON.stringify(a.v) > JSON.stringify(b.v);

export const mergeFields = (a: Fields, b: Fields): Fields => {
  const out: Fields = { ...a };
  for (const k of SYNCED_KEYS) {
    const fb = b[k];
    if (!fb) continue;
    const fa = out[k];
    if (!fa || newerField(fb, fa)) out[k] = fb;
  }
  return out;
};

export const mergeDocs = (a: SettingsDoc | null, b: SettingsDoc): SettingsDoc => ({
  app: "trickline", version: 1, fields: mergeFields(a?.fields ?? {}, b.fields),
});

/** A structural check on something that arrived over the wire. */
export const isSettingsDoc = (x: unknown): x is SettingsDoc => {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Partial<SettingsDoc>;
  if (d.app !== "trickline" || d.version !== 1 || typeof d.fields !== "object" || d.fields === null) return false;
  if (d.writer !== undefined && (typeof d.writer !== "string" || d.writer.length > 40)) return false;
  for (const [k, f] of Object.entries(d.fields)) {
    if (!isSyncKey(k)) return false;
    const field = f as Partial<Field>;
    if (typeof field.at !== "number" || typeof field.by !== "string" || !("v" in field)) return false;
    if (!validValue(k, field.v)) return false;
  }
  return true;
};

const isBoolRecord = (v: unknown, keys: string[]): boolean =>
  typeof v === "object" && v !== null && keys.every((k) => typeof (v as Record<string, unknown>)[k] === "boolean");

/** Each field's value has a shape; a wrong one is refused, never coerced. */
export const validValue = (k: SyncKey, v: unknown): boolean => {
  const ops = ["add", "sub", "mul", "div"];
  switch (k) {
    case "strands": return isBoolRecord(v, ops) && ops.some((o) => (v as Record<string, boolean>)[o]);
    case "caps": return typeof v === "object" && v !== null
      && ops.every((o) => { const c = (v as Record<string, unknown>)[o]; return c === null || (typeof c === "number" && c >= 1 && c <= 100); });
    case "missing": return isBoolRecord(v, ops) && typeof (v as MissingLike).pct === "number" && (v as MissingLike).pct >= 5 && (v as MissingLike).pct <= 80;
    case "dailyGoal": return typeof v === "number" && v >= 10 && v <= 80;
    case "speedLimit": return typeof v === "number" && v >= 1 && v <= 30;
    case "elapsedOn": return typeof v === "boolean";
    case "elapsedLevel": return v === 1 || v === 2 || v === 3;
    case "elapsedAnalog": return typeof v === "boolean";
    case "parkMinutes": return typeof v === "number" && Number.isInteger(v) && v >= 2 && v <= 20;
    case "parkTokensPerDay": return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 8;
  }
};

/** Deep-enough equality for the shapes above. */
export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Which fields in `remote` are newer than the local stamps and differ. */
export const fieldsToApply = (
  local: SyncedSettings, stamps: Partial<Record<SyncKey, Stamp>>, remote: Fields,
): Partial<Record<SyncKey, Field>> => {
  const out: Partial<Record<SyncKey, Field>> = {};
  for (const k of SYNCED_KEYS) {
    const f = remote[k];
    if (!f) continue;
    const mine = stamps[k] ?? { at: 0, by: "" };
    if (!newer(f, mine)) continue;
    if (sameValue(f.v, local[k])) continue;
    if (!validValue(k, f.v)) continue;
    out[k] = f;
  }
  return out;
};

/** The dials the record says the device is actually running, from its meta. */
export const settingsOf = (meta: SyncedSettings): SyncedSettings => ({
  strands: meta.strands, caps: meta.caps, missing: meta.missing, dailyGoal: meta.dailyGoal,
  speedLimit: meta.speedLimit, elapsedOn: meta.elapsedOn, elapsedLevel: meta.elapsedLevel, elapsedAnalog: meta.elapsedAnalog,
  parkMinutes: meta.parkMinutes, parkTokensPerDay: meta.parkTokensPerDay,
});

/** Fields the grown-ups' door has set that the rider's device is not yet
 *  running: the "waiting for the iPad" list. */
export const pendingFields = (doc: Fields, running: SyncedSettings): SyncKey[] =>
  SYNCED_KEYS.filter((k) => doc[k] !== undefined && !sameValue(doc[k]!.v, running[k]));

/** Human words for a field's value, for toasts and pending lists. */
export const describeField = (k: SyncKey, v: unknown): string => {
  const names: Record<string, string> = { add: "addition", sub: "subtraction", mul: "multiplication", div: "division" };
  switch (k) {
    case "strands": {
      const s = v as Strands;
      const on = (["add", "sub", "mul", "div"] as const).filter((o) => s[o]).map((o) => names[o]);
      return `practising ${on.join(", ")}`;
    }
    case "caps": {
      const c = v as Caps;
      const set = (["add", "sub", "mul", "div"] as const).filter((o) => c[o] !== null).map((o) => `${names[o]} up to ${c[o]}`);
      return set.length === 0 ? "no caps" : `caps: ${set.join(", ")}`;
    }
    case "missing": {
      const m = v as MissingLike;
      const on = (["add", "sub", "mul", "div"] as const).filter((o) => m[o]).map((o) => names[o]);
      return on.length === 0 ? "missing number off" : `missing number on ${on.join(", ")} at ${m.pct}%`;
    }
    case "dailyGoal": return `${v as number} problems a day`;
    case "speedLimit": return `${v as number} speed runs a day`;
    case "elapsedOn": return (v as boolean) ? "bonus round on" : "bonus round off";
    case "elapsedLevel": return `elapsed time up to level ${v as number}`;
    case "elapsedAnalog": return (v as boolean) ? "analog clock faces on" : "analog clock faces off";
    case "parkMinutes": return `${v as number} park minutes per token`;
    case "parkTokensPerDay": return `${v as number} park ${(v as number) === 1 ? "token" : "tokens"} a day`;
  }
};

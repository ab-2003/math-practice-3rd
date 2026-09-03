/**
 * ONE WAY TO CHANGE A SETTING, wherever the change comes from.
 *
 * The settings screen on the iPad, and the grown-ups' door on a phone via
 * the cloud, both end here. Turning an operation on or raising a cap
 * REVIVES the facts it lets back in (see core/scheduler reviveStrand), so a
 * remote change can no more avalanche a session than a local one. A local
 * change stamps the field with now and this device and pushes it to the
 * settings document; a remote one adopts the remote stamp so it is never
 * pushed back as if it were new.
 */

import { reviveStrand } from "../core/scheduler";
import { sameValue, SYNCED_KEYS, type Field, type SyncedSettings, type SyncKey, settingsOf, validValue } from "../core/sync";
import type { Caps, FactKind, Strands } from "../core/types";
import type { App } from "./appstate";
import { connectedCode, deviceId, putSettings } from "./cloud";

const KINDS: readonly FactKind[] = ["add", "sub", "mul", "div"];

/** The dials this device is running. */
export const currentSettings = (app: App): SyncedSettings => settingsOf(app.meta);

/**
 * Apply one setting. Returns whether anything changed. Does not save: the
 * caller saves once, after one or several changes.
 */
export const applySetting = <K extends SyncKey>(
  app: App, key: K, value: SyncedSettings[K], from: { remote?: Field } = {},
): boolean => {
  const before = currentSettings(app)[key];
  if (sameValue(before, value)) return false;
  // A value outside its shape is refused here too, not only by the worker:
  // a daily limit under fifteen, a goal over eighty, never land.
  if (!validValue(key, value)) return false;

  if (key === "strands") {
    const next = value as Strands;
    if (!KINDS.some((k) => next[k])) return false; // the last one cannot go off
    const prev = before as Strands;
    app.meta.strands = { ...next };
    for (const k of KINDS) if (next[k] && !prev[k]) app.states = reviveStrand(app.deck, app.states, k, app.day);
  } else if (key === "caps") {
    const next = value as Caps;
    const prev = before as Caps;
    app.meta.caps = { ...next };
    // Raising or clearing a cap lets facts back in that may be overdue by
    // weeks; revive them to today so they cannot avalanche.
    for (const k of KINDS) {
      const was = prev[k];
      const now = next[k];
      if (now === null ? was !== null : (was !== null && now > was)) app.states = reviveStrand(app.deck, app.states, k, app.day);
    }
  } else if (key === "missing") {
    app.meta.missing = { ...(value as SyncedSettings["missing"]) };
  } else if (key === "addDots") {
    app.meta.addDots = value as boolean;
  } else if (key === "dailyGoal") {
    app.meta.dailyGoal = value as number;
  } else if (key === "speedLimit") {
    app.meta.speedLimit = value as number;
  } else if (key === "elapsedOn") {
    app.meta.elapsedOn = value as boolean;
  } else if (key === "elapsedLevel") {
    app.meta.elapsedLevel = value as 1 | 2 | 3;
  } else if (key === "elapsedAnalog") {
    app.meta.elapsedAnalog = value as boolean;
  } else if (key === "parkMinutes") {
    app.meta.parkMinutes = value as number;
  } else if (key === "parkTokensPerDay") {
    app.meta.parkTokensPerDay = value as number;
  } else if (key === "dayLimitMinutes") {
    app.meta.dayLimitMinutes = value as number;
  }

  const stamp = from.remote ? { at: from.remote.at, by: from.remote.by } : { at: Date.now(), by: deviceId() };
  app.meta.settingsStamps = { ...app.meta.settingsStamps, [key]: stamp };
  if (!from.remote) pushLocal(app);
  return true;
};

/**
 * A local change goes up as EVERYTHING this device knows, fire and forget,
 * never blocking. Not just the changed field: KV reads can be stale for a
 * moment after a write (the live smoke caught it), and a merge fed only the
 * newest field over a stale document could drop the one before it. A full
 * set is idempotent under the merge, so a stale read costs nothing.
 */
export const pushLocal = (app: App): void => {
  const code = connectedCode();
  if (code === null) return;
  const fields = localFields(app);
  if (Object.keys(fields).length === 0) return;
  void putSettings(code, fields);
};

/** Every synced field this device holds, stamped, for a first full push. */
export const localFields = (app: App): Partial<Record<SyncKey, Field>> => {
  const out: Partial<Record<SyncKey, Field>> = {};
  const s = currentSettings(app);
  for (const k of SYNCED_KEYS) {
    const st = app.meta.settingsStamps[k];
    if (!st) continue; // never set on this device: nothing to claim
    out[k] = { v: s[k], at: st.at, by: st.by };
  }
  return out;
};

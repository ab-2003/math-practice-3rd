/**
 * THE RIDER'S DEVICE LISTENS (0.16.0).
 *
 * At boot, when the app comes back to the foreground, and after each push,
 * the device asks the cloud for the settings document and applies any field
 * newer than its own, through the same path the settings screen uses. Never
 * blocking: no network, no code, no document all mean nothing happens. When
 * something changes it says so in a toast, in words, so a boy who sees
 * multiplication appear knows a grown-up asked for it.
 *
 * And the safety net that falls out of the same machinery: a device that
 * boots with nothing of its own, a remembered code, and a record in the cloud
 * is offered its data back. That is the iOS eviction case.
 */

import { describeField, fieldsToApply, type SyncKey } from "../core/sync";
import type { App } from "./appstate";
import { cloudWhose, connectedCode, declineRestore, getSettings, getShare, loadBackup, restoreDeclined, sessionsText } from "./cloud";
import { applySetting, currentSettings } from "./settings-apply";
import { sheet } from "./sheet";
import { hasLocalData } from "./store";
import { queueToast, toast } from "./toast";

let pulling = false;
let lastPull = 0;
const PULL_GAP_MS = 20_000;

/** Ask the cloud for newer settings and apply them. Resolves to the keys
 *  that changed, for the probes and for the toast. */
export const pullSettings = async (app: App, force = false): Promise<SyncKey[]> => {
  const code = connectedCode();
  if (code === null || pulling) return [];
  if (!force && Date.now() - lastPull < PULL_GAP_MS) return [];
  pulling = true;
  lastPull = Date.now();
  try {
    const res = await getSettings(code);
    if (res.kind !== "ok") return [];
    const apply = fieldsToApply(currentSettings(app), app.meta.settingsStamps, res.doc.fields);
    const changed: SyncKey[] = [];
    for (const [k, f] of Object.entries(apply) as Array<[SyncKey, NonNullable<typeof apply[SyncKey]>]>) {
      if (applySetting(app, k, f.v as never, { remote: f })) changed.push(k);
    }
    if (changed.length > 0) {
      await app.save();
      app.refresh();
      toast(`Settings updated from the grown-ups' page: ${changed.map((k) => describeField(k, currentSettings(app)[k])).join("; ")}.`);
    }
    return changed;
  } finally { pulling = false; }
};

/** Boot-time: pull once, then again whenever the app comes back. */
export const startSync = (app: App): void => {
  void pullSettings(app, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void pullSettings(app);
  });
  (window as unknown as Record<string, unknown>).__sync = { pull: () => pullSettings(app, true) };
};

/**
 * A device with nothing of its own and a code that holds something: offer
 * the record back. Offered, not forced: a fresh sibling profile linked to
 * the wrong code must not silently become someone else.
 */
export const offerRestore = async (app: App): Promise<boolean> => {
  const code = connectedCode();
  if (code === null) return false;
  // A device that linked to LOOK (Just view), or already said start fresh,
  // is not asked at every launch.
  if (restoreDeclined(code)) return false;
  if (await hasLocalData()) return false;
  const res = await getShare(code);
  if (res.kind !== "ok") return false;
  const n = res.meta.sessions ?? 0;
  if (n === 0 && (res.backup.responses?.length ?? 0) === 0) return false;
  sheet({
    title: "Restore from the cloud?",
    body: `This device has no practice on it, but the cloud holds ${cloudWhose(res)}'s record: ${sessionsText(n)}. Bring it back here?`,
    cancel: "Start fresh", confirm: "Restore",
    onCancel: () => declineRestore(code),
    onConfirm: () => {
      queueToast(`Restored ${cloudWhose(res)}'s record: ${sessionsText(n)}.`);
      void loadBackup(res.backup).then(() => location.reload());
    },
  });
  void app;
  return true;
};


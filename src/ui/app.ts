import { today } from "../core/clock";
import { buildDeck } from "../core/facts";
import { allStates, freshState } from "../core/scheduler";
import type { FactState } from "../core/types";
import type { App, Route } from "./appstate";
import { dashboardScreen } from "./dashboard";
import { mount } from "./dom";
import { profilesScreen } from "./profiles";
import { collectionScreen, homeScreen } from "./screens";
import { sessionScreen } from "./session-screen";
import { speedScreen } from "./speed-screen";
import { setMuted } from "./sfx";
import { sheet } from "./sheet";
import { flushToast } from "./toast";
import { cloudAutoPush } from "./cloud";
import {
  getFacts, getMeta, loadRegistry, putFacts, putMeta, freshMeta, saveRegistry, useProfile, type Meta,
} from "./store";

const BACKUP_NUDGE_DAYS = 21;
/** Once a rider is picked, a reload inside the same visit keeps them. */
const CHOSEN_KEY = "tl-profile-chosen";

export const boot = async (root: HTMLElement): Promise<void> => {
  const deck = buildDeck();

  const registry = loadRegistry();
  useProfile(registry.active);
  const profile = registry.profiles.find((p) => p.id === registry.active) ?? registry.profiles[0]!;

  let meta: Meta;
  try {
    meta = await getMeta();
  } catch (err) {
    // An unknown schema is REJECTED, not coerced: a half-migrated progress
    // file is worse than a missing one. Say so plainly and carry on empty.
    meta = freshMeta();
    sheet({
      title: "Could not read the saved progress",
      body: `${String(err)}. Starting fresh. If you have a backup file, restore it from the grown-ups screen.`,
      confirm: "OK",
    });
  }

  // The PIN moved from the progress file to the device when profiles
  // arrived. Seed it once so nobody sets it twice.
  if (registry.pin === null && meta.pin !== null) {
    registry.pin = meta.pin;
    saveRegistry(registry);
  }

  const stored = await getFacts();
  const states = allStates(deck);
  for (const [id, s] of stored) if (states.has(id)) states.set(id, s as FactState);
  // A fact added by a later version of the deck simply starts fresh.
  for (const id of deck.keys()) if (!states.has(id)) states.set(id, freshState());

  setMuted(meta.muted);

  let chosen = false;
  try { chosen = sessionStorage.getItem(CHOSEN_KEY) !== null; } catch { /* private mode */ }
  // More than one rider on this iPad: ask who is up, every launch.
  let route: Route = registry.profiles.length > 1 && !chosen ? "profiles" : "home";

  const app: App = {
    deck, states, meta, day: today(), profile, registry,
    go: (r) => { route = r; render(); },
    save: async () => {
      await putMeta(app.meta);
      await putFacts(app.states);
      // Best-effort mirror to the cloud share, throttled, never blocking:
      // the on-device data is the gold standard.
      cloudAutoPush();
    },
    refresh: () => render(true),
    pin: () => app.registry.pin,
    setPin: (code) => { app.registry.pin = code; app.meta.pin = code; saveRegistry(app.registry); void app.save(); },
    saveRegistry: () => saveRegistry(app.registry),
    switchProfile: (id) => {
      app.registry.active = id;
      saveRegistry(app.registry);
      try { sessionStorage.setItem(CHOSEN_KEY, id); } catch { /* private mode */ }
      location.reload();
    },
  };

  const render = (keepScroll = false): void => {
    // A refresh in place (a setting flipped, a helmet bought) must not throw
    // him back to the top of a long screen (Andy, 2026-09-02). The WINDOW is
    // the scroller here (#app grows with its content; only the session screen
    // clips), and the old screen is torn down, so carry the position across.
    const prev = keepScroll ? Math.max(window.scrollY, root.querySelector(".screen")?.scrollTop ?? 0) : 0;
    const screen =
      route === "session" ? sessionScreen(app)
      : route === "speed" ? speedScreen(app)
      : route === "collection" ? collectionScreen(app)
      : route === "dashboard" ? dashboardScreen(app)
      : route === "profiles" ? profilesScreen(app)
      : homeScreen(app);
    mount(root, screen);
    window.scrollTo(0, prev);
    if (prev > 0) screen.scrollTop = prev;
  };

  render();
  flushToast();

  /**
   * iOS evicts IndexedDB from home-screen apps under storage pressure and
   * after long non-use. A backup is therefore offered on a schedule rather
   * than left in a menu nobody opens.
   */
  const nudged = meta.backupNudgedOn;
  const sessionsDeep = [...states.values()].some((s) => s.seen > 40);
  if (sessionsDeep && (nudged === null || app.day - nudged > BACKUP_NUDGE_DAYS)) {
    app.meta.backupNudgedOn = app.day;
    void app.save();
    sheet({
      title: "Time for a backup",
      body: "iPads clear app storage sometimes. Take a backup from the grown-ups screen so this progress cannot vanish.",
      cancel: "Later", confirm: "Go there", onConfirm: () => app.go("dashboard"),
    });
  }

  (window as unknown as Record<string, unknown>).__app = {
    go: (r: Route) => app.go(r),
    states: () => app.states,
    meta: () => app.meta,
    deck: () => app.deck,
    day: () => app.day,
    registry: () => app.registry,
    profile: () => app.profile,
    save: () => app.save(),
  };
};

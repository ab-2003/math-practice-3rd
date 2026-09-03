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
import { parkScreen } from "./park-screen";
import { setMuted } from "./sfx";
import { sheet } from "./sheet";
import { catchUpStreak } from "./streak";
import { flushToast } from "./toast";
import { cloudAutoPush, cloudRole, connectedCode, setCloudRole } from "./cloud";
import { offerRestore, startSync } from "./sync";
import { applySetting } from "./settings-apply";
import { advancePlay, dayOver, leftWords, routeCounts } from "./day-limit";
import { toast } from "./toast";
import type { SyncedSettings, SyncKey } from "../core/sync";
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

  // The streak, brought up to date before anything is drawn: an old save
  // keeps its number, and a day already finished still gets its ceremony.
  catchUpStreak(meta, today());

  setMuted(meta.muted);

  let chosen = false;
  try { chosen = sessionStorage.getItem(CHOSEN_KEY) !== null; } catch { /* private mode */ }
  // More than one rider on this iPad: ask who is up, every launch.
  let route: Route = registry.profiles.length > 1 && !chosen ? "profiles" : "home";

  const app: App = {
    deck, states, meta, day: today(), profile, registry,
    // A closed day admits nothing but home and the grown-ups' screen.
    go: (r) => { route = dayOver(app) && routeCounts(r) && r !== "home" ? "home" : r; render(); },
    dayDone: () => {
      route = "home";
      render();
      sheet({ title: "Time's up for today!", body: "That is all the game time for today. Nice riding. Come back tomorrow!", confirm: "OK" });
    },
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
      : route === "park" ? parkScreen(app)
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
   * THE DAY'S GAME TIME. One tick a second while the page is visible and
   * the screen counts; the warnings are toasts; the end of the day sends
   * every screen home except a session, which finishes its line first
   * (it asks dayOver at the line break). The tally is saved on its own
   * slow beat so a closed tab does not lose more than a few seconds.
   */
  let saveBeat = 0;
  const onPlay = (ev: ReturnType<typeof advancePlay>): void => {
    if (ev === "warn3" || ev === "warn1") { toast(leftWords(app)); void app.save(); }
    else if (ev === "over") { void app.save(); if (route !== "session") app.dayDone(); }
  };
  const playTick = (ms: number): void => {
    if (!routeCounts(route)) return;
    onPlay(advancePlay(app, ms));
    saveBeat += ms;
    if (saveBeat >= 15_000) { saveBeat = 0; void app.save(); }
  };
  window.setInterval(() => { if (document.visibilityState === "visible") playTick(1000); }, 1000);

  // Before the ownership rule, a linked device with practice was the writer
  // by default. Keep that true for it, once, so Kallen's iPad keeps mirroring.
  if (connectedCode() !== null && cloudRole() === null && [...states.values()].some((s) => s.introduced)) setCloudRole("owner");

  // The cloud may hold newer settings from the grown-ups' door, or, for a
  // device that lost its store, the record itself. Both non-blocking.
  void offerRestore(app).then((offered) => { if (!offered) startSync(app); });

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
    // A synced setting, through the one real path (revives, stamp, push).
    set: <K extends SyncKey>(key: K, value: SyncedSettings[K]) => { const changed = applySetting(app, key, value); return app.save().then(() => changed); },
    // The day's clock, driven by hand: the same path the ticker takes.
    playAdvance: (ms: number) => { playTick(ms); return app.save(); },
    route: () => route,
  };
};

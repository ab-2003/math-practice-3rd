import { today } from "../core/clock";
import { buildDeck } from "../core/facts";
import { allStates, freshState } from "../core/scheduler";
import type { FactState } from "../core/types";
import type { App, Route } from "./appstate";
import { dashboardScreen } from "./dashboard";
import { mount } from "./dom";
import { collectionScreen, homeScreen } from "./screens";
import { sessionScreen } from "./session-screen";
import { setMuted } from "./sfx";
import { sheet } from "./sheet";
import { getFacts, getMeta, putFacts, putMeta, freshMeta, type Meta } from "./store";

const BACKUP_NUDGE_DAYS = 21;

export const boot = async (root: HTMLElement): Promise<void> => {
  const deck = buildDeck();

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

  const stored = await getFacts();
  const states = allStates(deck);
  for (const [id, s] of stored) if (states.has(id)) states.set(id, s as FactState);
  // A fact added by a later version of the deck simply starts fresh.
  for (const id of deck.keys()) if (!states.has(id)) states.set(id, freshState());

  setMuted(meta.muted);

  let route: Route = "home";

  const app: App = {
    deck, states, meta, day: today(),
    go: (r) => { route = r; render(); },
    save: async () => { await putMeta(app.meta); await putFacts(app.states); },
    refresh: () => render(),
  };

  const render = (): void => {
    const screen =
      route === "session" ? sessionScreen(app)
      : route === "collection" ? collectionScreen(app)
      : route === "dashboard" ? dashboardScreen(app)
      : homeScreen(app);
    mount(root, screen);
    window.scrollTo(0, 0);
  };

  render();

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
  };
};

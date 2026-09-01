import { creatureById, levelCost, MAX_LEVEL, nextLocked, ROSTER } from "../core/creatures";
import { standardProgress } from "../core/standards";
import type { App } from "./appstate";
import { progressBar } from "./charts";
import { creatureSilhouette, creatureSvg } from "./creature-svg";
import { el, on } from "./dom";
import { sfx } from "./sfx";
import { sheet } from "./sheet";

const coinChip = (n: number): HTMLElement =>
  el("div", { class: "coins" }, el("span", { text: "◆" }), el("span", { text: String(n) }));

/** A small round button, used for the corner controls. */
const iconBtn = (label: string, title: string, fn: () => void, probe?: string): HTMLElement => {
  const b = el("button", {
    type: "button", class: "btn small ghost", "aria-label": title, title,
    ...(probe === undefined ? {} : { "data-probe": probe }),
  }, el("span", { text: label }));
  on(b, "click", fn);
  return b;
};

export const homeScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });

  const bar = el("div", { class: "topbar" });
  bar.append(coinChip(app.meta.coins));
  bar.append(el("div", { class: "grow" }));
  if (app.meta.streak > 1) bar.append(el("span", { class: "pill", text: `${app.meta.streak} day streak` }));
  // Two kid controls, side by side: sound, and the trick animations.
  bar.append(iconBtn(app.meta.animations ? "🛹" : "💤",
    app.meta.animations ? "Turn trick animations off" : "Turn trick animations on", () => {
      app.meta.animations = !app.meta.animations;
      void app.save();
      app.refresh();
    }, "anim-toggle"));
  bar.append(iconBtn(app.meta.muted ? "🔇" : "🔊", app.meta.muted ? "Unmute" : "Mute", () => {
    app.meta.muted = !app.meta.muted;
    void app.save();
    app.refresh();
  }, "mute-toggle"));
  bar.append(iconBtn("⚙", "Grown-ups", () => app.go("dashboard")));
  root.append(bar);

  const hero = el("div", { class: "hero" });
  hero.append(el("h1", { text: "Trick Line" }));

  // The most recent creature he owns rides the home screen. Something of his
  // own is the first thing he sees, before anything asks him to work.
  const owned = app.meta.owned;
  const star = owned.length > 0 ? creatureById(owned[owned.length - 1]!) : null;
  if (star) {
    const art = creatureSvg(star);
    art.classList.add("home-creature");
    hero.append(art);
    hero.append(el("div", { class: "mon-name", text: app.meta.names[star.id] ?? star.name }));
  } else {
    const next = nextLocked([]);
    if (next) {
      const art = creatureSvg(next);
      art.classList.add("home-creature", "target");
      hero.append(art);
      hero.append(el("p", { class: "sub", text: `Land some tricks and ${next.name} is yours.` }));
    }
  }
  root.append(hero);

  const go = el("button", { type: "button", class: "btn go big", "data-probe": "start" }, el("span", { text: "Drop In" }));
  on(go, "click", () => app.go("session"));
  root.append(go);

  const grid = el("div", { class: "home-grid" });
  const mastered = [...app.states.values()].filter((s) => s.mastered).length;
  const learning = [...app.states.values()].filter((s) => s.introduced && !s.mastered).length;
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(mastered) }), el("span", { text: "Locked in" })));
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(learning) }), el("span", { text: "Working on" })));
  root.append(grid);

  const coll = el("button", { type: "button", class: "btn alt big", "data-probe": "collection" },
    el("span", { text: `Monsters ${app.meta.owned.length}/${ROSTER.length}` }));
  on(coll, "click", () => app.go("collection"));
  root.append(coll);

  return root;
};

export const collectionScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const bar = el("div", { class: "topbar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  on(back, "click", () => app.go("home"));
  bar.append(back, el("div", { class: "grow" }), coinChip(app.meta.coins));
  root.append(bar);
  root.append(el("h2", { text: "The Crew" }));

  const grid = el("div", { class: "roster" });
  for (const c of ROSTER) {
    const owned = app.meta.owned.includes(c.id);
    const level = app.meta.levels[c.id] ?? 1;
    const tile = el("div", { class: `mon${owned ? "" : " locked"}`, "data-mon": c.id });
    tile.append(owned ? creatureSvg(c) : creatureSilhouette(c));
    tile.append(el("div", { class: "mon-name", text: owned ? (app.meta.names[c.id] ?? c.name) : "???" }));
    tile.append(el("div", { class: "mon-sub", text: owned ? `Level ${level}` : `◆ ${c.cost}` }));
    if (owned) on(tile, "click", () => monsterSheet(app, c.id));
    else if (app.meta.coins >= c.cost) {
      tile.classList.remove("locked");
      tile.classList.add("affordable");
      tile.append(el("div", { class: "mon-sub", text: "Tap to unlock" }));
      on(tile, "click", () => unlockSheet(app, c.id));
    }
    grid.append(tile);
  }
  root.append(grid);
  return root;
};

const unlockSheet = (app: App, id: string): void => {
  const c = creatureById(id);
  if (!c) return;
  sheet({
    title: `Unlock ${c.name}?`,
    body: `That is ${c.cost} coins. You have ${app.meta.coins}.`,
    cancel: "Not yet", confirm: "Unlock",
    onConfirm: () => {
      if (app.meta.coins < c.cost) return;
      app.meta.coins -= c.cost;
      app.meta.owned.push(c.id);
      app.meta.levels[c.id] = 1;
      sfx.roar();
      void app.save();
      revealSheet(app, c.id);
    },
  });
};

export const revealSheet = (app: App, id: string): void => {
  const c = creatureById(id);
  if (!c) return;
  const body = el("div", { class: "reveal" });
  body.append(creatureSvg(c));
  body.append(el("h2", { text: c.name }));
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  sheet({ title: "New monster!", body, confirm: "Nice", onConfirm: () => app.refresh() });
};

const monsterSheet = (app: App, id: string): void => {
  const c = creatureById(id);
  if (!c) return;
  const level = app.meta.levels[c.id] ?? 1;
  const cost = levelCost(level);
  const body = el("div", { class: "reveal" });
  body.append(creatureSvg(c));
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  body.append(el("div", { class: "mon-sub", text: `Level ${level} of ${MAX_LEVEL}` }));

  const rename = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "Rename" }));
  on(rename, "click", () => {
    const given = window.prompt("Give it a name", app.meta.names[c.id] ?? c.name);
    if (given !== null && given.trim() !== "") {
      app.meta.names[c.id] = given.trim().slice(0, 18).toUpperCase();
      void app.save();
      app.refresh();
    }
  });
  body.append(rename);

  sheet({
    title: app.meta.names[c.id] ?? c.name,
    body,
    cancel: "Close",
    ...(level < MAX_LEVEL && app.meta.coins >= cost
      ? {
          confirm: `Level up ◆${cost}`,
          onConfirm: (): void => {
            app.meta.coins -= cost;
            app.meta.levels[c.id] = level + 1;
            sfx.coin();
            void app.save();
            app.refresh();
          },
        }
      : {}),
  });
};

/** Shown on the home screen inside the dashboard: where he stands on the SOLs. */
export const standardsCard = (app: App): HTMLElement => {
  const card = el("div", { class: "card" });
  card.append(el("h3", { text: "Virginia standards" }));
  for (const s of standardProgress(app.deck, app.states)) {
    card.append(el("div", { class: "mon-sub", text: `${s.code} (grade ${s.grade}) — ${s.title}` }));
    card.append(progressBar(s.pct, s.grade === 3 ? "#B6FF3C" : "#35E6FF"));
    card.append(el("p", { class: "note", text: `${s.mastered} of ${s.total} from memory, ${s.inProgress} in progress.` }));
  }
  return card;
};

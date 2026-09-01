import { cheapestLocked, creatureById, levelCost, MAX_LEVEL, ROSTER, type Creature } from "../core/creatures";
import { HELMETS, helmetById, type Helmet } from "../core/gear";
import { standardProgress } from "../core/standards";
import type { App } from "./appstate";
import { progressBar } from "./charts";
import { creatureSvg, helmetIcon } from "./creature-svg";
import { el, on, svg } from "./dom";
import { sfx } from "./sfx";
import { sheet } from "./sheet";

/** Who rides: his explicit pick, else the newest owned, else the target. */
export const resolveRider = (app: App): Creature => {
  const picked = app.meta.rider !== null ? creatureById(app.meta.rider) : null;
  if (picked && app.meta.owned.includes(picked.id)) return picked;
  const owned = app.meta.owned;
  const newest = owned.length > 0 ? creatureById(owned[owned.length - 1]!) : null;
  return newest ?? cheapestLocked(app.meta.owned) ?? ROSTER[0]!;
};

/** The day's work is DONE when today's answered items reach the parent-set
 *  goal. The badge, the jingle, the extra-practice label and the shop all
 *  key off this one truth. */
export const doseDone = (app: App): boolean =>
  app.meta.doseDay === app.day && app.meta.doseCount >= app.meta.dailyGoal;

/** The prominent stamp for a finished day: a starburst that stamps in once
 *  and then gleams. Retired the little text pill; this is the real thing. */
const dailyBadge = (): HTMLElement => {
  const wrap = el("div", { class: "daily-badge", "data-probe": "daily-badge" });
  const g = svg("svg", { viewBox: "0 0 200 200", class: "badge-star" });
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 96 : 78;
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${100 + Math.cos(a) * r},${100 + Math.sin(a) * r}`);
  }
  g.append(svg("polygon", { points: pts.join(" "), fill: "#B6FF3C", stroke: "#05070A", "stroke-width": 6 }));
  g.append(svg("circle", { cx: 100, cy: 100, r: 70, fill: "none", stroke: "#05070A", "stroke-width": 4, "stroke-dasharray": "3 7" }));
  g.append(svg("text", { x: 100, y: 88, "text-anchor": "middle", "font-size": 21, "font-weight": 900, fill: "#05070A" }, "TODAY'S"));
  g.append(svg("text", { x: 100, y: 112, "text-anchor": "middle", "font-size": 21, "font-weight": 900, fill: "#05070A" }, "WORK"));
  g.append(svg("text", { x: 100, y: 140, "text-anchor": "middle", "font-size": 27, "font-weight": 900, fill: "#05070A" }, "DONE ✓"));
  wrap.append(g);
  return wrap;
};

/** Little game-art icons for the big buttons: ink shapes on the coloured
 *  slabs, same sticker language as everything else. */
const iconSkate = (): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 44 22", class: "btn-ico", "aria-hidden": "true" });
  g.append(svg("path", { d: "M5 6 C1 6 1 13 5 13 L39 13 C43 13 43 6 39 6 Z", fill: "#05070A" }));
  g.append(svg("circle", { cx: 13, cy: 17, r: 4, fill: "#05070A" }));
  g.append(svg("circle", { cx: 31, cy: 17, r: 4, fill: "#05070A" }));
  return g;
};
const iconMonster = (): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 40 30", class: "btn-ico", "aria-hidden": "true" });
  g.append(svg("path", { d: "M6 26 L8 12 L14 6 L27 6 L34 13 L34 26 Z", fill: "#05070A" }));
  g.append(svg("path", { d: "M11 6 L14 0 L17 6 Z M21 6 L24 0 L27 6 Z", fill: "#05070A" }));
  g.append(svg("circle", { cx: 16, cy: 14, r: 3.4, fill: "#35E6FF" }));
  g.append(svg("circle", { cx: 26, cy: 14, r: 3.4, fill: "#35E6FF" }));
  g.append(svg("path", { d: "M12 21 l4 4 l4 -4 l4 4 l4 -4", fill: "none", stroke: "#35E6FF", "stroke-width": 2.4 }));
  return g;
};

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
  const star = owned.length > 0 ? resolveRider(app) : null;
  if (star) {
    const starHelm = app.meta.gear[star.id] !== undefined ? helmetById(app.meta.gear[star.id]!) : undefined;
    const art = creatureSvg(star, { level: app.meta.levels[star.id] ?? 1, ...(starHelm ? { helmet: starHelm } : {}) });
    art.classList.add("home-creature");
    hero.append(art);
    hero.append(el("div", { class: "mon-name", text: app.meta.names[star.id] ?? star.name }));
  } else {
    const next = cheapestLocked([]);
    if (next) {
      const art = creatureSvg(next);
      art.classList.add("home-creature", "target");
      hero.append(art);
      hero.append(el("p", { class: "sub", text: "Land some tricks, then pick any monster in the shop." }));
    }
  }
  root.append(hero);

  // Today's state lives on the button and, when the work is done, on the
  // big stamp beside the hero: after the dose, everything is EXTRA PRACTICE.
  const done = doseDone(app);
  if (done) hero.append(dailyBadge());
  const go = el("button", { type: "button", class: "btn go big", "data-probe": "start" },
    iconSkate(), el("span", { text: done ? "Extra Practice" : "Drop In" }));
  on(go, "click", () => app.go("session"));
  root.append(go);
  if (!done) {
    const todayN = app.meta.doseDay === app.day ? app.meta.doseCount : 0;
    const dose = el("div", { class: "dose-line", "data-probe": "dose-progress" });
    dose.append(el("span", { class: "mon-sub", text: `Today's tricks: ${todayN} / ${app.meta.dailyGoal}` }));
    dose.append(progressBar(Math.min(100, Math.round((todayN / app.meta.dailyGoal) * 100)), "#B6FF3C"));
    root.append(dose);
  }

  const grid = el("div", { class: "home-grid" });
  const mastered = [...app.states.values()].filter((s) => s.mastered).length;
  const learning = [...app.states.values()].filter((s) => s.introduced && !s.mastered).length;
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(mastered) }), el("span", { text: "Locked in" })));
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(learning) }), el("span", { text: "Working on" })));
  root.append(grid);

  // Progress toward the next monster, always visible: the classic lever,
  // and it was simply missing.
  const target = cheapestLocked(app.meta.owned);
  if (target) {
    const prog = el("div", { class: "card unlock-progress", "data-probe": "unlock-progress" });
    const pct = Math.min(100, Math.round((app.meta.coins / target.cost) * 100));
    prog.append(el("div", { class: "mon-sub", text: app.meta.coins >= target.cost
      ? "A new monster is in reach! Pick anyone you can afford."
      : `Nearest monster: ${target.name}` }));
    prog.append(progressBar(pct, "#FFE14D"));
    prog.append(el("div", { class: "mon-sub", text: `◆ ${app.meta.coins} / ${target.cost}` }));
    root.append(prog);
  }

  const coll = el("button", { type: "button", class: "btn alt big", "data-probe": "collection" },
    iconMonster(), el("span", { text: `Monsters ${app.meta.owned.length}/${ROSTER.length}` }));
  on(coll, "click", () => app.go("collection"));
  root.append(coll);

  return root;
};

const PEEK_MS = 60_000;

export const collectionScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const bar = el("div", { class: "topbar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  on(back, "click", () => app.go("home"));
  bar.append(back, el("div", { class: "grow" }), coinChip(app.meta.coins));
  root.append(bar);

  // THE PEEK (Andy 2026-09-01): before today's run the shop opens ONCE, for
  // one minute from the moment it opens; then it shuts until the run is done.
  // After today's run it stays open until midnight. Wanting to get back in
  // is supposed to point at the DROP IN button.
  const runDone = doseDone(app);
  if (!runDone) {
    if (app.meta.shopPeekDay !== app.day) {
      app.meta.shopPeekDay = app.day;
      app.meta.shopPeekAt = Date.now();
      void app.save();
    }
    const elapsed = Date.now() - (app.meta.shopPeekAt ?? Date.now());
    if (elapsed > PEEK_MS) {
      root.append(el("h2", { text: "The Crew" }));
      const closedCard = el("div", { class: "card reveal", "data-probe": "shop-locked" });
      closedCard.append(el("h2", { text: "Shop opens after today's run" }));
      closedCard.append(el("p", { class: "note", text: "You had your peek. Land today's tricks and the whole shop is yours until midnight." }));
      const goRun = el("button", { type: "button", class: "btn go big" }, el("span", { text: "Drop In" }));
      on(goRun, "click", () => app.go("session"));
      closedCard.append(goRun);
      root.append(closedCard);
      return root;
    }
    root.append(el("p", { class: "note peek-note", "data-probe": "shop-peek",
      text: "Quick look! The shop opens for real after today's run." }));
    const watcher = window.setInterval(() => {
      if (!root.isConnected) { window.clearInterval(watcher); return; }
      if (Date.now() - (app.meta.shopPeekAt ?? 0) > PEEK_MS) {
        window.clearInterval(watcher);
        app.go("home");
        sheet({
          title: "Peek's over!",
          body: "The shop opens for the rest of the day once today's run is done.",
          cancel: "OK",
          confirm: "Drop in",
          onConfirm: () => app.go("session"),
        });
      }
    }, 1000);
  }

  root.append(el("h2", { text: "The Crew" }));

  const grid = el("div", { class: "roster" });
  let tileIndex = 0;
  for (const c of ROSTER) {
    const owned = app.meta.owned.includes(c.id);
    const level = app.meta.levels[c.id] ?? 1;
    // NO MYSTERIES (Andy 2026-09-01): every monster shows itself and its
    // price, and he buys whichever one he wants, in any order.
    const helm = app.meta.gear[c.id] !== undefined ? helmetById(app.meta.gear[c.id]!) : undefined;
    const tile = el("div", { class: `mon${owned ? "" : " shop-locked"}`, "data-mon": c.id });
    // Staggered so they never move in lockstep; near-misses are fine.
    const idle = ((tileIndex++) * 0.73) % 5.2;
    tile.append(creatureSvg(c, { level, idle, ...(owned && helm ? { helmet: helm } : {}) }));
    tile.append(el("div", { class: "mon-name", text: owned ? (app.meta.names[c.id] ?? c.name) : c.name }));
    tile.append(owned
      ? el("div", { class: "mon-sub", text: `Level ${level}` })
      : el("div", { class: `price-chip${app.meta.coins >= c.cost ? " can" : ""}`, text: `◆ ${c.cost}` }));
    if (owned && resolveRider(app).id === c.id) {
      tile.append(el("div", { class: "riding-badge", text: "RIDING" }));
    }
    on(tile, "click", () => (owned ? monsterSheet(app, c.id) : buySheet(app, c.id)));
    grid.append(tile);
  }
  root.append(grid);

  // THE GEAR RACK: twenty helmets, bought once, worn by anyone he owns.
  // Locked until the first monster: gear for a crew you do not have yet is
  // just noise on day one (Andy 2026-09-01).
  const rackOpen = app.meta.owned.length > 0;
  root.append(el("h2", { text: "The Gear Rack", style: "margin-top:18px" }));
  root.append(el("p", { class: "note", "data-probe": "rack-note", text: rackOpen
    ? "Buy a helmet once and any of the crew can wear it. Put it on from a monster's card."
    : "Helmets need heads. Pick your first monster and the rack opens." }));
  const rack = el("div", { class: `gear-rack${rackOpen ? "" : " rack-locked"}` });
  for (const h of HELMETS) {
    const has = app.meta.helmetsOwned.includes(h.id);
    const t = el("button", {
      type: "button", class: `helm-tile${has ? " owned" : ""}`, "data-helm": h.id,
      ...(rackOpen ? {} : { disabled: true }),
    });
    t.append(helmetIcon(h));
    t.append(el("span", { class: "helm-name", text: h.name }));
    t.append(el("span", { class: "mon-sub", text: has ? "owned" : `◆ ${h.cost}` }));
    on(t, "click", () => { if (app.meta.owned.length > 0) helmSheet(app, h); });
    rack.append(t);
  }
  root.append(rack);
  return root;
};

const helmSheet = (app: App, h: Helmet): void => {
  const has = app.meta.helmetsOwned.includes(h.id);
  const body = el("div", { class: "reveal" });
  body.append(helmetIcon(h));
  if (has) {
    sheet({ title: h.name, body: "Already in the locker. Put it on from any monster's card.", confirm: "OK" });
    return;
  }
  const affordable = app.meta.coins >= h.cost;
  sheet({
    title: affordable ? `Buy ${h.name}?` : h.name,
    body: affordable
      ? `${h.cost} coins. You have ${app.meta.coins}, so you would have ${app.meta.coins - h.cost} left.`
      : `${h.cost} coins. You have ${app.meta.coins}, so keep landing tricks.`,
    cancel: "Not yet",
    ...(affordable ? {
      confirm: `Buy ◆${h.cost}`,
      onConfirm: (): void => {
        app.meta.coins -= h.cost;
        app.meta.helmetsOwned.push(h.id);
        sfx.coin();
        void app.save().then(() => app.refresh());
      },
    } : {}),
  });
};

/** Buying a monster HE chose. The reveal still pops, because it earned it. */
const buySheet = (app: App, id: string): void => {
  const c = creatureById(id);
  if (!c) return;
  const affordable = app.meta.coins >= c.cost;
  const body = el("div", { class: "reveal" });
  // On a card the monster performs on a FAST loop: act, breathe for a couple
  // of seconds, act again. The shop saunters; the spotlight does not.
  body.append(creatureSvg(c, { idle: 0.3, fastIdle: true }));
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  body.append(el("p", { class: "note", text: affordable
    ? `${c.cost} coins. You have ${app.meta.coins}, so you would have ${app.meta.coins - c.cost} left.`
    : `${c.cost} coins. You have ${app.meta.coins}, so keep landing tricks.` }));
  sheet({
    title: affordable ? `Buy ${c.name}?` : c.name,
    body,
    cancel: "Not yet",
    ...(affordable ? {
      confirm: `Buy ◆${c.cost}`,
      onConfirm: (): void => {
        app.meta.coins -= c.cost;
        app.meta.owned.push(c.id);
        app.meta.levels[c.id] = 1;
        sfx.roar();
        void app.save().then(() => revealSheet(app, c.id));
      },
    } : {}),
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
  const wornId = (): string | undefined => app.meta.gear[c.id];
  const worn = (): Helmet | undefined => {
    const w = wornId();
    return w !== undefined ? helmetById(w) : undefined;
  };
  let bigArt = creatureSvg(c, { level, idle: 0.3, fastIdle: true, ...(worn() ? { helmet: worn()! } : {}) });
  body.append(bigArt);
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  body.append(el("div", { class: "mon-sub", text: `Level ${level} of ${MAX_LEVEL}` }));

  // The gear row: NONE plus everything in the locker. Updates in place so
  // he sees the helmet land on the monster the moment he taps it.
  if (app.meta.helmetsOwned.length > 0) {
    const row = el("div", { class: "gear-row" });
    const redraw = (): void => {
      const fresh = creatureSvg(c, { level, idle: 0.3, fastIdle: true, ...(worn() ? { helmet: worn()! } : {}) });
      bigArt.replaceWith(fresh);
      bigArt = fresh;
      for (const t of Array.from(row.children)) {
        const idAttr = (t as HTMLElement).dataset["equip"] ?? "";
        t.classList.toggle("sel", idAttr === (wornId() ?? ""));
      }
    };
    const noneTile = el("button", { type: "button", class: `gear-pick${wornId() === undefined ? " sel" : ""}`, "data-equip": "" }, el("span", { text: "none" }));
    on(noneTile, "click", () => {
      const g = { ...app.meta.gear };
      delete g[c.id];
      app.meta.gear = g;
      void app.save();
      redraw();
    });
    row.append(noneTile);
    for (const hid of app.meta.helmetsOwned) {
      const h = helmetById(hid);
      if (!h) continue;
      const t = el("button", { type: "button", class: `gear-pick${wornId() === hid ? " sel" : ""}`, "data-equip": hid, "aria-label": h.name });
      t.append(helmetIcon(h));
      on(t, "click", () => {
        app.meta.gear = { ...app.meta.gear, [c.id]: hid };
        void app.save();
        redraw();
      });
      row.append(t);
    }
    body.append(row);
  }

  // SEND OUT: he picks who rides. Agency turns the collection from a museum
  // into a pre-run ritual.
  if (resolveRider(app).id !== c.id) {
    const send = el("button", { type: "button", class: "btn small alt", "data-probe": "send-out" }, el("span", { text: "Send out" }));
    on(send, "click", () => {
      app.meta.rider = c.id;
      void app.save();
      app.refresh();
    });
    body.append(send);
  } else {
    body.append(el("p", { class: "mon-sub", text: "Riding today" }));
  }

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

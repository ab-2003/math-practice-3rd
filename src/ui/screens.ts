import { boardFor, BOARDS, ownedBoards, PLAIN_BOARD, type Board } from "../core/boards";
import { canLevelUp, cheapestLocked, creatureById, levelBrings, levelCost, MAX_LEVEL, ROSTER, type Creature } from "../core/creatures";
import { HELMETS, helmetById, type Helmet } from "../core/gear";
import { boardSvg } from "./board-svg";
import { standardProgress } from "../core/standards";
import type { App } from "./appstate";
import { progressBar } from "./charts";
import { creatureSvg, helmetIcon } from "./creature-svg";
import { el, on, svg } from "./dom";
import { doseDone, speedAttemptsToday, speedKey } from "./day";
import { tokenIcon } from "./icons";
import { parkGate, spentToday } from "../core/park";
import { dayOver, limitOn, remainingMs } from "./day-limit";
export { doseDone } from "./day"; // session-screen imports it from here
import { sfx } from "./sfx";
import { sheet } from "./sheet";
import { confirmSpend } from "./spend";
import { claimStreak } from "./streak";

/** Who rides: his explicit pick, else the newest owned, else the target. */
export const resolveRider = (app: App): Creature => {
  const picked = app.meta.rider !== null ? creatureById(app.meta.rider) : null;
  if (picked && app.meta.owned.includes(picked.id)) return picked;
  const owned = app.meta.owned;
  const newest = owned.length > 0 ? creatureById(owned[owned.length - 1]!) : null;
  return newest ?? cheapestLocked(app.meta.owned) ?? ROSTER[0]!;
};

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
  el("div", { class: "coins" }, el("span", { text: "◆" }), el("span", { class: "chip-n", text: String(n) }));

/** The corner icons, drawn in the same ink as everything else: emoji looked
 *  like a different app sitting on top of this one. */
const ico = (paths: string[], extra: SVGElement[] = []): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 24 24", class: "ico", "aria-hidden": "true" });
  for (const d of paths) g.append(svg("path", { d }));
  for (const e of extra) g.append(e);
  return g;
};
const icoBoard = (): SVGElement => ico(
  ["M4 9 C1.5 9 1.5 13 4 13 L20 13 C22.5 13 22.5 9 20 9 Z"],
  [svg("circle", { cx: 8, cy: 16.5, r: 2.2 }), svg("circle", { cx: 16, cy: 16.5, r: 2.2 })],
);
const icoMoon = (): SVGElement => ico(["M14 3 A9 9 0 1 0 21 15.5 A7 7 0 0 1 14 3 Z"]);
const icoSound = (): SVGElement => {
  const g = ico(["M3 9 L7.5 9 L13 4.5 L13 19.5 L7.5 15 L3 15 Z"]);
  g.append(svg("path", { d: "M16 8.5 Q19 12 16 15.5 M18.5 5.5 Q23.5 12 18.5 18.5", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round" }));
  return g;
};
const icoMuted = (): SVGElement => {
  const g = ico(["M3 9 L7.5 9 L13 4.5 L13 19.5 L7.5 15 L3 15 Z"]);
  g.append(svg("path", { d: "M16.5 8.5 L22 15.5 M22 8.5 L16.5 15.5", fill: "none", stroke: "currentColor", "stroke-width": 2.4, "stroke-linecap": "round" }));
  return g;
};
const icoGear = (): SVGElement => {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = 12 + Math.cos(a) * 8.5;
    const y = 12 + Math.sin(a) * 8.5;
    return `M${x - 2.2} ${y - 2.2} h4.4 v4.4 h-4.4 Z`;
  }).join(" ");
  const g = ico([teeth]);
  g.append(svg("circle", { cx: 12, cy: 12, r: 7 }));
  g.append(svg("circle", { cx: 12, cy: 12, r: 3, fill: "var(--panel)" }));
  return g;
};

/** A small round button, used for the corner controls. */
const iconBtn = (icon: SVGElement, title: string, fn: () => void, probe?: string): HTMLElement => {
  const b = el("button", {
    type: "button", class: "btn small ghost", "aria-label": title, title,
    ...(probe === undefined ? {} : { "data-probe": probe }),
  }, icon);
  on(b, "click", fn);
  return b;
};

export const homeScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });

  const bar = el("div", { class: "topbar" });
  const wallet = coinChip(app.meta.coins);
  bar.append(wallet);
  // More than one rider on this iPad: whose coins these are, and the way to
  // the picker. With one rider the bar stays clean.
  if (app.registry.profiles.length > 1) {
    const who = el("button", { type: "button", class: "pill name-chip", "data-probe": "name-chip" }, el("span", { text: app.profile.name }));
    on(who, "click", () => app.go("profiles"));
    bar.append(who);
  }
  bar.append(el("div", { class: "grow" }));
  let streakPill: HTMLElement | null = null;
  if (app.meta.streak > 1) {
    streakPill = el("span", { class: `pill${app.meta.streak >= 7 ? " streak-hot" : ""}`, "data-probe": "streak-pill", text: `${app.meta.streak} day streak` });
    bar.append(streakPill);
  }
  // Two kid controls, side by side: sound, and the trick animations.
  bar.append(iconBtn(app.meta.animations ? icoBoard() : icoMoon(),
    app.meta.animations ? "Turn trick animations off" : "Turn trick animations on", () => {
      app.meta.animations = !app.meta.animations;
      void app.save();
      app.refresh();
    }, "anim-toggle"));
  bar.append(iconBtn(app.meta.muted ? icoMuted() : icoSound(), app.meta.muted ? "Unmute" : "Mute", () => {
    app.meta.muted = !app.meta.muted;
    void app.save();
    app.refresh();
  }, "mute-toggle"));
  bar.append(iconBtn(icoGear(), "Grown-ups", () => app.go("dashboard"), "grownups"));
  root.append(bar);

  // THE HOME BODY (Andy's landscape iPad, 2026-09-03): the hero and the
  // controls are two blocks. Stacked on a phone and a portrait tablet;
  // side by side on a tablet on its side, where stacking scrolled and the
  // monster came out tiny.
  const body = el("div", { class: "home-body" });
  const panel = el("div", { class: "home-panel" });
  root.append(body);
  const hero = el("div", { class: "hero" });
  hero.append(el("h1", { text: "Trick Line" }));

  // The most recent creature he owns rides the home screen. Something of his
  // own is the first thing he sees, before anything asks him to work.
  const owned = app.meta.owned;
  const star = owned.length > 0 ? resolveRider(app) : null;
  if (star) {
    const starHelm = app.meta.gear[star.id] !== undefined ? helmetById(app.meta.gear[star.id]!) : undefined;
    // THE RIDER PERFORMS AT HOME (Andy, 2026-09-03): its shop act, once on
    // arrival and then every fifteen seconds. The act runs at its own speed
    // (one idle cycle), then every animation is parked at its rest pose
    // until the next beat; a fifteen second cycle would have been slow
    // motion, since the keyframes are percentages.
    const art = creatureSvg(star, { level: app.meta.levels[star.id] ?? 1, idle: 0, ...(starHelm ? { helmet: starHelm } : {}) });
    art.classList.add("home-creature");
    hero.append(art);
    const anims = (): Animation[] => art.getAnimations({ subtree: true });
    const rest = (): void => { for (const a of anims()) { a.pause(); a.currentTime = 0; } };
    const act = (): void => { for (const a of anims()) { a.currentTime = 0; a.play(); } window.setTimeout(rest, HOME_ACT_MS); };
    window.setTimeout(act, 60);
    const beat = window.setInterval(() => { if (!root.isConnected) { window.clearInterval(beat); return; } act(); }, HOME_ACT_EVERY_MS);
    void beat;
    // The rider stands on its board: a bought deck is visible before any run.
    const deck = boardFor(app.meta.boardOf, star.id, app.meta.boardsOwned);
    if (deck.id !== PLAIN_BOARD) hero.append(boardSvg(deck, { cls: "home-board" }));
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
  body.append(hero, panel);

  // Today's state lives on the button and, when the work is done, on the
  // big stamp beside the hero: after the dose, everything is EXTRA PRACTICE.
  const done = doseDone(app);
  if (done) hero.append(dailyBadge());
  // THE DAY'S GAME TIME is up: the doors close, the words say why, and
  // the grown-ups' gear stays open above.
  const closed = dayOver(app);
  if (closed) {
    panel.append(el("div", { class: "card closed-card", "data-probe": "day-closed" },
      el("b", { text: "Time's up for today" }),
      el("span", { class: "mon-sub", text: "That is all the game time for today. Come back tomorrow!" })));
  } else if (limitOn(app)) {
    const left = Math.ceil(remainingMs(app) / 60_000);
    panel.append(el("div", { class: "mon-sub left-line", "data-probe": "time-left", text: `${left} ${left === 1 ? "minute" : "minutes"} of game time left today` }));
  }
  const go = el("button", { type: "button", class: "btn go big", "data-probe": "start", ...(closed ? { disabled: true } : {}) },
    iconSkate(), el("span", { text: closed ? "Come back tomorrow" : done ? "Extra Practice" : "Drop In" }));
  on(go, "click", () => app.go("session"));
  panel.append(go);
  if (!done) {
    const todayN = app.meta.doseDay === app.day ? app.meta.doseCount : 0;
    const dose = el("div", { class: "dose-line", "data-probe": "dose-progress" });
    dose.append(el("span", { class: "mon-sub", text: `Today's tricks: ${todayN} / ${app.meta.dailyGoal}` }));
    dose.append(progressBar(Math.min(100, Math.round((todayN / app.meta.dailyGoal) * 100)), "#B6FF3C"));
    panel.append(dose);
  }

  const grid = el("div", { class: "home-grid three" });
  const mastered = [...app.states.values()].filter((s) => s.mastered).length;
  const learning = [...app.states.values()].filter((s) => s.introduced && !s.mastered).length;
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(mastered) }), el("span", { text: "Locked in" })));
  grid.append(el("div", { class: "card stat" }, el("b", { text: String(learning) }), el("span", { text: "Working on" })));
  // SPEED RUN rides the stats row: a distinct door, no new vertical space.
  const bestNow = app.meta.speedBest[speedKey(app)] ?? 0;
  const used = speedAttemptsToday(app);
  const speed = el("button", { type: "button", class: "card stat speed-cell", "data-probe": "speed-open", ...(closed ? { disabled: true } : {}) },
    el("b", { text: "⚡ SPEED RUN" }),
    el("span", { text: `${bestNow > 0 ? `best ${bestNow} · ` : ""}${used}/${app.meta.speedLimit} today` }));
  on(speed, "click", () => app.go("speed"));
  grid.append(speed);
  panel.append(grid);

  // THE SKATE PARK (0.19.0): the daily reward's door. Dim until the first
  // Daily Token drops, lit from then on, with the pocket and today's plays.
  const parkOpen = app.meta.parkUnlocked;
  const gate = parkGate(app.meta, app.day);
  const park = el("button", {
    type: "button", class: `btn big park-btn${parkOpen ? " alt" : " ghost dim"}${parkOpen && gate.ok && !app.meta.parkSeen && !closed ? " park-new" : ""}`,
    "data-probe": "park-open", ...(closed ? { disabled: true } : {}),
  }, tokenIcon("btn-ico token-btn"), el("span", { text: parkOpen
    ? `Skate Park · ${app.meta.tokens} ${app.meta.tokens === 1 ? "token" : "tokens"}`
    : "Skate Park" }));
  if (parkOpen) {
    on(park, "click", () => app.go("park"));
    const plays = app.meta.parkTokensPerDay - spentToday(app.meta, app.day);
    park.append(el("small", { class: "park-sub", "data-probe": "park-sub", text: gate.ok
      ? `${plays} ${plays === 1 ? "play" : "plays"} left today`
      : gate.why === "dayFull" ? "closed until tomorrow" : "finish today's tricks for a token" }));
  } else {
    // One line for the name, one small line for how to light it: a two
    // line slab was the tallest thing on Andy's phone.
    park.append(el("small", { class: "park-sub", "data-probe": "park-sub", text: "earn a Daily Token" }));
    on(park, "click", () => sheet({ title: "The Skate Park", body: "Finish today's tricks and a Daily Token drops. A token opens the park: your monster, its board, its helmet, tricks down a line.", confirm: "OK" }));
  }
  panel.append(park);

  // Progress toward the next monster, always visible: the classic lever,
  // and it was simply missing.
  const target = cheapestLocked(app.meta.owned);
  if (target) {
    const prog = el("div", { class: "card unlock-progress", "data-probe": "unlock-progress" });
    const pct = Math.min(100, Math.round((app.meta.coins / target.cost) * 100));
    prog.append(el("div", { class: "mon-sub grow", text: app.meta.coins >= target.cost
      ? "A new monster is in reach!"
      : `Nearest monster: ${target.name}` }));
    prog.append(el("div", { class: "mon-sub", text: `◆ ${app.meta.coins} / ${target.cost}` }));
    const bar = progressBar(pct, "#FFE14D");
    bar.classList.add("unlock-bar");
    prog.append(bar);
    panel.append(prog);
  }

  const coll = el("button", { type: "button", class: "btn alt big", "data-probe": "collection", ...(closed ? { disabled: true } : {}) },
    iconMonster(), el("span", { text: `Monster Shop ${app.meta.owned.length}/${ROSTER.length}` }));
  on(coll, "click", () => app.go("collection"));
  panel.append(coll);

  // THE STREAK CEREMONY (Andy, 2026-09-03) happens HERE and nowhere else.
  // Finishing the day's work happens mid-problem, so the purse is owed there
  // and paid here: not on top of a problem, not in the shop, and not behind
  // the sheet the run's end puts up. It waits for a clear home screen,
  // however long that takes, and if he leaves first it simply waits again.
  if (app.meta.streakOwed >= 2) {
    const ceremony = (): void => {
      if (!root.isConnected) return;                  // gone again; the purse keeps
      if (document.querySelector(".scrim") !== null) { window.setTimeout(ceremony, 250); return; }
      const won = claimStreak(app.meta);
      if (!won) return;
      void app.save();
      const n = wallet.querySelector(".chip-n");
      if (n) n.textContent = String(app.meta.coins);
      wallet.classList.add("bump");
      sfx.streakJingle();
      const b = el("div", { class: "streak-banner", "data-probe": "streak-ceremony" },
        el("div", { class: "sb-big", text: `${won.days} DAY STREAK!` }),
        el("div", { class: "sb-sub", "data-probe": "streak-purse", text: `+${won.coins} coins` }));
      for (const [x, y, d] of [[12, 24, 0], [82, 18, 140], [26, 74, 260], [70, 80, 380], [48, 8, 500]] as const) {
        b.append(el("span", { class: "sb-spark", style: `left:${x}%;top:${y}%;animation-delay:${d}ms` }));
      }
      root.append(b);
      window.setTimeout(() => { b.remove(); wallet.classList.remove("bump"); }, 2600);
      if (streakPill) {
        streakPill.classList.add("streak-won");
        streakPill.append(el("span", { class: "streak-plus", "data-probe": "streak-plus", text: `+${won.coins}` }));
        window.setTimeout(() => { streakPill?.classList.remove("streak-won"); streakPill?.querySelector(".streak-plus")?.remove(); }, 3200);
      }
    };
    window.setTimeout(ceremony, 160);
  }

  return root;
};

const PEEK_MS = 60_000;
/** The home rider's act: one idle cycle, then a rest until the next beat. */
export const HOME_ACT_MS = 4900;
export const HOME_ACT_EVERY_MS = 15_000;

export const collectionScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  // The wallet rides along as the shop scrolls (Andy, 2026-09-03): the
  // balance is the whole question in a shop.
  const bar = el("div", { class: "topbar shop-bar", "data-probe": "shop-bar" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  // Walking out of a peek ends it; the handler below is set once we know.
  let onLeave: (() => void) | null = null;
  on(back, "click", () => { onLeave?.(); app.go("home"); });
  bar.append(back, el("div", { class: "grow" }), coinChip(app.meta.coins));
  root.append(bar);

  // THE PEEK (Andy 2026-09-01): before today's run the shop opens ONCE, for
  // one minute from the moment it opens; then it shuts until the run is done.
  // After today's run it stays open until midnight. Wanting to get back in
  // is supposed to point at the DROP IN button.
  //
  // ONE VISIT, NOT ONE MINUTE (Andy's alpha report, 2026-09-02: "let me
  // enter several times"). Leaving the shop inside the minute spends the
  // peek too, and the minute itself is a thin bar that shrinks, so the end
  // of the look is never a surprise.
  const runDone = doseDone(app);
  if (!runDone) {
    if (app.meta.shopPeekDay !== app.day) {
      app.meta.shopPeekDay = app.day;
      app.meta.shopPeekAt = Date.now();
      app.meta.shopPeekSpent = false;
      void app.save();
    }
    const elapsed = Date.now() - (app.meta.shopPeekAt ?? Date.now());
    if (elapsed > PEEK_MS || app.meta.shopPeekSpent) {
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
    const spend = (): void => {
      if (app.meta.shopPeekSpent) return;
      app.meta.shopPeekSpent = true;
      void app.save();
    };
    onLeave = spend;
    root.append(el("p", { class: "note peek-note", "data-probe": "shop-peek",
      text: "Quick look! The shop opens for real after today's run." }));
    const timer = el("div", { class: "speed-timer peek-timer", "data-probe": "peek-timer", role: "progressbar", "aria-label": "Quick look time left" });
    const fill = el("div", { class: "speed-fill" });
    timer.append(fill);
    root.append(timer);
    const paintBar = (): void => {
      const left = Math.max(0, PEEK_MS - (Date.now() - (app.meta.shopPeekAt ?? 0)));
      fill.style.width = `${(left / PEEK_MS) * 100}%`;
    };
    paintBar();
    const watcher = window.setInterval(() => {
      // Gone from the screen by any road: the peek is spent.
      if (!root.isConnected) { window.clearInterval(watcher); spend(); return; }
      paintBar();
      if (Date.now() - (app.meta.shopPeekAt ?? 0) > PEEK_MS) {
        window.clearInterval(watcher);
        spend();
        app.go("home");
        sheet({
          title: "Peek's over!",
          body: "The shop opens for the rest of the day once today's run is done.",
          cancel: "OK",
          confirm: "Drop in",
          onConfirm: () => app.go("session"),
        });
      }
    }, 200);
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
    if (owned) {
      // THE LEVEL IS SURFACED (Andy, 2026-09-02): when the wallet covers the
      // next level the tile says so, right on the "Level N" line.
      const line = el("div", { class: "mon-sub", text: `Level ${level}` });
      if (canLevelUp(level, app.meta.coins)) line.append(el("span", { class: "lvl-ready", "data-probe": "level-ready", text: "LEVEL UP ▲" }));
      tile.append(line);
    } else {
      tile.append(el("div", { class: `price-chip${app.meta.coins >= c.cost ? " can" : ""}`, text: `◆ ${c.cost}` }));
    }
    if (c.kaiju === true) tile.append(el("div", { class: "kaiju-tag", "data-probe": "kaiju-tag", text: "KAIJU" }));
    if (c.silhouette === "dragon") tile.append(el("div", { class: "kaiju-tag dragon-tag", "data-probe": "dragon-tag", text: "DRAGON" }));
    if (owned && resolveRider(app).id === c.id) {
      tile.append(el("div", { class: "riding-badge", text: "RIDING" }));
    }
    on(tile, "click", () => (owned ? monsterSheet(app, c.id) : buySheet(app, c.id)));
    grid.append(tile);
  }
  root.append(grid);
  // Twenty-one tiles animating at once is a battery on an older iPad. Tiles
  // that have scrolled off stage pause their acts until they are back.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("offstage", !e.isIntersecting);
    }, { rootMargin: "120px" });
    for (const t of Array.from(grid.children)) io.observe(t);
  }

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
    // Shut to buying before the first monster, open to LOOK at any time
    // (Andy's alpha, 2026-09-03: "it should let me open them up to see").
    const t = el("button", { type: "button", class: `helm-tile${has ? " owned" : ""}`, "data-helm": h.id });
    t.append(helmetIcon(h));
    t.append(el("span", { class: "helm-name", text: h.name }));
    t.append(el("span", { class: "mon-sub", text: has ? "owned" : `◆ ${h.cost}` }));
    on(t, "click", () => helmSheet(app, h));
    rack.append(t);
  }
  root.append(rack);

  // THE BOARD RACK (Andy 2026-09-02): thirteen decks, plain always owned, the
  // rest a real save, worn by whichever monster he puts them under. Shut
  // until the first monster, for the same reason the helmets are.
  root.append(el("h2", { text: "The Board Rack", style: "margin-top:18px" }));
  root.append(el("p", { class: "note", "data-probe": "board-note", text: rackOpen
    ? "Buy a board once and any of the crew can ride it. Put it under a monster from its card. The plain board is always yours."
    : "Boards need riders. Pick your first monster and the rack opens." }));
  const boards = el("div", { class: `board-rack${rackOpen ? "" : " rack-locked"}`, "data-probe": "board-rack" });
  for (const b of BOARDS) {
    const has = b.id === PLAIN_BOARD || app.meta.boardsOwned.includes(b.id);
    const t = el("button", { type: "button", class: `board-tile${has ? " owned" : ""}`, "data-board-tile": b.id });
    const art = boardSvg(b, { cls: "board-mini" });
    t.append(art);
    t.append(el("span", { class: "helm-name", text: b.name }));
    t.append(el("span", { class: "mon-sub", text: b.id === PLAIN_BOARD ? "always yours" : has ? "owned" : `◆ ${b.cost}` }));
    on(t, "click", () => boardSheet(app, b));
    boards.append(t);
  }
  root.append(boards);
  return root;
};

/** Buying a board: the same confirm and cancel as everything else, then the
 *  reveal offers to put it straight under the rider. */
const boardSheet = (app: App, b: Board): void => {
  const has = b.id === PLAIN_BOARD || app.meta.boardsOwned.includes(b.id);
  const body = el("div", { class: "reveal" });
  body.append(boardSvg(b, { cls: "board-big", riding: true }));
  body.append(el("p", { class: "mon-lore", text: b.lore }));
  if (has) {
    sheet({ title: b.name, body, cancel: "Close" });
    return;
  }
  // Before the first monster the rack is shut to buying, open to look: the
  // deck rides on the sheet, trail and all, and the words say what opens it.
  if (app.meta.owned.length === 0) {
    body.append(el("p", { class: "note", "data-probe": "rack-shut", text: `${b.cost} coins, once the rack opens. Pick your first monster and it does.` }));
    sheet({ title: b.name, body, cancel: "Close" });
    return;
  }
  confirmSpend(app, {
    what: b.name, verb: "Buy", cost: b.cost, body,
    onSpent: (): void => {
        app.meta.boardsOwned.push(b.id);
        sfx.coin();
        void app.save().then(() => {
          const rider = resolveRider(app);
          const riderName = app.meta.names[rider.id] ?? rider.name;
          const reveal = el("div", { class: "reveal" });
          reveal.append(boardSvg(b, { cls: "board-big", riding: true }));
          reveal.append(el("h2", { text: b.name }));
          reveal.append(el("p", { class: "mon-lore", text: b.lore }));
          sheet({
            title: "New board!", body: reveal,
            cancel: "Later",
            ...(app.meta.owned.includes(rider.id) ? {
              confirm: `${riderName} rides it`,
              onConfirm: (): void => {
                app.meta.boardOf = { ...app.meta.boardOf, [rider.id]: b.id };
                void app.save().then(() => app.refresh());
              },
            } : {}),
            onCancel: () => app.refresh(),
          });
        });
    },
  });
};

const helmSheet = (app: App, h: Helmet): void => {
  const has = app.meta.helmetsOwned.includes(h.id);
  const body = el("div", { class: "reveal" });
  body.append(helmetIcon(h));
  if (has) {
    sheet({ title: h.name, body: "Already in the locker. Put it on from any monster's card.", confirm: "OK" });
    return;
  }
  if (app.meta.owned.length === 0) {
    body.append(el("p", { class: "note", "data-probe": "rack-shut", text: `${h.cost} coins, once the rack opens. Pick your first monster and it does.` }));
    sheet({ title: h.name, body, cancel: "Close" });
    return;
  }
  confirmSpend(app, {
    what: h.name, verb: "Buy", cost: h.cost, body,
    onSpent: (): void => {
      app.meta.helmetsOwned.push(h.id);
      sfx.coin();
      void app.save().then(() => app.refresh());
    },
  });
};

/** Buying a monster HE chose. The reveal still pops, because it earned it. */
const buySheet = (app: App, id: string): void => {
  const c = creatureById(id);
  if (!c) return;
  const body = el("div", {});
  // On a card the monster performs on a FAST loop: act, breathe for a couple
  // of seconds, act again. The shop saunters; the spotlight does not.
  body.append(creatureSvg(c, { idle: 0.3, fastIdle: true }));
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  confirmSpend(app, {
    what: c.name, verb: "Buy", cost: c.cost, body,
    onSpent: (): void => {
      app.meta.owned.push(c.id);
      app.meta.levels[c.id] = 1;
      sfx.roar();
      void app.save().then(() => revealSheet(app, c.id));
    },
  });
};

/**
 * LEVEL UP goes through the same gate as a purchase (Andy, 2026-09-02: any
 * spend of coins requires confirmation) and SAYS WHY: the monster drawn at
 * the level it would reach, the ladder of what each level brings with the
 * next one lit, and the plain fact that levels are for looks only.
 */
const levelSheet = (app: App, c: Creature): void => {
  const level = app.meta.levels[c.id] ?? 1;
  if (level >= MAX_LEVEL) return;
  const next = level + 1;
  const cost = levelCost(level);
  const helm = app.meta.gear[c.id] !== undefined ? helmetById(app.meta.gear[c.id]!) : undefined;
  const body = el("div", { "data-probe": "level-sheet" });
  body.append(creatureSvg(c, { level: next, idle: 0.3, fastIdle: true, ...(helm ? { helmet: helm } : {}) }));
  body.append(el("div", { class: "mon-sub", text: `Level ${level} → Level ${next} of ${MAX_LEVEL}` }));
  body.append(el("p", { class: "mon-lore", "data-probe": "level-why", text: `Level ${next} brings ${levelBrings(c, next)}.` }));
  const ladder = el("ul", { class: "perk-list", "data-probe": "perk-list" });
  for (const lv of [2, 3, 4, 7, 10]) {
    const cls = lv === next ? "next" : lv <= level ? "had" : "";
    ladder.append(el("li", { class: cls, text: `Level ${lv}: ${levelBrings(c, lv)}${lv <= level ? " ✓" : ""}` }));
  }
  body.append(ladder);
  body.append(el("p", { class: "note", text: "Levels are for looks. The tricks, the coins and the maths never change with level." }));
  // The card closed to make room; either road leads back to it, and after a
  // level-up the card reopens at the new level so the change is SEEN.
  confirmSpend(app, {
    what: app.meta.names[c.id] ?? c.name, verb: "Level up", cost, body, probe: "level-confirm",
    onCancel: () => monsterSheet(app, c.id),
    onSpent: (): void => {
      app.meta.levels[c.id] = next;
      sfx.coin();
      void app.save().then(() => { app.refresh(); monsterSheet(app, c.id); });
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
  const wornId = (): string | undefined => app.meta.gear[c.id];
  const worn = (): Helmet | undefined => {
    const w = wornId();
    return w !== undefined ? helmetById(w) : undefined;
  };
  let bigArt = creatureSvg(c, { level, idle: 0.3, fastIdle: true, ...(worn() ? { helmet: worn()! } : {}) });
  body.append(bigArt);
  // The board under the monster, on the card, so an equip is seen at once.
  let cardBoard = boardSvg(boardFor(app.meta.boardOf, c.id, app.meta.boardsOwned), { cls: "card-board" });
  body.append(cardBoard);
  body.append(el("p", { class: "mon-lore", text: c.lore }));
  // The level row: where it stands, what the next one costs, and the door
  // to the confirm sheet. The button is there whether or not he can pay,
  // because the sheet is also where the ladder is explained.
  const lvlRow = el("div", { class: "lvl-row" });
  lvlRow.append(el("span", { class: "mon-sub", "data-probe": "level-line", text: level >= MAX_LEVEL ? `Level ${level} of ${MAX_LEVEL}. Maxed out!` : `Level ${level} of ${MAX_LEVEL}` }));
  if (level < MAX_LEVEL) {
    const ready = canLevelUp(level, app.meta.coins);
    const up = el("button", { type: "button", class: `btn small${ready ? " go" : " ghost"}`, "data-probe": "level-up" }, el("span", { text: `Level up ◆${cost}` }));
    on(up, "click", () => { card.close(); levelSheet(app, c); });
    lvlRow.append(up);
  }
  body.append(lvlRow);

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

  // The board row: plain plus everything in the rack, shown only once there
  // is a choice to make.
  if (app.meta.boardsOwned.length > 0) {
    const row = el("div", { class: "gear-row board-row", "data-probe": "board-row" });
    const redrawBoard = (): void => {
      const fresh = boardSvg(boardFor(app.meta.boardOf, c.id, app.meta.boardsOwned), { cls: "card-board" });
      cardBoard.replaceWith(fresh);
      cardBoard = fresh;
      const cur = boardFor(app.meta.boardOf, c.id, app.meta.boardsOwned).id;
      for (const t of Array.from(row.children)) t.classList.toggle("sel", (t as HTMLElement).dataset["ride"] === cur);
    };
    for (const b of ownedBoards(app.meta.boardsOwned)) {
      const cur = boardFor(app.meta.boardOf, c.id, app.meta.boardsOwned).id === b.id;
      const t = el("button", { type: "button", class: `gear-pick board-pick${cur ? " sel" : ""}`, "data-ride": b.id, "aria-label": b.name });
      t.append(boardSvg(b, { cls: "board-pick-art" }));
      on(t, "click", () => {
        app.meta.boardOf = { ...app.meta.boardOf, [c.id]: b.id };
        void app.save();
        redrawBoard();
      });
      row.append(t);
    }
    body.append(row);
  }

  // SEND OUT: he picks who rides. Agency turns the collection from a museum
  // into a pre-run ritual. One row with Rename, so the card fits an iPad
  // on its side without a scroll (Andy, 2026-09-02).
  const actions = el("div", { class: "card-actions" });
  if (resolveRider(app).id !== c.id) {
    const send = el("button", { type: "button", class: "btn small alt", "data-probe": "send-out" }, el("span", { text: "Send out" }));
    on(send, "click", () => {
      app.meta.rider = c.id;
      void app.save();
      app.refresh();
    });
    actions.append(send);
  } else {
    actions.append(el("span", { class: "mon-sub", text: "Riding today" }));
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
  actions.append(rename);
  body.append(actions);

  const card = sheet({ title: app.meta.names[c.id] ?? c.name, body, cancel: "Close" });
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

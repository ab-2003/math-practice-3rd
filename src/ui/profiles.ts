/**
 * WHO'S RIDING? The picker shown at launch when more than one rider lives on
 * this iPad. Kid-facing: big tiles, each rider's own monster, a tap. Adding,
 * renaming and removing riders is grown-ups' work and lives behind the PIN.
 */

import { cheapestLocked, creatureById, ROSTER } from "../core/creatures";
import { helmetById } from "../core/gear";
import type { App } from "./appstate";
import { creatureSvg } from "./creature-svg";
import { el, on } from "./dom";
import { peekMeta, type Meta } from "./store";

/** The same rule as the home hero, from a bare meta. */
const heroOf = (m: Meta): { art: SVGElement; owned: boolean } => {
  const picked = m.rider !== null ? creatureById(m.rider) : null;
  const rider = picked && m.owned.includes(picked.id) ? picked
    : m.owned.length > 0 ? creatureById(m.owned[m.owned.length - 1]!) ?? null : null;
  if (rider) {
    const helm = m.gear[rider.id] !== undefined ? helmetById(m.gear[rider.id]!) : undefined;
    return { art: creatureSvg(rider, { level: m.levels[rider.id] ?? 1, ...(helm ? { helmet: helm } : {}) }), owned: true };
  }
  return { art: creatureSvg(cheapestLocked([]) ?? ROSTER[0]!), owned: false };
};

export const profilesScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const hero = el("div", { class: "hero" });
  hero.append(el("h1", { text: "Who's riding?" }));
  root.append(hero);

  const grid = el("div", { class: "profile-grid", "data-probe": "profile-grid" });
  root.append(grid);

  for (const p of app.registry.profiles) {
    const tile = el("button", { type: "button", class: "profile-tile", "data-profile": p.id });
    tile.append(el("div", { class: "profile-name", text: p.name }));
    tile.append(el("div", { class: "profile-sub", text: "…" }));
    on(tile, "click", () => { if (p.id === app.profile.id) app.go("home"); else app.switchProfile(p.id); });
    grid.append(tile);
    void peekMeta(p.id).then((m) => {
      if (!tile.isConnected) return;
      const { art, owned } = heroOf(m);
      art.classList.add("profile-art");
      if (!owned) art.classList.add("target");
      tile.prepend(art);
      const sub = tile.querySelector(".profile-sub");
      if (sub) sub.textContent = m.owned.length > 0 ? `${m.owned.length} monsters · ◆ ${m.coins}` : "new rider";
    });
  }

  root.append(el("p", { class: "note", style: "text-align:center", text: "Grown-ups add riders from the settings screen." }));
  return root;
};

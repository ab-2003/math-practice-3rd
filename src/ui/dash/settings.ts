/**
 * THE SETTINGS TAB on the iPad: every control, grouped, and none of the
 * charts. The dials themselves come from dash/controls.ts over a model
 * backed by the live app; the riders, data and cloud cards are this
 * device's own business.
 */

import { csv } from "../../core/report";
import type { Response, SessionRecord } from "../../core/types";
import type { App } from "../appstate";
import { forgetCode } from "../cloud";
import { cloudCard, type CloudViewHandler } from "../cloud-ui";
import { el, on } from "../dom";
import { applySetting } from "../settings-apply";
import { sheet } from "../sheet";
import { deleteProfileData, eraseAll, exportAll, importAll, newProfileId } from "../store";
import { settingsCards, setRow, type SettingsModel } from "./controls";

/** Offer a text file to the viewer without a network round trip. */
const download = (name: string, text: string, mime: string): void => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const section = (text: string): HTMLElement => el("div", { class: "dash-h", text });

export interface SettingsOpts {
  onView: CloudViewHandler;
  responses: readonly Response[];
  sessions: readonly SessionRecord[];
  /** Redraw this pane in place, keeping the screen's scroll position. */
  rerender: () => void;
}

/** The live app as a settings model: a change applies (with its revives),
 *  saves, pushes its field to the cloud, and redraws the pane in place. */
export const appModel = (app: App, rerender: () => void): SettingsModel => ({
  deck: app.deck,
  states: app.states,
  who: app.profile.name, // never a pronoun: the rider by name, as the door does
  get: (key) => ({
    strands: app.meta.strands, caps: app.meta.caps, missing: app.meta.missing, addDots: app.meta.addDots, dailyGoal: app.meta.dailyGoal,
    speedLimit: app.meta.speedLimit, elapsedOn: app.meta.elapsedOn, elapsedLevel: app.meta.elapsedLevel, elapsedAnalog: app.meta.elapsedAnalog,
    parkMinutes: app.meta.parkMinutes, parkTokensPerDay: app.meta.parkTokensPerDay,
    extraTokenMax: app.meta.extraTokenMax, extraTokenEvery: app.meta.extraTokenEvery, extraTokensOn: app.meta.extraTokensOn,
    dayLimitMinutes: app.meta.dayLimitMinutes,
  })[key],
  set: (key, value) => {
    if (!applySetting(app, key, value)) return;
    void app.save().then(rerender);
  },
});

export const settingsTab = (app: App, opts: SettingsOpts): HTMLElement => {
  const wrap = el("div", { "data-probe": "settings-tab" });
  const model = appModel(app, opts.rerender);

  // ---- the dials --------------------------------------------------------------
  wrap.append(section("Practice"));
  const [focus, dayCard, park, bonus] = settingsCards(model);
  wrap.append(focus!);
  wrap.append(section("The day"));
  wrap.append(dayCard!, park!);

  // ---- daily tokens: the parent's hand on the pocket ------------------------------
  // A token normally drops with the day's work. A grown-up can give one
  // (a sick day, a reward) or reopen today's park once the cap is hit.
  // Device-side, behind the PIN, on this rider's own pocket.
  const spent = app.meta.parkDay === app.day ? app.meta.parkSpent : 0;
  const tokenCard = el("div", { class: "card", "data-probe": "token-card" });
  tokenCard.append(el("h3", { class: "title", text: "Daily Tokens" }));
  tokenCard.append(el("p", { class: "note", "data-probe": "token-count", text:
    `${app.profile.name} has ${app.meta.tokens} Daily ${app.meta.tokens === 1 ? "Token" : "Tokens"} in the pocket and has spent ${spent} today. A token drops with the day's work; a grown-up can give one too, or reopen the park for today.` }));
  const trow = el("div", { class: "stepper", style: "flex-wrap:wrap" });
  const grant = el("button", { type: "button", class: "btn small alt", "data-probe": "grant-token" }, el("span", { text: "Give a Daily Token" }));
  on(grant, "click", () => { app.meta.tokens += 1; app.meta.parkUnlocked = true; void app.save().then(opts.rerender); });
  const reopen = el("button", { type: "button", class: "btn small ghost", "data-probe": "reopen-park", ...(spent === 0 ? { disabled: true } : {}) }, el("span", { text: "Reopen the park today" }));
  on(reopen, "click", () => { app.meta.parkDay = app.day; app.meta.parkSpent = 0; void app.save().then(opts.rerender); });
  trow.append(grant, reopen);
  tokenCard.append(trow);
  wrap.append(tokenCard, bonus!);


  // ---- riders ------------------------------------------------------------------
  wrap.append(section("Riders"));
  const riders = el("div", { class: "card", "data-probe": "riders-card" });
  riders.append(el("h3", { class: "title", text: "Who uses this iPad" }));
  riders.append(el("p", { class: "note", text:
    "Each rider has their own progress, monsters and share code. With more than one, the app asks who is riding at launch." }));
  for (const p of app.registry.profiles) {
    const isActive = p.id === app.profile.id;
    const controls = el("div", { class: "mini-stepper" });
    const rename = el("button", { type: "button", class: "btn small ghost", "data-rename": p.id }, el("span", { text: "Rename" }));
    on(rename, "click", () => {
      const given = window.prompt("Rider's name", p.name);
      if (given !== null && given.trim() !== "") {
        p.name = given.trim().slice(0, 14).toUpperCase();
        app.saveRegistry();
        opts.rerender();
      }
    });
    controls.append(rename);
    if (app.registry.profiles.length > 1) {
      const remove = el("button", { type: "button", class: "btn small ghost", "data-remove": p.id }, el("span", { text: "Remove" }));
      on(remove, "click", () => sheet({
        title: `Remove ${p.name}?`,
        body: "Their facts, sessions, coins and monsters on this iPad go with them. Take a backup first if you want to keep any of it.",
        cancel: "Keep them", confirm: "Remove", danger: true,
        onConfirm: () => {
          void deleteProfileData(p.id).then(() => {
            app.registry.profiles = app.registry.profiles.filter((x) => x.id !== p.id);
            if (app.registry.active === p.id) app.registry.active = app.registry.profiles[0]!.id;
            app.saveRegistry();
            if (isActive) location.reload(); else opts.rerender();
          });
        },
      }));
      controls.append(remove);
    }
    riders.append(setRow(p.name, isActive ? "riding now" : "", controls));
  }
  const addRow = el("div", { class: "stepper", style: "flex-wrap:wrap" });
  const add = el("button", { type: "button", class: "btn small alt", "data-probe": "add-rider" }, el("span", { text: "Add a rider" }));
  on(add, "click", () => {
    const given = window.prompt("New rider's name");
    if (given === null || given.trim() === "") return;
    app.registry.profiles.push({ id: newProfileId(), name: given.trim().slice(0, 14).toUpperCase(), createdAt: Date.now() });
    app.saveRegistry();
    opts.rerender();
  });
  addRow.append(add);
  if (app.registry.profiles.length > 1) {
    const sw = el("button", { type: "button", class: "btn small", "data-probe": "switch-rider" }, el("span", { text: "Switch rider" }));
    on(sw, "click", () => app.go("profiles"));
    addRow.append(sw);
  }
  riders.append(addRow);
  wrap.append(riders);

  // ---- data ----------------------------------------------------------------------
  wrap.append(section("Data"));
  const data = el("div", { class: "card" });
  data.append(el("h3", { class: "title", text: `${app.profile.name}'s data` }));
  data.append(el("p", { class: "note", text:
    "The CSV carries every response with its raw timings and its own measurement definition. The backup is the whole profile; restore replaces this rider's data with it." }));
  const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });

  const csvBtn = el("button", { type: "button", class: "btn small alt", "data-probe": "csv" }, el("span", { text: "Export CSV" }));
  on(csvBtn, "click", () => download(`trickline-${new Date().toISOString().slice(0, 10)}.csv`, csv(opts.responses, opts.sessions), "text/csv"));

  const jsonBtn = el("button", { type: "button", class: "btn small" }, el("span", { text: "Backup" }));
  on(jsonBtn, "click", () => {
    void exportAll().then((b) =>
      download(`trickline-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), "application/json"));
  });

  const inp = el("input", { type: "file", accept: "application/json,.json", style: "display:none" });
  on(inp, "change", () => {
    const file = inp.files?.[0];
    if (!file) return;
    void file.text().then((t) => importAll(JSON.parse(t)))
      .then(() => sheet({ title: "Restored", body: "Progress loaded. The app will reload.", confirm: "OK", onConfirm: () => location.reload() }))
      .catch((e: unknown) => sheet({ title: "Could not restore", body: String(e), confirm: "OK" }));
  });
  const restore = el("button", { type: "button", class: "btn small" }, el("span", { text: "Restore" }));
  on(restore, "click", () => inp.click());

  const reset = el("button", { type: "button", class: "btn small warm" }, el("span", { text: "Erase everything" }));
  on(reset, "click", () => sheet({
    title: "Erase all progress?",
    body: "Every fact, every session, every monster, and this device's link to its share code. This cannot be undone, so take a backup first.",
    cancel: "Keep it", confirm: "Erase", danger: true,
    // The link goes too: a fresh start must not be offered its old record
    // back at the next launch.
    onConfirm: () => { forgetCode(); void eraseAll().then(() => location.reload()); },
  }));

  row.append(csvBtn, jsonBtn, restore, inp, reset);
  data.append(row);
  wrap.append(data);

  // ---- the cloud share --------------------------------------------------------------
  wrap.append(section("Cloud"));
  wrap.append(cloudCard(app, { onView: opts.onView }));

  return wrap;
};

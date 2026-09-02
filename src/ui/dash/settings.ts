/**
 * THE SETTINGS TAB: every control, grouped, and none of the charts.
 */

import { csv } from "../../core/report";
import type { Response, SessionRecord } from "../../core/types";
import type { App } from "../appstate";
import { cloudCard, type CloudViewHandler } from "../cloud-ui";
import { el, on } from "../dom";
import { sheet } from "../sheet";
import { deleteProfileData, eraseAll, exportAll, importAll, newProfileId } from "../store";
import { practiceTable } from "./practice";

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

/** A compact labelled row with a control on the right. */
const setRow = (label: string, hint: string, control: HTMLElement): HTMLElement => {
  const row = el("div", { class: "setrow" });
  const text = el("div", { class: "grow" });
  text.append(el("b", { text: label }));
  if (hint) text.append(el("small", { text: hint }));
  row.append(text, control);
  return row;
};

const stepper = (
  value: string, probe: string, onMinus: () => void, onPlus: () => void,
): HTMLElement => {
  const box = el("div", { class: "mini-stepper" });
  const minus = el("button", { type: "button", class: "btn small", "data-probe": `${probe}-minus` }, el("span", { text: "−" }));
  const val = el("span", { class: "stepper-value", "data-probe": probe, text: value });
  const plus = el("button", { type: "button", class: "btn small", "data-probe": `${probe}-plus` }, el("span", { text: "+" }));
  on(minus, "click", onMinus);
  on(plus, "click", onPlus);
  box.append(minus, val, plus);
  return box;
};

const knob = (onNow: boolean, probe: string, label: string, fn: () => void): HTMLElement => {
  const b = el("button", {
    type: "button", class: `knob${onNow ? " on" : ""}`, "data-probe": probe,
    "aria-pressed": String(onNow), "aria-label": label,
  }, el("i", {}));
  on(b, "click", fn);
  return b;
};

export interface SettingsOpts {
  onView: CloudViewHandler;
  responses: readonly Response[];
  sessions: readonly SessionRecord[];
  /** Redraw this pane in place, keeping the screen's scroll position. */
  rerender: () => void;
}

export const settingsTab = (app: App, opts: SettingsOpts): HTMLElement => {
  const wrap = el("div", { "data-probe": "settings-tab" });
  const saveAndRefresh = (): void => { void app.save().then(() => opts.rerender()); };

  // ---- what he is practising -------------------------------------------------
  wrap.append(section("Practice"));
  const focus = el("div", { class: "card" });
  focus.append(el("h3", { class: "title", text: "What he is practising" }));
  focus.append(el("p", { class: "note", text:
    "Switch an operation off and it leaves his sessions entirely; everything learned in it is kept. Missing number asks 7 + ▢ = 15 style items. The cap is a ceiling for the very young." }));
  focus.append(practiceTable(app, opts.rerender));

  // One shared mix percentage for whichever operations have it on. Still
  // typed production, so the first-digit clock stays honest at any setting.
  const anyMissing = Object.entries(app.meta.missing).some(([k, v]) => k !== "pct" && v === true);
  if (anyMissing) {
    focus.append(setRow("Missing-number mix", "share of items asked with a blank operand",
      stepper(`${app.meta.missing.pct}%`, "missing-pct",
        () => { app.meta.missing = { ...app.meta.missing, pct: Math.max(5, app.meta.missing.pct - 5) }; saveAndRefresh(); },
        () => { app.meta.missing = { ...app.meta.missing, pct: Math.min(80, app.meta.missing.pct + 5) }; saveAndRefresh(); })));
  }
  if (app.meta.strands.div && !app.meta.strands.mul) {
    focus.append(el("p", { class: "note warn", text:
      "Division is on but multiplication is off. A division fact only unlocks once its own multiplication family is solid, so nothing new will arrive until multiplication is switched back on." }));
  }
  wrap.append(focus);

  // ---- the day -----------------------------------------------------------------
  wrap.append(section("The day"));
  const dayCard = el("div", { class: "card" });
  dayCard.append(el("h3", { class: "title", text: "The daily dose" }));
  dayCard.append(el("p", { class: "note", text:
    "How many answered problems make a day's work. The DONE badge, the jingle, the extra-practice label and the shop all key off it." }));
  dayCard.append(setRow("Problems per day", "",
    stepper(String(app.meta.dailyGoal), "dose-goal",
      () => { app.meta.dailyGoal = Math.max(10, app.meta.dailyGoal - 5); saveAndRefresh(); },
      () => { app.meta.dailyGoal = Math.min(80, app.meta.dailyGoal + 5); saveAndRefresh(); })));
  dayCard.append(setRow("Speed runs per day", "one is allowed before the day's work",
    stepper(String(app.meta.speedLimit), "speed-limit",
      () => { app.meta.speedLimit = Math.max(1, app.meta.speedLimit - 1); saveAndRefresh(); },
      () => { app.meta.speedLimit = Math.min(30, app.meta.speedLimit + 1); saveAndRefresh(); })));
  wrap.append(dayCard);

  // ---- the bonus round -----------------------------------------------------------
  const bonus = el("div", { class: "card" });
  bonus.append(el("h3", { class: "title", text: "Bonus round: elapsed time" }));
  bonus.append(el("p", { class: "note", text: "A reward, not drill. Problems mix everything up to the level you pick; every time sits on a five minute mark." }));
  const LEVELS: Array<{ n: 1 | 2 | 3; label: string; hint: string }> = [
    { n: 1, label: "Same hour", hint: "2:10 to 2:45. Never leaves the hour it started in." },
    { n: 2, label: "Next hour", hint: "2:50 to 3:10. Crosses the hour, still 60 minutes or less." },
    { n: 3, label: "Big spans", hint: "2:10 to 3:45. More than an hour, never more than two." },
  ];
  const seg = el("div", { class: "seg", role: "radiogroup", "aria-label": "Highest elapsed-time level" });
  for (const lvl of LEVELS) {
    const active = app.meta.elapsedLevel === lvl.n;
    const b = el("button", {
      type: "button", class: active ? "on" : "", role: "radio", "aria-checked": String(active),
      "data-probe": `elapsed-level-${lvl.n}`,
    }, el("span", { text: `${lvl.n} · ${lvl.label}` }));
    on(b, "click", () => { app.meta.elapsedLevel = lvl.n; saveAndRefresh(); });
    seg.append(b);
  }
  bonus.append(seg);
  const chosen = LEVELS.find((l) => l.n === app.meta.elapsedLevel) ?? LEVELS[0]!;
  bonus.append(el("p", { class: "note", "data-probe": "elapsed-hint", text:
    `Up to level ${chosen.n}: ${chosen.hint}${chosen.n > 1 ? " Lower levels stay in the mix." : ""}` }));
  bonus.append(setRow("Analog clock faces", app.meta.elapsedAnalog ? "he reads the times off drawn faces" : "times are written out (2:45)",
    knob(app.meta.elapsedAnalog, "elapsed-analog", "Analog clock faces", () => { app.meta.elapsedAnalog = !app.meta.elapsedAnalog; saveAndRefresh(); })));
  wrap.append(bonus);

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
    body: "Every fact, every session, every monster. This cannot be undone, so take a backup first.",
    cancel: "Keep it", confirm: "Erase", danger: true,
    onConfirm: () => { void eraseAll().then(() => location.reload()); },
  }));

  row.append(csvBtn, jsonBtn, restore, inp, reset);
  data.append(row);
  wrap.append(data);

  // ---- the cloud share --------------------------------------------------------------
  wrap.append(section("Cloud"));
  wrap.append(cloudCard(app, { onView: opts.onView }));

  return wrap;
};

/**
 * THE GROWN-UPS' DOOR, at /parent/ (Andy, 2026-09-02).
 *
 * A parent's phone or a teacher's laptop wants to LOOK at the record, and
 * since 0.16.0 to SET what the rider works on. This is a separate front door
 * in the same build: remember any number of riders by their share codes,
 * open one, and see three tabs: the report, the trends, and the settings.
 * Settings changes go to the cloud's settings document, field by field with
 * a stamp, and the rider's device picks them up when it next checks in; the
 * door shows which fields are still waiting. Read only for everything else:
 * no PIN, no game, nothing that writes a rider's practice.
 *
 * A separate PATH rather than a first-launch "parent or child?" fork, so the
 * kid's door stays exactly the game and nothing about it needs an age gate.
 */

import { today } from "../core/clock";
import { buildDeck } from "../core/facts";
import { csv } from "../core/report";
import { describeField, pendingFields, settingsOf, SYNCED_KEYS, type Fields, type SyncedSettings } from "../core/sync";
import {
  cloudFrom, cloudWhen, cloudWhose, describeRefresh, deviceId, fmtCode, forgetParentCode, getSettings, getShare,
  parentCode, putSettings, rememberParentCode, sessionsText, type CloudOk,
} from "./cloud";
import { connectForm } from "./cloud-ui";
import { settingsCards, type SettingsModel } from "./dash/controls";
import { progressTab } from "./dash/progress";
import { trendsTab } from "./dash/trends";
import { el, mount, on } from "./dom";
import { icoRefresh } from "./icons";
import { sheet } from "./sheet";
import { snapshotFromBackup } from "./snapshot";
import { checkBackup, type Backup } from "./store";
import { toast } from "./toast";

/** Offer a text file without a network round trip. */
const download = (name: string, text: string, mime: string): void => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// ---- the riders this door remembers -----------------------------------------
export interface Rider { code: string; name: string; savedAt?: string; device?: string; lastSeen: number }
const RIDERS_KEY = "tl-parent-riders";
export const riders = (): Rider[] => {
  try { const raw = localStorage.getItem(RIDERS_KEY); return raw ? (JSON.parse(raw) as Rider[]) : []; } catch { return []; }
};
const saveRiders = (list: Rider[]): void => { try { localStorage.setItem(RIDERS_KEY, JSON.stringify(list)); } catch { /* private mode */ } };
export const rememberRider = (code: string, res: CloudOk): void => {
  const list = riders().filter((r) => r.code !== code);
  list.unshift({ code, name: cloudWhose(res), lastSeen: Date.now(),
    ...(res.meta.savedAt !== undefined ? { savedAt: res.meta.savedAt } : {}),
    ...(res.meta.device !== undefined ? { device: res.meta.device } : {}) });
  saveRiders(list);
  rememberParentCode(code);
};
export const forgetRider = (code: string): void => {
  saveRiders(riders().filter((r) => r.code !== code));
  if (parentCode() === code) forgetParentCode();
};

type Source =
  | { kind: "cloud"; code: string; res: CloudOk; settings: Fields }
  | { kind: "file"; name: string; backup: Backup };
type Tab = "progress" | "trends" | "settings";

export const bootParent = async (root: HTMLElement): Promise<void> => {
  const deck = buildDeck();
  let source: Source | null = null;
  let tab: Tab = "progress";

  const render = (keepScroll = false): void => {
    const y = keepScroll ? window.scrollY : 0;
    mount(root, source === null ? doorScreen() : viewScreen(source));
    window.scrollTo(0, y);
  };

  /** Open a rider: the record and the settings document together. */
  const openCloud = async (code: string, res: CloudOk, why: "connected" | "opened"): Promise<void> => {
    const s = await getSettings(code);
    source = { kind: "cloud", code, res, settings: s.kind === "ok" ? s.doc.fields : {} };
    rememberRider(code, res);
    tab = "progress";
    render();
    toast(`${why === "connected" ? "Connected. " : ""}Viewing ${cloudWhose(res)}'s copy: ${sessionsText(res.meta.sessions ?? 0)}, saved ${cloudWhen(res)}${cloudFrom(res)}.`);
  };

  // ---- the front door: riders, a code, a file -------------------------------------
  const doorScreen = (): HTMLElement => {
    const screen = el("div", { class: "screen", "data-probe": "parent-connect" });
    const hero = el("div", { class: "hero" });
    hero.append(el("h1", { text: "Trick Line" }));
    hero.append(el("p", { class: "sub", text: "Grown-ups' view." }));
    screen.append(hero);

    const known = riders();
    if (known.length > 0) {
      const card = el("div", { class: "card", "data-probe": "riders-list" });
      card.append(el("h3", { class: "title", text: known.length === 1 ? "Your rider" : "Your riders" }));
      for (const r of known) {
        const row = el("div", { class: "setrow" });
        const text = el("div", { class: "grow" });
        text.append(el("b", { text: r.name }));
        text.append(el("small", { text: `${fmtCode(r.code)}${r.savedAt !== undefined ? ` · saved ${new Date(r.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}` }));
        row.append(text);
        const open = el("button", { type: "button", class: "btn small alt", "data-open-rider": r.code }, el("span", { text: "Open" }));
        on(open, "click", () => {
          open.setAttribute("disabled", "true");
          void getShare(r.code).then((res) => {
            if (res.kind === "ok") { void openCloud(r.code, res, "opened"); return; }
            open.removeAttribute("disabled");
            toast(res.kind === "missing" ? `The cloud holds nothing under ${r.name}'s code any more.` : "The cloud is not answering. Try again in a bit.");
          });
        });
        const forget = el("button", { type: "button", class: "btn small ghost", "data-forget-rider": r.code }, el("span", { text: "Forget" }));
        on(forget, "click", () => sheet({
          title: `Forget ${r.name}?`,
          body: `This device will no longer remember the code ${fmtCode(r.code)}. You will need the code, or a backup file, to see ${r.name}'s record here again. Nothing on the rider's own device changes.`,
          cancel: "Keep", confirm: "Forget", danger: true,
          onConfirm: () => { forgetRider(r.code); render(); toast(`Forgotten ${r.name}'s code.`); },
        }));
        const controls = el("div", { class: "mini-stepper" }, open, forget);
        row.append(controls);
        card.append(row);
      }
      screen.append(card);
    }

    const card = el("div", { class: "card" });
    card.append(connectForm({
      onConnected: (code, res) => { void openCloud(code, res, "connected"); },
    }));
    const last = parentCode();
    if (last !== null && !known.some((r) => r.code === last)) {
      const chip = el("button", { type: "button", class: "chip dim", "data-probe": "last-code" }, el("span", { text: `Last code: ${fmtCode(last)}` }));
      on(chip, "click", () => { const inp = card.querySelector<HTMLInputElement>(".cloud-input"); if (inp) inp.value = fmtCode(last); });
      card.append(el("div", { class: "chips", style: "justify-content:flex-start" }, chip));
    }
    screen.append(card);

    const fileCard = el("div", { class: "card" });
    fileCard.append(el("h3", { class: "title", text: "Or open a backup file" }));
    fileCard.append(el("p", { class: "note", text: "A backup taken from the rider's grown-ups screen. Nothing is uploaded; the file is read here and shown." }));
    const inp = el("input", { type: "file", accept: "application/json,.json", style: "display:none", "data-probe": "parent-file" });
    on(inp, "change", () => {
      const file = inp.files?.[0];
      if (!file) return;
      void file.text().then((t) => {
        const backup = checkBackup(JSON.parse(t));
        source = { kind: "file", name: file.name, backup };
        tab = "progress";
        render();
        toast(`Opened ${backup.name ?? "the rider"}'s backup: ${sessionsText(backup.sessions?.length ?? 0)}.`);
      }).catch((e: unknown) => toast(`Could not open that file: ${String(e)}`));
    });
    const open = el("button", { type: "button", class: "btn small", "data-probe": "parent-open-file" }, el("span", { text: "Open a file" }));
    on(open, "click", () => inp.click());
    fileCard.append(open, inp);
    screen.append(fileCard);

    screen.append(el("p", { class: "note", style: "text-align:center", text:
      "This page reads the record and sets what the rider works on. To practise, use the rider's own app at the main address." }));
    return screen;
  };

  // ---- the record, in three tabs ---------------------------------------------------
  const viewScreen = (src: Source): HTMLElement => {
    const screen = el("div", { class: "screen", "data-probe": "parent-view" });
    const bar = el("div", { class: "topbar" });
    // Never destructive: Riders goes back to the list, which still holds this one.
    const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "parent-riders" }, el("span", { text: "← Riders" }));
    on(back, "click", () => { source = null; render(); });
    bar.append(back, el("div", { class: "grow" }), el("h3", { text: "Grown-ups" }));
    screen.append(bar);

    const banner = el("div", { class: "viewer-banner", "data-probe": "viewer-banner" });
    if (src.kind === "cloud") {
      const { res, code } = src;
      banner.append(el("span", { class: "grow", text:
        `Viewing ${cloudWhose(res)}'s cloud copy · saved ${cloudWhen(res)}${cloudFrom(res)}.` }));
      const label = el("span", { text: "Refresh" });
      const refresh = el("button", { type: "button", class: "btn small", "data-probe": "viewer-refresh" }, icoRefresh(), label);
      on(refresh, "click", () => {
        if (refresh.classList.contains("busy")) return;
        refresh.classList.add("busy");
        label.textContent = "Refreshing…";
        void Promise.all([getShare(code), getSettings(code)]).then(([fresh, s]) => {
          if (fresh.kind !== "ok") {
            refresh.classList.remove("busy");
            label.textContent = "Refresh";
            toast(fresh.kind === "missing" ? "The cloud holds nothing under this code any more." : "The cloud is not answering. Showing the last copy.");
            return;
          }
          const settings = s.kind === "ok" ? s.doc.fields : src.settings;
          source = { kind: "cloud", code, res: fresh, settings };
          rememberRider(code, fresh);
          render(true);
          const verdict = describeRefresh(res, fresh);
          const pend = pendingFields(settings, settingsOf(fresh.backup.meta));
          toast(pend.length === 0 ? verdict.text : `${verdict.text} Settings still waiting for the rider's device: ${pend.map((k) => describeField(k, settings[k]!.v)).join("; ")}.`);
        });
      });
      banner.append(refresh);
    } else {
      banner.append(el("span", { class: "grow", text:
        `Viewing ${src.backup.name ?? "the rider"}'s backup file (${src.name}), exported ${new Date(src.backup.exportedAt).toLocaleDateString()}. Read only.` }));
    }
    screen.append(banner);

    const tabs = el("div", { class: "dash-tabs", role: "tablist" });
    const pane = el("div", { class: "dash-pane" });
    const tabBtn = (id: Tab, label: string): HTMLElement => {
      const b = el("button", {
        type: "button", class: `tab${tab === id ? " on" : ""}`, role: "tab",
        "aria-selected": String(tab === id), "data-probe": `tab-${id}`,
      }, el("span", { text: label }));
      on(b, "click", () => { tab = id; render(); });
      return b;
    };
    tabs.append(tabBtn("progress", "Progress"), tabBtn("trends", "Trends"));
    if (src.kind === "cloud") tabs.append(tabBtn("settings", "Settings"));
    screen.append(tabs, pane);

    const backup = src.kind === "cloud" ? src.res.backup : src.backup;
    const snap = snapshotFromBackup(deck, backup);
    if (tab === "progress") {
      pane.append(progressTab(snap, today(), true));
      const tools = el("div", { class: "card" });
      tools.append(el("h3", { class: "title", text: "This copy" }));
      const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });
      const csvBtn = el("button", { type: "button", class: "btn small alt", "data-probe": "csv" }, el("span", { text: "Export CSV" }));
      on(csvBtn, "click", () => download(`trickline-${(backup.name ?? "rider").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv(backup.responses ?? [], backup.sessions ?? []), "text/csv"));
      row.append(csvBtn);
      tools.append(row);
      pane.append(tools);
    } else if (tab === "trends") {
      pane.append(trendsTab(snap, today()));
    } else if (src.kind === "cloud") {
      pane.append(settingsPane(src, snap.states));
    }
    return screen;
  };

  // ---- settings, from here: the cloud document as the model ----------------------
  const settingsPane = (src: Extract<Source, { kind: "cloud" }>, states: SettingsModel["states"]): HTMLElement => {
    const wrap = el("div", { "data-probe": "settings-tab" });
    const running = settingsOf(src.res.backup.meta);
    // What the door sees: the document's value where it has one, else what
    // the device is running.
    const effective = (): SyncedSettings => {
      const out = { ...running };
      for (const k of SYNCED_KEYS) if (src.settings[k] !== undefined) (out as Record<string, unknown>)[k] = src.settings[k]!.v;
      return out;
    };
    const model: SettingsModel = {
      deck, states, who: cloudWhose(src.res),
      get: (key) => effective()[key],
      set: (key, value) => {
        const field = { v: value, at: Date.now(), by: deviceId() };
        src.settings = { ...src.settings, [key]: field };
        render(true);
        // Send everything this door knows, not just the change: a stale KV
        // read on the worker could otherwise drop the field before it.
        void putSettings(src.code, src.settings).then((r) => {
          if (r.kind === "ok") { src.settings = r.doc.fields; render(true); toast(`Saved: ${describeField(key, value)}. The rider's device picks it up when it next opens.`); }
          else toast("The cloud did not take that change. Try again in a bit.");
        });
      },
    };

    const status = el("div", { class: "card", "data-probe": "settings-status" });
    status.append(el("h3", { class: "title", text: `On ${cloudWhose(src.res)}'s device` }));
    const pend = pendingFields(src.settings, running);
    if (pend.length === 0) {
      status.append(el("p", { class: "note pending ok", "data-probe": "settings-applied", text:
        `Everything set here is running on the device, as of its last mirror (${cloudWhen(src.res)}${cloudFrom(src.res)}).` }));
    } else {
      status.append(el("p", { class: "note pending", "data-probe": "settings-pending", text:
        `Waiting for the device to check in: ${pend.map((k) => describeField(k, src.settings[k]!.v)).join("; ")}. ` +
        `It picks changes up when the app opens or comes back to the front; its last mirror was ${cloudWhen(src.res)}${cloudFrom(src.res)}. Press Refresh above to see when it has.` }));
    }
    wrap.append(status);
    for (const card of settingsCards(model)) wrap.append(card);
    wrap.append(el("p", { class: "note", text: "The PIN, sound and trick animations belong to the device and are not set from here." }));
    return wrap;
  };

  // ---- launch: a remembered code opens straight onto the record -------------------
  const remembered = parentCode();
  if (remembered !== null) {
    mount(root, el("div", { class: "screen", "data-probe": "parent-loading" },
      el("div", { class: "card" }, el("h3", { class: "title", text: "Asking the cloud…" }),
        el("p", { class: "note", text: "Fetching the latest copy of the record and any settings." }))));
    const res = await getShare(remembered);
    if (res.kind === "ok") {
      await openCloud(remembered, res, "opened");
    } else {
      render();
      toast(res.kind === "missing" ? "The cloud holds nothing under the remembered code. Connect again."
        : res.kind === "bad" ? "The cloud copy needs a newer app than this device runs."
        : "The cloud is not answering. Connect again when you are online.");
    }
  } else {
    render();
  }

  (window as unknown as Record<string, unknown>).__parent = {
    code: () => parentCode(),
    viewing: () => source !== null,
    kind: () => source?.kind ?? null,
    riders: () => riders(),
    settings: () => (source?.kind === "cloud" ? source.settings : null),
  };
};

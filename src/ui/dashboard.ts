/**
 * THE GROWN-UPS SCREEN.
 *
 * This is the part that leaves the house. The data goes to a teacher, so two
 * rules govern everything here:
 *
 *  1. Every figure is recomputed from the stored raw response log, never from
 *     a running total, so the dashboard cannot drift away from its evidence.
 *     The derivations live in core/report.ts and take a SNAPSHOT, so the same
 *     report draws from this device's data or from a cloud copy.
 *  2. The export carries its own MEASUREMENT DEFINITION. A median response
 *     time from an iPad with a custom keypad is not a normed assessment, and a
 *     specialist reading the file needs to know what the clock was doing.
 *
 * TWO TABS (alpha, 2026-09-01). The one-scroll dashboard had grown to four
 * and a half screens with charts and controls interleaved: a parent adjusting
 * a cap scrolled past a chart, a teacher wanting the data scrolled past every
 * control, and a phone that only wanted to connect a code found that button
 * last. PROGRESS is the report; SETTINGS is the controls. One PIN covers both.
 *
 * VIEWER MODE. A device linked to a share code that has no practice data of
 * its own shows the cloud copy, read-only, with a banner saying whose it is
 * and when it was saved. That is the parent's phone and the teacher's laptop:
 * neither should have to "load" a child's data over their own to look at it.
 */

import type { Snapshot } from "../core/report";
import type { App } from "./appstate";
import { cloudFrom, cloudWhen, cloudWhose, connectedCode, describeRefresh, getShare, sessionsText, type CloudOk } from "./cloud";
import { parentAppButton } from "./dash/parent-app";
import { renderPin } from "./dash/pin";
import { progressTab } from "./dash/progress";
import { settingsTab } from "./dash/settings";
import { trendsTab } from "./dash/trends";
import { el, mount, on } from "./dom";
import { icoRefresh } from "./icons";
import { snapshotFromBackup } from "./snapshot";
import { getResponses, getSessions, hasLocalData } from "./store";
import { toast } from "./toast";

type Tab = "progress" | "trends" | "settings";

/** Once the code has been given, it stays given for the rest of the visit.
 *  Re-asking for it after every toggle would make the settings unusable. */
let unlocked = false;
let tab: Tab = "progress";
/** An explicit "view the cloud copy" request, or the automatic one on a
 *  device with no data of its own. Null means this device's own report. */
let viewing: { code: string; res: CloudOk; auto: boolean } | null = null;

export const relock = (): void => { unlocked = false; viewing = null; tab = "progress"; };

export const dashboardScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const body = el("div", {});
  root.append(body);

  if (unlocked) { renderDash(app, body); return root; }

  if (app.pin() === null) {
    renderPin(app, body, "Set a 4 digit code", (code) => {
      app.setPin(code);
      unlocked = true;
      renderDash(app, body);
    });
  } else {
    const ask = (title: string, retry: boolean): void =>
      renderPin(app, body, title, (code) => {
        if (code === app.pin()) { unlocked = true; renderDash(app, body); }
        else ask("Not that one. Try again.", true);
      }, retry);
    ask("Grown-ups only", false);
  }
  return root;
};

const renderDash = (app: App, host: HTMLElement): void => {
  void (async () => {
   try {
    const responses = await getResponses();
    const sessions = await getSessions();
    const local = await hasLocalData();
    const code = connectedCode();

    // VIEWER MODE, automatically: linked, and nothing of our own to show.
    if (viewing === null && !local && code !== null) {
      const res = await getShare(code);
      if (res.kind === "ok") viewing = { code, res, auto: true };
    }

    // NOT "dash": that class already belonged to BLADEBACK's speed streaks
    // (opacity 0 with a flash animation), and the whole grown-ups screen spent
    // ten minutes on Andy's phone fading to black once every 4.8 seconds.
    const wrap = el("div", { class: "grownups", "data-probe": "grownups-screen" });
    const bar = el("div", { class: "topbar" });
    const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
    on(back, "click", () => { relock(); app.go("home"); });
    // The grown-ups' door, advertised where a parent already is: one button,
    // the details behind it, so it is known without being clutter.
    bar.append(back, parentAppButton(), el("div", { class: "grow" }), el("h3", { text: "Grown-ups" }));
    wrap.append(bar);

    const tabs = el("div", { class: "dash-tabs", role: "tablist" });
    const pane = el("div", { class: "dash-pane" });
    const tabBtn = (id: Tab, label: string): HTMLElement => {
      const b = el("button", {
        type: "button", class: `tab${tab === id ? " on" : ""}`, role: "tab",
        "aria-selected": String(tab === id), "data-probe": `tab-${id}`,
      }, el("span", { text: label }));
      on(b, "click", () => {
        tab = id;
        for (const t of Array.from(tabs.children)) {
          const onNow = (t as HTMLElement).dataset["probe"] === `tab-${id}`;
          t.classList.toggle("on", onNow);
          t.setAttribute("aria-selected", String(onNow));
        }
        show();
      });
      return b;
    };
    tabs.append(tabBtn("progress", "Progress"), tabBtn("trends", "Trends"), tabBtn("settings", "Settings"));
    wrap.append(tabs, pane);

    // Connecting or pressing View lands on the report AND says so: a
    // silent switch read as nothing happening (Andy, 2026-09-02).
    const onView = (c: string, res: CloudOk): void => {
      viewing = { code: c, res, auto: false };
      tab = "progress";
      renderDash(app, host);
      toast(`Connected. Viewing ${cloudWhose(res)}'s copy: ${sessionsText(res.meta.sessions ?? 0)}, saved ${cloudWhen(res)}${cloudFrom(res)}.`);
    };

    const progressPane = (): HTMLElement => {
      const box = el("div", {});
      if (viewing !== null) {
        const { res, code: c } = viewing;
        const banner = el("div", { class: "viewer-banner", "data-probe": "viewer-banner" });
        banner.append(el("span", { class: "grow", text:
          `Viewing ${cloudWhose(res)}'s cloud copy · saved ${cloudWhen(res)}${cloudFrom(res)}. Read only.` }));
        // REFRESH says what it did: new data, or already the latest. A button
        // that changed nothing visible felt like a button that did nothing.
        const refreshLabel = el("span", { text: "Refresh" });
        const refresh = el("button", { type: "button", class: "btn small", "data-probe": "viewer-refresh" }, icoRefresh(), refreshLabel);
        on(refresh, "click", () => {
          if (refresh.classList.contains("busy")) return;
          refresh.classList.add("busy");
          refreshLabel.textContent = "Refreshing…";
          const before = res;
          void getShare(c).then((fresh) => {
            if (fresh.kind !== "ok") {
              refresh.classList.remove("busy");
              refreshLabel.textContent = "Refresh";
              toast(fresh.kind === "missing" ? "The cloud holds nothing under this code any more." : "The cloud is not answering. Showing the last copy.");
              return;
            }
            viewing = { code: c, res: fresh, auto: viewing?.auto ?? false };
            renderDash(app, host);
            toast(describeRefresh(before, fresh).text);
          });
        });
        banner.append(refresh);
        if (local || !viewing.auto) {
          const exit = el("button", { type: "button", class: "btn small", "data-probe": "viewer-exit" }, el("span", { text: "This device" }));
          on(exit, "click", () => { viewing = null; renderDash(app, host); });
          banner.append(exit);
        }
        box.append(banner);
        box.append(progressTab(snapshotFromBackup(app.deck, res.backup), app.day, true));
        return box;
      }
      if (!local && responses.length === 0) {
        const empty = el("div", { class: "card", "data-probe": "dash-empty" });
        empty.append(el("h3", { class: "title", text: "Nothing here yet" }));
        empty.append(el("p", { class: "note", text:
          "This device has no practice on it. Drop in for a first run, or connect a share code from another device to view its record here." }));
        const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });
        const go = el("button", { type: "button", class: "btn small go" }, el("span", { text: "Drop in" }));
        on(go, "click", () => { relock(); app.go("session"); });
        const connect = el("button", { type: "button", class: "btn small alt", "data-probe": "empty-connect" }, el("span", { text: "Connect a code" }));
        on(connect, "click", () => {
          tab = "settings";
          renderDash(app, host);
          window.setTimeout(() => host.querySelector('[data-probe="cloud-card"]')?.scrollIntoView({ block: "start" }), 50);
        });
        row.append(go, connect);
        empty.append(row);
        box.append(empty);
      }
      const snap: Snapshot = {
        deck: app.deck, states: app.states, responses, sessions,
        strands: app.meta.strands, caps: app.meta.caps,
      };
      box.append(progressTab(snap, app.day, false));
      return box;
    };

    // A setting changed: redraw the pane INSIDE the same scrolling screen, so
    // the parent stays where they were on a long settings list.
    const rerender = (): void => { mount(pane, settingsTab(app, { onView, responses, sessions, rerender })); };
    const trendsPane = (): HTMLElement => {
      if (viewing !== null) return trendsTab(snapshotFromBackup(app.deck, viewing.res.backup), app.day);
      return trendsTab({ deck: app.deck, states: app.states, responses, sessions, strands: app.meta.strands, caps: app.meta.caps }, app.day);
    };
    const show = (): void => {
      mount(pane, tab === "progress" ? progressPane() : tab === "trends" ? trendsPane() : settingsTab(app, { onView, responses, sessions, rerender }));
    };
    show();
    mount(host, wrap);
   } catch (err) {
    // The report failing to draw must READ as a failure, never as the old
    // pane sitting there with a stale note on it.
    const card = el("div", { class: "card", "data-probe": "dash-error" });
    card.append(el("h3", { class: "title", text: "Could not draw the report" }));
    card.append(el("p", { class: "note warn", text: String(err) }));
    const back = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "← Back" }));
    on(back, "click", () => { relock(); app.go("home"); });
    card.append(back);
    mount(host, card);
   }
  })();
};

/**
 * THE PARENT DASHBOARD.
 *
 * This is the part that leaves the house. The data goes to a teacher, so two
 * rules govern everything here:
 *
 *  1. Every figure is recomputed from the stored raw response log, never from
 *     a running total, so the dashboard cannot drift away from its evidence.
 *  2. The export carries its own MEASUREMENT DEFINITION. A median response
 *     time from an iPad with a custom keypad is not a normed assessment, and a
 *     specialist reading the file needs to know what the clock was doing.
 *
 * Retries are excluded everywhere. He had just been shown the answer.
 * Elapsed-time bonus items are excluded too: they are problems he is already
 * good at, and letting them into the headline would inflate it.
 */

import { DERIVED_MAX_MS, RETRIEVED_MAX_MS } from "../core/config";
import { standardProgress } from "../core/standards";
import type { Response } from "../core/types";
import type { App } from "./appstate";
import { heatMap, progressBar, retrievalTrend, type HeatCell, type WeekPoint } from "./charts";
import { el, mount, on } from "./dom";
import { sheet } from "./sheet";
import { eraseAll, exportAll, getResponses, getSessions, importAll, type SessionRecord } from "./store";

const MEASUREMENT_NOTE =
  `Response time is measured from the moment the problem is painted to the FIRST DIGIT pressed on the app's own keypad, ` +
  `not to submission, so it excludes the motor time of typing a two or three digit answer. ` +
  `Retrieved = correct under ${RETRIEVED_MAX_MS / 1000}s. Derived = correct ${RETRIEVED_MAX_MS / 1000}-${DERIVED_MAX_MS / 1000}s. ` +
  `Effortful = correct over ${DERIVED_MAX_MS / 1000}s, or incorrect. ` +
  `Forced re-entries after a wrong answer and elapsed-time bonus items are excluded from all figures. ` +
  `This is practice telemetry from a tablet, not a normed assessment.`;

const scoreable = (rs: readonly Response[]): Response[] =>
  rs.filter((r) => !r.isRetry && !r.factId.startsWith("elapsed:"));

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? null) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
};

const weekOf = (day: number): number => Math.floor(day / 7);

const byWeek = (rs: readonly Response[]): WeekPoint[] => {
  const buckets = new Map<number, Response[]>();
  for (const r of scoreable(rs)) {
    const w = weekOf(r.day);
    const list = buckets.get(w);
    if (list) list.push(r); else buckets.set(w, [r]);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([w, list], i) => {
    const correct = list.filter((r) => r.correct);
    return {
      label: `wk ${i + 1}`,
      items: list.length,
      retrievedPct: correct.length === 0 ? 0
        : Math.round((correct.filter((r) => r.cls === "retrieved").length / correct.length) * 100),
      week: w,
    };
  });
};

const csv = (rs: readonly Response[], sessions: readonly SessionRecord[]): string => {
  const esc = (v: string | number | boolean | null): string => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`# TRICK LINE practice export. ${MEASUREMENT_NOTE}`);
  lines.push(["date", "fact", "kind", "correct", "answered", "first_key_ms", "submit_ms", "classification", "is_retry"].join(","));
  for (const r of rs) {
    lines.push([
      esc(new Date(r.at).toISOString()), esc(r.factId), esc(r.factId.split(":")[0] ?? ""),
      esc(r.correct), esc(r.answered), esc(r.firstKeyMs), esc(r.submitMs), esc(r.cls), esc(r.isRetry),
    ].join(","));
  }
  lines.push("");
  lines.push(["session_date", "minutes", "items", "correct", "retrieved", "derived", "status"].join(","));
  for (const s of sessions) {
    lines.push([
      esc(new Date(s.startedAt).toISOString()),
      esc(Math.round((s.endedAt - s.startedAt) / 60000)),
      esc(s.items), esc(s.correct), esc(s.retrieved), esc(s.derived), esc(s.status),
    ].join(","));
  }
  return lines.join("\n");
};

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

export const dashboardScreen = (app: App): HTMLElement => {
  const root = el("div", { class: "screen" });
  const body = el("div", {});
  root.append(body);

  if (app.meta.pin === null) {
    renderPin(app, body, "Set a 4 digit code", (code) => {
      app.meta.pin = code;
      void app.save().then(() => renderDash(app, body));
    });
  } else {
    renderPin(app, body, "Grown-ups only", (code) => {
      if (code === app.meta.pin) renderDash(app, body);
      else renderPin(app, body, "Not that one. Try again.", () => undefined, true);
    });
  }
  return root;
};

const renderPin = (
  app: App, host: HTMLElement, title: string, done: (code: string) => void, retry = false,
): void => {
  let code = "";
  const wrap = el("div", { class: "screen pinpad" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
  on(back, "click", () => app.go("home"));
  wrap.append(back);
  wrap.append(el("h2", { text: title }));
  const dots = el("div", { class: "pin-dots" });
  const paintDots = (): void => {
    mount(dots, ...Array.from({ length: 4 }, (_, i) =>
      el("div", { class: `pin-dot${i < code.length ? " on" : ""}` })));
  };
  paintDots();
  wrap.append(dots);

  const grid = el("div", { class: "keypad" });
  for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    const b = el("button", { type: "button", class: "key digit", "data-key": d }, el("span", { text: d }));
    on(b, "click", () => {
      if (code.length >= 4) return;
      code += d;
      paintDots();
      if (code.length === 4) window.setTimeout(() => done(code), 160);
    });
    grid.append(b);
  }
  const del = el("button", { type: "button", class: "key util clear" }, el("span", { text: "back" }));
  on(del, "click", () => { code = code.slice(0, -1); paintDots(); });
  const zero = el("button", { type: "button", class: "key digit", "data-key": "0" }, el("span", { text: "0" }));
  on(zero, "click", () => {
    if (code.length >= 4) return;
    code += "0";
    paintDots();
    if (code.length === 4) window.setTimeout(() => done(code), 160);
  });
  grid.append(del, zero, el("span", {}));
  wrap.append(grid);
  if (retry) {
    const again = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "Try again" }));
    on(again, "click", () => renderPin(app, host, "Grown-ups only", (c) => {
      if (c === app.meta.pin) renderDash(app, host);
      else renderPin(app, host, "Not that one. Try again.", () => undefined, true);
    }));
    wrap.append(again);
  }
  mount(host, wrap);
};

const renderDash = (app: App, host: HTMLElement): void => {
  void (async () => {
    const responses = await getResponses();
    const sessions = await getSessions();
    const scored = scoreable(responses);
    const wrap = el("div", {});

    const bar = el("div", { class: "topbar" });
    const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "back" }, el("span", { text: "← Back" }));
    on(back, "click", () => app.go("home"));
    bar.append(back, el("div", { class: "grow" }), el("h3", { text: "Progress" }));
    wrap.append(bar);

    // ---- the headline -----------------------------------------------------
    const correct = scored.filter((r) => r.correct);
    const retrPct = correct.length === 0 ? 0
      : Math.round((correct.filter((r) => r.cls === "retrieved").length / correct.length) * 100);
    const derPct = correct.length === 0 ? 0
      : Math.round((correct.filter((r) => r.cls === "derived").length / correct.length) * 100);

    const head = el("div", { class: "card" });
    head.append(el("h3", { text: "Retrieval vs derivation" }));
    head.append(el("p", { class: "note", text:
      `Of ${correct.length} correct answers, ${retrPct}% were retrieved from memory and ${derPct}% were worked out. ` +
      `Both are correct. The first number is the one that has to climb.` }));
    head.append(retrievalTrend(byWeek(responses)));
    wrap.append(head);

    // ---- the standards ----------------------------------------------------
    const std = el("div", { class: "card" });
    std.append(el("h3", { text: "Virginia Standards of Learning" }));
    for (const s of standardProgress(app.deck, app.states)) {
      std.append(el("div", { class: "mon-sub", text: `${s.code} · grade ${s.grade} · ${s.title}` }));
      std.append(progressBar(s.pct, s.grade === 3 ? "#B6FF3C" : "#35E6FF"));
      std.append(el("p", { class: "note", text: `${s.mastered} of ${s.total} known from memory. ${s.inProgress} in progress.` }));
    }
    std.append(el("p", { class: "note", text:
      "2.CE.1 is a second grade standard being closed this year. 3.CE.2 is due by the end of third grade and is the direct prerequisite for fourth grade multi-digit multiplication and long division." }));
    wrap.append(std);

    // ---- the heat map -----------------------------------------------------
    const perFact = new Map<string, number[]>();
    for (const r of scored) {
      if (!r.correct || r.firstKeyMs === null) continue;
      const list = perFact.get(r.factId);
      if (list) list.push(r.firstKeyMs); else perFact.set(r.factId, [r.firstKeyMs]);
    }
    const cells: HeatCell[] = [...app.deck.values()].map((f) => {
      const st = app.states.get(f.id);
      const sym = f.kind === "add" ? "+" : f.kind === "sub" ? "−" : f.kind === "mul" ? "×" : "÷";
      return {
        id: f.id, label: `${f.a}${sym}${f.b}`,
        box: st?.box ?? 1, mastered: st?.mastered ?? false,
        medianMs: median(perFact.get(f.id) ?? []),
        seen: st?.seen ?? 0,
      };
    });
    for (const kind of ["add", "sub", "mul", "div"] as const) {
      const card = el("div", { class: "card" });
      const label = { add: "Addition", sub: "Subtraction", mul: "Multiplication", div: "Division" }[kind];
      const mine = cells.filter((c) => c.id.startsWith(kind));
      card.append(el("h3", { text: `${label} — ${mine.filter((c) => c.mastered).length}/${mine.length} from memory` }));
      card.append(heatMap(mine));
      wrap.append(card);
    }

    // ---- regressions ------------------------------------------------------
    const slipping = cells.filter((c) => {
      const st = app.states.get(c.id);
      return st !== undefined && st.introduced && !st.mastered && st.seen >= 4 && st.correct / st.seen < 0.7;
    }).sort((a, b) => (a.box - b.box)).slice(0, 12);
    const regr = el("div", { class: "card" });
    regr.append(el("h3", { text: "Going the wrong way" }));
    regr.append(slipping.length === 0
      ? el("p", { class: "note", text: "Nothing is slipping right now." })
      : el("p", { class: "note", text: slipping.map((c) => c.label).join("   ") }));
    wrap.append(regr);

    // ---- sessions ---------------------------------------------------------
    const log = el("div", { class: "card" });
    log.append(el("h3", { text: "Sessions" }));
    log.append(el("p", { class: "note", text:
      "Stamina is itself worth watching. \"Ended early\" means the app stopped him, or he chose to stop at a line break, both of which are working as intended." }));
    const table = el("table", { class: "rows" });
    table.append(el("tr", {}, ...["Date", "Min", "Items", "Correct", "Retrieved", "Status"].map((h) => el("th", { text: h }))));
    for (const s of [...sessions].reverse().slice(0, 20)) {
      table.append(el("tr", {},
        el("td", { text: new Date(s.startedAt).toLocaleDateString() }),
        el("td", { text: String(Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))) }),
        el("td", { text: String(s.items) }),
        el("td", { text: s.items === 0 ? "—" : `${Math.round((s.correct / s.items) * 100)}%` }),
        el("td", { text: s.correct === 0 ? "—" : `${Math.round((s.retrieved / s.correct) * 100)}%` }),
        el("td", { text: s.status === "endedEarly" ? "ended early" : s.status }),
      ));
    }
    log.append(el("div", { class: "scroll-x" }, table));
    wrap.append(log);

    // ---- data -------------------------------------------------------------
    const data = el("div", { class: "card" });
    data.append(el("h3", { text: "Data" }));
    data.append(el("p", { class: "note", text: MEASUREMENT_NOTE }));
    const row = el("div", { class: "sheet-row", style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:12px" });

    const csvBtn = el("button", { type: "button", class: "btn small alt", "data-probe": "csv" }, el("span", { text: "Export CSV" }));
    on(csvBtn, "click", () => download(`trickline-${new Date().toISOString().slice(0, 10)}.csv`, csv(responses, sessions), "text/csv"));

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

    mount(host, wrap);
  })();
};

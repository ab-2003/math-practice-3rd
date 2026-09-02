/**
 * THE GROWN-UPS' DOOR, at /parent/ (Andy, 2026-09-02).
 *
 * A parent's phone or a teacher's laptop wants to LOOK at the record. Until
 * now it had to walk through the kid's home, set a PIN it did not need, and
 * find Connect at the bottom of Settings. This is a separate front door in
 * the same build: connect a share code (type, paste, scan) or open a backup
 * file, and see the report. Read only. No PIN, no game, no shop, nothing
 * that writes a rider's data. The code is the secret, and it is remembered
 * so the next launch opens straight onto the record and refreshes.
 *
 * A separate PATH rather than a first-launch "parent or child?" fork, so the
 * kid's door stays exactly the game and nothing about it needs an age gate.
 */

import { today } from "../core/clock";
import { buildDeck } from "../core/facts";
import { csv } from "../core/report";
import {
  cloudFrom, cloudWhen, cloudWhose, describeRefresh, forgetParentCode, getShare, parentCode,
  rememberParentCode, type CloudOk,
} from "./cloud";
import { connectForm } from "./cloud-ui";
import { progressTab } from "./dash/progress";
import { el, mount, on } from "./dom";
import { icoRefresh } from "./icons";
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

type Source =
  | { kind: "cloud"; code: string; res: CloudOk }
  | { kind: "file"; name: string; backup: Backup };

export const bootParent = async (root: HTMLElement): Promise<void> => {
  const deck = buildDeck();
  let source: Source | null = null;

  const render = (): void => {
    mount(root, source === null ? connectScreen() : viewScreen(source));
    window.scrollTo(0, 0);
  };

  // ---- the front door ------------------------------------------------------
  const connectScreen = (): HTMLElement => {
    const screen = el("div", { class: "screen", "data-probe": "parent-connect" });
    const hero = el("div", { class: "hero" });
    hero.append(el("h1", { text: "Trick Line" }));
    hero.append(el("p", { class: "sub", text: "Grown-ups' view. Read only." }));
    screen.append(hero);

    const card = el("div", { class: "card" });
    card.append(connectForm({
      onConnected: (code, res) => {
        rememberParentCode(code);
        source = { kind: "cloud", code, res };
        render();
        toast(`Connected. Viewing ${cloudWhose(res)}'s copy: ${res.meta.sessions ?? 0} sessions, saved ${cloudWhen(res)}${cloudFrom(res)}.`);
      },
    }));
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
        render();
        toast(`Opened ${backup.name ?? "the rider"}'s backup: ${backup.sessions?.length ?? 0} sessions.`);
      }).catch((e: unknown) => toast(`Could not open that file: ${String(e)}`));
    });
    const open = el("button", { type: "button", class: "btn small", "data-probe": "parent-open-file" }, el("span", { text: "Open a file" }));
    on(open, "click", () => inp.click());
    fileCard.append(open, inp);
    screen.append(fileCard);

    screen.append(el("p", { class: "note", style: "text-align:center", text:
      "This page only reads. To practise, use the rider's own app at the main address." }));
    return screen;
  };

  // ---- the record ----------------------------------------------------------
  const viewScreen = (src: Source): HTMLElement => {
    const screen = el("div", { class: "screen", "data-probe": "parent-view" });
    const bar = el("div", { class: "topbar" });
    const change = el("button", { type: "button", class: "btn small ghost", "data-probe": "parent-change" }, el("span", { text: "← Change" }));
    on(change, "click", () => { source = null; render(); });
    bar.append(change, el("div", { class: "grow" }), el("h3", { text: "Grown-ups" }));
    screen.append(bar);

    const banner = el("div", { class: "viewer-banner", "data-probe": "viewer-banner" });
    if (src.kind === "cloud") {
      const { res, code } = src;
      banner.append(el("span", { class: "grow", text:
        `Viewing ${cloudWhose(res)}'s cloud copy · saved ${cloudWhen(res)}${cloudFrom(res)}. Read only.` }));
      const label = el("span", { text: "Refresh" });
      const refresh = el("button", { type: "button", class: "btn small", "data-probe": "viewer-refresh" }, icoRefresh(), label);
      on(refresh, "click", () => {
        if (refresh.classList.contains("busy")) return;
        refresh.classList.add("busy");
        label.textContent = "Refreshing…";
        void getShare(code).then((fresh) => {
          if (fresh.kind !== "ok") {
            refresh.classList.remove("busy");
            label.textContent = "Refresh";
            toast(fresh.kind === "missing" ? "The cloud holds nothing under this code any more." : "The cloud is not answering. Showing the last copy.");
            return;
          }
          source = { kind: "cloud", code, res: fresh };
          render();
          toast(describeRefresh(res, fresh).text);
        });
      });
      banner.append(refresh);
    } else {
      banner.append(el("span", { class: "grow", text:
        `Viewing ${src.backup.name ?? "the rider"}'s backup file (${src.name}), exported ${new Date(src.backup.exportedAt).toLocaleDateString()}. Read only.` }));
    }
    screen.append(banner);

    const backup = src.kind === "cloud" ? src.res.backup : src.backup;
    screen.append(progressTab(snapshotFromBackup(deck, backup), today(), true));

    const tools = el("div", { class: "card" });
    tools.append(el("h3", { class: "title", text: "This copy" }));
    const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });
    const csvBtn = el("button", { type: "button", class: "btn small alt", "data-probe": "csv" }, el("span", { text: "Export CSV" }));
    on(csvBtn, "click", () => download(`trickline-${(backup.name ?? "rider").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv(backup.responses ?? [], backup.sessions ?? []), "text/csv"));
    row.append(csvBtn);
    if (src.kind === "cloud") {
      const forget = el("button", { type: "button", class: "btn small ghost", "data-probe": "parent-forget" }, el("span", { text: "Forget this code" }));
      on(forget, "click", () => { forgetParentCode(); source = null; render(); toast("Forgotten. This device no longer knows the code."); });
      row.append(forget);
    }
    tools.append(row);
    screen.append(tools);
    return screen;
  };

  // ---- launch: a remembered code opens straight onto the record ----------------
  const remembered = parentCode();
  if (remembered !== null) {
    mount(root, el("div", { class: "screen", "data-probe": "parent-loading" },
      el("div", { class: "card" }, el("h3", { class: "title", text: "Asking the cloud…" }),
        el("p", { class: "note", text: "Fetching the latest copy of the record." }))));
    const res = await getShare(remembered);
    if (res.kind === "ok") {
      source = { kind: "cloud", code: remembered, res };
      render();
      toast(`Viewing ${cloudWhose(res)}'s copy: ${res.meta.sessions ?? 0} sessions, saved ${cloudWhen(res)}${cloudFrom(res)}.`);
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
  };
};

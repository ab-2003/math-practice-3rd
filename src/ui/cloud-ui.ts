/**
 * THE CLOUD SHARE CARD (parent settings, behind the PIN). Faithful to the
 * WO4 flow Andy asked for: connect gives metadata, load restores, QR/copy/
 * share to hand the code across, disconnect and delete are separate acts,
 * and none of it ever blocks the app.
 */

import qrcode from "qrcode-generator";
import jsQR from "jsqr";
import type { App } from "./appstate";
import {
  cloudPushNow, connectedCode, deleteShare, fmtCode, forgetCode, genCode,
  getShare, lastPush, loadBackup, normalizeCode, putShare, rememberCode, type CloudResult,
} from "./cloud";
import { el, mount, on } from "./dom";
import { exportAll } from "./store";
import { sheet } from "./sheet";

export type CloudOk = Extract<CloudResult, { kind: "ok" }>;
/** The dashboard's way into VIEWER MODE: show this copy, read-only. */
export type CloudViewHandler = (code: string, res: CloudOk) => void;

export const cloudCard = (_app: App, opts: { onView?: CloudViewHandler } = {}): HTMLElement => {
  const card = el("div", { class: "card", "data-probe": "cloud-card" });
  let stopScan: (() => void) | null = null;
  const render = (): void => { stopScan?.(); mount(card, build()); };

  const build = (): HTMLElement => {
    const box = el("div", {});
    box.append(el("h3", { text: "Cloud share" }));
    const code = connectedCode();

    if (code === null) {
      box.append(el("p", { class: "note", text:
        "Mirror the practice record to a private share code, so you or a teacher can see it from another device. The iPad stays the real copy; the cloud is a best-effort mirror that never interrupts him." }));
      const row = el("div", { class: "stepper" });
      const create = el("button", { type: "button", class: "btn small alt", "data-probe": "cloud-create" }, el("span", { text: "Create a share code" }));
      on(create, "click", () => {
        const fresh = genCode();
        void exportAll().then((b) => putShare(fresh, b)).then((ok) => {
          if (!ok) { sheet({ title: "The cloud did not answer", body: "Nothing was created. Try again in a bit.", confirm: "OK" }); return; }
          rememberCode(fresh);
          render();
        });
      });
      const connect = el("button", { type: "button", class: "btn small" }, el("span", { text: "Connect a code" }));
      on(connect, "click", () => { mount(card, buildConnect()); });
      row.append(create, connect);
      box.append(row);
      return box;
    }

    // ---- connected -------------------------------------------------------
    box.append(el("p", { class: "cloud-code", "data-probe": "cloud-code", text: fmtCode(code) }));

    // The QR carries the CODE, never a URL: scanning must not open a browser.
    const qr = qrcode(0, "M");
    qr.addData(fmtCode(code));
    qr.make();
    const cells = qr.getModuleCount();
    const scale = 4;
    const canvas = el("canvas", { class: "qr-canvas", "data-probe": "cloud-qr" }) as unknown as HTMLCanvasElement;
    canvas.width = canvas.height = (cells + 8) * scale;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "#05070A";
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if (qr.isDark(r, c)) g.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
    }
    box.append(canvas);

    const status = el("p", { class: "note", "data-probe": "cloud-status" });
    const last = lastPush();
    status.textContent = last === null ? "Nothing mirrored from this device yet."
      : `Last mirror from this device: ${new Date(last.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ${last.ok ? "✓" : "(did not reach the cloud)"}`;
    box.append(status);
    const held = el("p", { class: "note", text: "Asking the cloud what it holds…" });
    box.append(held);
    void getShare(code).then((res) => {
      if (res.kind === "ok") {
        const when = res.meta.savedAt !== undefined ? new Date(res.meta.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "sometime";
        held.textContent = `Cloud holds ${res.meta.sessions ?? 0} sessions · saved ${when}${res.meta.device !== undefined ? ` from ${res.meta.device}` : ""}.`;
      } else if (res.kind === "missing") held.textContent = "The cloud holds nothing under this code yet. Save now to fill it.";
      else if (res.kind === "bad") held.textContent = "The cloud copy needs a newer app than this device runs.";
      else held.textContent = "The cloud is not answering right now. The data on this device is untouched.";
    });

    const rows = el("div", { class: "stepper", style: "flex-wrap:wrap" });
    const copy = el("button", { type: "button", class: "btn small" }, el("span", { text: "Copy" }));
    on(copy, "click", () => { void navigator.clipboard?.writeText(fmtCode(code)).then(() => { copy.querySelector("span")!.textContent = "Copied!"; }); });
    rows.append(copy);
    if (typeof navigator.share === "function") {
      const share = el("button", { type: "button", class: "btn small" }, el("span", { text: "Share" }));
      on(share, "click", () => { void navigator.share({ text: `Trick Line share code: ${fmtCode(code)}` }).catch(() => undefined); });
      rows.append(share);
    }
    const now = el("button", { type: "button", class: "btn small alt", "data-probe": "cloud-save-now" }, el("span", { text: "Save now" }));
    on(now, "click", () => { void cloudPushNow().then(() => render()); });
    rows.append(now);
    // VIEW without loading: the parent's phone and the teacher's laptop want
    // to LOOK at the record, not replace their own data with it.
    const view = el("button", { type: "button", class: "btn small", "data-probe": "cloud-view" }, el("span", { text: "View" }));
    on(view, "click", () => {
      void getShare(code).then((res) => {
        if (res.kind !== "ok") { sheet({ title: "Nothing to view", body: "The cloud did not hand back a usable copy.", confirm: "OK" }); return; }
        opts.onView?.(code, res);
      });
    });
    rows.append(view);
    const load = el("button", { type: "button", class: "btn small" }, el("span", { text: "Load from cloud" }));
    on(load, "click", () => {
      void getShare(code).then((res) => {
        if (res.kind !== "ok") { sheet({ title: "Nothing to load", body: "The cloud did not hand back a usable copy.", confirm: "OK" }); return; }
        sheet({
          title: "Load the cloud copy?",
          body: `It holds ${res.meta.sessions ?? 0} sessions. Loading REPLACES everything on this device.`,
          cancel: "Keep this device's data", confirm: "Load", danger: true,
          onConfirm: () => { void loadBackup(res.backup).then(() => location.reload()); },
        });
      });
    });
    rows.append(load);
    box.append(rows);

    const rows2 = el("div", { class: "stepper", style: "flex-wrap:wrap" });
    const dis = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "Disconnect" }));
    on(dis, "click", () => { forgetCode(); render(); });
    const del = el("button", { type: "button", class: "btn small warm" }, el("span", { text: "Delete cloud copy" }));
    on(del, "click", () => sheet({
      title: "Delete the cloud copy?",
      body: "The code stops working everywhere. The data on this device is untouched.",
      cancel: "Keep it", confirm: "Delete", danger: true,
      onConfirm: () => { void deleteShare(code).then(() => { forgetCode(); render(); }); },
    }));
    rows2.append(dis, del);
    box.append(rows2);
    return box;
  };

  // ---- the connect flow: type, paste, or scan ------------------------------
  const buildConnect = (): HTMLElement => {
    const box = el("div", {});
    box.append(el("h3", { text: "Connect a code" }));
    box.append(el("p", { class: "note", text: "Type or paste the code from the other device, or scan its QR." }));
    const input = el("input", {
      class: "cloud-input", placeholder: "MATH-PRA3-XXXXX-XXXXX-XXXXX-XXXXX",
      autocapitalize: "characters", spellcheck: "false",
    }) as HTMLInputElement;
    box.append(input);
    const err = el("p", { class: "note warn" });
    box.append(err);
    const scanWrap = el("div", {});
    box.append(scanWrap);

    const beginScan = async (): Promise<void> => {
      err.textContent = "";
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = document.createElement("video");
        video.playsInline = true; video.muted = true;
        video.srcObject = stream;
        video.style.cssText = "width:100%;max-width:340px;border-radius:12px;border:3px solid var(--line);";
        mount(scanWrap, video);
        await video.play();
        const cnv = document.createElement("canvas");
        const cg = cnv.getContext("2d", { willReadFrequently: true })!;
        let live = true;
        stopScan = () => { live = false; for (const tr of stream.getTracks()) tr.stop(); mount(scanWrap); stopScan = null; };
        const tick = (): void => {
          if (!live) return;
          try {
            if (video.videoWidth) {
              cnv.width = video.videoWidth; cnv.height = video.videoHeight;
              cg.drawImage(video, 0, 0);
              const img = cg.getImageData(0, 0, cnv.width, cnv.height);
              const hit = jsQR(img.data, img.width, img.height);
              const norm = hit ? normalizeCode(hit.data) : null;
              if (norm !== null) {
                input.value = fmtCode(norm);
                err.textContent = "Code scanned. Press Connect.";
                stopScan?.();
                return;
              }
            }
          } catch { /* one bad frame is not a verdict */ }
          window.setTimeout(tick, 250);
        };
        tick();
      } catch { err.textContent = "The camera did not open. Type the code instead."; }
    };

    const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      const scan = el("button", { type: "button", class: "btn small" }, el("span", { text: "Scan QR" }));
      on(scan, "click", () => { if (stopScan) stopScan(); else void beginScan(); });
      row.append(scan);
    }
    const go = el("button", { type: "button", class: "btn small alt", "data-probe": "cloud-connect" }, el("span", { text: "Connect" }));
    on(go, "click", () => {
      const norm = normalizeCode(input.value);
      if (norm === null) { err.textContent = "That does not look like a MATH-PRA3 code."; return; }
      err.textContent = "Asking the cloud…";
      void getShare(norm).then((res) => {
        if (res.kind === "missing") { err.textContent = "The cloud holds nothing under that code. Check it and try again."; return; }
        if (res.kind === "offline") { err.textContent = "The cloud is not answering. Try again in a bit."; return; }
        if (res.kind === "bad") { err.textContent = "That copy needs a newer app than this device runs."; return; }
        stopScan?.();
        const whose = res.meta.name !== undefined ? `${res.meta.name}'s record` : "the record";
        sheet({
          title: "Code connected",
          body: `The cloud holds ${whose}: ${res.meta.sessions ?? 0} sessions${res.meta.device !== undefined ? ` from ${res.meta.device}` : ""}. ` +
            `View it here without touching this device's own data, or load it onto this device?`,
          cancel: "Just view",
          confirm: "Load it here",
          onConfirm: () => {
            sheet({
              title: "Replace this device's data?",
              body: "Loading the cloud copy replaces everything currently on this device for this rider.",
              cancel: "Cancel", confirm: "Replace", danger: true,
              onConfirm: () => { rememberCode(norm); void loadBackup(res.backup).then(() => location.reload()); },
            });
          },
          onCancel: () => { rememberCode(norm); if (opts.onView) opts.onView(norm, res); else render(); },
        });
      });
    });
    const cancel = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "Back" }));
    on(cancel, "click", () => render());
    row.append(go, cancel);
    box.append(row);
    return box;
  };

  render();
  return card;
};

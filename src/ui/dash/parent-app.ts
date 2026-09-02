/**
 * GET PARENT APP (Andy, 2026-09-02): the grown-ups' door, advertised where a
 * parent already is, behind one button so it is not clutter. The modal has
 * its own Back pinned at the top (the sheet can scroll on a phone, and a
 * dismiss that scrolls away is a trap), the link, a QR that opens it, and
 * the two ways to put it on a home screen.
 */

import qrcode from "qrcode-generator";
import { PARENT_DOOR } from "../cloud-ui";
import { el, on } from "../dom";
import { sheet } from "../sheet";
import { toast } from "../toast";

export const parentAppButton = (): HTMLElement => {
  const b = el("button", { type: "button", class: "btn small alt", "data-probe": "get-parent-app" }, el("span", { text: "Get Parent App" }));
  on(b, "click", () => openParentApp());
  return b;
};

export const openParentApp = (): void => {
  const body = el("div", { class: "parent-app", "data-probe": "parent-app-sheet" });
  const head = el("div", { class: "topbar", style: "margin-bottom:6px" });
  const back = el("button", { type: "button", class: "btn small ghost", "data-probe": "parent-app-back" }, el("span", { text: "← Back" }));
  head.append(back, el("div", { class: "grow" }));
  body.append(head);

  body.append(el("p", { class: "note", text:
    "The grown-ups' door is a separate page for your own phone or a teacher's laptop: no PIN, no game, just the record, the trends, and the settings. Open this link there:" }));
  const link = el("a", { class: "cloud-code parent-link", href: PARENT_DOOR, target: "_blank", rel: "noopener", "data-probe": "parent-link", text: PARENT_DOOR.replace(/^https?:\/\//, "") });
  body.append(link);

  // A QR of the LINK (unlike the share code's QR, this one is meant to open
  // a browser): the phone's camera reads it and offers the page.
  const qr = qrcode(0, "M");
  qr.addData(PARENT_DOOR);
  qr.make();
  const cells = qr.getModuleCount();
  const scale = 4;
  const canvas = el("canvas", { class: "qr-canvas", "data-probe": "parent-qr" }) as unknown as HTMLCanvasElement;
  canvas.width = canvas.height = (cells + 8) * scale;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#05070A";
  for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
    if (qr.isDark(r, c)) g.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
  }
  body.append(canvas);
  body.append(el("p", { class: "note", text: "Point the phone's camera at the code and it offers the page." }));

  const row = el("div", { class: "stepper", style: "flex-wrap:wrap" });
  const copy = el("button", { type: "button", class: "btn small", "data-probe": "parent-copy" }, el("span", { text: "Copy link" }));
  on(copy, "click", () => {
    void navigator.clipboard?.writeText(PARENT_DOOR).then(() => { copy.querySelector("span")!.textContent = "Copied!"; toast("Link copied."); }).catch(() => toast("Could not copy. The link is written above."));
  });
  row.append(copy);
  if (typeof navigator.share === "function") {
    const share = el("button", { type: "button", class: "btn small" }, el("span", { text: "Share" }));
    on(share, "click", () => { void navigator.share({ text: `Trick Line grown-ups' page: ${PARENT_DOOR}`, url: PARENT_DOOR }).catch(() => undefined); });
    row.append(share);
  }
  body.append(row);

  body.append(el("h3", { class: "title", style: "margin-top:12px", text: "Put it on a home screen" }));
  body.append(el("p", { class: "note", "data-probe": "install-ios", text:
    "iPhone or iPad: open the link in Safari, tap the Share button, then Add to Home Screen. It installs as TL Grown-ups with its own icon." }));
  body.append(el("p", { class: "note", "data-probe": "install-android", text:
    "Android: open the link in Chrome, tap the menu, then Install app (or Add to Home screen)." }));
  body.append(el("p", { class: "note", text:
    "Once it is on the phone, connect this rider's share code from the Cloud card in Settings. The code is the only key; there is no account." }));

  const s = sheet({ title: "Get Parent App", body });
  on(back, "click", () => s.close());
};

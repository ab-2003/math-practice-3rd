import { el, on } from "./dom";

export interface SheetOpts {
  title: string;
  body?: Node | string;
  confirm?: string;
  /** An icon drawn before the confirm label (the breather's pause bars). */
  confirmIcon?: () => SVGElement;
  cancel?: string;
  /** The same for the cancel label ("Call it" at a line break is a breather too). */
  cancelIcon?: () => SVGElement;
  onConfirm?: () => void;
  onCancel?: () => void;
  danger?: boolean;
}

/**
 * The one modal. It has Escape, a tappable scrim, and it traps nothing it does
 * not need to: a modal without an escape once showed up as a scrim that ate
 * the next tap and looked like a dead screen.
 */
export const sheet = (opts: SheetOpts): { close: () => void } => {
  const scrim = el("div", { class: "scrim" });
  const box = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  box.append(el("h2", { text: opts.title }));
  if (opts.body !== undefined) {
    box.append(typeof opts.body === "string" ? el("p", { class: "note", text: opts.body }) : opts.body);
  }
  const row = el("div", { class: "row" });
  let settled = false;
  const close = (cancelled: boolean): void => {
    if (settled) return;
    settled = true;
    scrim.remove();
    document.removeEventListener("keydown", onKey);
    if (cancelled) opts.onCancel?.();
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") close(true); };
  document.addEventListener("keydown", onKey);

  if (opts.cancel !== undefined) {
    const b = el("button", { type: "button", class: "btn ghost" }, el("span", { text: opts.cancel }));
    if (opts.cancelIcon !== undefined) b.prepend(opts.cancelIcon());
    on(b, "click", () => close(true));
    row.append(b);
  }
  if (opts.confirm !== undefined) {
    const b = el("button", { type: "button", class: `btn ${opts.danger === true ? "warm" : "go"}` }, el("span", { text: opts.confirm }));
    if (opts.confirmIcon !== undefined) b.prepend(opts.confirmIcon());
    on(b, "click", () => { close(false); opts.onConfirm?.(); });
    row.append(b);
  }
  if (row.childElementCount > 0) box.append(row);
  on(scrim, "click", (e) => { if (e.target === scrim) close(true); });
  scrim.append(box);
  document.body.append(scrim);
  return { close: () => close(true) };
};

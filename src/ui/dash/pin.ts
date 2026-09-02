import type { App } from "../appstate";
import { el, mount, on } from "../dom";

/** The four-dot code pad. Same keypad as the session, so it never needs the
 *  iOS keyboard either. */
export const renderPin = (
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
  const press = (d: string): void => {
    if (code.length >= 4) return;
    code += d;
    paintDots();
    if (code.length === 4) window.setTimeout(() => done(code), 160);
  };
  for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    const b = el("button", { type: "button", class: "key digit", "data-key": d }, el("span", { text: d }));
    on(b, "click", () => press(d));
    grid.append(b);
  }
  const del = el("button", { type: "button", class: "key util clear" }, el("span", { text: "back" }));
  on(del, "click", () => { code = code.slice(0, -1); paintDots(); });
  const zero = el("button", { type: "button", class: "key digit", "data-key": "0" }, el("span", { text: "0" }));
  on(zero, "click", () => press("0"));
  grid.append(del, zero, el("span", {}));
  wrap.append(grid);
  if (retry) {
    const again = el("button", { type: "button", class: "btn small ghost" }, el("span", { text: "Try again" }));
    on(again, "click", () => renderPin(app, host, "Grown-ups only", done, true));
    wrap.append(again);
  }
  mount(host, wrap);
};

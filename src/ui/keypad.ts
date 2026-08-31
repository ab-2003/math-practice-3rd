/**
 * THE KEYPAD.
 *
 * Free numeric entry, never multiple choice: if he has to produce the number
 * he cannot guess his way through a session, and rapid guessing is exactly
 * what he did to the last test somebody gave him.
 *
 * Custom, never the iOS keyboard. The system keyboard would cover the problem,
 * resize the viewport under us, offer autocorrect and a decimal point, and put
 * a "done" bar where a thumb expects a digit. This is a fixed slab at the
 * bottom of the screen that never moves.
 *
 * It reports the FIRST KEY separately from the submit, because time to the
 * first digit is the retrieval measurement and everything after it is his
 * hands. See core/classify.ts.
 */

import { el, on } from "./dom";
import { sfx } from "./sfx";

export interface Keypad {
  root: HTMLElement;
  value: () => string;
  reset: () => void;
  setEnabled: (on: boolean) => void;
}

export interface KeypadOpts {
  onFirstKey: () => void;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  maxDigits?: number;
}

export const keypad = (opts: KeypadOpts): Keypad => {
  const max = opts.maxDigits ?? 3;
  let value = "";
  let touched = false;
  let enabled = true;

  const root = el("div", { class: "keypad", role: "group", "aria-label": "Number keypad" });

  const press = (d: string): void => {
    if (!enabled) return;
    if (!touched) { touched = true; opts.onFirstKey(); }
    if (value.length >= max) return;
    // A leading zero is never meaningful here and reads as a mis-tap.
    if (value === "" && d === "0") { value = "0"; }
    else if (value === "0") { value = d; }
    else { value += d; }
    sfx.tap();
    opts.onChange(value);
  };

  const keyBtn = (label: string, cls: string, fn: () => void): HTMLElement => {
    const b = el("button", { type: "button", class: `key ${cls}`, "data-key": label }, el("span", { text: label }));
    on(b, "click", () => { if (enabled) fn(); });
    return b;
  };

  for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    root.append(keyBtn(d, "digit", () => press(d)));
  }
  root.append(keyBtn("clear", "util clear", () => {
    if (!enabled) return;
    value = "";
    sfx.tap();
    opts.onChange(value);
  }));
  root.append(keyBtn("0", "digit", () => press("0")));
  root.append(keyBtn("enter", "util enter", () => {
    if (!enabled || value === "") return;
    opts.onSubmit(value);
  }));

  return {
    root,
    value: () => value,
    reset: () => { value = ""; touched = false; opts.onChange(""); },
    setEnabled: (v: boolean) => {
      enabled = v;
      root.classList.toggle("asleep", !v);
      for (const b of Array.from(root.querySelectorAll("button"))) {
        b.toggleAttribute("disabled", !v);
      }
    },
  };
};

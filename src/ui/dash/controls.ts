/**
 * THE SETTINGS CONTROLS, bound to a MODEL rather than to the app, so the
 * iPad's settings tab and the grown-ups' door draw the same table, the same
 * steppers and the same segmented control over different backends: the
 * live app on one side, the cloud's settings document on the other.
 */

import { KIND_LABEL, KINDS, OP_SYMBOL } from "../../core/report";
import type { SyncedSettings, SyncKey } from "../../core/sync";
import type { Deck, FactKind, States } from "../../core/types";
import { el, mount, on } from "../dom";
import { sheet } from "../sheet";

export interface SettingsModel {
  deck: Deck;
  states: States;
  get: <K extends SyncKey>(key: K) => SyncedSettings[K];
  /** Apply a change. The model saves and redraws; the controls never do. */
  set: <K extends SyncKey>(key: K, value: SyncedSettings[K]) => void;
  /** Whose settings these are, for the copy: "he" on the iPad, the rider's name on the door. */
  who: string;
}

export const setRow = (label: string, hint: string, control: HTMLElement): HTMLElement => {
  const row = el("div", { class: "setrow" });
  const text = el("div", { class: "grow" });
  text.append(el("b", { text: label }));
  if (hint) text.append(el("small", { text: hint }));
  row.append(text, control);
  return row;
};

export const stepper = (value: string, probe: string, onMinus: () => void, onPlus: () => void): HTMLElement => {
  const box = el("div", { class: "mini-stepper" });
  const minus = el("button", { type: "button", class: "btn small", "data-probe": `${probe}-minus` }, el("span", { text: "−" }));
  const val = el("span", { class: "stepper-value", "data-probe": probe, text: value });
  const plus = el("button", { type: "button", class: "btn small", "data-probe": `${probe}-plus` }, el("span", { text: "+" }));
  on(minus, "click", onMinus);
  on(plus, "click", onPlus);
  box.append(minus, val, plus);
  return box;
};

export const knob = (onNow: boolean, probe: string, label: string, fn: () => void, small = false): HTMLElement => {
  const b = el("button", {
    type: "button", class: `knob${small ? " small" : ""}${onNow ? " on" : ""}`, "data-probe": probe,
    "aria-pressed": String(onNow), "aria-label": label,
  }, el("i", {}));
  on(b, "click", fn);
  return b;
};

/** THE MAGNITUDE CAP (Andy): a ceiling so a very young child can work the
 *  early facts without frustration. + and x cap the answer; - and / cap the
 *  starting number. "no limit" is the default. */
const CAP: Record<FactKind, { label: string; chips: number[]; min: number; max: number; step: number }> = {
  add: { label: "Biggest answer", chips: [5, 10, 15, 20], min: 2, max: 20, step: 1 },
  sub: { label: "Biggest starting number", chips: [5, 10, 15, 20], min: 2, max: 20, step: 1 },
  mul: { label: "Biggest answer", chips: [20, 50, 100], min: 5, max: 100, step: 5 },
  div: { label: "Biggest starting number", chips: [20, 50, 100], min: 5, max: 100, step: 5 },
};

/** The cap sheet: chips for the common values, a fine stepper beside them. */
const capSheet = (model: SettingsModel, kind: FactKind): void => {
  const spec = CAP[kind];
  const body = el("div", {});
  body.append(el("p", { class: "note", text:
    `${spec.label} for ${KIND_LABEL[kind].toLowerCase()}. Facts beyond it wait, with their progress kept, until the cap is raised.` }));
  const chips = el("div", { class: "chips" });
  const fine = el("div", { class: "stepper", style: "justify-content:center" });
  const setCap = (next: number | null): void => { model.set("caps", { ...model.get("caps"), [kind]: next }); };
  const paint = (): void => {
    const cur = model.get("caps")[kind];
    mount(chips, ...[null, ...spec.chips].map((v) => {
      const c = el("button", {
        type: "button", class: `chip${cur === v ? " sel" : ""}`, "data-cap-chip": v === null ? "none" : String(v),
      }, el("span", { text: v === null ? "No limit" : String(v) }));
      on(c, "click", () => { setCap(v); paint(); });
      return c;
    }));
    const minus = el("button", { type: "button", class: "btn small", "data-probe": `cap-${kind}-minus` }, el("span", { text: "−" }));
    const val = el("span", { class: "stepper-value", "data-probe": `cap-${kind}-value`, text: cur === null ? "no limit" : String(cur) });
    const plus = el("button", { type: "button", class: "btn small", "data-probe": `cap-${kind}-plus` }, el("span", { text: "+" }));
    on(minus, "click", () => { setCap(cur === null ? spec.chips[1] ?? spec.max : Math.max(spec.min, cur - spec.step)); paint(); });
    on(plus, "click", () => { setCap(cur === null ? null : (cur + spec.step > spec.max ? null : cur + spec.step)); paint(); });
    mount(fine, minus, val, plus);
  };
  paint();
  body.append(chips, fine);
  sheet({ title: `${KIND_LABEL[kind]} cap`, body, confirm: "Done" });
};

/**
 * WHAT HE IS PRACTISING, AS A TABLE. Four operations, three controls each:
 * on/off, missing-number, and the magnitude cap. State is carried by the
 * knob's position and colour, never by a word.
 */
export const practiceTable = (model: SettingsModel): HTMLElement => {
  const table = el("div", { class: "ptable", role: "table" });
  const head = el("div", { class: "prow phead", role: "row" });
  for (const t of ["Operation", "On", "Missing #", "Cap"]) head.append(el("span", { text: t }));
  table.append(head);
  const strands = model.get("strands");
  const missing = model.get("missing");
  const caps = model.get("caps");

  for (const kind of KINDS) {
    const live = strands[kind];
    const facts = [...model.deck.values()].filter((f) => f.kind === kind);
    const mastered = facts.filter((f) => model.states.get(f.id)?.mastered === true).length;
    const row = el("div", { class: `prow${live ? "" : " off"}`, role: "row", "data-strand-row": kind });

    const label = el("div", { class: "plabel" });
    label.append(el("b", { text: `${OP_SYMBOL[kind]} ${KIND_LABEL[kind]}` }));
    label.append(el("small", { text: `${mastered} of ${facts.length} from memory` }));
    row.append(label);

    // NOT named `on`: that is the event helper, and shadowing it once made
    // the click binding uncallable.
    const strandKnob = el("button", {
      type: "button", class: `knob${live ? " on" : ""}`, "data-strand": kind,
      "aria-pressed": String(live), "aria-label": `${KIND_LABEL[kind]} ${live ? "on" : "off"}`,
    }, el("i", {}));
    on(strandKnob, "click", () => {
      const next = { ...strands, [kind]: !strands[kind] };
      if (!KINDS.some((k) => next[k])) {
        sheet({ title: "Keep at least one", body: `${model.who} needs something to practise, so at least one operation has to stay switched on.`, confirm: "OK" });
        return;
      }
      model.set("strands", next);
    });
    row.append(strandKnob);

    const mOn = missing[kind];
    const missKnob = el("button", {
      type: "button", class: `knob small${mOn ? " on" : ""}`, "data-missing": kind,
      "aria-pressed": String(mOn), "aria-label": `Missing number for ${KIND_LABEL[kind]} ${mOn ? "on" : "off"}`,
    }, el("i", {}));
    on(missKnob, "click", () => model.set("missing", { ...missing, [kind]: !missing[kind] }));
    row.append(missKnob);

    const cur = caps[kind];
    const capChip = el("button", {
      type: "button", class: `chip${cur === null ? " dim" : ""}`, "data-probe": `cap-${kind}`,
      "aria-label": `${CAP[kind].label} for ${KIND_LABEL[kind]}`,
    }, el("span", { text: cur === null ? "no limit" : String(cur) }));
    on(capChip, "click", () => capSheet(model, kind));
    row.append(capChip);

    table.append(row);
  }
  return table;
};

export const LEVELS: Array<{ n: 1 | 2 | 3; label: string; hint: string }> = [
  { n: 1, label: "Same hour", hint: "2:10 to 2:45. Never leaves the hour it started in." },
  { n: 2, label: "Next hour", hint: "2:50 to 3:10. Crosses the hour, still 60 minutes or less." },
  { n: 3, label: "Big spans", hint: "2:10 to 3:45. More than an hour, never more than two." },
];

/** The dials, as cards, for either backend. Returns the cards in order. */
export const settingsCards = (model: SettingsModel): HTMLElement[] => {
  const cards: HTMLElement[] = [];
  const who = model.who;

  const focus = el("div", { class: "card" });
  focus.append(el("h3", { class: "title", text: `What ${who} is practising` }));
  focus.append(el("p", { class: "note", text:
    "Switch an operation off and it leaves the sessions entirely; everything learned in it is kept. Missing number asks 7 + ▢ = 15 style items. The cap is a ceiling for the very young." }));
  focus.append(practiceTable(model));
  const missing = model.get("missing");
  const anyMissing = KINDS.some((k) => missing[k]);
  if (anyMissing) {
    focus.append(setRow("Missing-number mix", "share of items asked with a blank operand",
      stepper(`${missing.pct}%`, "missing-pct",
        () => model.set("missing", { ...missing, pct: Math.max(5, missing.pct - 5) }),
        () => model.set("missing", { ...missing, pct: Math.min(80, missing.pct + 5) }))));
  }
  // ADDITION AS DOTS (Andy, 2026-09-03): for a rider still counting, an
  // addition shows two groups of coloured dots either side of the plus.
  // Only addition; only the standard form.
  const dots = model.get("addDots");
  focus.append(setRow("Addition as dots", dots ? "green dots plus blue dots, counted" : "numbers, as usual",
    knob(dots, "add-dots", "Addition as dots", () => model.set("addDots", !dots))));
  const strands = model.get("strands");
  if (strands.div && !strands.mul) {
    focus.append(el("p", { class: "note warn", text:
      "Division is on but multiplication is off. A division fact only unlocks once its own multiplication family is solid, so nothing new will arrive until multiplication is switched back on." }));
  }
  cards.push(focus);

  const dayCard = el("div", { class: "card" });
  dayCard.append(el("h3", { class: "title", text: "The daily dose" }));
  dayCard.append(el("p", { class: "note", text:
    "How many answered problems make a day's work. The DONE badge, the jingle, the extra-practice label and the shop all key off it." }));
  const goal = model.get("dailyGoal");
  dayCard.append(setRow("Problems per day", "",
    stepper(String(goal), "dose-goal",
      () => model.set("dailyGoal", Math.max(10, goal - 5)),
      () => model.set("dailyGoal", Math.min(80, goal + 5)))));
  const limit = model.get("speedLimit");
  dayCard.append(setRow("Speed runs per day", "one is allowed before the day's work",
    stepper(String(limit), "speed-limit",
      () => model.set("speedLimit", Math.max(1, limit - 1)),
      () => model.set("speedLimit", Math.min(30, limit + 1)))));
  // THE DAY'S GAME TIME (Andy, 2026-09-03): an overall cap on minutes of
  // game a day, off by default, never under 15 when on. Warns at three
  // minutes and one, then closes the game until tomorrow after the current
  // line. The grown-ups' screen is neither counted nor closed.
  const dayLimit = model.get("dayLimitMinutes");
  dayCard.append(setRow("Daily time limit", dayLimit === 0
    ? "off: no cap on game time"
    : "every screen but this one counts; warns at 3 and 1 minutes, then closes until tomorrow",
    knob(dayLimit > 0, "day-limit", "Daily time limit", () => model.set("dayLimitMinutes", dayLimit > 0 ? 0 : 30))));
  if (dayLimit > 0) {
    dayCard.append(setRow("Minutes a day", "15 at the least",
      stepper(String(dayLimit), "day-limit-minutes",
        () => model.set("dayLimitMinutes", Math.max(15, dayLimit - 5)),
        () => model.set("dayLimitMinutes", Math.min(180, dayLimit + 5)))));
  }
  cards.push(dayCard);

  // THE SKATE PARK (0.19.0): a token a day for the day's work; the dials
  // say how long a token lasts and how many a day may be spent.
  const park = el("div", { class: "card", "data-probe": "park-card" });
  park.append(el("h3", { class: "title", text: "The Skate Park" }));
  park.append(el("p", { class: "note", text:
    "Finishing the day's dose drops one Daily Token. A token buys park time in a pure skateboarding game; the cap keeps a saved-up pocket of tokens from becoming an afternoon." }));
  const minutes = model.get("parkMinutes");
  park.append(setRow("Minutes per token", "how long one token keeps the park open",
    stepper(String(minutes), "park-minutes",
      () => model.set("parkMinutes", Math.max(2, minutes - 1)),
      () => model.set("parkMinutes", Math.min(20, minutes + 1)))));
  const perDay = model.get("parkTokensPerDay");
  park.append(setRow("Tokens per day", "the most that can be spent before midnight",
    stepper(String(perDay), "park-tokens",
      () => model.set("parkTokensPerDay", Math.max(1, perDay - 1)),
      () => model.set("parkTokensPerDay", Math.min(8, perDay + 1)))));
  cards.push(park);

  const bonus = el("div", { class: "card", "data-probe": "bonus-card" });
  bonus.append(el("h3", { class: "title", text: "Bonus round: elapsed time" }));
  bonus.append(el("p", { class: "note", text: "A reward, not drill. Problems mix everything up to the level you pick; every time sits on a five minute mark." }));
  // The round can be OFF altogether for a younger rider who is not reading
  // clocks yet (Andy, 2026-09-03). Default on, at level 1.
  const onNow = model.get("elapsedOn");
  bonus.append(setRow("Bonus round", onNow ? "offered after a run that went well" : "off: runs end without it",
    knob(onNow, "elapsed-on", "Bonus round", () => model.set("elapsedOn", !onNow))));
  if (!onNow) { cards.push(bonus); return cards; }
  const level = model.get("elapsedLevel");
  const seg = el("div", { class: "seg", role: "radiogroup", "aria-label": "Highest elapsed-time level" });
  for (const lvl of LEVELS) {
    const active = level === lvl.n;
    const b = el("button", {
      type: "button", class: active ? "on" : "", role: "radio", "aria-checked": String(active),
      "data-probe": `elapsed-level-${lvl.n}`,
    }, el("span", { text: `${lvl.n} · ${lvl.label}` }));
    on(b, "click", () => model.set("elapsedLevel", lvl.n));
    seg.append(b);
  }
  bonus.append(seg);
  const chosen = LEVELS.find((l) => l.n === level) ?? LEVELS[0]!;
  bonus.append(el("p", { class: "note", "data-probe": "elapsed-hint", text:
    `Up to level ${chosen.n}: ${chosen.hint}${chosen.n > 1 ? " Lower levels stay in the mix." : ""}` }));
  const analog = model.get("elapsedAnalog");
  bonus.append(setRow("Analog clock faces", analog ? "the times are read off drawn faces" : "times are written out (2:45)",
    knob(analog, "elapsed-analog", "Analog clock faces", () => model.set("elapsedAnalog", !analog))));
  cards.push(bonus);

  return cards;
};

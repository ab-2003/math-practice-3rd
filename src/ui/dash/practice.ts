/**
 * WHAT HE IS PRACTISING, AS A TABLE.
 *
 * Four operations, three controls each: on/off, missing-number, and the
 * magnitude cap. The one-scroll dashboard stacked those as twelve full-width
 * rows and the card alone stood taller than an iPad screen; as a table the
 * columns line up and the whole thing fits in a third of the space. State is
 * carried by the knob's position and colour, never by a word.
 */

import { reviveStrand } from "../../core/scheduler";
import { KIND_LABEL, KINDS, OP_SYMBOL } from "../../core/report";
import type { FactKind } from "../../core/types";
import type { App } from "../appstate";
import { el, mount, on } from "../dom";
import { sheet } from "../sheet";

/**
 * Flip one operation on or off.
 *
 * Turning the LAST one off would leave the app with nothing to ask, so it is
 * refused. Turning one back ON revives it: anything that went overdue while
 * the switch was off becomes due today rather than overdue by a term, so a
 * whole strand cannot avalanche into one session.
 */
const flipStrand = (app: App, kind: FactKind, done: () => void): void => {
  const next = { ...app.meta.strands, [kind]: !app.meta.strands[kind] };
  if (!Object.values(next).some(Boolean)) {
    sheet({ title: "Keep at least one", body: "He needs something to practise, so at least one operation has to stay switched on.", confirm: "OK" });
    return;
  }
  const turningOn = next[kind] && !app.meta.strands[kind];
  app.meta.strands = next;
  if (turningOn) app.states = reviveStrand(app.deck, app.states, kind, app.day);
  void app.save().then(done);
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

const setCap = (app: App, kind: FactKind, next: number | null): void => {
  const before = app.meta.caps[kind];
  app.meta.caps = { ...app.meta.caps, [kind]: next };
  // Raising or clearing a cap lets facts back in that may be overdue by
  // weeks; revive them to today so they cannot avalanche.
  if (next === null || (before !== null && next > before)) {
    app.states = reviveStrand(app.deck, app.states, kind, app.day);
  }
  void app.save();
};

/** The cap sheet: chips for the common values, a fine stepper beside them. */
const capSheet = (app: App, kind: FactKind, onDone: () => void): void => {
  const spec = CAP[kind];
  const body = el("div", {});
  body.append(el("p", { class: "note", text:
    `${spec.label} for ${KIND_LABEL[kind].toLowerCase()}. Facts beyond it wait, with their progress kept, until the cap is raised.` }));
  const chips = el("div", { class: "chips" });
  const fine = el("div", { class: "stepper", style: "justify-content:center" });
  const paint = (): void => {
    const cur = app.meta.caps[kind];
    mount(chips, ...[null, ...spec.chips].map((v) => {
      const c = el("button", {
        type: "button", class: `chip${cur === v ? " sel" : ""}`, "data-cap-chip": v === null ? "none" : String(v),
      }, el("span", { text: v === null ? "No limit" : String(v) }));
      on(c, "click", () => { setCap(app, kind, v); paint(); });
      return c;
    }));
    const minus = el("button", { type: "button", class: "btn small", "data-probe": `cap-${kind}-minus` }, el("span", { text: "−" }));
    const val = el("span", { class: "stepper-value", "data-probe": `cap-${kind}-value`, text: cur === null ? "no limit" : String(cur) });
    const plus = el("button", { type: "button", class: "btn small", "data-probe": `cap-${kind}-plus` }, el("span", { text: "+" }));
    on(minus, "click", () => { setCap(app, kind, cur === null ? spec.chips[1] ?? spec.max : Math.max(spec.min, cur - spec.step)); paint(); });
    on(plus, "click", () => { setCap(app, kind, cur === null ? null : (cur + spec.step > spec.max ? null : cur + spec.step)); paint(); });
    mount(fine, minus, val, plus);
  };
  paint();
  body.append(chips, fine);
  sheet({ title: `${KIND_LABEL[kind]} cap`, body, confirm: "Done", onConfirm: onDone });
};

export const practiceTable = (app: App, rerender: () => void): HTMLElement => {
  const table = el("div", { class: "ptable", role: "table" });
  const head = el("div", { class: "prow phead", role: "row" });
  for (const t of ["Operation", "On", "Missing #", "Cap"]) head.append(el("span", { text: t }));
  table.append(head);

  for (const kind of KINDS) {
    const live = app.meta.strands[kind];
    const facts = [...app.deck.values()].filter((f) => f.kind === kind);
    const mastered = facts.filter((f) => app.states.get(f.id)?.mastered === true).length;
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
    on(strandKnob, "click", () => flipStrand(app, kind, rerender));
    row.append(strandKnob);

    const mOn = app.meta.missing[kind];
    const missKnob = el("button", {
      type: "button", class: `knob small${mOn ? " on" : ""}`, "data-missing": kind,
      "aria-pressed": String(mOn), "aria-label": `Missing number for ${KIND_LABEL[kind]} ${mOn ? "on" : "off"}`,
    }, el("i", {}));
    on(missKnob, "click", () => {
      app.meta.missing = { ...app.meta.missing, [kind]: !app.meta.missing[kind] };
      void app.save().then(rerender);
    });
    row.append(missKnob);

    const cur = app.meta.caps[kind];
    const capChip = el("button", {
      type: "button", class: `chip${cur === null ? " dim" : ""}`, "data-probe": `cap-${kind}`,
      "aria-label": `${CAP[kind].label} for ${KIND_LABEL[kind]}`,
    }, el("span", { text: cur === null ? "no limit" : String(cur) }));
    on(capChip, "click", () => capSheet(app, kind, rerender));
    row.append(capChip);

    table.append(row);
  }
  return table;
};

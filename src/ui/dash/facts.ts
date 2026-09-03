/**
 * THE FACTS TAB (Andy, 2026-09-03): "the grid of facts mastered ... those
 * tables with each individual fact in progress or mastered." Every fact of
 * every operation, one cell each, always open: green from memory, amber by
 * box while it is being worked on, dark not met yet. The Progress tab keeps
 * its summary rows; this is the whole map.
 */

import { heatCells, KIND_LABEL, kindSummary, OP_SYMBOL, type Snapshot } from "../../core/report";
import { heatMap } from "../charts";
import { el } from "../dom";

export const factsTab = (snap: Snapshot): HTMLElement => {
  const wrap = el("div", { "data-probe": "facts-tab" });
  const cells = heatCells(snap.deck, snap.states, snap.responses);
  const legend = el("div", { class: "facts-legend" });
  for (const [cls, text] of [["mastered", "from memory"], ["working", "being worked on, warmer is a higher box"], ["unseen", "not met yet"]] as const) {
    legend.append(el("span", { class: "facts-key" }, el("i", { class: `facts-swatch ${cls}` }), el("span", { text })));
  }
  wrap.append(legend);
  for (const s of kindSummary(cells)) {
    const card = el("div", { class: "card facts-card", "data-probe": `facts-${s.kind}` });
    const head = el("div", { class: "facts-head" });
    head.append(el("h3", { class: "title", text: `${KIND_LABEL[s.kind]} ${OP_SYMBOL[s.kind]}` }));
    head.append(el("span", { class: "mon-sub", "data-probe": `facts-count-${s.kind}`, text: `${s.mastered} from memory · ${s.working} working · ${s.unseen} not met` }));
    card.append(head);
    if (!snap.strands[s.kind]) card.append(el("p", { class: "note", text: "This operation is switched off right now; what it has learned is kept." }));
    card.append(heatMap(cells.filter((c) => c.kind === s.kind)));
    wrap.append(card);
  }
  return wrap;
};

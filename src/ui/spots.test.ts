import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEASONAL_SPOTS, SPOTS } from "../core/tricks";

/**
 * THE RAIL LAW (Andy, 2026-09-03): every spot is a rail line on flat ground,
 * because the rider crosses left to right and never drops into anything. A
 * static read of the art module, since the drawing needs a DOM.
 */
describe("the spots", () => {
  const src = readFileSync(new URL("./spots.ts", import.meta.url), "utf8");
  const blocks = new Map<string, string>();
  for (const m of src.matchAll(/\n  (\w+): \(p\) => \{([\s\S]*?)\n  \},/g)) blocks.set(m[1]!, m[2]!);

  it("draws every spot in the ladder and every seasonal one", () => {
    for (const s of [...SPOTS, ...SEASONAL_SPOTS]) expect(blocks.has(s.id), s.id).toBe(true);
  });

  it("gives every spot a rail to grind, and none is a pipe, a bowl or a ramp", () => {
    for (const [id, body] of blocks) expect(body.includes("p.rail("), `${id} has no rail`).toBe(true);
    for (const gone of ["halfpipe", "bowl", "megaramp"]) expect(blocks.has(gone)).toBe(false);
    expect(SPOTS.map((s) => s.id)).toEqual(["street", "stairs", "rooftop", "plaza", "kink"]);
  });
});

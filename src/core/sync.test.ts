import { describe, expect, it } from "vitest";
import {
  describeField, fieldsToApply, isSettingsDoc, mergeDocs, mergeFields, newer, pendingFields, sameValue,
  validValue, type Fields, type SyncedSettings,
} from "./sync";

const base: SyncedSettings = {
  strands: { add: true, sub: true, mul: false, div: false },
  caps: { add: null, sub: null, mul: null, div: null },
  missing: { add: false, sub: false, mul: false, div: false, pct: 20 },
  dailyGoal: 40, speedLimit: 10, elapsedLevel: 1, elapsedAnalog: false, parkMinutes: 7, parkTokensPerDay: 3,
};

describe("later writer wins, per field", () => {
  it("takes the later stamp, and breaks a tie by device id the same way from both sides", () => {
    expect(newer({ at: 2, by: "a" }, { at: 1, by: "z" })).toBe(true);
    expect(newer({ at: 1, by: "b" }, { at: 1, by: "a" })).toBe(true);
    expect(newer({ at: 1, by: "a" }, { at: 1, by: "b" })).toBe(false);
  });

  it("merges field by field: a phone flipping multiplication never clobbers the iPad raising a cap", () => {
    const phone: Fields = { strands: { v: { ...base.strands, mul: true }, at: 200, by: "phone" } };
    const ipad: Fields = { caps: { v: { ...base.caps, add: 10 }, at: 100, by: "ipad" }, strands: { v: base.strands, at: 50, by: "ipad" } };
    const m = mergeFields(ipad, phone);
    expect((m.strands!.v as typeof base.strands).mul).toBe(true);
    expect((m.caps!.v as typeof base.caps).add).toBe(10);
  });

  it("is commutative and idempotent, which is what an eventually consistent store needs", () => {
    const a: Fields = { dailyGoal: { v: 30, at: 5, by: "a" }, speedLimit: { v: 3, at: 9, by: "a" } };
    const b: Fields = { dailyGoal: { v: 50, at: 7, by: "b" }, elapsedLevel: { v: 2, at: 1, by: "b" } };
    expect(mergeFields(a, b)).toEqual(mergeFields(b, a));
    expect(mergeFields(mergeFields(a, b), b)).toEqual(mergeFields(a, b));
    expect(mergeDocs(null, { app: "trickline", version: 1, fields: a }).fields).toEqual(a);
  });
});

describe("what a device applies", () => {
  it("applies only fields newer than its own stamps that actually differ", () => {
    const remote: Fields = {
      strands: { v: { ...base.strands, mul: true }, at: 500, by: "phone" },
      dailyGoal: { v: 40, at: 900, by: "phone" }, // newer but identical: nothing to do
      speedLimit: { v: 5, at: 10, by: "phone" }, // older than the local stamp: ignored
    };
    const apply = fieldsToApply(base, { speedLimit: { at: 50, by: "ipad" } }, remote);
    expect(Object.keys(apply)).toEqual(["strands"]);
  });

  it("refuses a value of the wrong shape rather than coercing it", () => {
    const remote: Fields = { dailyGoal: { v: 999, at: 500, by: "phone" }, elapsedLevel: { v: 7, at: 500, by: "phone" } };
    expect(Object.keys(fieldsToApply(base, {}, remote))).toEqual([]);
    expect(validValue("strands", { add: false, sub: false, mul: false, div: false })).toBe(false); // the last one cannot go off
    expect(validValue("caps", { add: 10, sub: null, mul: 50, div: null })).toBe(true);
    expect(validValue("missing", { ...base.missing, pct: 200 })).toBe(false);
  });

  it("checks a document that arrived over the wire", () => {
    expect(isSettingsDoc({ app: "trickline", version: 1, fields: { dailyGoal: { v: 30, at: 1, by: "x" } } })).toBe(true);
    expect(isSettingsDoc({ app: "trickline", version: 1, fields: { pin: { v: "1234", at: 1, by: "x" } } })).toBe(false);
    expect(isSettingsDoc({ app: "trickline", version: 1, fields: { dailyGoal: { v: 30, by: "x" } } })).toBe(false);
    expect(isSettingsDoc({ app: "other", version: 1, fields: {} })).toBe(false);
  });
});

describe("pending on the iPad", () => {
  it("lists the fields the door has set that the device is not yet running", () => {
    const doc: Fields = {
      strands: { v: { ...base.strands, mul: true }, at: 5, by: "phone" },
      dailyGoal: { v: 40, at: 5, by: "phone" },
    };
    expect(pendingFields(doc, base)).toEqual(["strands"]);
    expect(pendingFields(doc, { ...base, strands: { ...base.strands, mul: true } })).toEqual([]);
    expect(sameValue({ a: 1 }, { a: 1 })).toBe(true);
  });

  it("puts a field's value into words a parent would use", () => {
    expect(describeField("strands", { add: true, sub: false, mul: true, div: false })).toBe("practising addition, multiplication");
    expect(describeField("caps", { add: 10, sub: null, mul: null, div: null })).toBe("caps: addition up to 10");
    expect(describeField("dailyGoal", 30)).toBe("30 problems a day");
    expect(describeField("elapsedAnalog", true)).toBe("analog clock faces on");
  });
});

describe("merge, under fire", () => {
  // Deterministic pseudo-random field sets: commutative, idempotent, and
  // order-independent however the writes arrive.
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const randomFields = (): Fields => {
    const out: Fields = {};
    const values: Record<string, unknown[]> = {
      dailyGoal: [10, 30, 50, 80], speedLimit: [1, 5, 10, 30], elapsedLevel: [1, 2, 3], elapsedAnalog: [true, false],
      parkMinutes: [2, 7, 20], parkTokensPerDay: [1, 3, 8],
    };
    for (const k of ["dailyGoal", "speedLimit", "elapsedLevel", "elapsedAnalog", "parkMinutes", "parkTokensPerDay"] as const) {
      if (rnd() < 0.6) out[k] = { v: values[k]![Math.floor(rnd() * values[k]!.length)], at: Math.floor(rnd() * 10), by: rnd() < 0.5 ? "a" : "b" };
    }
    return out;
  };
  it("is commutative, associative and idempotent over a thousand random writes", () => {
    for (let i = 0; i < 1000; i++) {
      const a = randomFields(); const b = randomFields(); const c = randomFields();
      expect(mergeFields(a, b)).toEqual(mergeFields(b, a));
      expect(mergeFields(mergeFields(a, b), c)).toEqual(mergeFields(a, mergeFields(b, c)));
      expect(mergeFields(mergeFields(a, b), b)).toEqual(mergeFields(a, b));
    }
  });
});

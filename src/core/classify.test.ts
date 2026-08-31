import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { DERIVED_MAX_MS, RETRIEVED_MAX_MS } from "./config";

describe("response classification", () => {
  it("classifies a fast correct answer as retrieved", () => {
    expect(classify(true, 400)).toBe("retrieved");
    expect(classify(true, RETRIEVED_MAX_MS - 1)).toBe("retrieved");
  });

  it("classifies a worked-out correct answer as derived", () => {
    expect(classify(true, RETRIEVED_MAX_MS)).toBe("derived");
    expect(classify(true, 5_000)).toBe("derived");
    expect(classify(true, DERIVED_MAX_MS - 1)).toBe("derived");
  });

  it("classifies a slow correct answer as effortful", () => {
    expect(classify(true, DERIVED_MAX_MS)).toBe("effortful");
    expect(classify(true, 30_000)).toBe("effortful");
  });

  it("classifies every wrong answer as effortful however fast it arrived", () => {
    expect(classify(false, 120)).toBe("effortful");
    expect(classify(false, 20_000)).toBe("effortful");
  });

  it("refuses to guess when no digit was ever pressed", () => {
    // A failed measurement must never read as a verdict.
    expect(classify(true, null)).toBe("effortful");
  });
});

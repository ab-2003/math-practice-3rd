import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRASH_TALK } from "./duel";
import { VOICES, voiceFor, voiceUrl } from "./voices";
import { ROSTER } from "./creatures";

const ROOT = new URL("../..", import.meta.url).pathname;

describe("the rivals' voices", () => {
  it("has every line of every listed voice on disk, as a real clip", () => {
    // The static law: a listed voice with a missing clip would be a rival
    // who opens its mouth and says nothing.
    for (const v of VOICES) {
      for (let i = 0; i < TRASH_TALK.length; i++) {
        const file = join(ROOT, "public", "voice", v.slug, `${i}.mp3`);
        expect(existsSync(file), `${v.slug}/${i}.mp3 is missing`).toBe(true);
        expect(statSync(file).size, `${v.slug}/${i}.mp3 is too small to be a clip`).toBeGreaterThan(1000);
      }
      expect(v.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("gives every monster one voice for good, and spreads the roster across the voices", () => {
    if (VOICES.length === 0) { expect(voiceFor("grindjaw")).toBeNull(); return; }
    const used = new Set<string>();
    for (const c of ROSTER) {
      const v = voiceFor(c.id);
      expect(v).not.toBeNull();
      expect(voiceFor(c.id)).toBe(v);
      used.add(v!.slug);
    }
    expect(used.size).toBe(Math.min(VOICES.length, ROSTER.length));
  });

  it("finds a line's clip by its place in the list, and nothing for a line it does not know", () => {
    const v = { slug: "test", name: "Test", accent: "british" };
    expect(voiceUrl(v, TRASH_TALK[0]!)).toBe("/voice/test/0.mp3");
    expect(voiceUrl(v, TRASH_TALK[29]!)).toBe("/voice/test/29.mp3");
    expect(voiceUrl(v, "not a line")).toBeNull();
  });
});

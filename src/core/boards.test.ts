import { describe, expect, it } from "vitest";
import { boardById, boardFor, BOARDS, ownedBoards, PLAIN_BOARD } from "./boards";

describe("the board rack", () => {
  it("holds twenty-one boards: plain and twenty to buy, with unique ids, names and themes", () => {
    expect(BOARDS.length).toBe(21);
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(21);
    expect(new Set(BOARDS.map((b) => b.name)).size).toBe(21);
    expect(new Set(BOARDS.map((b) => b.theme)).size).toBe(21);
  });

  it("keeps the plain board first and free, and prices the rest as a real save", () => {
    expect(BOARDS[0]!.id).toBe(PLAIN_BOARD);
    expect(BOARDS[0]!.cost).toBe(0);
    expect(BOARDS.slice(1).map((b) => b.cost)).toEqual([100, 250, 280, 300, 320, 330, 350, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500, 1700, 1800, 1900]);
    // The sports decks are a short save (Andy): every one under 400.
    for (const b of BOARDS.filter((x) => ["soccer", "hockey", "hoops", "baseball", "football", "moto"].includes(x.theme))) expect(b.cost, b.id).toBeLessThan(400);
    expect(BOARDS.slice(-3).map((b) => b.theme)).toEqual(["hazard", "ninja", "knight"]);
    expect(boardById("void")!.cost).toBe(500);
  });

  it("always offers the plain board, plus whatever is bought", () => {
    expect(ownedBoards([]).map((b) => b.id)).toEqual(["plain"]);
    expect(ownedBoards(["void", "ember"]).map((b) => b.id)).toEqual(["plain", "ember", "void"]);
  });

  it("rides the monster's own pick, and falls back to plain for a board it does not own", () => {
    expect(boardFor({ grindjaw: "void" }, "grindjaw", ["void"]).id).toBe("void");
    expect(boardFor({ grindjaw: "void" }, "grindjaw", []).id).toBe("plain");
    expect(boardFor({}, "grindjaw", ["void"]).id).toBe("plain");
    expect(boardFor({ grindjaw: "nope" }, "grindjaw", ["nope"]).id).toBe("plain");
  });

  it("carries no em-dashes into the shop copy", () => {
    for (const b of BOARDS) expect(b.lore).not.toContain("—");
  });
});

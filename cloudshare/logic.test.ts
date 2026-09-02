import { describe, expect, it } from "vitest";
import { FUTURE_GRACE_MS, handle, MemKV } from "./logic";

const CODE = "ABCDEFGHJKMNPQRSTVWX";
const put = (kv: MemKV, path: string, body: unknown, now?: number) =>
  handle({ method: "PUT", path, body: JSON.stringify(body) }, kv, now);
const get = (kv: MemKV, path: string) => handle({ method: "GET", path, body: "" }, kv);
const doc = (fields: Record<string, unknown>) => ({ app: "trickline", version: 1, fields });

describe("the worker's record route", () => {
  it("stores Trick Line data and refuses anything else", async () => {
    const kv = new MemKV();
    expect((await put(kv, `/v1/share/${CODE}`, { app: "other", version: 1, meta: {} })).status).toBe(400);
    expect((await put(kv, `/v1/share/${CODE}`, { app: "trickline", version: 1, meta: { coins: 1 } })).status).toBe(200);
    const got = await get(kv, `/v1/share/${CODE}`);
    expect(got.status).toBe(200);
    expect(JSON.parse(got.body!).meta.coins).toBe(1);
  });

  it("answers 404 for a code nothing lives under, and 400 for a code that is not a code", async () => {
    const kv = new MemKV();
    expect((await get(kv, `/v1/share/${CODE}`)).status).toBe(404);
    expect((await get(kv, "/v1/share/notacode")).status).toBe(400);
    expect((await get(kv, "/v1/nowhere")).status).toBe(404);
  });

  it("normalises the code's case", async () => {
    const kv = new MemKV();
    await put(kv, `/v1/share/${CODE}`, { app: "trickline", version: 1, meta: {} });
    expect((await get(kv, `/v1/share/${CODE.toLowerCase()}`)).status).toBe(200);
  });
});

describe("the worker's settings route", () => {
  it("merges on write, later stamp winning per field", async () => {
    const kv = new MemKV();
    await put(kv, `/v1/share/${CODE}/settings`, doc({ dailyGoal: { v: 30, at: 100, by: "phone" } }));
    const r = await put(kv, `/v1/share/${CODE}/settings`, doc({ dailyGoal: { v: 80, at: 50, by: "ipad" }, speedLimit: { v: 3, at: 60, by: "ipad" } }));
    const merged = JSON.parse(r.body!);
    expect(merged.fields.dailyGoal.v).toBe(30);
    expect(merged.fields.speedLimit.v).toBe(3);
  });

  it("clamps a stamp from a clock that runs in the future", async () => {
    const kv = new MemKV();
    const now = 1_000_000_000_000;
    const r = await put(kv, `/v1/share/${CODE}/settings`, doc({ dailyGoal: { v: 30, at: now + 365 * 86_400_000, by: "wrong-clock" } }), now);
    expect(JSON.parse(r.body!).fields.dailyGoal.at).toBe(now + FUTURE_GRACE_MS);
    // A device a minute fast is left alone.
    const r2 = await put(kv, `/v1/share/${CODE}/settings`, doc({ speedLimit: { v: 4, at: now + 60_000, by: "fast" } }), now);
    expect(JSON.parse(r2.body!).fields.speedLimit.at).toBe(now + 60_000);
  });

  it("refuses foreign fields, bad shapes and oversize documents", async () => {
    const kv = new MemKV();
    expect((await put(kv, `/v1/share/${CODE}/settings`, doc({ pin: { v: "1234", at: 1, by: "x" } }))).status).toBe(400);
    expect((await put(kv, `/v1/share/${CODE}/settings`, doc({ dailyGoal: { v: 999, at: 1, by: "x" } }))).status).toBe(400);
    expect((await handle({ method: "PUT", path: `/v1/share/${CODE}/settings`, body: "not json" }, kv)).status).toBe(400);
    const big = doc({ dailyGoal: { v: 30, at: 1, by: "x".repeat(30_000) } });
    expect((await put(kv, `/v1/share/${CODE}/settings`, big)).status).toBe(413);
  });

  it("deleting the code takes the settings with it", async () => {
    const kv = new MemKV();
    await put(kv, `/v1/share/${CODE}`, { app: "trickline", version: 1, meta: {} });
    await put(kv, `/v1/share/${CODE}/settings`, doc({ dailyGoal: { v: 30, at: 1, by: "x" } }));
    expect((await handle({ method: "DELETE", path: `/v1/share/${CODE}`, body: "" }, kv)).status).toBe(204);
    expect((await get(kv, `/v1/share/${CODE}`)).status).toBe(404);
    expect((await get(kv, `/v1/share/${CODE}/settings`)).status).toBe(404);
  });
});

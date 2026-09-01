/**
 * PERSISTENCE. IndexedDB, because the response log carries two timestamps per
 * item and will run to thousands of rows across a school year, and because
 * localStorage is synchronous enough to jank the keypad.
 *
 * THE SCHEMA CARRIES A VERSION AND AN UNKNOWN VERSION IS REJECTED, NOT
 * COERCED. A half-migrated progress file is worse than a missing one.
 *
 * iOS evicts IndexedDB from home-screen apps under storage pressure and after
 * long periods of non-use. That is not a hypothetical, and it is the reason
 * the JSON backup is offered on a schedule rather than buried in a menu.
 */

import { DEFAULT_STRANDS } from "../core/config";
import { DEFAULT_MISSING, type MissingCfg } from "../core/present";
import type { FactState, Response, Strands } from "../core/types";

export const SCHEMA_VERSION = 1;
const DB_NAME = "trickline";
const STORES = ["meta", "facts", "responses", "sessions"] as const;

export interface SessionRecord {
  id: string;
  day: number;
  startedAt: number;
  endedAt: number;
  items: number;
  correct: number;
  retrieved: number;
  derived: number;
  status: "complete" | "endedEarly" | "abandoned";
  coins: number;
}

export interface Meta {
  version: number;
  pin: string | null;
  muted: boolean;
  /** Trick animations on a correct answer. A kid control, like mute. */
  animations: boolean;
  /** Which monster rides. His pick from the collection; null = newest owned. */
  rider: string | null;
  /** The daily dose: how many real items make a day's work (parent-set),
   *  and how many he has answered today. The badge, the jingle and the shop
   *  all key off it. */
  dailyGoal: number;
  doseDay: number | null;
  doseCount: number;
  /** SPEED RUN: per-setup best scores, today's attempt count, and the
   *  parent-set daily budget. Speed runs never touch the scheduler or the
   *  practice telemetry; they are a game with a scoreboard. */
  speedBest: Record<string, number>;
  speedDay: number | null;
  speedCount: number;
  speedLimit: number;
  /** The one pre-run shop peek per day: which day, and when it started. */
  shopPeekDay: number | null;
  shopPeekAt: number | null;
  /** Helmets bought. Bought once, wearable by any monster. */
  helmetsOwned: string[];
  /** Which helmet each monster wears: creatureId -> helmetId. */
  gear: Record<string, string>;
  /** Lifetime lines landed. Unlocks tricks and spots. */
  linesLanded: number;
  /** Personal bests. They only ever go up, which is what keeps them safe. */
  bestTricksRun: number;
  bestLinesRun: number;
  coins: number;
  owned: string[];
  levels: Record<string, number>;
  names: Record<string, string>;
  lastSessionDay: number | null;
  streak: number;
  backupNudgedOn: number | null;
  /** Which operations are switched on. A grown-up setting, behind the PIN. */
  strands: Strands;
  /** Missing-number presentation: per-operation switches and the mix percent.
   *  All four OFF by default, per Andy 2026-09-01. */
  missing: MissingCfg;
  /** Highest elapsed-time level allowed: 1 same-hour, 2 crosses the hour
   *  within 60 minutes, 3 up to two hours. Problems mix everything at or
   *  below it. Default 1: the bonus round must never bite. */
  elapsedLevel: 1 | 2 | 3;
  /** Show the bonus times as analog clock faces instead of digits. Opt-in:
   *  it doubles as analog-reading practice on five minute marks. */
  elapsedAnalog: boolean;
}

export const freshMeta = (): Meta => ({
  version: SCHEMA_VERSION, pin: null, muted: false, animations: true,
  rider: null, dailyGoal: 40, doseDay: null, doseCount: 0,
  speedBest: {}, speedDay: null, speedCount: 0, speedLimit: 10,
  shopPeekDay: null, shopPeekAt: null, helmetsOwned: [], gear: {}, linesLanded: 0, bestTricksRun: 0, bestLinesRun: 0, coins: 0, owned: [],
  levels: {}, names: {}, lastSessionDay: null, streak: 0, backupNudgedOn: null,
  strands: { ...DEFAULT_STRANDS },
  missing: { ...DEFAULT_MISSING },
  elapsedLevel: 1,
  elapsedAnalog: false,
});

let db: IDBDatabase | null = null;

export const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });

const tx = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await open();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    // A failed read must never return a value that reads as a verdict.
    req.onerror = () => reject(req.error ?? new Error(`${store} request failed`));
  });
};

export const getMeta = async (): Promise<Meta> => {
  const raw = await tx<Meta | undefined>("meta", "readonly", (s) => s.get("meta"));
  if (!raw) return freshMeta();
  if (raw.version !== SCHEMA_VERSION) {
    throw new Error(`saved data is version ${raw.version}, this app speaks ${SCHEMA_VERSION}`);
  }
  // A meta saved before a field existed picks up the default rather than
  // arriving undefined, which is why this spread is not a formality.
  return {
    ...freshMeta(), ...raw,
    strands: { ...DEFAULT_STRANDS, ...(raw.strands ?? {}) },
    missing: { ...DEFAULT_MISSING, ...(raw.missing ?? {}) },
    // A save from the brief elapsedHard era maps onto the ladder it became.
    dailyGoal: Math.max(10, Math.min(80, raw.dailyGoal ?? 40)),
    speedLimit: Math.max(1, Math.min(30, raw.speedLimit ?? 10)),
    speedBest: raw.speedBest ?? {},
    elapsedLevel: raw.elapsedLevel ?? ((raw as { elapsedHard?: boolean }).elapsedHard === true ? 3 : 1),
    elapsedAnalog: raw.elapsedAnalog ?? false,
  };
};

export const putMeta = async (m: Meta): Promise<void> => {
  await tx("meta", "readwrite", (s) => s.put({ ...m, version: SCHEMA_VERSION }, "meta"));
};

export const getFacts = async (): Promise<Map<string, FactState>> => {
  const raw = await tx<Record<string, FactState> | undefined>("facts", "readonly", (s) => s.get("all"));
  return new Map(Object.entries(raw ?? {}));
};

export const putFacts = async (states: ReadonlyMap<string, FactState>): Promise<void> => {
  await tx("facts", "readwrite", (s) => s.put(Object.fromEntries(states), "all"));
};

export const appendResponses = async (rs: readonly Response[]): Promise<void> => {
  if (rs.length === 0) return;
  const prior = await getResponses();
  await tx("responses", "readwrite", (s) => s.put([...prior, ...rs], "all"));
};

export const getResponses = async (): Promise<Response[]> =>
  (await tx<Response[] | undefined>("responses", "readonly", (s) => s.get("all"))) ?? [];

export const appendSession = async (r: SessionRecord): Promise<void> => {
  const prior = await getSessions();
  await tx("sessions", "readwrite", (s) => s.put([...prior, r], "all"));
};

export const getSessions = async (): Promise<SessionRecord[]> =>
  (await tx<SessionRecord[] | undefined>("sessions", "readonly", (s) => s.get("all"))) ?? [];

// ---------------------------------------------------------------------------
// Export and import, so progress survives a device change or an eviction.
// ---------------------------------------------------------------------------

export interface Backup {
  app: "trickline";
  version: number;
  exportedAt: string;
  meta: Meta;
  facts: Record<string, FactState>;
  responses: Response[];
  sessions: SessionRecord[];
}

export const exportAll = async (): Promise<Backup> => ({
  app: "trickline",
  version: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  meta: await getMeta(),
  facts: Object.fromEntries(await getFacts()),
  responses: await getResponses(),
  sessions: await getSessions(),
});

export const importAll = async (b: unknown): Promise<void> => {
  if (typeof b !== "object" || b === null) throw new Error("that file is not a backup");
  const back = b as Partial<Backup>;
  if (back.app !== "trickline") throw new Error("that backup is from a different app");
  if (back.version !== SCHEMA_VERSION) {
    throw new Error(`that backup is version ${String(back.version)}, this app speaks ${SCHEMA_VERSION}`);
  }
  if (!back.meta || !back.facts) throw new Error("that backup is missing its progress");
  await putMeta(back.meta);
  await putFacts(new Map(Object.entries(back.facts)));
  await tx("responses", "readwrite", (s) => s.put(back.responses ?? [], "all"));
  await tx("sessions", "readwrite", (s) => s.put(back.sessions ?? [], "all"));
};

/** Wipe everything. Only ever reached behind a typed confirmation. */
export const eraseAll = async (): Promise<void> => {
  const d = await open();
  await Promise.all(STORES.map((store) => new Promise<void>((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    const req = t.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("clear failed"));
  })));
};

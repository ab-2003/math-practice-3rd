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
 *
 * PROFILES (alpha, 2026-09-01). One iPad, more than one child: each profile
 * is its own database, so nothing about one rider can leak into another's
 * evidence. The first profile keeps the original database name, so an
 * install that predates profiles carries on without a migration. The
 * registry of profiles, and the grown-ups' PIN, are DEVICE-level and live in
 * localStorage: a PIN belongs to the parent, not to a child's progress file.
 */

import { DEFAULT_STRANDS } from "../core/config";
import { PARK_DEFAULTS } from "../core/park";
import { DEFAULT_MISSING, type MissingCfg } from "../core/present";
import type { Stamp, SyncKey } from "../core/sync";
import type { Caps, FactState, Response, SessionRecord, Strands } from "../core/types";
export type { SessionRecord } from "../core/types";

export const SCHEMA_VERSION = 1;
const LEGACY_DB = "trickline";
const STORES = ["meta", "facts", "responses", "sessions"] as const;

// ---------------------------------------------------------------------------
// The registry: who the riders are, which one is up, and the grown-ups' code.
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

export interface Registry {
  version: 1;
  active: string;
  /** The grown-ups' 4 digit code. Device-level; seeded from a pre-profile
   *  meta.pin on first boot so nobody has to set it twice. */
  pin: string | null;
  profiles: Profile[];
}

export const MAIN_PROFILE = "main";
const REG_KEY = "tl-profiles";

const freshRegistry = (): Registry => ({
  version: 1, active: MAIN_PROFILE, pin: null,
  profiles: [{ id: MAIN_PROFILE, name: "RIDER", createdAt: 0 }],
});

export const loadRegistry = (): Registry => {
  try {
    const raw = localStorage.getItem(REG_KEY);
    if (raw) {
      const r = JSON.parse(raw) as Registry;
      if (r.version === 1 && Array.isArray(r.profiles) && r.profiles.length > 0) {
        if (!r.profiles.some((p) => p.id === r.active)) r.active = r.profiles[0]!.id;
        return r;
      }
    }
  } catch { /* private mode, or a garbled entry: start clean */ }
  return freshRegistry();
};

export const saveRegistry = (r: Registry): void => {
  try { localStorage.setItem(REG_KEY, JSON.stringify(r)); } catch { /* private mode */ }
};

export const dbNameFor = (id: string): string => (id === MAIN_PROFILE ? LEGACY_DB : `${LEGACY_DB}-${id}`);

export const newProfileId = (): string =>
  `p${Date.now().toString(36)}${Math.floor(Math.random() * 46_656).toString(36)}`;

let profileId = MAIN_PROFILE;
let dbName = LEGACY_DB;
let db: IDBDatabase | null = null;

/** Point every store call at this profile's database. */
export const useProfile = (id: string): void => {
  const name = dbNameFor(id);
  profileId = id;
  if (name === dbName) return;
  db?.close();
  db = null;
  dbName = name;
};

export const currentProfileId = (): string => profileId;

const openNamed = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });

export const open = async (): Promise<IDBDatabase> => {
  if (db) return db;
  db = await openNamed(dbName);
  return db;
};

/** Wipe a profile's database entirely. Only ever reached behind a typed
 *  confirmation in the grown-ups screen. */
export const deleteProfileData = (id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (dbNameFor(id) === dbName) { db?.close(); db = null; }
    const req = indexedDB.deleteDatabase(dbNameFor(id));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("delete failed"));
    req.onblocked = () => resolve();
  });

/** Read another profile's meta without switching to it: the picker shows
 *  each rider's monster and coins. Missing or unreadable reads as fresh. */
export const peekMeta = async (id: string): Promise<Meta> => {
  try {
    const d = await openNamed(dbNameFor(id));
    const raw = await new Promise<Meta | undefined>((resolve, reject) => {
      const t = d.transaction("meta", "readonly");
      const req = t.objectStore("meta").get("meta");
      req.onsuccess = () => resolve(req.result as Meta | undefined);
      req.onerror = () => reject(req.error);
    });
    d.close();
    return raw && raw.version === SCHEMA_VERSION ? { ...freshMeta(), ...raw } : freshMeta();
  } catch { return freshMeta(); }
};

// ---------------------------------------------------------------------------
// Meta: everything about one rider that is not a fact state or a response.
// ---------------------------------------------------------------------------

export interface Meta {
  version: number;
  /** Legacy: the PIN before profiles existed. Seeds the registry once. */
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
  /** The one pre-run shop peek per day: which day, when it started, and
   *  whether he has already walked out of it (one VISIT, not one minute). */
  shopPeekDay: number | null;
  shopPeekAt: number | null;
  shopPeekSpent: boolean;
  /** Helmets bought. Bought once, wearable by any monster. */
  helmetsOwned: string[];
  /** Which helmet each monster wears: creatureId -> helmetId. */
  gear: Record<string, string>;
  /** Boards bought. PLAIN is always owned and never listed here. */
  boardsOwned: string[];
  /** Which board each monster rides: creatureId -> boardId. Plain by default. */
  boardOf: Record<string, string>;
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
  /** Magnitude caps per operation, null = no limit (the default). */
  caps: Caps;
  /** Missing-number presentation: per-operation switches and the mix percent.
   *  All four OFF by default, per Andy 2026-09-01. */
  missing: MissingCfg;
  /** The bonus round at all. Default on; a grown-up can switch it off for a
   *  younger rider who is not reading clocks yet (Andy, 2026-09-03). */
  elapsedOn: boolean;
  /** Highest elapsed-time level allowed: 1 same-hour, 2 crosses the hour
   *  within 60 minutes, 3 up to two hours. Problems mix everything at or
   *  below it. Default 1: the bonus round must never bite. */
  elapsedLevel: 1 | 2 | 3;
  /** Show the bonus times as analog clock faces instead of digits. Opt-in:
   *  it doubles as analog-reading practice on five minute marks. */
  elapsedAnalog: boolean;
  /** THE SKATE PARK (0.19.0). Daily Tokens in the pocket, the day the last
   *  one dropped, today's spend, the parent dials, and whether the park
   *  has ever lit (the first token) and its tutorial been seen. Bests are
   *  the park's own scoreboard; it earns no coins. */
  tokens: number;
  tokenDay: number | null;
  parkDay: number | null;
  parkSpent: number;
  parkMinutes: number;
  parkTokensPerDay: number;
  parkUnlocked: boolean;
  parkSeen: boolean;
  parkBest: number;
  parkBestChain: number;
  /** The day of the last weekly cold check. See core/config COLD_CHECK. */
  lastColdDay: number | null;
  /** When and by which device each synced setting was last set, so the
   *  cloud's copy and this one can be merged field by field (core/sync). */
  settingsStamps: Partial<Record<SyncKey, Stamp>>;
}

export const freshMeta = (): Meta => ({
  version: SCHEMA_VERSION, pin: null, muted: false, animations: true,
  rider: null, dailyGoal: 40, doseDay: null, doseCount: 0,
  speedBest: {}, speedDay: null, speedCount: 0, speedLimit: 10,
  shopPeekDay: null, shopPeekAt: null, shopPeekSpent: false, helmetsOwned: [], gear: {}, boardsOwned: [], boardOf: {}, linesLanded: 0, bestTricksRun: 0, bestLinesRun: 0, coins: 0, owned: [],
  levels: {}, names: {}, lastSessionDay: null, streak: 0, backupNudgedOn: null,
  strands: { ...DEFAULT_STRANDS },
  missing: { ...DEFAULT_MISSING },
  caps: { add: null, sub: null, mul: null, div: null },
  elapsedOn: true,
  elapsedLevel: 1,
  elapsedAnalog: false,
  tokens: 0, tokenDay: null, parkDay: null, parkSpent: 0,
  parkMinutes: PARK_DEFAULTS.minutes, parkTokensPerDay: PARK_DEFAULTS.tokensPerDay,
  parkUnlocked: false, parkSeen: false, parkBest: 0, parkBestChain: 0,
  lastColdDay: null,
  settingsStamps: {},
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

/** A meta saved before a field existed picks up the default rather than
 *  arriving undefined, which is why this spread is not a formality. */
export const hydrateMeta = (raw: Partial<Meta>): Meta => ({
  ...freshMeta(), ...raw,
  strands: { ...DEFAULT_STRANDS, ...(raw.strands ?? {}) },
  missing: { ...DEFAULT_MISSING, ...(raw.missing ?? {}) },
  caps: { add: null, sub: null, mul: null, div: null, ...(raw.caps ?? {}) },
  dailyGoal: Math.max(10, Math.min(80, raw.dailyGoal ?? 40)),
  speedLimit: Math.max(1, Math.min(30, raw.speedLimit ?? 10)),
  speedBest: raw.speedBest ?? {},
  // A save from the brief elapsedHard era maps onto the ladder it became.
  elapsedLevel: raw.elapsedLevel ?? ((raw as { elapsedHard?: boolean }).elapsedHard === true ? 3 : 1),
  elapsedOn: raw.elapsedOn ?? true,
  elapsedAnalog: raw.elapsedAnalog ?? false,
  lastColdDay: raw.lastColdDay ?? null,
  shopPeekSpent: raw.shopPeekSpent ?? false,
  settingsStamps: raw.settingsStamps ?? {},
  boardsOwned: raw.boardsOwned ?? [],
  boardOf: raw.boardOf ?? {},
  tokens: Math.max(0, raw.tokens ?? 0),
  parkMinutes: Math.max(2, Math.min(20, raw.parkMinutes ?? PARK_DEFAULTS.minutes)),
  parkTokensPerDay: Math.max(1, Math.min(8, raw.parkTokensPerDay ?? PARK_DEFAULTS.tokensPerDay)),
});

export const getMeta = async (): Promise<Meta> => {
  const raw = await tx<Meta | undefined>("meta", "readonly", (s) => s.get("meta"));
  if (!raw) return freshMeta();
  if (raw.version !== SCHEMA_VERSION) {
    throw new Error(`saved data is version ${raw.version}, this app speaks ${SCHEMA_VERSION}`);
  }
  return hydrateMeta(raw);
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

/** Has this profile ever done anything? The viewer mode keys off this: a
 *  device with nothing of its own shows the cloud copy instead. */
export const hasLocalData = async (): Promise<boolean> => {
  const facts = await getFacts();
  for (const s of facts.values()) if (s.introduced) return true;
  return (await getSessions()).length > 0;
};

// ---------------------------------------------------------------------------
// Export and import, so progress survives a device change or an eviction.
// ---------------------------------------------------------------------------

export interface Backup {
  app: "trickline";
  version: number;
  exportedAt: string;
  /** The rider's name, so a viewer knows whose record this is. */
  name?: string;
  meta: Meta;
  facts: Record<string, FactState>;
  responses: Response[];
  sessions: SessionRecord[];
}

export const exportAll = async (): Promise<Backup> => {
  const reg = loadRegistry();
  const name = reg.profiles.find((p) => p.id === profileId)?.name;
  return {
    app: "trickline",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...(name !== undefined ? { name } : {}),
    meta: await getMeta(),
    facts: Object.fromEntries(await getFacts()),
    responses: await getResponses(),
    sessions: await getSessions(),
  };
};

export const checkBackup = (b: unknown): Backup => {
  if (typeof b !== "object" || b === null) throw new Error("that file is not a backup");
  const back = b as Partial<Backup>;
  if (back.app !== "trickline") throw new Error("that backup is from a different app");
  if (back.version !== SCHEMA_VERSION) {
    throw new Error(`that backup is version ${String(back.version)}, this app speaks ${SCHEMA_VERSION}`);
  }
  if (!back.meta || !back.facts) throw new Error("that backup is missing its progress");
  return back as Backup;
};

export const importAll = async (b: unknown): Promise<void> => {
  const back = checkBackup(b);
  await putMeta(hydrateMeta(back.meta));
  await putFacts(new Map(Object.entries(back.facts)));
  await tx("responses", "readwrite", (s) => s.put(back.responses ?? [], "all"));
  await tx("sessions", "readwrite", (s) => s.put(back.sessions ?? [], "all"));
};

/** Wipe everything in THIS profile. Only ever reached behind a typed confirmation. */
export const eraseAll = async (): Promise<void> => {
  const d = await open();
  await Promise.all(STORES.map((store) => new Promise<void>((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    const req = t.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("clear failed"));
  })));
};

// Cross-game port registry (Andy's pattern, 2026-07-20). Multiple games run
// on this machine at once; each session CHECKS OUT a 50-port block from the
// shared registry at ~/.claude/port-registry.json and RETURNS it on exit.
// A lease is held by a LIVE pid: only an active shell can hold ports, and a
// dead shell's leases are pruned on every claim, so an exited session never
// blocks a range.
//
//   node tools/ports.mjs claim <project> <pid>   -> prints the block's base port
//   node tools/ports.mjs release <pid>           -> returns that pid's leases
//   node tools/ports.mjs status                  -> prints live leases
//
// Claim verifies the block is conflict-free twice over: no overlap with any
// live lease, AND nothing actually listening on the block (lsof probe).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REGISTRY = join(homedir(), ".claude", "port-registry.json");
const BLOCK = 50;
const FLOOR = 4200; // blocks live at 4200, 4250, ... 8950
const CEIL = 9000;

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

const load = () => {
  try {
    const r = JSON.parse(readFileSync(REGISTRY, "utf8"));
    if (Array.isArray(r.leases)) return r;
  } catch { /* fresh registry */ }
  return { leases: [] };
};

const save = (reg) => {
  mkdirSync(dirname(REGISTRY), { recursive: true });
  const tmp = REGISTRY + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify(reg, null, 1));
  renameSync(tmp, REGISTRY);
};

const prune = (reg) => {
  reg.leases = reg.leases.filter((l) => alive(l.pid));
  return reg;
};

// something actually listening anywhere in [base, base+BLOCK)?
const blockBusy = (base) => {
  try {
    const spec = `:${Array.from({ length: BLOCK }, (_, i) => base + i).join(",:")}`;
    const out = execSync(`lsof -nP -iTCP${""} -sTCP:LISTEN -i "${spec}" 2>/dev/null || true`, { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false; // lsof unavailable — lease overlap is still enforced
  }
};

// stable preferred base per project so each game keeps "its" range
const preferredBase = (project) => {
  let h = 2166136261 >>> 0;
  for (const ch of project) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const slots = Math.floor((CEIL - FLOOR) / BLOCK);
  return FLOOR + (h % slots) * BLOCK;
};

const [, , cmd, arg1, arg2] = process.argv;

if (cmd === "claim") {
  const project = arg1;
  const pid = Number(arg2);
  if (!project || !Number.isInteger(pid)) {
    console.error("usage: ports.mjs claim <project> <pid>");
    process.exit(1);
  }
  const reg = prune(load());
  // an existing live lease for this project+pid is simply re-used
  const mine = reg.leases.find((l) => l.project === project && l.pid === pid);
  if (mine) { console.log(mine.base); process.exit(0); }
  const taken = new Set(reg.leases.map((l) => l.base));
  let base = preferredBase(project);
  let guard = 0;
  while (guard++ < 200) {
    if (!taken.has(base) && !blockBusy(base)) break;
    base += BLOCK;
    if (base >= CEIL) base = FLOOR;
  }
  if (guard >= 200) { console.error("no free port block"); process.exit(1); }
  reg.leases.push({ project, base, size: BLOCK, pid, at: new Date().toISOString() });
  save(reg);
  console.log(base);
} else if (cmd === "release") {
  const pid = Number(arg1);
  const reg = load();
  const before = reg.leases.length;
  reg.leases = reg.leases.filter((l) => l.pid !== pid);
  save(prune(reg));
  console.log(`released ${before - reg.leases.length} lease(s)`);
} else if (cmd === "status") {
  const reg = prune(load());
  save(reg);
  for (const l of reg.leases) {
    console.log(`${l.project}: ${l.base}-${l.base + l.size - 1} (pid ${l.pid}, since ${l.at})`);
  }
  if (!reg.leases.length) console.log("no live leases");
} else {
  console.error("usage: ports.mjs claim <project> <pid> | release <pid> | status");
  process.exit(1);
}

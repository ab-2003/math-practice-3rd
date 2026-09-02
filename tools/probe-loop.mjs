/**
 * PROBE-LOOP — the functional playtest, now SIX SUITES RUN TOGETHER.
 *
 * The single 913-line serial probe took four minutes and every new feature
 * made it longer. Each suite in tools/probe/ is its own process with its own
 * browser against the same preview (Playwright contexts have isolated
 * storage), so the whole playtest costs what the slowest suite costs.
 *
 *   BASE=http://localhost:8350 node tools/probe-loop.mjs [suite...]
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const dir = new URL("./probe/", import.meta.url);
const all = readdirSync(dir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).map((f) => f.replace(/\.mjs$/, ""));
const want = process.argv.slice(2);
const suites = want.length > 0 ? all.filter((s) => want.includes(s)) : all;

const run = (name) => new Promise((resolve) => {
  const child = spawn(process.execPath, [new URL(`./probe/${name}.mjs`, import.meta.url).pathname], { env: process.env });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  child.on("close", (code) => resolve({ name, code, out }));
});

const results = await Promise.all(suites.map(run));
let red = false;
for (const r of results) {
  console.log(`-- ${r.name} (exit ${r.code}) --`);
  console.log(r.out.trim());
  if (r.code !== 0) red = true;
}
console.log(red ? "PROBE-LOOP RED" : "PROBE-LOOP GREEN");
process.exitCode = red ? 1 : 0;

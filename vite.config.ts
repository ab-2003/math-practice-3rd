import { defineConfig, type Plugin } from "vite";
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// Stamped at BUILD time and shown in the corner. "What stamp do you see?" is
// always the first debugging question, and with a service worker in the loop a
// stale cached bundle is otherwise invisible.
const fmtEastern = (d: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short",
  }).formatToParts(d);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} ${get("timeZoneName")}`;
};

const stamp = `${pkg.version} · ${fmtEastern(new Date())}`;

/**
 * THE PRECACHE LIST IS GENERATED, NEVER HAND WRITTEN.
 *
 * A hand maintained list is one forgotten file away from an app that boots
 * offline and renders nothing, or an icon that silently resolves to index.html
 * at status 200 (both vite preview and Cloudflare Pages answer unknown paths
 * that way). This walks the real build output, and offline-check then proves
 * every URL the app actually requests is in it.
 */
const precachePlugin = (): Plugin => ({
  name: "precache-list",
  apply: "build",
  closeBundle() {
    const dist = fileURLToPath(new URL("./dist/", import.meta.url));
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else files.push("./" + relative(dist, p).split("\\").join("/"));
      }
    };
    walk(dist);
    const assets = files.filter((f) => !/\/sw\.js$|_headers$|\.map$/.test(f));
    const swPath = join(dist, "sw.js");
    const sw = readFileSync(swPath, "utf8")
      .replace("__PRECACHE__", JSON.stringify(assets.sort(), null, 2))
      .replace("__STAMP__", JSON.stringify(stamp));
    writeFileSync(swPath, sw);
    console.log(`  precache: ${assets.length} files stamped into sw.js`);
  },
});

export default defineConfig({
  base: "./",
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(stamp),
  },
  plugins: [precachePlugin()],
  build: {
    outDir: "dist",
    target: "es2020",
    // Every asset stays a real file so the service worker can cache it.
    assetsInlineLimit: 0,
  },
});

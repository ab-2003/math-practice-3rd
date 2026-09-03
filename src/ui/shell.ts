/**
 * THE SHELL: the flight recorder, the tap synthesiser, the build stamp, the
 * service worker. Shared by both doors into the app (the kid's at / and the
 * grown-ups' at /parent/). All of it exists because of scars in earlier
 * projects in this house.
 */

import { el, on } from "./dom";
import { unlock, wake } from "./sfx";

declare const __BUILD_STAMP__: string;

// ---------- the flight recorder -------------------------------------------
// Ninety lines that once ended a three release bug hunt in a single paste.

const BOX_KEY = "tl.box.v1";
const box: string[] = [];
export const boxPush = (line: string): void => {
  box.push(`${new Date().toISOString().slice(11, 23)} ${line}`);
  if (box.length > 400) box.splice(0, box.length - 400);
  try { sessionStorage.setItem(BOX_KEY, box.join("\n")); } catch { /* full storage must not break the app */ }
};
export const boxDump = (): string => box.join("\n");

/** Is this the grown-ups' door? Decided by the path, never by a setting. */
export const isParentDoor = (): boolean => /\/parent\/?$/.test(location.pathname);

export const installShell = (): void => {
  try {
    const prior = sessionStorage.getItem(BOX_KEY);
    if (prior) box.push("--- earlier ---", prior, "--- reload ---");
  } catch { /* nothing to restore */ }
  boxPush(`boot ${__BUILD_STAMP__} ${isParentDoor() ? "parent " : ""}${navigator.userAgent.slice(0, 90)}`);
  window.addEventListener("error", (e) => boxPush(`ERROR ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => boxPush(`REJECT ${String(e.reason).slice(0, 160)}`));
  document.addEventListener("visibilitychange", () => boxPush(`visible=${!document.hidden}`));

  // ---------- the tap synthesiser -------------------------------------------
  //
  // Safari's double tap zoom is a DEFAULT ACTION of the second tap's touchend.
  // Viewport meta, touch-action and gesture suppressors all fail when a tap
  // removes its own button, which is exactly what this keypad does on submit.
  // So preventDefault EVERY touchend and synthesise the click by hand.
  //
  // Text inputs are exempted FIRST. This app has almost none, but the restore
  // file picker and the rename prompt need their native behaviour, and an
  // exemption that arrives too late is an app whose keyboard never opens.

  const TAPPABLE = "button, a, .mon, .key";
  const starts = new Map<number, { x: number; y: number; el: Element | null }>();

  // GHOST CLICKS (Andy, 2026-09-02): hold a button a beat instead of tapping
  // it and iOS follows the touch with a native click of its own, which lands
  // on whatever is under the finger BY THEN. The synthesised click had
  // already closed the monster card, so the ghost opened the tile beneath.
  // A native click inside a short window after a synthesised one can only
  // be that ghost, and it is eaten before anything sees it.
  const GHOST_MS = 700;
  let ghostUntil = 0;
  document.addEventListener("click", (e) => {
    if (e.isTrusted && performance.now() < ghostUntil) { e.stopPropagation(); e.preventDefault(); }
  }, { capture: true });

  document.addEventListener("touchstart", (e) => {
    unlock(); // iOS gives audio only on a gesture. Retry on every one.
    for (const t of Array.from(e.changedTouches)) {
      starts.set(t.identifier, { x: t.clientX, y: t.clientY, el: document.elementFromPoint(t.clientX, t.clientY) });
    }
  }, { passive: true, capture: true });

  document.addEventListener("touchend", (e) => {
    if (e.touches.length > 0) return; // a multi touch gesture is still running
    const t = e.changedTouches[0];
    if (!t) return;
    const under = document.elementFromPoint(t.clientX, t.clientY);
    if (under instanceof HTMLElement && under.closest("input, textarea, select")) {
      starts.delete(t.identifier);
      return;
    }
    e.preventDefault(); // no native click means no double tap zoom, ever
    const start = starts.get(t.identifier);
    starts.delete(t.identifier);
    // 24px of movement is a pan, not a tap, or half of real taps read as drags.
    if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 24) return;
    // Element, NOT HTMLElement: a tap on monster ART lands on an SVG path,
    // which is an SVGElement, and the old gate silently ate every one of those
    // taps. Andy found it on his phone; tap-audit had not, because it judged
    // with its own contains() instead of THIS code path. closest() lives on
    // Element, which is all we need.
    const target = under instanceof Element ? under.closest(TAPPABLE) : null;
    const startTarget = start?.el instanceof Element ? start.el.closest(TAPPABLE) : null;
    // A button born mid gesture never eats the same tap.
    if (target instanceof HTMLElement && target === startTarget && !target.hasAttribute("disabled")) {
      ghostUntil = performance.now() + GHOST_MS;
      target.click();
    }
  }, { passive: false, capture: true });

  for (const ev of ["gesturestart", "gesturechange"]) {
    document.addEventListener(ev, (e) => e.preventDefault());
  }
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("pointerdown", unlock, { capture: true });
  // The sound has to survive a sleeping iPad: coming back into view, into
  // focus, or out of the back/forward cache all re-arm the audio context.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  window.addEventListener("pageshow", wake);
  window.addEventListener("focus", wake);

  // the build stamp, and a long press on it copies the flight recorder
  const stamp = el("div", { class: "stamp", id: "stamp", text: __BUILD_STAMP__ });
  document.body.append(stamp);
  let pressTimer: number | undefined;
  on(stamp, "pointerdown", () => {
    pressTimer = window.setTimeout(() => {
      void navigator.clipboard?.writeText(boxDump()).catch(() => undefined);
      alert("Debug report copied.");
    }, 900);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    document.addEventListener(ev, () => window.clearTimeout(pressTimer));
  }

  // ---------- the service worker --------------------------------------------
  //
  // NO blind skipWaiting. There is one production URL and no beta channel, so a
  // worker that swaps the bundle mid session has nowhere to be caught. The
  // worker lives at the site root and covers both doors; from /parent/ it is
  // one directory up.

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      const swUrl = isParentDoor() ? "../sw.js" : "./sw.js";
      void navigator.serviceWorker.register(swUrl).then((reg) => {
        boxPush("sw registered");
        const offer = (worker: ServiceWorker): void => {
          if (document.getElementById("update-chip")) return;
          const b = el("button", { type: "button", class: "btn small alt", id: "update-chip",
            style: "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:35" },
            el("span", { text: "Update ready · reload" }));
          on(b, "click", () => { worker.postMessage("SKIP_WAITING"); setTimeout(() => location.reload(), 250); });
          document.body.append(b);
        };
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) offer(nw);
          });
        });
      }).catch((err: unknown) => boxPush(`sw failed ${String(err).slice(0, 120)}`));
    });
  }

  (window as unknown as Record<string, unknown>).__box = boxDump;
};

/**
 * THE TOAST: a line of feedback that needs no tap. Fixed length, bottom of
 * the screen, above the build stamp, gone by itself. For "it worked" and
 * "nothing changed": the things that once happened in silence and read as
 * the app doing nothing (Andy, 2026-09-02, on connecting and refreshing the
 * cloud copy).
 */

import { el } from "./dom";

const TOAST_MS = 2_800;
const QUEUE_KEY = "tl-toast";

export const toast = (text: string): void => {
  for (const old of Array.from(document.querySelectorAll(".toast"))) old.remove();
  const t = el("div", { class: "toast", role: "status", "aria-live": "polite", "data-probe": "toast", text });
  document.body.append(t);
  window.setTimeout(() => t.remove(), TOAST_MS);
};

/** A toast for AFTER a reload: the load-from-cloud path reloads the page,
 *  and its success would otherwise vanish with the old document. */
export const queueToast = (text: string): void => {
  try { sessionStorage.setItem(QUEUE_KEY, text); } catch { /* private mode */ }
};

export const flushToast = (): void => {
  try {
    const t = sessionStorage.getItem(QUEUE_KEY);
    if (t !== null) { sessionStorage.removeItem(QUEUE_KEY); toast(t); }
  } catch { /* nothing queued */ }
};

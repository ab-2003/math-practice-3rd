// Not a test: an INSTRUMENT. The unit tests prove the transitions are what we
// said. This asks a different question the tests cannot: over a school year
// of daily sessions, does this configuration produce a sane experience, or
// does the queue explode / mastery stall / division never unlock / the
// maintenance of owned facts crowd out the new ones?
//
//   npx tsx tools/sim.ts [days]
import { buildDeck } from "../src/core/facts";
import { allStates } from "../src/core/scheduler";
import { coldCheckDue, coldCheckIds, currentFactId, isColdItem, recordResponse, sessionIsOver, startSession } from "../src/core/session";
import type { ResponseClass, States } from "../src/core/types";

const DAYS = Number(process.argv[2] ?? 70);
const deck = buildDeck();
let states: States = allStates(deck);

// A model of the boy: strong derivation, weak retrieval, improving with
// exposure. Bridge cases and the hard middles are his slow ground.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const exposure = new Map<string, number>();

const behave = (id: string): { cls: ResponseClass; correct: boolean } => {
  const f = deck.get(id)!;
  const n = exposure.get(id) ?? 0;
  exposure.set(id, n + 1);
  const hard = f.bridge || f.tier >= 70 ? 1 : 0;
  // retrieval probability climbs with exposure, slower on hard ground
  const pRetrieved = Math.min(0.9, (n * (hard ? 0.06 : 0.13)) + (hard ? 0.02 : 0.15));
  const pWrong = Math.max(0.02, (hard ? 0.22 : 0.08) - n * 0.02);
  const r = rnd();
  if (r < pWrong) return { cls: "effortful", correct: false };
  if (r < pWrong + pRetrieved) return { cls: "retrieved", correct: true };
  return rnd() < 0.85 ? { cls: "derived", correct: true } : { cls: "effortful", correct: true };
};

console.log(`deck: ${deck.size} facts, ${DAYS} days`);
console.log("day  items  planned  new  review  mastered  intro'd  box6+  cold  status");
let lastCold: number | null = null;
let coldTotal = 0;
for (let day = 0; day < DAYS; day++) {
  const cold = coldCheckDue(lastCold, day) ? coldCheckIds(deck, states, day) : [];
  if (cold.length > 0) lastCold = day;
  coldTotal += cold.length;
  let s = startSession(deck, states, day, undefined, undefined, cold);
  const planned = s.queue.length;
  const newToday = s.queue.filter((id) => !states.get(id)!.introduced).length;
  const review = s.queue.filter((id) => states.get(id)!.introduced && states.get(id)!.dueOn <= day).length;
  let guard = 0;
  while (!sessionIsOver(s) && guard++ < 400) {
    const id = currentFactId(s);
    if (id === null) break;
    const { cls, correct } = behave(id);
    const base = { factId: id, day, at: 0, submitMs: 9000, answered: 1, isRetry: false, cold: isColdItem(s) };
    const fk = cls === "retrieved" ? 900 : cls === "derived" ? 5000 : 11000;
    let step = recordResponse(deck, states, s, { ...base, firstKeyMs: fk, correct, cls });
    s = step.session; states = step.states;
    if (!correct) {
      step = recordResponse(deck, states, s, { ...base, firstKeyMs: 2000, correct: true, cls: "retrieved", isRetry: true });
      s = step.session; states = step.states;
    }
  }
  const real = s.responses.filter((r) => !r.isRetry).length;
  const mastered = [...states.values()].filter((x) => x.mastered).length;
  const intro = [...states.values()].filter((x) => x.introduced).length;
  const deep = [...states.values()].filter((x) => x.box >= 6).length;
  if (day % 7 === 0 || day === DAYS - 1) {
    console.log(
      `${String(day).padStart(3)}  ${String(real).padStart(5)}  ${String(planned).padStart(7)}  ${String(newToday).padStart(3)}  ${String(review).padStart(6)}  ${String(mastered).padStart(8)}  ${String(intro).padStart(7)}  ${String(deep).padStart(5)}  ${String(cold.length).padStart(4)}  ${s.status}`,
    );
  }
}
const byKind = (k: string) => [...deck.values()].filter((f) => f.kind === k);
for (const k of ["add", "sub", "mul", "div"]) {
  const fs = byKind(k);
  const intro = fs.filter((f) => states.get(f.id)!.introduced).length;
  const mast = fs.filter((f) => states.get(f.id)!.mastered).length;
  console.log(`${k}: ${intro}/${fs.length} introduced, ${mast} mastered`);
}
// The maintenance question: at the end, how many owned facts fall due per day?
const owned = [...states.values()].filter((x) => x.mastered);
const perDay = new Map<number, number>();
for (const x of owned) perDay.set(x.dueOn, (perDay.get(x.dueOn) ?? 0) + 1);
const horizon = [...perDay.entries()].filter(([d]) => d >= DAYS && d < DAYS + 30).map(([, n]) => n);
const avg = horizon.length === 0 ? 0 : horizon.reduce((a, b) => a + b, 0) / 30;
console.log(`maintenance: ${owned.length} mastered facts, ~${avg.toFixed(1)} of them due per day over the next 30 days; ${coldTotal} cold-check items asked`);

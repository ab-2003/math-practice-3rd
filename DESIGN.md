# TRICK LINE

**A math fact fluency PWA that honours how one particular boy thinks, while
still driving him toward automaticity.**

Design document and development handbook. Started 2026-08-31.

LIVE at `https://math-practice-3rd.pages.dev`, single production channel.
Repo `~/code/math-practice-3rd`, GitHub `ab-2003/math-practice-3rd`, private.

---

## How to use this document

Part I is the learner and the pedagogy, and it is the part that must not be
optimised away: every mechanic in this app exists because of something true
about him. Part II is the model. Part III is the design system. Part IV is
architecture. Part V is verification. Part VI is the ladder.

**For a new session**: read the first law, then Part I, then Part II. The
pedagogy is the product; the harness is what makes it trustworthy.

**Inheritance.** The pipeline is lifted from MORTGAGE RECAST ANALYZER
(`~/code/mortgage-recast-analyzer`), the one prior non-game PWA, which in turn
inherited from THE WAR OF 4 (`~/code/tactics`). Where a law here exists because
of a scar in those projects, the scar is named. Laws without scars get
optimised away.

---

## The first law: validate, never assume

Andy, 2026-07-28, naming it the main development principle:

> *"Don't take unvalidated shortcuts or use unvalidated assumptions. Don't rely
> on 'the audio should finish in this amount of time' or 'I think this is how
> many pixels to offset on a phone'. Validate it empirically."*

Every other law in this document is a special case of that one.

This app has its own sharp edge. A game that renders a sprite backwards is
embarrassing. **This app produces evidence that goes to a teacher**, and a
tool that reports "automaticity is not building" when it is, because it timed
the boy's thumbs instead of his memory, is worse than no tool at all.

Three corollaries:

1. **Every number the dashboard reports is derived from stored raw values**,
   never from a running total that cannot be re-checked.
2. **A failed measurement must never read as a verdict.** No digit pressed
   means we do not know how fast he was, and `classify` returns `effortful`
   by refusing to guess rather than by inventing a number.
3. **Tuning constants are hypotheses.** They live in one file, and because
   every response stores its raw milliseconds forever, history can be
   re-classified under different thresholds without losing a month of evidence.

---

# PART I - THE LEARNER, AND WHY EVERY MECHANIC EXISTS

## 0. The year's job, in Virginia's own words

Loudoun County follows the **Virginia Standards of Learning**, not Common Core,
and two standards define this year. They are not from the same year:

| | | |
|---|---|---|
| **2.CE.1** | grade **2** | recall with automaticity addition and subtraction facts within 20 |
| **3.CE.2** | grade **3** | recall with automaticity multiplication facts through 10 x 10 and the corresponding division facts |

He is at the beginning of third grade carrying the second grade standard as an
open gap. So the year has to **close a prior-year gap and hit a current-year
standard at the same time**, and 3.CE.2 is not an end in itself: it is the
direct prerequisite for fourth grade multi-digit multiplication and long
division, which is exactly where a boy who derives every fact will run out of
working memory.

That pair of numbers is what the parent dashboard reports, because it is what
his teacher actually needs to see.

## 1. Who is holding the iPad

A third grade boy. From a parent and a teacher who both watch him closely:

- **Strong conceptual reasoning, weak fact retrieval.** He derives 11 - 8
  correctly and quickly by finding the tens, decomposing across 5s and 10s,
  talking himself through it aloud. What he cannot do reliably is retrieve.
- **The derivation is a genuine strength. Do not train it out of him.**
- **The cost of derivation is working memory.** Every derived fact eats a
  slot. Fine in second grade, painful in fourth, when long division asks him
  to hold a procedure, a remainder and a lookup at once. The goal is to
  compress derivation into automaticity, not to replace it.
- **He has recently disengaged from a standardised test**, 43 questions in 19
  minutes, which is rapid guessing. Assume some maths avoidance. Assume
  pressure makes it worse.
- **He has been through significant family loss.** Nothing in this app ever
  shames, scolds, or conveys disappointment. No red X paired with a negative
  sound. No failure state.

Interests, for theming: dinosaurs, kaiju, creature collecting, hockey,
skateboarding, inline skating.

## 2. The mechanic: two ledgers that never touch

This is the whole design.

| | The learner's ledger | The scheduler's ledger |
|---|---|---|
| Correct under 3s | full credit | **promotes a box** |
| Correct 3 to 8s | full credit, identical | **holds** |
| Correct over 8s | full credit, identical | holds, asks again today |
| Wrong | cheerful bail, banked currency kept | demotes two boxes |

He experiences a generous system. The scheduler runs a strict one. The
strictness never surfaces as judgement, only as *this one keeps coming back*,
which reads as perfectly ordinary.

**LAW: nothing in the UI may ever distinguish a derived answer from a
retrieved one.** No "fast!" badge, no speed multiplier, no different sound, no
different animation. The moment speed is visible it becomes a threat, and this
is a boy who rapid-guesses under threat. This is the law most likely to erode
during the fun part of the build.

**LAW: a derived answer HOLDS the mastery streak rather than resetting it.**
He was right. Resetting would punish a correct answer and put mastery out of
reach for a boy whose entire strength is derivation.

## 3. The clock starts at paint and stops at the first digit

The single most important measurement decision in the app.

Time to *submit* includes motor time, and motor time scales with digits:
`2+3=5` is one tap, `8+7=15` is two taps and a submit. A boy who retrieves in
400ms but taps deliberately lands past three seconds on every two-digit answer,
never promotes, and the dashboard tells his teacher automaticity is not
building when in fact it is.

**`firstKeyMs` is the retrieval measurement. Everything after it is his
hands.** `submitMs` is stored on every response for diagnosis and is never
allowed near classification.

## 3b. The ruling on multiple choice (2026-09-01)

Andy asked whether ~10% of questions might be multiple choice. Advised
against, and he should overrule this in full knowledge of the reasoning if he
still wants it:

1. **Recognition is not recall.** Picking 15 from four options is a weaker
   memory act than producing 15, and the transfer target, long division, only
   ever asks for production.
2. **It is his documented failure mode.** He rapid-guessed a 43-question test.
   Free entry is the one structural guarantee a session cannot be guessed
   through, and even occasional MC teaches that the app can sometimes be gamed.
3. **It corrupts the evidence.** Classification and the teacher-facing chart
   run on time-to-first-digit. A tapped choice has no first digit, so those
   items would carry fake timings or holes.

The variety itch has a safe outlet, and Andy took it (2026-09-01):
**missing-number problems** (8 + ▢ = 15), still typed production, the exact
shape of his bridge strategy. Per operation switches in parent settings, OFF
for all four by default, mixing at an editable shared percentage (default 20)
when on. The blank is always an OPERAND, never the result; he types into the
blank itself (one slot on screen, not two); grading and the forced re-entry
demand the operand; the format travels into the CSV. `answer-eye` solves every
missing item from the rendered sentence alone, a second implementation to the
last digit.

## 4. Rules that are not negotiable

1. **No multiple choice, ever.** Free numeric entry on a large custom keypad,
   never the iOS keyboard. Multiple choice is what makes rapid guessing
   possible; if he must produce the number he cannot guess his way through.
2. **No visible timer, no ticking, no pressure UI.** Response time is measured
   silently on every item. Speed is diagnostic, never a threat.
   *Corollary, and the back door to watch:* trick animations are FIXED
   duration regardless of latency, and no combo meter visibly decays. A timer
   smuggled in as a progress bar is still a timer.
3. **A wrong answer cannot be skipped.** Warm neutral feedback, then a
   strategy scaffold matched to his actual method (a ten-frame or number line
   showing the bridge: 11, take 1 to reach 10, take 7 more, land on 3), then
   he **types the correct number himself** to continue. Not a "got it" button.
   The re-entry is a closing gesture, not a retrieval event: it never reaches
   the scheduler and never enters the dashboard's retrieval percentage.
4. **Every session ends on success.** The last three items are drawn from
   facts he has already succeeded at.
5. **Ending early is a feature.** If he is grinding, the session stops on its
   closer and is logged as `endedEarly`, distinct from `abandoned`, so the
   dashboard can tell "the app protected him" from "he walked away."

---

# PART II - THE MODEL

## 5. The deck

363 facts, generated deterministically with stable ids so a progress file
survives any change to the generator.

| Kind | Count | Notes |
|---|---|---|
| `add` | 66 | addends 0-10, canonical `a <= b` |
| `sub` | 121 | subtrahend and difference both 0-10 |
| `mul` | 66 | 0-10, canonical `a <= b` |
| `div` | 110 | inverse of multiplication, divisor never zero |

**A commutative pair is ONE fact with two presentations, not two facts.**
`8+7` and `7+8` share an id; the UI picks the orientation. This halves the
addition and multiplication decks, which matters for a boy who needs to see
progress, and it matches how fact fluency is actually assessed.

**Bridge-through-ten is flagged on the fact.** `isBridgeSub(m, s)` is true
when the subtrahend exceeds the minuend's units digit, so the ten must be
broken: 11-8 and 13-5 bridge, 15-3 does not. This is his strategy zone and the
stated priority.

## 6. The tier ladder is the curriculum

```
10  addition within ten, and the +0 facts (early wins on purpose)
15  the +10 facts
20  x0, x1, x2, x5, x10
23  division by 2, 5, 10          (partner tier + 3)
25  doubles above ten
30  BRIDGE-THROUGH-TEN ADDITION    <- priority
40  subtraction within ten
45  the -10 and back-to-ten facts
50  x3, x4
53  division by 3, 4
60  BRIDGE-THROUGH-TEN SUBTRACTION <- priority
70  the hard middles, 6-9 by 6-9
73  division in the hard middles
80  everything left within twenty
```

Multiplication opens at tier 20, third group in, deliberately: a strict
"finish all the adding first" order keeps a third grader off multiplication
until spring, and multiplication is the wall he is about to hit.

**Division rides just behind its own multiplication family** rather than
behind the entire rest of the deck. The tier says where it belongs in the
queue; the real gate is the partner rule below.

## 7. Leitner, and what mastery means

Boxes 1 to 5, intervals 1, 2, 4, 8, 16 days.

- **retrieved** promotes a box, and counts toward mastery *if it is a new day*
- **derived** holds the box and holds the streak
- **effortful** holds the box, breaks the streak, asks again this session
- **wrong** demotes two boxes, due tomorrow, asks again this session

**Mastery is three retrieved responses on three DISTINCT days.** The
distinct-day rule is load bearing: three fast answers inside one session are
partly priming from having just seen the fact, and only a new day is evidence
it survived sleep. A second retrieved response on the same day neither counts
nor resets.

**Mastery is a label, not an exit.** A mastered fact keeps circulating at the
box-5 interval and can lose the label. If mastery retired a fact, automaticity
would decay silently, the heat map would go stale, and the dashboard's
"trending the wrong way" list would be permanently empty because nothing could
ever trend anywhere.

**Division unlocks per family at box 3**, not at mastery. Waiting for mastery
would mean division never unlocks: three retrieved responses on distinct days
at box 4 and 5 intervals is weeks per fact. Box 3 means "he has been right
about this twice, days apart," and that is enough to hang the inverse on.

## 7b. Practice focus: which operations are switched on

A **parent control**, behind the PIN, added 2026-08-31 at Andy's request:
*"we have not started multiplication yet so right now we would just be doing
addition and subtraction."*

School reaches multiplication when it reaches it. Drilling an operation nobody
has taught him is not practice, it is a boy being asked questions he has never
been shown how to answer, and for this boy in particular that is the fastest
route back to the avoidance the whole app is built around.

**A fresh install practises addition and subtraction only.** That is not a
neutral default, it is the correct one for the autumn of third grade: 2.CE.1
is the gap he is actually carrying, and multiplication arrives when his class
does.

The rules:

- A switched-off operation leaves sessions **entirely**: the due queue, the
  new-fact draw, the top-up, and the closer all filter on it. A session
  focused on addition must not end on three multiplication facts.
- **Progress is preserved, never reset.** Boxes, mastery streaks and history
  in a switched-off strand sit exactly where they were.
- **Switching one back on REVIVES it** (`reviveStrand`). While an operation is
  off its facts keep accruing a `dueOn`, so after a term away every one of
  them is overdue by ninety days. Turning multiplication back on would then
  dump the whole backlog into one session, ordered by an overdue-ness that
  measures only how long the switch was off, which is exactly the drowning the
  new-fact gate exists to prevent. So on revival anything already overdue
  becomes due **today**. Boxes are untouched: if the time away really did cost
  him a fact, his next wrong answer says so and the scheduler demotes it.
  Presuming decay would be guessing; letting him show us is not.
- **The last operation cannot be switched off**, or the app has nothing to ask.
- **Division without multiplication is allowed but warned about.** A division
  fact still needs its own multiplication family at box 3, so nothing new
  arrives until multiplication is back on. The card says so rather than
  silently doing nothing.
- **The dashboard says when a standard is switched off.** Without that, a
  teacher reads "0 of 176" as a boy failing multiplication when in fact nobody
  has switched it on. A switched-off standard is a starting point, not a result.

## 7c. Pacing: placement and the fill (2026-09-01)

Andy, after the first real sessions: *"How does it decide when to increase the
size of the facts... I haven't gotten anything bigger than like 3+2."* Nothing
was deciding. New material dripped in at a fixed four facts a session in
curriculum order, the right pace for a child building from nothing and
exactly wrong for a REVIEWER, who was weeks away from ever meeting 8+7.

Two rules replaced the drip:

- **Placement on first sight.** A fact retrieved fast on its very first
  sighting was never something to teach: it starts at box 4 instead of
  climbing from the bottom rung. The ladder exists to schedule learning; a
  fact he already owns does not need its bottom rungs. Mastery still takes
  three distinct days.
- **The fill.** A session takes new material up to its target length (cap 24
  new per sitting) whenever the due queue is light. The anti-drowning gate is
  untouched and makes the flood self-limiting: what he owns flies to a
  distant box after one look, and what he does not stacks up as due work that
  closes the gate.

Re-simulated on the slow-consolidator profile: 81 facts met by day 7 (was 28),
all four strands moving, sessions in the 44 to 50 item band, and the struggle
detector still ends bad days early.

## 8. Session assembly

Everything due, then new facts **only if the due queue is under the gate**
(the anti-drowning rule: a heavy review day has no room for anything new, so a
bad day cannot compound into a worse one), then top-up to a workable length.

**New facts are drawn round-robin across strands**, not strictly by global
tier. Order within a strand is still strictly by tier, which is where the
pedagogy lives.

**Top-up is sorted weakest-box-first**, so shaky facts fill the slots ahead of
solid ones and the session is front-loaded with the work that matters and
back-loaded with wins.

## 9. The closer cascade

The spec says the last three items come from mastered facts. Taken literally
that leaves the most important moment in the app, the ending of his very first
session, with an empty pool: on day one nothing is mastered, and by the
mastery definition nothing will be for two to three weeks.

So it cascades, and there is always a pool: **mastered facts, else his
strongest boxes, else whatever he got right earlier in this same session.**
Every branch is something he has already succeeded at, which is the point.

## 10. What the simulation found

`tools/sim.ts` runs seventy days of daily sessions against a model of the boy.
The unit tests prove the transitions are what we said; the simulation asks the
question the tests cannot, which is whether this *configuration* produces a
sane experience. It found three things that no unit test would have:

1. **Division never unlocked at all** (0 of 110 after ten weeks). Division sat
   at tier 90, and new facts walked global tier order, so the entire rest of
   the deck had to be introduced first. Fixed by deriving the division tier
   from its multiplication partner.
2. **Subtraction was starved** (21 of 121, while addition finished at 66 of
   66), because every subtraction tier sits behind an addition tier. Fixed by
   drawing new facts round-robin across strands.
3. **Sessions ran 11 to 25 items**, a three minute sitting rather than the
   eight to ten minutes the design calls for. Fixed by topping up from the
   weakest boxes, never by loosening the new-fact gate.

After the fixes, the slow-consolidator profile runs 47 to 56 item sessions,
advances all four strands, and the struggle detector still cuts bad days short.

---

# PART III - DESIGN SYSTEM

Bold, chunky, high contrast. Skate-deck graphics and monster-sticker art:
heavy outlines, saturated flat colour, a little grit. Not cute, not babyish,
not corporate-EdTech pastel. He is eight and wants it to look cool.

**All creatures and trick animations are inline SVG.** No image assets beyond
the PWA app icons. This is an art direction and an engineering decision at
once: it keeps the offline bundle tiny, and it sidesteps the missing-asset
trap entirely (see §17).

**Sound is synthesised with WebAudio**, not shipped as files, for the same
reasons. Short and punchy. Skate sounds on landing, a roar on unlock, a soft
neutral tone on a wrong answer, never a buzzer. Mute toggle persists.

**Intellectual property: everything original.** No Pokemon, Godzilla, Marvel,
DC, NHL, real team, real player, or any existing franchise, character or
trademark. Original creature designs, names and lore. Original dinosaurs and
general kaiju conventions are fine; anything licensed is not.

---

# PART IV - ARCHITECTURE

Vite 5, TypeScript 5 strict, Vitest, Playwright. **Vanilla DOM, no framework,
no Pixi.** The spec proposed React plus Tailwind plus Framer Motion; the house
stack was chosen instead because the entire harness suite is written against
DOM, the art direction is inline SVG which is DOM-native, the bundle stays
tiny (which matters because iOS evicts PWA storage under pressure), and every
touch interaction stays under our own control on an app whose critical path is
a custom keypad. Pixi would earn its weight only on the trick animations and
carries a known scar: one throw in a shared-ticker listener freezes the canvas
while the DOM keeps working.

```
math-practice-3rd/
  DESIGN.md
  index.html
  src/
    core/                PURE. no DOM, no Date, no imports from ui/
      config.ts          EVERY tuning dial, one file
      types.ts
      clock.ts           the one sanctioned use of Date
      facts.ts           deck generation, tiers, bridge detection
      classify.ts        response-time classification
      scheduler.ts       the Leitner transition
      session.ts         assembly, requeue, closer, struggle detector
      *.test.ts
    ui/                  keypad, trick line, creatures, dashboard
    main.ts
  tools/                 the senses, sim.ts
  public/                manifest, sw.js, _headers, icons
```

**The dependency rule**: `core/` may not import from `ui/`, and may not
mention `document`, `window`, `localStorage`, `indexedDB` or `new Date` except
in `clock.ts`. `architecture.test.ts` asserts it. On its first run it caught a
local variable named `window` shadowing the global inside the struggle
detector.

**Persistence is IndexedDB**, not localStorage: the per-item history carries
two timestamps and will run to thousands of rows, and localStorage is
synchronous enough to jank the keypad. Schema carries a version; an unknown
version is **rejected, not coerced**, because a half-migrated progress file is
worse than a missing one.

**iOS evicts IndexedDB from PWAs under storage pressure and after long
non-use.** That is the real argument for the JSON export being a prompted
periodic backup rather than a menu item nobody finds.

---

# PART V - VERIFICATION

## Unit test law

Every behaviour change lands with its test in the same commit, beside the code
it pins. **Prove the pin bites**: reintroduce the bug, watch that specific test
fail, restore. A guard that has never run is not a guard.

Done at the close of milestone 1 for the three load-bearing rules:

| Mutation | Test that caught it |
|---|---|
| let a derived answer promote the box | "HOLDS the box on a derived answer", "never promotes on derivation alone" |
| same-day retrieved counts toward mastery | "refuses to count three retrieved answers inside one day" |
| let the forced re-entry reach the scheduler | "never touches the schedule", "holds the cursor on a wrong answer" |

**A test suite passing is not a build passing.** `vitest` does not typecheck;
during milestone 1 the suite was green over a `session.ts` that failed `tsc`
on a missing type import. The gate runs both, always.

## The senses

All six run in parallel against a fresh preview, so the gate costs what the
slowest sense costs rather than the sum.

**`answer-eye`** is the core instrument, the analogue of the mortgage
analyser's `number-eye`. It drives real sessions through the real UI and
derives every expected answer with a SECOND implementation that never imports
the app's code (`lib/drive.mjs` parses the fact id). Two implementations that
agree is evidence; one agreeing with itself is not. It also parses the clock
times out of each elapsed-time bonus problem and works the minutes out
itself, checks that every stored response's classification matches its own raw
milliseconds, and proves no fact ever gained mastery credit from a forced
re-entry. A tool that grades wrong is this app's defining failure, and this is
the only instrument that catches it.

**`probe-loop`** is the functional playtest: real taps, real keystrokes. It
asserts there is no native text input anywhere in a session, that the scaffold
never contains the words "wrong", "incorrect" or "failed", that a wrong PIN
does not open the dashboard, and that the CSV carries its measurement
definition.

**`human-eye`** walks five states across four shapes, iPad portrait and
landscape first. It judges vertical overflow by SCROLLING and re-measuring:
below the fold is not the same as unreachable, and the first version of this
check reported a long dashboard as broken.

**`tap-audit`** synthesises a real touch at every element's centre and asserts
that element receives it, plus a 44px floor. **`legible-check`** measures
contrast and font size. **`offline-check`** cuts the network and proves a full
question is asked, answered and graded, and that the creatures still draw with
zero image requests.

## Laws inherited by scar

- **A missing asset is not a 404.** Cloudflare Pages and vite preview both
  answer an unknown path with `index.html` at status 200. Check bytes.
- **`Vary: Origin` silently defeats a service-worker precache.** Use
  `{ignoreSearch: true, ignoreVary: true}` on every `caches.match`.
- **The precache list is generated at build time** from real build output.
- **No blind `skipWaiting`.** One production URL means a stuck worker is stuck
  for everyone; a waiting worker raises a reload chip.
- **iOS double-tap**: preventDefault every touchend and synthesise the click,
  with `input`, `textarea` and `select` exempted first.
- **Never redirect a build to `/dev/null`.**
- **No em-dashes in user-facing copy.**

---

# PART VI - THE LADDER

- [x] **M1 - the model.** Deck, tiers, Leitner scheduler, response-time
      classification, session assembly with requeue, closer cascade and
      struggle detector. 51 unit tests, three proven mutations, and the
      seventy-day simulation that found three configuration defects.
- [x] **M2 - the loop.** Custom keypad (no native input anywhere in a
      session), two-clock timing capture, grading, the bridge-through-ten
      scaffold, forced re-entry.
- [x] **M3 - the shell.** PWA, hand-written service worker with a generated
      precache, offline proved by instrument, IndexedDB with a rejected-not-
      coerced schema version, JSON backup and restore, prompted backup nudge,
      flight recorder.
- [x] **M4 - Trick Line.** Five-trick lines in inline SVG, coins banked per
      trick, the cheerful bail, the celebrated exit at every line break.
- [x] **M5 - the collection.** Twelve original creatures as parameter sets
      through one renderer, naming, levelling.
- [x] **M6 - the parent dashboard.** PIN gate, retrieval-vs-derivation trend,
      per-operation heat maps, regressions, session log with the
      ended-early distinction, CSV export carrying its own measurement
      definition, and the two SOL standards.
- [x] **M7 - sound.** WebAudio kit synthesised at runtime, persisted mute,
      first-gesture unlock.
- [x] **0.5.0 - the elapsed-time ladder and the analog clocks.** Three
      explained levels with the parent picking the ceiling (default level 1
      only), mixing everything at or below it; and an opt-in analog view,
      two house-style clock faces on five minute marks, so the bonus round
      doubles as clock-reading practice.
- [x] **0.4.0 - missing number, gentle time, and pacing.** Missing-number
      format behind per-operation parent switches (all OFF by default, shared
      mix percent, default 20); elapsed-time bonus stays inside one hour until
      a parent switches the crossing on; placement-on-first-sight plus the
      session fill replace the four-fact drip. Scars collected: the `hidden`
      attribute is UA-level and `.eq { display: flex }` beat it, so every
      missing item briefly showed two answer slots; and `answer-eye` spent a
      while exercising only multiplication because an earlier probe happened
      to have SAVED it on, so its own state setup is now explicit.
- [x] **0.3.0 - the trick, performed.** On a correct answer his creature (the
      newest owned, else a cameo of the one he is saving for) rides the stage
      and does the line's trick: ollie, kickflip with a spinning deck, rail
      grind, 360, backflip. A chime sounds and the answered problem ghosts out
      before the next fades in. Fixed 760ms always, identical for retrieved
      and derived, kid toggle (skateboard button by the mute button), honours
      prefers-reduced-motion. Phone fix: the five trick names collided at
      390-430px and shoved OLLIE off the edge; narrow screens now show the
      decks plus one label. Multiple choice considered and ruled out (SS3b).
- [x] **0.2.0 - practice focus.** Per-operation switches behind the parent
      PIN, defaulting to addition and subtraction only. Progress preserved
      across a switch, revived without an avalanche, and reported honestly on
      the standards card.
- [ ] **The real iPad.** Everything above is machine-verified and eyeballed in
      an emulator. An emulation is evidence; his actual iPad is proof, and
      that loop is the one still open.

## What the harness found that reading the code did not

- **The keypad kept its own buffer through a bail.** The scaffold blanked the
  answer slot's TEXT but never reset the keypad, so the wrong answer stayed
  buffered and his forced re-entry got silently prepended with it and
  rejected. `probe-loop` caught it; a person would have hit it on the first
  wrong answer of the first session.
- **The app opened on `0 + 0`.** The intro order sorted identity facts first,
  so the very first thing a boy who can derive 11 - 8 would have seen was
  `0 + 0`. Identity facts now sort to the back of their own tier.
- **Text below the 13px floor.** Trick names at 10px and creature levels at
  12px. `legible-check` measured it; both were raised.
- **The breather button fell off a phone.** The trick strip pushed it past the
  right edge at 390px. The strip yields now; the way out never does.

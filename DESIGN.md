# TRICK LINE

**A math fact fluency PWA that honours how one particular boy thinks, while
still driving him toward automaticity.**

Design document and development handbook. Started 2026-08-31.

LIVE at `https://math-practice-3rd.pages.dev`, the production channel (branch
`main`). The ALPHA channel, `https://alpha.math-practice-3rd.pages.dev`, is
the `alpha` branch published as a Cloudflare Pages preview by the same
gauntlet (`./run-gauntlet.sh --branch alpha`); it has its own origin and so
its own storage, and the cloud share code is the bridge between the two.
Repo `~/code/math-practice-3rd`, GitHub `ab-2003/math-practice-3rd`, public.

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

Boxes 1 to 7, intervals 1, 2, 4, 8, 16, 32, 64 days.

**Why seven and not five (alpha).** With the ladder topping out at sixteen
days every mastered fact recycled forever at that interval, and the arithmetic
of a full deck is unforgiving: 363 / 16 is about 23 due a day purely to
MAINTAIN what he owns, more than half of a forty item dose by spring, crowding
out the new facts. Boxes at 32 and 64 days let owned facts drift to long
intervals. The 200-day simulation then found the other edge of that change:
once the whole deck was owned, sessions COLLAPSED to three items and some days
planned nothing, because top-up refused to reach past box 5 and a boy who
owned the deck could never have met his dose again. Top-up may now draw from
any owned box, weakest and closest to due first; it cannot crowd out new
facts, which are gated by the DUE count, never by top-up. Sessions hold at
43 to 47 items through day 200 with all four strands complete.

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

## 7d. Interleaving, fatigue, the cold check, and the floor (alpha)

Four additions from the holistic review (Fable 5.1, 2026-09-01), all in
`core/`, all pinned by tests, none of them visible as anything about speed:

**Interleaving within priority bands.** Facts introduced together share a
dueOn and a box, so the plain sort handed him eight additions in a row and
then eight subtractions: blocked practice, the weaker kind. The queue is now
shuffled WITHIN runs of equal (dueOn, box), seeded by the day, so priority
order is exact, same-operation runs are broken, and a probe can predict the
queue.

**The fatigue detector.** The struggle detector watches wrongness; this one
watches the clock creep. When the median first-digit time of his last eight
correct answers is 1.5x his first eight AND over two seconds, he is tiring
before the misses arrive. It never ends a session by itself: it lowers the bar
at which the ordinary line-break exit is offered (ten items instead of
twenty), and the offer uses the identical sheet and words. A run he calls
after a tired offer is logged `endedEarly · tired`; the stamina log now names
every early ending (struggle, tired, choice, breather).

**The cold check.** The retrieval percentage is measured INSIDE sessions,
where a fact may have appeared minutes earlier: partly priming. Once a week
the first five items of a session are mastered facts he has gone longest
without retrieving, asked unannounced before anything has warmed him up, and
flagged `cold` on the response. The dashboard draws them as their own series,
FROM COLD, beside the headline, and the CSV carries the flag. Requeues can
never land inside the cold zone (REQUEUE_GAP >= COLD_CHECK_ITEMS, pinned).

**The floor.** The 3 second threshold is a hypothesis. The report now states
his personal floor, the median first-digit time on facts he owns, and how
many times it fits under the line, so the day the derived band is starving
can be seen rather than guessed at.

**Tomorrow.** The report runs the real planner one day ahead and says what
is due, what is new, and what is pulled forward, so "what is he working on?"
is answered by what the app will actually do.

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

**MAGNITUDE CAPS (0.13.0, Andy: "so very young children can work out the
early facts without frustration").** Each operation carries an optional
ceiling, no limit by default: addition and multiplication cap the ANSWER,
subtraction and division cap the STARTING number. A capped-out fact leaves
sessions exactly the way a switched-off operation does (due queue, new draw,
top-up, closer, and the speed-run pool), with progress kept; raising or
clearing a cap revives the strand so weeks of overdue facts arrive due
today, not as an avalanche. The stepper starts a sensible cap on the first
press from "no limit" (10 for +/-, 20 for x and /) and returns to no limit
past the top. The standards card says when a cap is narrowing the deck.

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

## 9b. The juice, the agency, and the arcs (0.6.0)

A fresh-eyes review (Fable, 2026-09-01) walked the live app as the child would
and found the core loop calm and true but the REWARDS nearly invisible. Andy
took every recommendation. What landed, and why:

**The line is an EVENT.** Screenshots proved that completing a line, in an app
named Trick Line, produced no feedback: the strip silently reset. Now: the
LINE LANDED banner (fixed ~1s, plays with or without ride animations), the
strip flashes as a unit, and the +5 rides up off the coin chip.

**Coins are visible while they happen.** A chip in the session topbar counts
up on every bank with a bump and a floating +n. It shows wallet plus run, so
it only ever counts UP.

**The unlock is HIS choice.** The old build auto-bought the next monster at
run's end, which broke saving up for the big one. Now a choice sheet: Unlock,
or Keep saving. Home also carries a progress bar toward the next monster.

**Levels are visible.** LEVEL UP used to buy an invisible number, which
teaches a child the economy cheats. Now: deck-sticker star at 2, glowing eyes
at 4, gold horns at 7, an aura at 10, drawn by the same parametric renderer.

**He picks who rides.** SEND OUT on any owned monster; a RIDING badge in the
collection; the home hero is the rider. Agency turns the collection into a
pre-run ritual.

**The vocabulary and the world grow (the spring-semester arcs).** The twelve
monsters cost 6,230 coins total and exhaust by roughly December, so lifetime
LINES LANDED now earns two more arcs: new tricks (720 at 25 lines, DARKSLIDE
at 60, MCTWIST at 110, LASER FLIP at 175; each line is composed from the
unlocked pool with a rotating showcase slot) and skate spots (halfpipe 15,
rooftop 40, sunset bowl 80, mega ramp 140), drawn dim behind the stage so the
equation always owns the contrast.

**The bonus announces itself** (BONUS ROUND, its own sting), **the run tells
its story** (tricks, lines, longest chain, personal bests that only go up,
who was riding), and **the day is visible** (the DROP IN button becomes
ANOTHER RUN? with a done-today pill, serving the one-run-a-day contract).

**The scaffold teaches in sequence**: steps light one at a time, the array
rows skip-count in, and the bridge frame's eleventh cell is attached to the
ten-frame instead of floating as a caption. **The chain is audible**: chime
and landing walk up in pitch through the line, correctness-linked only.

**The victory lap and the minimal screen (0.7.0, Andy's choreography).** His
phone report: the scenery under the answer box was "a little distracting"
during problems. So the contract is now MINIMAL WHILE THINKING: no scenery at
all with a problem up. On a correct answer the dim gray rail fades in and the
rider does that one trick over it on the rail lane, then it vanishes for the
next problem. On the line-completing answer the spot LIGHTS UP in colour and
the rider performs the whole line, all five tricks in one 3.2 second
crossing, each name popping as it lands, the five landing sounds walking up
the scale, LINE LANDED! +5 riding overhead; then back to minimal. The
equation row ghosts during any ride, because on a phone the rider crosses
right where it sits. Scar collected: animationend BUBBLES, so the first
580ms hop was ending the whole 3.2s lap until the handler was made to check
the animation's name; probes now time the lap.

**The open shop and the gear rack (0.8.0, Andy's economy).** The mystery
unlock ladder is gone: all TWENTY monsters (the original twelve, six dragons
in six colours, PUCKJAW the hockey bruiser and BLADEBACK the inline
speedster) are on open display with their prices, and he buys whichever one
he wants in any order. Wanting a specific one and saving for it IS the game;
the end-of-run offer only says the crew has someone in reach and opens the
shop. And THE GEAR RACK: twenty helmets, ten shapes in two colourways, drawn
by one parametric renderer that also dresses the monsters. A helmet is bought
once, lives in the locker, and any owned monster wears any owned helmet from
its card, where the art updates the moment he taps it. The rider wears his
helmet through every solo trick and every victory lap.

**Shop life and shop manners (0.8.1).** The gear rack stands on display but
SHUT until the first monster ("Helmets need heads. Pick your first monster
and the rack opens"), because gear for a crew you do not have is noise on day
one. Every purchase, monster or helmet, runs through an explicit confirm that
names the price, the balance, and what would be left, with Not-yet as the
cancel; probes prove the cancel path moves nothing. And the shop BREATHES:
every monster does a tiny idle on a ~5s cycle, staggered per tile so the crew
never moves in lockstep. Each dragon breathes its own element (ember fire,
ice shards, leaf-spray, void wisps, frost crystals, gold sparkles; the probe
asserts all six breaths differ), and PUCKJAW fires a slap shot, puck and
speed lines and all. Honours prefers-reduced-motion by standing still.

**Character acting (0.8.2, Andy's direction).** The idles stopped being
"little dances." Every act got bigger and in-character: brutes stomp with
squash, raptors leap, serpents cut a real S, titans rear up, horned ones
charge, dragons FLAP. The six dragons are six FORMS now, not palette swaps:
jagged bat wings on the ember, smooth fins and no legs on the serpentine sea
dragon, scalloped leaf wings, swept night-hunter wings, many-pointed crystal
wings, and tall regal wings with a raised head on the gold; the probe asserts
all six wing paths differ. Flames grew ~1.6x and angle 40 degrees down-range.
PUCKJAW takes a full slapper: stick winds up and swings, impact star pops,
puck rockets away; BLADEBACK flashes speed streaks through its leap. And on a
DETAIL CARD the monster performs on a fast loop (act, a beat or two of rest,
act again) so the one being looked at is the one showing off. All of it on
one idle clock, staggered in the shop, still under prefers-reduced-motion.

**Prop acting, the peek, and the SVG tap scar (0.9.0).**

Signature acts joined the repertoire: GRINDJAW gnaws a log until it SNAPS in
half with grind sparks; VOLTMAW crackles under alternating lightning arcs;
MAGMASPYNE stands in a permanent lava pool with bubbles popping on his beat;
GLACIODON leaps while an ice floe sails through under his feet; PUCKJAW's
slapper now ends in a netted GOAL the puck flies into. All on the shared idle
clock, all probe-pinned, all still under prefers-reduced-motion.

**THE PEEK.** Before today's run the shop opens ONCE, for one minute from
the moment it opens; then it closes ("You had your peek...") until the run is
done, with DROP IN as the way forward. After today's run it stays open until
midnight. Wanting back in is supposed to point at practice. ONE VISIT, not
one minute (alpha, Andy 2026-09-02: "let me enter several times before I
did my daily math"): walking out of the shop inside the minute spends the
peek too, on the Back button and on any other road off the screen, and the
minute is a thin warm bar that shrinks, the one clock outside the speed run,
because the shop is not practice and the end of a look should never be a
surprise.

**THE SVG TAP SCAR, a harness lesson that goes in the permanent list.** On
Andy's phone, tapping monster ART did nothing: the tap synthesizer gated on
`instanceof HTMLElement`, and a tap on art lands on an SVG path, which is an
SVGElement. Every art tap died silently. tap-audit never caught it because it
judged hits with its OWN contains() check instead of the production
synthesizer's logic: an instrument that does not share the production code
path vouches for a different app. The gate is `instanceof Element` now, and
probe-loop drives a REAL synthesized touch on monster art every run.

**The daily dose, the histogram, and the cloud (0.10.0, day-one feedback).**

**THE DAILY DOSE.** One run no longer means the day is done (a six-item
breather was lighting the done state, and his son could not tell whether he
had done enough). A day's work is now a parent-set number of answered
problems (default 40, settable 10-80 in the dashboard). Crossing it
mid-session is the day's headline moment: the one fanfare the app owns, a
TODAY'S WORK DONE banner, and then the big starburst stamp on the home
screen for the rest of the day, with the button flipping to EXTRA PRACTICE
and every later session wearing an EXTRA PRACTICE tag. Below the goal, home
shows a quiet "Today's tricks: X / G" bar. The little text pill is retired.
The shop unlock keys off the dose too.

**THE HISTOGRAM.** "How long answers take": first-digit times on correct
answers in five buckets chosen to NEST inside the classification (under
1.5s and 1.5-3s are the retrieved band; 3-5s and 5-8s the derived band;
8s+ the tail), split by problem type (all four operations, standard and
missing-number). The chart explains the mechanic instead of talking past it.

**CLOUD SHARE**, cloned from the proven WO4 pattern: a 100-bit bearer code
(displayed MATH-PRA3-XXXXX-...), no accounts, no PII, one KV entry per code
on math-pra3-cloudshare.beyer-games.workers.dev (worker in cloudshare/, own
hostname on purpose). Parent settings create/connect (type, paste, or scan;
QR carries the CODE, never a URL), copy/share/save-now/load/disconnect/
delete. Every data save schedules a THROTTLED (45s, trailing) fire-and-forget
push; failures and hangs never block the app - the on-device data is the
gold standard and the cloud is a best-effort mirror. cloud-smoke.mjs proves
the real worker at every release (KV is eventually consistent; the smoke
polls rather than judging first answers). GRINDJAW's log now exists only
during his act.

**SPEED RUN (0.12.0): the one bounded exception to the no-pressure law.**
Andy asked for it by name, and its fences are the feature. A separate mode
behind its own small door (a third cell in the stats row, no new vertical
space): how many correct in one minute. During the run there are no rides,
no banners and no scaffolds, just a flash and the next problem; the timer is
a slim quiet bar, never ticking digits; the longer celebration is the
victory lap at the end, wearing TIME! and the score. High scores are kept
PER SETUP (which operations and missing-number modes are on), because a
multiply-and-divide minute is a different sport from a plus minute; a
kid-reachable reset behind a confirm clears them all. One run is allowed
before the day's work; after the dose the parent-set budget applies
(default 10/day, set 1-30 in the dashboard); the attempt is spent at the
START of a run so a bad minute cannot be abandoned for free. And the walls
that keep it safe: speed-run answers never touch the Leitner scheduler, the
response log, the histogram or the teacher evidence, and they earn no
coins, so the game can never out-earn or contaminate the practice.

Laws intact throughout: nothing distinguishes retrieved from derived, all
celebration is fixed-duration, records only rise, and nothing is ever taken
back.

## 9c. The grown-ups screen, riders, and the viewer (0.14.0-alpha)

**Two tabs.** Measured before the rebuild: 5,227px, 4.4 iPad screens, 31
buttons, 12 toggles, 7 steppers, 363 heat cells, with charts and controls
interleaved, and the practising card alone taller than the screen. Now
PROGRESS (the report: headline, from cold, standards, the clock with his
floor and the histogram, tomorrow, the facts as per-operation summary bars
with the grid on request, going the wrong way, stamina) and SETTINGS (the
practice TABLE of four rows by On / Missing # / Cap, the day's dials, the
elapsed ladder as a segmented control, riders, data, cloud). Caps are set
from chips with a fine stepper beside them. Every derivation lives in
`core/report.ts` and takes a Snapshot, which is what makes the viewer
possible. Settings measured 2,539px after; the practice card 700px or under.

**Viewer mode.** A device linked to a share code that has no practice of its
own shows the cloud copy, read-only, with a banner naming whose record it is
and when it was saved, and a Refresh. A device with its own data reaches the
same view through the cloud card's View button, with a way back. Connecting a
code now offers "Just view" before "Load it here": the parent's phone and the
teacher's laptop want to LOOK, not to replace their own data.

**Riders.** One iPad, more than one child. Each profile is its own IndexedDB
database (the first keeps the original name, so an install that predates
profiles needs no migration), with its own coins, monsters, settings and
share code. The registry of riders and the grown-ups' PIN are device-level in
localStorage: a PIN belongs to the parent, not to a child's progress file.
With more than one rider the app asks who is riding at launch, and home
carries a name chip that leads back to the picker.

**The rest of the review, as shipped.** A dose chip in the session topbar
(a count, never a clock); streak stamps at 7, 30 and 100 days; the rider gets
a line of its own on the end sheet (two per monster, day-rotated, no
em-dashes); SVG corner icons in place of emoji; nine new body forms so no two
monsters share a mass; idle acts pause off stage; two seasonal spots (FROST
PARK, Dec-Feb; THE BOARDWALK, Jun-Aug), open to everyone in season; the
build stamp cleared by the screen's bottom padding.

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
definition. It is SIX SUITES in `tools/probe/` (core, settings, juice, shop,
cloud, speed), each its own browser against the same preview, launched in
parallel by the gauntlet, because the single serial probe had reached 913
lines and four minutes. Two lessons from splitting it: a probe that pokes the
live meta or states must SAVE before anything reads the store (`saveNow`), and
a pane that re-fetches on a click must be judged by the old element's
DEPARTURE, not by a snapshot taken mid-fetch.

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

- [ ] **0.14.0-alpha - the holistic review, built.** Everything in SS7d and
      SS9c: the seven-box ladder with top-up from any owned box (the
      simulation's cliff), band interleaving, the fatigue detector, the
      cold check and its series, the floor, tomorrow, the two-tab grown-ups
      screen with the practice table, viewer mode, riders, the dose chip,
      streak stamps, rider voices, SVG icons, nine body forms, off-stage
      pause, seasonal spots, the stamp clearance; `core/report.ts` as the
      one source of every figure; `day.ts` under test; the probe split into
      six parallel suites; the gauntlet's `--branch` channel. Published to
      the alpha channel for Andy to test before any of it reaches main.
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
- [x] **0.13.0 - magnitude caps.** Per-operation ceilings in parent
      settings (answer for + and x, starting number for - and /), no limit
      by default, honoured by every lane of the scheduler and the speed-run
      pool, revived without avalanche when raised, and named on the
      standards card.
- [x] **0.12.0 - speed run.** One minute, as many as you can: per-setup
      high scores, kid-reachable reset behind a confirm, attempts counted on
      screen, one run before the day's work and a parent-set daily budget
      after (default 10), the attempt spent at the start, the victory lap as
      the finale, and hard walls between the game and the practice
      telemetry. Two scars: a screens/speed circular import minified into a
      TDZ crash (broken with a pure day.ts), and the locked screen's Back
      button closing over a later `let` (the probe's step-tagged pageerror
      trace found both).
- [x] **0.11.0 - the whole company acts.** Every remaining monster got a
      true in-character scene: QUARRYBACK's stomp brings boulders down from
      the sky with dust on impact; STORMHIDE grows a thundercloud that rains
      and throws a bolt; NIGHTCOIL vanishes while his trophy relocates in
      plain sight; SKATHORN's deck pops off the frill and flips a full turn;
      TIDEWRECK's wave washes through carrying a drowned mast; RUSTFANG
      shakes nuts loose and a gear rolls for it; EMBERCLAW's charge draws a
      scorch mark in with embers rising; VOIDCREST tears open a rift that
      takes a little light with it. MAGMASPYNE's pool gained standing DEPTH
      (surfacing domes and a blister at rest) and a six-popper rolling boil
      during his act. All fourteen bespoke rigs probe-pinned; transient props
      stand down entirely under reduced motion.
- [x] **0.10.1 - VOIDWYRM, and the fold.** Kallen's commission: the void
      dragon, 21st and last in the shop at 500 coins — starry hide, nebula-
      torn wings (an eighth distinct dragon form), cosmos-stardust breath,
      and his own patch of twinkling space that fades in for his act. Plus
      the home screen tightened so the shop button lives above the fold on
      the iPad, and game-art icons on the DROP IN and MONSTERS slabs.
- [x] **0.10.0 - the daily dose, the histogram, and the cloud.** A real
      configurable day's-work with the badge/jingle/extra-practice system;
      the nested response-time histogram by problem type; WO4-pattern cloud
      share with throttled never-blocking auto-push; the log only during
      GRINDJAW's act.
- [x] **0.9.0 - prop acting, the peek, and the SVG tap fix.** Signature
      prop acts (log snap, lightning, lava pool, sailing floe, goal-bound
      slapper); the once-a-day one-minute pre-run shop peek; and the
      phone-found tap bug (SVG art ate touches) fixed at the synthesizer
      with a real-touch regression probe.
- [x] **0.8.2 - character acting.** Bigger in-character idles, six distinct
      dragon FORMS, down-angled 1.6x flames, PUCKJAW's full stick-and-puck
      slapper, BLADEBACK's speed streaks, and fast-loop performance on the
      detail cards.
- [x] **0.8.1 - shop life and shop manners.** The rack locked until the
      first monster; explicit buy confirms with clean cancels; staggered
      idle animations, six distinct dragon breaths, and PUCKJAW's slap shot.
- [x] **0.8.0 - the open shop and the gear rack.** Twenty monsters on open
      display, bought in any order (no more mysteries, no more auto-ladder);
      six new dragons plus a hockey bruiser and an inline speedster; twenty
      helmets bought once and worn by anyone, on the card, in the shop tile,
      and through every trick.
- [x] **0.7.0 - the victory lap and the minimal screen.** Andy's
      choreography: nothing on screen while he thinks; the dim rail appears
      under each solo trick and vanishes; the line-completing answer lights
      the whole spot and his creature rides all five tricks start to finish
      before the next problem. The equation ghosts during rides after his
      phone screenshot showed the rider crossing through it.
- [x] **0.6.0 - the juice, the agency, and the arcs.** Everything from the
      fresh-eyes review (SS9b): the line banner, the visible coin chip, the
      unlock as a choice plus the home progress bar, visible level
      accessories, SEND OUT, the trick and spot arcs keyed to lifetime lines,
      the bonus round announcing itself, the run story with rising-only
      bests, the done-today button, sequenced scaffolds, and the pitched
      chain.
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
- **The grown-ups screen faded to black on Andy's phone.** The rebuilt
  dashboard's wrapper was `class="dash"`, and `.dash` already belonged to
  BLADEBACK's speed streaks: opacity 0 with a 4.8 second flash. Every
  element-level check passed because children of an opacity-0 parent report
  opacity 1, and the Chromium captures that came out blank were explained
  away as a screenshot artefact, which they were not. A blank picture is
  evidence until proven otherwise. human-eye now measures EFFECTIVE opacity
  through the ancestor chain, and the core probe asserts nothing animates on
  the grown-ups screen.
- **The long boxes emptied the sessions.** Adding boxes at 32 and 64 days
  fixed the maintenance arithmetic and, in the 200-day simulation, produced
  three-item sessions and empty days once the deck was owned, because top-up
  stopped at box 5. No unit test asked that question; the instrument did.

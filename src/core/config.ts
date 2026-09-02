/**
 * EVERY TUNING DIAL IN THE APP, IN ONE FILE.
 *
 * The scheduler will need tuning against a real boy, so nothing here is
 * allowed to be a magic number buried in a branch. Change a value here and
 * the whole system moves; nowhere else holds a copy.
 *
 * The classification thresholds in particular are a HYPOTHESIS, not a
 * measurement. We store the raw millisecond value of every response forever,
 * so history can be re-classified under different thresholds without losing
 * a month of evidence. See classify.ts for why the clock is what it is.
 */

/** Correct, first digit pressed before this, and the fact was RETRIEVED. */
export const RETRIEVED_MAX_MS = 3_000;

/** Correct, first digit pressed before this, and the fact was DERIVED. */
export const DERIVED_MAX_MS = 8_000;

/**
 * Leitner intervals in days, indexed by box 1..7. Index 0 is unused.
 *
 * SEVEN boxes, not five (alpha, 2026-09-01). With the ladder topping out at
 * sixteen days, every mastered fact recycled forever at that interval, and the
 * arithmetic of a full deck is unforgiving: 363 facts / 16 days is about 23
 * due per day purely to MAINTAIN what he already owns. Against a forty item
 * dose that is more than half of every spring session spent re-proving known
 * facts, crowding out the new ones. Boxes at 32 and 64 days let owned facts
 * drift out to long intervals, which drops steady-state maintenance to a
 * handful a day. Standard spaced-repetition practice; the simulation in
 * tools/sim.ts measures the load either way.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 32, 64] as const;

export const MAX_BOX = 7;
export const MIN_BOX = 1;

/**
 * How far a wrong answer knocks a fact back.
 *
 * TUNING NOTE: two boxes is the spec, and it is deliberately steep. The risk
 * is a bad session compounding into a next-day queue big enough to drown a
 * boy who already avoids maths. SESSION_MAX_ITEMS is the safety valve; if the
 * queue still bloats in practice, drop this to 1 before touching anything else.
 */
export const DEMOTE_BOXES_ON_WRONG = 2;

/** Consecutive retrieved responses, on DISTINCT days, to earn the label. */
export const MASTERY_STREAK = 3;

/**
 * PLACEMENT. A fact retrieved fast on its VERY FIRST sighting was never
 * something to teach: it starts at this box instead of climbing from the
 * bottom rung, so known material clears out at the speed he demonstrates it.
 * The Leitner ladder exists to schedule learning; a fact he already owns does
 * not need its bottom rungs. Mastery still takes three distinct days.
 */
export const FIRST_SIGHT_BOX = 4;

/**
 * New facts are only introduced when the due queue is under this. He never
 * drowns: a heavy review day simply has no room for anything new.
 */
export const NEW_FACT_GATE = 12;

/**
 * Ceiling on new facts in one session.
 *
 * Was 4, and Andy caught what that does to a REVIEWER: "I haven't gotten
 * anything bigger than like 3+2." A boy who mostly owns the small facts was
 * weeks away from ever meeting 8+7 at two addition facts a session. Sessions
 * now FILL with new material whenever the due queue is light; the anti-
 * drowning gate above still slams this to zero the moment real review piles
 * up, so the pace of introduction is set by what he demonstrates, not by a
 * drip.
 */
export const NEW_FILL_MAX = 24;

/** Unique facts planned into a session before requeues are added on top. */
export const SESSION_MAX_ITEMS = 48;

/** Absolute ceiling including requeues. The session ends here no matter what. */
export const SESSION_HARD_CAP = 60;

/** A requeued fact reappears this many items later, never immediately. */
export const REQUEUE_GAP = 5;

/** The session always ends on this many items he has already succeeded at. */
export const CLOSER_ITEMS = 3;

/**
 * THE STRUGGLE DETECTOR.
 *
 * If this many of the last STRUGGLE_WINDOW responses were wrong or effortful,
 * the session ends early on its closer. Ending early is a FEATURE and is
 * logged as such: the dashboard must be able to tell "the app protected him"
 * apart from "he walked away". Given a boy who has already rapid-guessed his
 * way out of one standardised test, this matters more than the trick line.
 */
export const STRUGGLE_WINDOW = 6;
export const STRUGGLE_THRESHOLD = 4;

/**
 * A division fact unlocks when its multiplication partner reaches this box.
 *
 * Waiting for full mastery would mean division never unlocks: mastery needs
 * three retrieved responses on distinct days, which at box 4 and 5 intervals
 * is weeks away per fact. Box 3 means "he has been right about this twice,
 * days apart" and that is enough to hang the inverse on.
 */
export const DIVISION_UNLOCK_BOX = 3;

/**
 * Target session length in unique planned items, before requeues.
 *
 * Discovered by simulation rather than assumed: a plain due-plus-new session
 * runs 11 to 25 items, which is a three minute sitting, not the eight to ten
 * minutes the design calls for. The gap is filled by topping up with weak
 * facts, never by loosening the new-fact gate.
 */
export const SESSION_TARGET_ITEMS = 40;

/**
 * How strong a fact may be and still get pulled forward as top-up.
 *
 * Top-up is sorted weakest-box-first, so the shaky facts always fill the slot
 * ahead of the solid ones and the session is front-loaded with the work that
 * matters. The ceiling only decides how far down the tail we are willing to
 * reach when there is not enough weak material to fill a sitting.
 *
 * Simulation said 3 was too tight: once he is doing well most introduced
 * facts sit in boxes 4 and 5, the pool empties, and sessions collapse to
 * twenty items. Allowing the strong ones to pad the TAIL costs a little
 * spacing precision and buys a session that ends in a run of easy wins,
 * which is the shape we wanted anyway.
 *
 * And the whole ladder, not five of its seven rungs (alpha): when the long
 * boxes arrived, a 200-day simulation showed sessions COLLAPSING once the
 * deck was owned, some days planning nothing at all, because the filler
 * refused to reach past box 5 and the anti-crowding boxes had nothing left
 * to crowd. A boy who owns the deck could never have met his forty-item dose
 * again. Top-up may now draw from any owned box, weakest and closest to due
 * first; it cannot crowd out new facts, which are gated by the DUE count,
 * never by top-up.
 */
export const TOPUP_MAX_BOX = MAX_BOX;

// ---------------------------------------------------------------------------
// THE FATIGUE DETECTOR (alpha, 2026-09-01)
//
// The struggle detector watches WRONGNESS. This one watches the clock creep:
// when his recent first-digit times run well above where he started the
// sitting, he is tiring before the misses arrive. It never ends a session by
// itself and never shows on screen as anything about speed; it only lowers
// the bar at which the ordinary line-break exit is offered, so the way out
// appears a few lines earlier and reads as the same friendly offer as always.
// ---------------------------------------------------------------------------

/** Responses compared: the first N correct answers against the last N. */
export const FATIGUE_WINDOW = 8;
/** No verdict before this many real items: a session has to have a baseline. */
export const FATIGUE_MIN_ITEMS = 16;
/** Recent median must be this many times the opening median... */
export const FATIGUE_RATIO = 1.5;
/** ...AND above this floor, so 600ms drifting to 1000ms never counts. */
export const FATIGUE_FLOOR_MS = 2_000;
/** When tired, the celebrated exit is offered from this many items instead. */
export const OFFER_EXIT_WHEN_TIRED_AFTER = 10;

// ---------------------------------------------------------------------------
// THE COLD CHECK (alpha, 2026-09-01)
//
// The retrieval percentage is measured INSIDE sessions, where a fact may have
// been seen minutes earlier: partly priming, not durable memory. Once a week
// the first few items of a session are drawn, unannounced, from facts he has
// mastered, and their latency is logged as a separate series. That is the
// honest number for a teacher: automaticity from cold, not from warm-up.
// Nothing on screen marks these items; they look like any other problem.
// ---------------------------------------------------------------------------

export const COLD_CHECK_DAYS = 7;
export const COLD_CHECK_ITEMS = 5;
/** Below this many mastered facts there is nothing meaningful to check. */
export const COLD_CHECK_MIN_POOL = 3;

/** Streak days that earn a stamp on the run's story. */
export const STREAK_MILESTONES = [7, 30, 100] as const;

// ---------------------------------------------------------------------------
// ATTENTION AND TOLERANCE
//
// A boy who has already rapid-guessed his way out of one standardised test
// does not need a longer session, he needs a session he can see the end of.
// So a session is not a list of forty questions, it is a run of LINES.
// ---------------------------------------------------------------------------

/** Tricks in one line. The line is the unit he actually experiences. */
export const LINE_LENGTH = 5;

/** Coins banked the moment a trick lands. Never taken back. */
export const COIN_PER_TRICK = 1;

/** Bonus for landing a whole line clean. */
export const COIN_PER_LINE = 5;

/** Coins for a correct bonus-round elapsed-time problem. */
export const COIN_PER_BONUS = 3;

/**
 * After this many items he is offered a genuine, celebrated exit at the end
 * of every line. Stopping is his call from here on, and taking it is not
 * logged as quitting. The struggle detector can still end it sooner.
 */
export const OFFER_EXIT_AFTER_ITEMS = 20;

/**
 * Which operations a fresh install practises.
 *
 * Addition and subtraction only, deliberately. He is at the START of third
 * grade and his class has not reached multiplication; VA SOL 2.CE.1 (+/-
 * within 20) is the gap he is actually carrying, and it is the right place to
 * spend the autumn. A grown-up switches the rest on from the settings card
 * when school gets there.
 */
export const DEFAULT_STRANDS = { add: true, sub: true, mul: false, div: false };

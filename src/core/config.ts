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

/** Leitner intervals in days, indexed by box 1..5. Index 0 is unused. */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;

export const MAX_BOX = 5;
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
 * New facts are only introduced when the due queue is under this. He never
 * drowns: a heavy review day simply has no room for anything new.
 */
export const NEW_FACT_GATE = 12;

/** Ceiling on new facts in any one session, even on a completely clear day. */
export const NEW_PER_SESSION = 4;

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
 */
export const TOPUP_MAX_BOX = 5;

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

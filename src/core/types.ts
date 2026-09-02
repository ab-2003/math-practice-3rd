export type FactKind = "add" | "sub" | "mul" | "div";

/** A fact is immutable content. What changes about it lives in FactState. */
export interface Fact {
  readonly id: string;
  readonly kind: FactKind;
  /**
   * The canonical operands. For add and mul, a <= b: the commutative pair is
   * ONE fact with two presentations, not two facts. This halves the deck,
   * which matters for a boy who needs to see progress, and it matches how
   * fact fluency is actually assessed. The UI picks the orientation.
   */
  readonly a: number;
  readonly b: number;
  readonly answer: number;
  /** Introduction order. Lower tiers are introduced first. See facts.ts. */
  readonly tier: number;
  readonly order: number;
  /** Bridge-through-ten: 11-8, 13-5, 8+7. His strategy zone, and the priority. */
  readonly bridge: boolean;
}

export interface FactState {
  introduced: boolean;
  /** 1..5 once introduced. Meaningless before. */
  box: number;
  dueOn: number;
  /** Consecutive retrieved responses on DISTINCT days. */
  masteryStreak: number;
  lastRetrievedDay: number | null;
  mastered: boolean;
  seen: number;
  correct: number;
}

export type ResponseClass = "retrieved" | "derived" | "effortful";

export interface Response {
  factId: string;
  /** Local-day index. See clock.ts. */
  day: number;
  at: number;
  /**
   * Problem painted -> first digit pressed. THE retrieval measurement, and
   * the only one classification is allowed to look at.
   */
  firstKeyMs: number | null;
  /** Problem painted -> submitted. Includes motor time. Diagnostic only. */
  submitMs: number;
  correct: boolean;
  answered: number | null;
  cls: ResponseClass;
  /** How the item was presented: standard, or missing-number. Travels into
   *  the CSV so a specialist can split the two if they ever diverge. */
  format?: "standard" | "missing";
  /**
   * The forced re-entry after a wrong answer. He has just been shown the
   * answer and the scaffold, so this is a typing exercise, not a retrieval
   * event: it never reaches the scheduler and never enters the dashboard's
   * retrieval percentage.
   */
  isRetry: boolean;
}

export type SessionStatus = "active" | "complete" | "endedEarly";

export interface SessionState {
  day: number;
  /** Live queue of fact ids. Requeues are spliced in, so it grows. */
  queue: string[];
  cursor: number;
  responses: Response[];
  closerAdded: boolean;
  status: SessionStatus;
  /** Ids answered correctly this session, for the closer cascade. */
  succeeded: string[];
}

/**
 * WHICH ARITHMETIC IS SWITCHED ON.
 *
 * A parent control, not a kid control. School reaches multiplication when it
 * reaches it, and practising an operation he has not been taught is not
 * practice, it is a boy being asked questions nobody has shown him how to
 * answer. Progress in a switched-off strand is PRESERVED, never reset.
 */
export type Strands = Record<FactKind, boolean>;

/**
 * MAGNITUDE CAPS, a parent control (Andy 2026-09-01): "so very young
 * children can work out the early facts without frustration." null = no
 * limit, the default. Addition and multiplication cap the ANSWER; subtraction
 * and division cap the STARTING number. A capped-out fact leaves sessions the
 * way a switched-off operation does: progress kept, never reset.
 */
export type Caps = Record<FactKind, number | null>;

export type Deck = ReadonlyMap<string, Fact>;
export type States = ReadonlyMap<string, FactState>;

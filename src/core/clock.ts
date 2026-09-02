/**
 * The ONE sanctioned use of the system clock in core/.
 *
 * Everything else in core/ is pure and takes `day` as an argument, so the
 * scheduler can be tested across months without waiting for months. A stored
 * "today" would quietly rot; every load re-reads the clock.
 *
 * The day index is LOCAL, not UTC. "Separate days" is the load-bearing part
 * of the mastery rule and it has to mean what a boy in New York would call
 * separate days, not what a UTC boundary at 8pm would call them.
 */

const MS_PER_DAY = 86_400_000;

/** Days since the epoch, measured in the device's local timezone. */
export const dayIndexOf = (d: Date): number =>
  Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / MS_PER_DAY);

export const today = (): number => dayIndexOf(new Date());

/** A stored timestamp as ISO text, for the export. Formatting, not a clock
 *  read, but it still lives here so the rest of core never touches Date. */
export const isoOf = (ms: number): string => new Date(ms).toISOString();

/** A local day index as a short date ("Sep 1"). The index is local-day
 *  based, so reading it back as a UTC noon lands on the right calendar day. */
export const dayLabel = (day: number): string =>
  new Date(day * MS_PER_DAY + MS_PER_DAY / 2).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" });

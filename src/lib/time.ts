/**
 * Pakistan time helpers. PKT is a fixed UTC+5 (no daylight saving), and every
 * date or time shown in the app is PKT regardless of the server's own timezone.
 */
export const TZ = "Asia/Karachi";
const OFFSET_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;

const fmt = (opts: Intl.DateTimeFormatOptions, locale = "en-GB") =>
  new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });

// Month names written out explicitly: some ICU versions print "Sept" for en-GB.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const partsF = fmt({ day: "numeric", month: "numeric", year: "numeric" });
function dmy(d: Date) {
  const p = Object.fromEntries(partsF.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: Number(p.day), month: MONTHS[Number(p.month) - 1], year: p.year };
}
const weekdayF = fmt({ weekday: "short" });
const weekdayLongF = fmt({ weekday: "long" });
const timeF = fmt({ hour: "numeric", minute: "2-digit", hour12: true }, "en-US");

type D = Date | string | number;
const toDate = (d: D) => (d instanceof Date ? d : new Date(d));

/** "22 Oct 2026" */
export const fmtDate = (d: D) => {
  const x = dmy(toDate(d));
  return `${x.day} ${x.month} ${x.year}`;
};
/** "22 Oct" */
export const fmtDayMonth = (d: D) => {
  const x = dmy(toDate(d));
  return `${x.day} ${x.month}`;
};
/** "Thu" */
export const fmtWeekday = (d: D) => weekdayF.format(toDate(d));
/** "Thursday" */
export const fmtWeekdayLong = (d: D) => weekdayLongF.format(toDate(d));
/** "3:30 PM" */
export const fmtTime = (d: D) => timeF.format(toDate(d)).replace(/ /g, " ");
/** "19 Oct 2026, 2:30 PM PKT" */
export const fmtDateTime = (d: D) => `${fmtDate(d)}, ${fmtTime(d)} PKT`;

/** Calendar date in PKT as YYYY-MM-DD (matches `date` columns). */
export function pktDate(d: D = new Date()): string {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD calendar date formatted as "22 Oct 2026". */
export function fmtCalendar(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  return fmtDate(new Date(`${ymd}T12:00:00+05:00`));
}

/** Parses a <input type="datetime-local"> value, interpreting it as PKT. */
export function parsePktLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const d = new Date(`${value.slice(0, 16)}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formats a Date for <input type="datetime-local"> in PKT. */
export function toPktLocalInput(d: D = new Date()): string {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Whole days elapsed since a moment. */
export function daysSince(d: D, now: Date): number {
  return Math.floor((now.getTime() - toDate(d).getTime()) / DAY_MS);
}

export function hoursSince(d: D, now: Date): number {
  return (now.getTime() - toDate(d).getTime()) / 3600_000;
}

/** Monday of the PKT week containing `ymd`. */
export function weekStart(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

/** "Good morning" / "Good afternoon" / "Good evening" for the PKT hour. */
export function greeting(now: Date): string {
  const h = new Date(now.getTime() + OFFSET_MS).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "45 min", "6.5 hrs", "2.0 days" */
export function humanizeHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

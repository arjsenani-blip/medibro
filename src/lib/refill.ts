import type { LabelFields } from './parseLabel';
import { parseSig } from './sig';

/* How long a prescription lasts and when to refill it. Everything here is an
   estimate from the label, so the app says "about" and lets the person correct it. */

export interface Supply {
  daysSupply: number;
  start: string; // YYYY-MM-DD, the day this fill was picked up
  refillsLeft: number | null; // null = not on the label
  remindDays: number; // remind this many days before running out
  reminders: boolean;
}

export const REMIND_DAYS = 7; // most pharmacies refill once about 3/4 of the supply is used

/** "07/23/26" or "7/23/2026" → "2026-07-23" */
export function parseLabelDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return isoDate(new Date(year, month - 1, day));
}

/** Units per day from the directions ("TAKE 2 TABLETS TWICE DAILY" → 4), or null when it
    can't be worked out, as with "as needed" or puffs from an inhaler. */
export function unitsPerDay(directions: string): number | null {
  const { sig } = parseSig(directions);
  if (!sig) return null;
  // the quantity is counted in these; puffs, drops and sprays aren't what's dispensed
  if (sig.unit && !['tablet', 'capsule', 'ml', 'patch'].includes(sig.unit)) return null;
  const d = directions.toUpperCase();
  const everyDays = /\bEVERY (\d{1,2})(?: \(\w+\))? DAYS?\b/.exec(d);
  const dosesPerDay = everyDays
    ? 1 / Number(everyDays[1])
    : /\bEVERY OTHER DAY\b/.test(d)
      ? 1 / 2
      : (sig.timesPerDay ??
        (sig.everyHours ? Math.floor(24 / sig.everyHours[0]) : null) ??
        (sig.weekly ? 1 / 7 : null) ??
        (sig.morning || sig.bedtime ? 1 : null));
  if (!dosesPerDay || (sig.asNeeded && !sig.timesPerDay)) return null; // "as needed" has no schedule
  return (sig.amount ?? 1) * dosesPerDay;
}

/** Days supply: as printed, or quantity ÷ units per day. */
export function estimateDaysSupply(f: LabelFields): number | null {
  const printed = Number(f.daysSupply);
  if (printed > 0) return printed;
  const qty = Number(f.quantity);
  const perDay = unitsPerDay(f.directions);
  if (!(qty > 0) || !perDay) return null;
  return Math.floor(qty / perDay);
}

/** A new supply from a saved label, or null when the days supply isn't known. */
export function supplyFromLabel(f: LabelFields, today = new Date()): Supply | null {
  const days = estimateDaysSupply(f);
  if (!days) return null;
  const refills = /^\d+$/.test(f.refills) ? Number(f.refills) : null;
  return { daysSupply: days, start: parseLabelDate(f.filled) ?? isoDate(today), refillsLeft: refills, remindDays: Math.min(REMIND_DAYS, Math.floor(days / 3)), reminders: true };
}

export interface SupplyStatus {
  daysLeft: number; // may be negative once it has run out
  runOut: Date;
  refillBy: Date;
  due: boolean; // time to refill
}

export function supplyStatus(s: Supply, today = new Date()): SupplyStatus {
  const start = fromIso(s.start);
  const runOut = addDays(start, s.daysSupply);
  const daysLeft = Math.round((runOut.getTime() - startOfDay(today).getTime()) / 86_400_000);
  return { daysLeft, runOut, refillBy: addDays(runOut, -s.remindDays), due: daysLeft <= s.remindDays };
}

/** After picking up a refill: the count restarts today and one refill is used. */
export function refilled(s: Supply, today = new Date()): Supply {
  return { ...s, start: isoDate(today), refillsLeft: s.refillsLeft == null ? null : Math.max(0, s.refillsLeft - 1) };
}

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

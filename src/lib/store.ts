import { EMPTY_FIELDS, type LabelFields } from './parseLabel';
import { supplyFromLabel, type Supply } from './refill';
import type { Appearance } from './appearance';
import { DEFAULT_ACCENT, hexToRgb } from './theme';
import { title } from './plain';

/* Medicines are saved on this phone only (localStorage). Nothing about a
   person's prescriptions leaves the device. */

export interface Medicine {
  id: string;
  fields: LabelFields;
  raw: string; // text the camera read, kept so the person can compare
  expected: Appearance | null; // confirmed appearance, once looked up
  supply?: Supply | null; // days supply and refills, when known
  savedAt: string;
}

const KEY = 'readrx:medicines:v1';

export function loadMedicines(): Medicine[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Medicine[];
    // medicines saved by older versions lack newer fields; work out their supply once
    return list.map((m) => {
      const fields = { ...EMPTY_FIELDS, ...m.fields };
      return { ...m, fields, supply: m.supply === undefined ? supplyFromLabel(fields) : m.supply };
    });
  } catch {
    return [];
  }
}

export function saveMedicines(list: Medicine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode or full — keep in memory */
  }
}

const PREFS = 'readrx:prefs:v1';
export interface Prefs {
  lang: import('./sig').Lang;
  large: boolean;
  rate: number;
  accent: string; // theme color, #rrggbb
}
const DEFAULT_PREFS: Prefs = { lang: 'en', large: false, rate: 0.9, accent: DEFAULT_ACCENT };
export function loadPrefs(): Prefs {
  try {
    const p = { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) };
    return { ...p, accent: typeof p.accent === 'string' && hexToRgb(p.accent) ? p.accent : DEFAULT_ACCENT };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/* The person's own details, from setup. Also kept on this phone only. Every
   field but the name is optional, so each one can be empty. */

const PROFILE = 'readrx:profile:v1';
export interface Profile {
  name: string;
  pharmacyName: string; // their main pharmacy
  pharmacyPhone: string;
  birthDate: string; // YYYY-MM-DD
  doctorName: string;
  doctorPhone: string;
  allergies: string[];
  setupDone: boolean; // finished (or skipped through) the first-launch setup
}
export const EMPTY_PROFILE: Profile = { name: '', pharmacyName: '', pharmacyPhone: '', birthDate: '', doctorName: '', doctorPhone: '', allergies: [], setupDone: false };

export function loadProfile(): Profile {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE) ?? '{}') as Partial<Record<keyof Profile, unknown>>;
    const str = (k: keyof Profile) => (typeof raw[k] === 'string' ? (raw[k] as string) : '');
    return {
      name: str('name'),
      pharmacyName: str('pharmacyName'),
      pharmacyPhone: str('pharmacyPhone'),
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(str('birthDate')) ? str('birthDate') : '',
      doctorName: str('doctorName'),
      doctorPhone: str('doctorPhone'),
      allergies: Array.isArray(raw.allergies) ? addAllergies([], raw.allergies.filter((a): a is string => typeof a === 'string').join(',')) : [],
      setupDone: raw.setupDone === true,
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** "penicillin, Sulfa drugs" added to a list: split on commas, trimmed, no repeats. */
export function addAllergies(list: string[], text: string): string[] {
  const out = [...list];
  for (const part of text.split(/[,;\n]/)) {
    const a = part.trim().replace(/\s+/g, ' ');
    if (a && !out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a);
  }
  return out;
}

/** A phone number as a tel: link, or null when it has too few digits to dial. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 3 ? `tel:${digits}` : null;
}

/** Who to call about a refill: the pharmacy on this label when it gives a phone
    number, else the person's main pharmacy, else the label's pharmacy name alone. */
export function refillPharmacy(f: LabelFields, profile: Profile): { name: string; phone: string; main: boolean } | null {
  if (f.pharmacyPhone) return { name: f.pharmacy ? title(f.pharmacy) : profile.pharmacyName || 'Your pharmacy', phone: f.pharmacyPhone, main: false };
  if (profile.pharmacyName || profile.pharmacyPhone) return { name: profile.pharmacyName || 'Your pharmacy', phone: profile.pharmacyPhone, main: true };
  if (f.pharmacy) return { name: title(f.pharmacy), phone: '', main: false };
  return null;
}

/* The symptom assistant asks once, before first use, that the person accept
   that it isn't medical advice. Bump the version if the wording changes, so
   everyone is asked again. */
const OTC_CONSENT = 'readrx:otc-consent';
export const OTC_CONSENT_VERSION = 1;
export function hasOtcConsent(): boolean {
  try {
    const c = JSON.parse(localStorage.getItem(OTC_CONSENT) ?? 'null') as { version?: number } | null;
    return c?.version === OTC_CONSENT_VERSION;
  } catch {
    return false;
  }
}
export function acceptOtcConsent(at = new Date()) {
  try {
    localStorage.setItem(OTC_CONSENT, JSON.stringify({ version: OTC_CONSENT_VERSION, at: at.toISOString() }));
  } catch {
    /* ignore: they'll be asked again next time */
  }
}

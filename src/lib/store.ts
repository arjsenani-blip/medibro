import { EMPTY_FIELDS, type LabelFields } from './parseLabel';
import { supplyFromLabel, type Supply } from './refill';
import type { Appearance } from './appearance';

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
}
export function loadPrefs(): Prefs {
  try {
    return { lang: 'en', large: false, rate: 0.9, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) };
  } catch {
    return { lang: 'en', large: false, rate: 0.9 };
  }
}
export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

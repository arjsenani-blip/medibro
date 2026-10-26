import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_FIELDS } from '../src/lib/parseLabel';
import { EMPTY_PROFILE, addAllergies, loadPrefs, loadProfile, refillPharmacy, savePrefs, saveProfile, telHref } from '../src/lib/store';

// a tiny in-memory localStorage for node
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;

beforeEach(() => mem.clear());

describe('profile', () => {
  it('starts empty, with setup not done', () => {
    expect(loadProfile()).toEqual(EMPTY_PROFILE);
  });
  it('saves and loads every field', () => {
    const p = { name: 'Maria', pharmacyName: 'Main St Pharmacy', pharmacyPhone: '(555) 123-4567', birthDate: '1948-03-09', doctorName: 'Dr. Lee', doctorPhone: '555 987 6543', policeName: 'Acton Police', policePhone: '978-555-0100', allergies: ['Penicillin', 'Sulfa'], setupDone: true };
    saveProfile(p);
    expect(loadProfile()).toEqual(p);
  });
  it('fills in fields an older or damaged save lacks', () => {
    mem.set('readrx:profile:v1', JSON.stringify({ name: 'Ana', allergies: ['latex', 3, 'Latex'], birthDate: 'March', setupDone: 'yes' }));
    expect(loadProfile()).toEqual({ ...EMPTY_PROFILE, name: 'Ana', allergies: ['latex'] });
    mem.set('readrx:profile:v1', '{not json');
    expect(loadProfile()).toEqual(EMPTY_PROFILE);
  });
});

describe('prefs', () => {
  it('defaults the theme color to cyan and keeps a saved one', () => {
    expect(loadPrefs().accent).toBe('#22d3ee');
    savePrefs({ ...loadPrefs(), accent: '#8b5cf6', large: true });
    expect(loadPrefs()).toMatchObject({ accent: '#8b5cf6', large: true, lang: 'en' });
  });
  it('drops a theme color that isn’t a color', () => {
    mem.set('readrx:prefs:v1', JSON.stringify({ accent: 'url(evil)', lang: 'es' }));
    expect(loadPrefs()).toMatchObject({ accent: '#22d3ee', lang: 'es' });
  });
});

describe('allergies', () => {
  it('splits, trims and removes repeats', () => {
    expect(addAllergies([], ' penicillin,  sulfa drugs ;latex')).toEqual(['penicillin', 'sulfa drugs', 'latex']);
    expect(addAllergies(['Penicillin'], 'penicillin, , codeine')).toEqual(['Penicillin', 'codeine']);
  });
});

describe('who to call about refills', () => {
  const profile = { ...EMPTY_PROFILE, pharmacyName: 'Corner Drug', pharmacyPhone: '555-0100' };
  it('prefers the pharmacy on the label when it has a phone', () => {
    expect(refillPharmacy({ ...EMPTY_FIELDS, pharmacy: 'CVS PHARMACY', pharmacyPhone: '555-0199' }, profile)).toEqual({ name: 'Cvs Pharmacy', phone: '555-0199', main: false });
  });
  it('falls back to the main pharmacy', () => {
    expect(refillPharmacy({ ...EMPTY_FIELDS, pharmacy: 'CVS PHARMACY' }, profile)).toEqual({ name: 'Corner Drug', phone: '555-0100', main: true });
    expect(refillPharmacy({ ...EMPTY_FIELDS, pharmacy: 'CVS PHARMACY' }, EMPTY_PROFILE)).toMatchObject({ phone: '', main: false });
    expect(refillPharmacy(EMPTY_FIELDS, EMPTY_PROFILE)).toBeNull();
  });
  it('makes dialable links', () => {
    expect(telHref('(555) 123-4567')).toBe('tel:5551234567');
    expect(telHref('+1 555 123 4567')).toBe('tel:+15551234567');
    expect(telHref('n/a')).toBeNull();
  });
});

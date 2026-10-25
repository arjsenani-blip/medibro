import { describe, expect, it } from 'vitest';
import { EMPTY_FIELDS, parseLabel } from '../src/lib/parseLabel';
import { titleAddress } from '../src/lib/plain';
import { estimateDaysSupply, parseLabelDate, refilled, supplyFromLabel, supplyStatus, unitsPerDay } from '../src/lib/refill';

const fields = (o: Partial<typeof EMPTY_FIELDS>) => ({ ...EMPTY_FIELDS, ...o });

describe('days supply', () => {
  it('works out units per day from the directions', () => {
    expect(unitsPerDay('TAKE 1 TABLET BY MOUTH ONCE DAILY')).toBe(1);
    expect(unitsPerDay('TAKE 2 TABLETS BY MOUTH TWICE DAILY')).toBe(4);
    expect(unitsPerDay('TAKE 1 CAPSULE BY MOUTH EVERY 8 HOURS')).toBe(3);
    expect(unitsPerDay('TAKE 1 TABLET BY MOUTH ONCE WEEKLY')).toBeCloseTo(1 / 7);
    expect(unitsPerDay('TAKE ONE (1) CAPSULE (50,000 UNITS) EVERY 14 (FOURTEEN) DAYS')).toBeCloseTo(1 / 14);
    expect(unitsPerDay('TAKE 1/2 TABLET BY MOUTH EVERY MORNING')).toBe(0.5);
  });
  it('gives up when the label has no schedule to count from', () => {
    expect(unitsPerDay('TAKE 1 TABLET BY MOUTH EVERY 6 HOURS AS NEEDED FOR PAIN')).toBeNull();
    expect(unitsPerDay('INHALE 2 PUFFS BY MOUTH TWICE DAILY')).toBeNull();
    expect(unitsPerDay('')).toBeNull();
  });
  it('prefers the days supply printed on the label', () => {
    expect(estimateDaysSupply(fields({ quantity: '90', directions: 'TAKE 1 TABLET BY MOUTH DAILY' }))).toBe(90);
    expect(estimateDaysSupply(fields({ quantity: '6', directions: 'TAKE ONE CAPSULE BY MOUTH EVERY 14 DAYS' }))).toBe(84);
    expect(estimateDaysSupply(fields({ quantity: '90', daysSupply: '45', directions: 'TAKE 1 TABLET BY MOUTH DAILY' }))).toBe(45);
    expect(parseLabel('LISINOPRIL 10MG TABLET\nQTY: 30 DAYS SUPPLY: 30').fields.daysSupply).toBe('30');
  });
  it('reads label dates', () => {
    expect(parseLabelDate('07/23/26')).toBe('2026-07-23');
    expect(parseLabelDate('9/5/2026')).toBe('2026-09-05');
    expect(parseLabelDate('13/40/26')).toBeNull();
  });
});

describe('refill tracking', () => {
  const today = new Date(2026, 9, 13); // Oct 13 2026
  it('counts the days left and says when to refill', () => {
    const s = supplyFromLabel(fields({ quantity: '30', refills: '2', filled: '10/01/26', directions: 'TAKE 1 TABLET BY MOUTH DAILY' }), today)!;
    expect(s).toMatchObject({ daysSupply: 30, start: '2026-10-01', refillsLeft: 2, remindDays: 7 });
    const st = supplyStatus(s, today);
    expect(st.daysLeft).toBe(18);
    expect(st.runOut).toEqual(new Date(2026, 9, 31));
    expect(st.refillBy).toEqual(new Date(2026, 9, 24));
    expect(st.due).toBe(false);
    expect(supplyStatus(s, new Date(2026, 9, 25)).due).toBe(true);
  });
  it('restarts the count and uses a refill when one is picked up', () => {
    const s = supplyFromLabel(fields({ quantity: '30', refills: '1', directions: 'TAKE 1 TABLET BY MOUTH DAILY' }), today)!;
    const later = new Date(2026, 10, 10);
    const r = refilled(s, later);
    expect(r).toMatchObject({ start: '2026-11-10', refillsLeft: 0 });
    expect(supplyStatus(r, later).daysLeft).toBe(30);
    expect(refilled(r, later).refillsLeft).toBe(0);
  });
  it('keeps the reminder inside short supplies', () => {
    expect(supplyFromLabel(fields({ quantity: '10', directions: 'TAKE 1 CAPSULE BY MOUTH DAILY' }), today)!.remindDays).toBe(3);
  });
});

describe('pharmacy address', () => {
  it('reads the street, city, state and ZIP', () => {
    expect(parseLabel('CVS pharmacy #01234\n123 MAIN ST BOSTON MA 02110 (617) 555-0199').fields.pharmacyAddress).toBe('123 MAIN ST, BOSTON, MA 02110');
    expect(parseLabel('ACTON PHARMACY\n563 MASSACHUSETTS AVE.\nACTON, MA 01720').fields.pharmacyAddress).toBe('563 MASSACHUSETTS AVE, ACTON, MA 01720');
    expect(parseLabel('MAIN STREET PHARMACY\n12 MAIN ST ACTON MA (978) 555-0142').fields.pharmacyAddress).toBe('12 MAIN ST, ACTON, MA');
  });
  it('doesn’t mistake other numbers for an address', () => {
    expect(parseLabel('Rx# 4829173 JOHN Q SMITH DR. MEI CHEN\nQTY: 30 REFILLS: 2\nTAKE 1 TABLET BY MOUTH DAILY').fields.pharmacyAddress).toBe('');
  });
});

it('formats an address for reading', () => {
  expect(titleAddress('563 MASSACHUSETTS AVE, ACTON, MA 01720')).toBe('563 Massachusetts Ave, Acton, MA 01720');
  expect(titleAddress('12 MAIN ST, ACTON, MA')).toBe('12 Main St, Acton, MA');
});

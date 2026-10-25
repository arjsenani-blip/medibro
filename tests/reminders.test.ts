import { describe, expect, it } from 'vitest';
import { EMPTY_FIELDS } from '../src/lib/parseLabel';
import { remindersFor } from '../src/lib/reminders';
import type { Medicine } from '../src/lib/store';

const med = (refillsLeft: number | null): Medicine => ({
  id: 'abc',
  fields: { ...EMPTY_FIELDS, drug: 'LISINOPRIL', strength: '10 mg', pharmacy: 'MAIN STREET PHARMACY' },
  raw: '',
  expected: null,
  savedAt: '',
  supply: { daysSupply: 30, start: '2026-10-01', refillsLeft, remindDays: 7, reminders: true },
});

describe('refill reminders', () => {
  it('reminds a week before running out and the day before, at 9 am', () => {
    const [due, last] = remindersFor(med(2), new Date(2026, 9, 13));
    expect(due.title).toBe('Time to refill Lisinopril 10 mg');
    expect(due.body).toBe('About 7 days left. Ask Main Street Pharmacy for a refill (2 left).');
    expect(due.schedule.at).toEqual(new Date(2026, 9, 24, 9));
    expect(last.title).toBe('Lisinopril 10 mg runs out tomorrow');
    expect(last.schedule.at).toEqual(new Date(2026, 9, 30, 9));
    expect(due.id).not.toBe(last.id);
    expect(due.extra).toEqual({ medId: 'abc' });
  });
  it('says to go through the pharmacy when no refills are left', () => {
    expect(remindersFor(med(0), new Date(2026, 9, 13))[0].body).toContain('No refills left. Call Main Street Pharmacy: they can ask your prescriber for a new prescription.');
  });
  it('skips reminders whose time has passed', () => {
    expect(remindersFor(med(1), new Date(2026, 9, 26))).toHaveLength(1);
    expect(remindersFor(med(1), new Date(2026, 10, 5))).toHaveLength(0);
  });
});

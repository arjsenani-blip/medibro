import { describe, expect, it } from 'vitest';
import { parseLabel, SAMPLE_LABEL } from '../src/lib/parseLabel';
import { findWarnings } from '../src/lib/warnings';
import { appearanceFromDescription, appearancesFromLabel, compareColor, compareShape } from '../src/lib/appearance';
import { ndcForms } from '../src/lib/fda';

describe('parseLabel', () => {
  it('reads the sample label', () => {
    const { fields: f, sig, warnings } = parseLabel(SAMPLE_LABEL);
    expect(f.drug).toBe('LISINOPRIL');
    expect(f.strength).toBe('10 mg');
    expect(f.form).toBe('tablet');
    expect(f.directions).toBe('TAKE 1 TABLET BY MOUTH ONCE DAILY FOR BLOOD PRESSURE');
    expect([f.rxNumber, f.quantity, f.refills, f.filled]).toEqual(['6024817', '30', '2', '09/28/2026']);
    expect(f.pharmacyPhone).toBe('(978) 555-0142');
    expect(f.pharmacy).toContain('MAIN STREET PHARMACY');
    expect(f.prescriber).toBe('A PATEL');
    expect(f.appearance).toBe('PINK ROUND TABLET IMPRINT RX 10');
    expect(sig.unknown).toEqual([]);
    expect(warnings.sort()).toEqual(['alcohol', 'dizzy']);
  });
  it('copes with typical OCR noise and a two-line direction', () => {
    const noisy = `ACME DRUG CO 555-123-4567\nRx #: 88213409   Filled 1/4/26\nAMOXICILLIN 500 MG CAPSULES\nTAKE 1 CAPSULE BY M0UTH 3 TIMES\nDAILY FOR 10 DAYS\nQty 30  Refills: NONE\nFINISH ALL THIS MEDICATION`;
    const { fields: f, sig, warnings } = parseLabel(noisy);
    expect(f.drug).toBe('AMOXICILLIN');
    expect(f.strength).toBe('500 mg');
    expect(f.directions).toBe('TAKE 1 CAPSULE BY MOUTH 3 TIMES DAILY FOR 10 DAYS');
    expect(sig.sig?.timesPerDay).toBe(3);
    expect(f.refills).toBe('0');
    expect(warnings).toContain('finish');
  });
  it('does not repeat "with food" as a separate warning when the directions say it', () => {
    expect(parseLabel('IBUPROFEN 600MG TABLET\nTAKE 1 TABLET BY MOUTH 3 TIMES DAILY WITH FOOD').warnings).not.toContain('food');
    expect(findWarnings('TAKE WITH FOOD OR MILK')).toEqual(['food']);
  });
});

describe('appearance', () => {
  it('reads a pharmacy description line', () => {
    const a = appearanceFromDescription('PINK ROUND TABLET IMPRINT RX 10')!;
    expect(a.colors).toEqual(['pink']);
    expect(a.shape).toBe('round');
    expect(a.imprint).toBe('RX 10');
  });
  it('reads FDA "how supplied" text and keeps only the right strength', () => {
    const fda = `Lisinopril Tablets USP, 5 mg are white, round tablets debossed with "L" on one side and "5" on the other side. ` +
      `Lisinopril Tablets USP, 10 mg are pink, round, biconvex tablets debossed with "L" on one side and "10" on the other side, supplied in bottles of 30. ` +
      `Lisinopril Tablets USP, 20 mg are peach, round tablets debossed with "L 20".`;
    const list = appearancesFromLabel(fda, '10 mg');
    expect(list.length).toBe(1);
    expect(list[0].colors).toEqual(['pink']);
    expect(list[0].shape).toBe('round');
    expect(list[0].imprint).toBe('L 10');
  });
  it('compares leniently where photos are unreliable, strictly where they are not', () => {
    expect(compareColor('pink', ['pink'])).toBe('match');
    expect(compareColor('yellow', ['white'])).toBe('close'); // warm light
    expect(compareColor('blue', ['white'])).toBe('mismatch');
    expect(compareShape('oval', ['oblong'][0] as 'oblong')).toBe('close');
    expect(compareShape('round', 'capsule')).toBe('mismatch');
  });
  it('expands an 11-digit NDC into the dashed forms it could be', () => {
    expect(ndcForms('68180-0513-01')).toEqual(['68180-0513-01']);
    expect(ndcForms('00093715001')).toContain('00093-7150-01');
  });
});

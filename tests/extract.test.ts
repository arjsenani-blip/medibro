import { describe, expect, it } from 'vitest';
import { mergeFields } from '../src/lib/extract';
import { parseLabel } from '../src/lib/parseLabel';

// Two-column label as Apple Vision lays it out: the directions are split by the fill
// date, which the built-in rules can't follow.
const LABEL = `CVS pharmacy #01234  (617) 555-0199
123 MAIN ST BOSTON MA 02110
Rx# 4829173  JOHN Q SMITH
TAKE ONE TABLET BY MOUTH  Filled: 09/15/2026
EVERY DAY AT BEDTIME
ATORVASTATIN  20 MG TABLET
QTY: 90  REFILLS: 3
DR. MEI CHEN  MFG: ACCORD
DESC: WHITE OVAL TABLET IMPRINT H 20`;

const MODEL = {
  drug: 'ATORVASTATIN', strength: '20 MG', form: 'TABLET', directions: 'TAKE ONE TABLET BY MOUTH EVERY DAY AT BEDTIME',
  rxNumber: '4829173', quantity: '90', refills: '3', filled: '09/15/2026', prescriber: 'DR. MEI CHEN',
  pharmacy: 'CVS pharmacy #01234', pharmacyPhone: '(617) 555-0199', ndc: '', manufacturer: 'ACCORD',
  appearance: 'WHITE OVAL TABLET IMPRINT H 20',
};

describe('mergeFields', () => {
  it('uses the model’s fields when the label text backs them up', () => {
    const rules = parseLabel(LABEL).fields;
    expect(rules.directions).toBe('TAKE ONE TABLET BY MOUTH FILLED: 09/15/2026 EVERY DAY AT BEDTIME'); // what the rules alone get wrong
    const f = mergeFields(rules, MODEL, LABEL);
    expect([f.drug, f.strength, f.form]).toEqual(['ATORVASTATIN', '20 mg', 'tablet']);
    expect(f.directions).toBe('TAKE ONE TABLET BY MOUTH EVERY DAY AT BEDTIME');
    expect([f.prescriber, f.refills, f.quantity, f.rxNumber]).toEqual(['MEI CHEN', '3', '90', '4829173']);
    expect(f.appearance).toBe('WHITE OVAL TABLET IMPRINT H 20');
  });
  it('drops anything the model made up and keeps the rules’ value', () => {
    const rules = parseLabel(LABEL).fields;
    const f = mergeFields(rules, { ...MODEL, drug: 'SIMVASTATIN', strength: '40 MG', directions: 'TAKE ONE TABLET BY MOUTH TWICE DAILY', ndc: '0000-0000-00' }, LABEL);
    expect(f.drug).toBe(rules.drug);
    expect(f.strength).toBe(rules.strength);
    expect(f.directions).toBe(rules.directions);
    expect(f.ndc).toBe(rules.ndc);
  });
  it('lets the model fix a one-letter OCR slip but not change a number', () => {
    const text = 'LISINOPR1L 10 MG TABLET\nTAKE 1 TABLET BY MOUTH DAILY';
    const rules = parseLabel(text).fields;
    expect(mergeFields(rules, { drug: 'LISINOPRIL' }, text).drug).toBe('LISINOPRIL');
    expect(mergeFields(rules, { strength: '40 MG' }, text).strength).toBe(rules.strength);
  });
  it('tidies the model’s answer into the rules’ format', () => {
    const text = 'METFORMIN HCL 500MG TABLETS\nTAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS\nNO REFILLS';
    const f = mergeFields(parseLabel(text).fields, { drug: 'METFORMIN HCL 500MG TABLETS', strength: '500MG', refills: 'NONE' }, text);
    expect([f.drug, f.strength]).toEqual(['METFORMIN HCL', '500 mg']);
    expect(f.refills).toBe('0');
  });
  it('rejects label words that landed in the wrong field', () => {
    const box = 'ONDANSETRON\nORALLY DISINTEGRATING TABLETS USP\n4 mg\nEach orally disintegrating tablet contains 4 mg ondansetron\nUsual Dosage: See package insert\n10 Tablets';
    const rules = parseLabel(box).fields;
    const f = mergeFields(rules, { directions: 'See package insert', appearance: 'Each orally disintegrating tablet contains 4 mg ondansetron', form: 'TABLET' }, box);
    expect([f.directions, f.appearance, f.form]).toEqual(['', '', 'orally disintegrating tablet']);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stitchTexts } from '../src/lib/stitch';
import { parseLabel } from '../src/lib/parseLabel';
import { parseSig } from '../src/lib/sig';

describe('stitchTexts', () => {
  it('joins a label read in three overlapping photos around a bottle', () => {
    const photos = [
      'CVS pharmacy #0123\nRx# 4829173 JOHN\nTAKE ONE TABLET BY MO\nATORVASTATIN 20',
      'pharmacy #0123 (617) 555-0199\nRx# 4829173 JOHN Q SMITH\nTABLET BY MOUTH EVERY DAY\nATORVASTATIN 20 MG TABLET\nQTY: 90 REFILLS: 3',
      'Q SMITH Filled: 09/15/2026\nEVERY DAY AT BEDTIME\nMG TABLET\nREFILLS: 3 DR. MEI CHEN',
    ];
    const text = stitchTexts(photos);
    expect(text.split('\n')).toEqual([
      'CVS pharmacy #0123 (617) 555-0199',
      'Rx# 4829173 JOHN Q SMITH Filled: 09/15/2026',
      'TAKE ONE TABLET BY MOUTH EVERY DAY AT BEDTIME',
      'ATORVASTATIN 20 MG TABLET',
      'QTY: 90 REFILLS: 3 DR. MEI CHEN',
    ]);
    const f = parseLabel(text).fields;
    expect([f.drug, f.strength, f.directions]).toEqual(['ATORVASTATIN', '20 mg', 'TAKE ONE TABLET BY MOUTH EVERY DAY AT BEDTIME']);
  });
  it('stitches what Apple Vision read from three photos around a curved bottle', () => {
    // fixtures: a label rendered onto a cylinder and viewed from three angles, read by native/ios/LabelReader.swift
    const photos = [1, 2, 3].map((i) => readFileSync(new URL(`./fixtures/bottle-photo${i}.txt`, import.meta.url), 'utf8'));
    expect(stitchTexts(photos).split('\n')).toEqual([
      'CVS pharmacy #01234 123 MAIN ST BOSTON MA 02110 (617) 555-0199',
      'Rx# 4829173 JOHN Q SMITH Filled: 09/15/2026 DR. MEI CHEN',
      'TAKE ONE TABLET BY MOUTH EVERY DAY AT BEDTIME FOR CHOLESTEROL',
      'ATORVASTATIN 20 MG TABLET QTY: 90 REFILLS: 3 BEFORE 09/15/2027',
      'MFG: ACCORD DESC: WHITE OVAL TABLET IMPRINT H 20',
    ]);
  });
  it('keeps repeated lines once and doesn’t join lines that merely share a word', () => {
    const text = stitchTexts(['TAKE 1 TABLET DAILY\nQTY: 30', 'TAKE 1 TABLET DAILY\nREFILLS: 2']);
    expect(text.split('\n').sort()).toEqual(['QTY: 30', 'REFILLS: 2', 'TAKE 1 TABLET DAILY']);
    expect(stitchTexts(['TAKE 1 TABLET BY MOUTH DAILY', 'DAILY FOR BLOOD PRESSURE']).split('\n')).toHaveLength(2);
  });
  it('only removes repeats on a box, and reads the medicine from the box front', () => {
    const sticker = 'WALGREENS #5521 (508) 555-0110\nRX 0712345 DR. R GOMEZ\nONDANSETRON ODT 4MG TAB\nDISSOLVE 1 TABLET ON TONGUE EVERY 8 HRS AS NEEDED FOR NAUSEA OR VOMITING\nQTY: 10 REFILLS: 1';
    const front = 'NDC 68462-157-13\nONDANSETRON\nORALLY DISINTEGRATING TABLETS USP\n4 mg\nRx only\n10 Tablets';
    const side = 'Each orally disintegrating tablet contains 4 mg ondansetron\nUsual Dosage: See package insert\nNDC 68462-157-13';
    const text = stitchTexts([sticker, front, side], false);
    expect(text.match(/NDC 68462-157-13/g)).toHaveLength(1);
    const f = parseLabel(text).fields;
    expect([f.drug, f.strength, f.form]).toEqual(['ONDANSETRON ODT', '4 mg', 'orally disintegrating tablet']);
    expect(parseSig(f.directions).unknown).toEqual([]);
    // the box front alone, without the pharmacy sticker
    const box = parseLabel(`${front}\n${side}`).fields;
    expect([box.drug, box.strength, box.form]).toEqual(['ONDANSETRON', '4 mg', 'orally disintegrating tablet']);
  });
});

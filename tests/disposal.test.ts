import { describe, expect, it } from 'vitest';
import { DEA_LOCATOR, FLUSH_LIST, disposalActions, isDisposalQuestion, onFlushList, savedMentioned, spokenDisposal, yesNo } from '../src/lib/disposal';
import { RX_NAMES, answer, answerText } from '../src/lib/otc/assistant';
import { SYMPTOMS } from '../src/lib/otc/symptoms';

const none = { allergies: [], medicines: [] };
const profile = { policePhone: '', policeName: '', pharmacyPhone: '', pharmacyName: '' };

describe('disposal questions', () => {
  it.each(['how do I get rid of old pills', 'throw away expired medicine', 'dispose of my medications', 'what do I do with leftover painkillers', 'drug take back', 'Is there a take-back day?', 'where can I drop off unused prescriptions', 'cómo tirar medicinas vencidas', 'desechar medicamentos viejos'])('“%s” is a disposal question', (q) => {
    expect(isDisposalQuestion(q)).toBe(true);
    expect(answer(q, none).kind).toBe('dispose');
  });
  it.each(['I have a headache', 'runny nose', 'old cough that won’t go away', 'heartburn after dinner', 'can I take this medicine for a fever', 'I can’t sleep', ...SYMPTOMS.flatMap((s) => s.words)])('“%s” is not', (q) => {
    expect(isDisposalQuestion(q)).toBe(false);
  });
  it('lets a red flag win', () => {
    expect(answer('my child swallowed my old pills, how do I get rid of them', none).kind).toBe('emergency');
    expect(answer('I took too many pills, throw away the rest?', none).kind).toBe('emergency');
  });
  it('names no medicine in the general steps', () => {
    const text = answerText(answer('how do I dispose of old pills', none)).join(' ').toLowerCase();
    for (const rx of RX_NAMES) expect(text, rx).not.toMatch(new RegExp(`\\b${rx}\\b`));
    expect(text).toMatch(/take-back/);
    expect(text).toMatch(/coffee grounds/);
    expect(text).toMatch(/sharps container/);
    expect(text).toMatch(/your local rules may differ/);
  });
});

describe('flush list', () => {
  it('knows the FDA flush list', () => {
    for (const n of ['fentanyl', 'oxycodone', 'hydrocodone', 'morphine', 'buprenorphine', 'methadone']) expect(onFlushList(n), n).toBe(true);
    expect(onFlushList('LISINOPRIL 10MG')).toBe(false);
    expect(onFlushList('Percocet 5/325')).toBe(true);
    expect(FLUSH_LIST.length).toBeGreaterThanOrEqual(14);
  });
  it('looks up saved medicines the person names', () => {
    const saved = [
      { name: 'Oxycodone 5 mg', text: 'OXYCODONE HCL 5MG TAKE 1 TABLET EVERY 6 HOURS' },
      { name: 'Lisinopril 10 mg', text: 'LISINOPRIL 10MG' },
    ];
    expect(savedMentioned('how do I get rid of my old oxycodone', saved)).toEqual([{ name: 'Oxycodone 5 mg', flush: true }]);
    expect(savedMentioned('throw away expired lisinopril pills', saved)).toEqual([{ name: 'Lisinopril 10 mg', flush: false }]);
    expect(savedMentioned('dispose of old pills', saved)).toEqual([]);
    const a = answer('get rid of my old lisinopril', { allergies: [], medicines: saved.map((s) => s.text), names: saved.map((s) => s.name) });
    expect(a).toEqual({ kind: 'dispose', saved: [{ name: 'Lisinopril 10 mg', flush: false }] });
    expect(spokenDisposal([{ name: 'Lisinopril 10 mg', flush: false }]).join(' ')).toMatch(/Lisinopril 10 mg is not on the flush list/);
  });
});

describe('calls', () => {
  it('never dials 911', () => {
    const tries = ['911', '9-1-1', '1 911', '', 'n/a', '978-555-0100'];
    for (const police of tries)
      for (const pharmacy of tries)
        for (const native of [true, false])
          for (const a of disposalActions({ ...profile, policePhone: police, pharmacyPhone: pharmacy }, native)) expect(a.href.replace(/\D/g, ''), `${police}/${pharmacy}`).not.toMatch(/^1?911$/);
  });
  it('calls the saved police station', () => {
    const a = disposalActions({ ...profile, policePhone: '(978) 555-0100', policeName: 'Acton Police' });
    expect(a[0]).toEqual({ id: 'police', label: 'Call police station', href: 'tel:9785550100' });
  });
  it('offers a Maps search without a saved number', () => {
    expect(disposalActions(profile, true)[0]).toMatchObject({ id: 'find-police', href: 'maps://?q=police%20station' });
    expect(disposalActions(profile, false)[0]).toMatchObject({ id: 'find-police', href: 'https://maps.apple.com/?q=police%20station' });
  });
  it('adds the pharmacy when saved, and always the DEA locator', () => {
    expect(disposalActions(profile).map((a) => a.id)).toEqual(['find-police', 'takeback']);
    const ids = disposalActions({ ...profile, pharmacyPhone: '555-0100' }).map((a) => a.id);
    expect(ids).toEqual(['find-police', 'pharmacy', 'takeback']);
    expect(disposalActions(profile).at(-1)!.href).toBe(DEA_LOCATOR);
  });
  it('asks whether to call, and understands the reply', () => {
    expect(spokenDisposal([]).at(-1)).toBe('Do you want to call your police station?');
    for (const y of ['yes', 'Yes please', 'yeah call them', 'sure', 'okay', 'sí']) expect(yesNo(y), y).toBe('yes');
    for (const n of ['no', 'no thanks', 'not now', 'nope', 'don’t call']) expect(yesNo(n), n).toBe('no');
    expect(yesNo('what is a take back day')).toBeNull();
  });
});

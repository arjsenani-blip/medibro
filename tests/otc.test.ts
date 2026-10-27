import { beforeEach, describe, expect, it } from 'vitest';
import { INGREDIENTS, byId } from '../src/lib/otc/otc-data';
import { SYMPTOMS } from '../src/lib/otc/symptoms';
import { RED_FLAGS, RX_NAMES, ageFrom, allergyFor, answer, answerText, matchRedFlags, matchSymptoms, spokenAnswer, type Answer, type Context } from '../src/lib/otc/assistant';
import { acceptOtcConsent, hasOtcConsent } from '../src/lib/store';

const none: Context = { allergies: [], medicines: [] };
const ids = (a: Answer) => (a.kind === 'suggest' ? a.suggestions.map((s) => s.ingredient.id) : []);

describe('the knowledge base is OTC only', () => {
  it('marks every ingredient OTC', () => {
    for (const i of INGREDIENTS) expect(i.otc, i.id).toBe(true);
  });
  it('only points symptoms at ingredients that exist', () => {
    for (const s of SYMPTOMS) for (const id of s.ingredients) expect(INGREDIENTS.some((i) => i.id === id), `${s.id} → ${id}`).toBe(true);
  });
  it('contains no prescription-only names', () => {
    const all = JSON.stringify([INGREDIENTS, SYMPTOMS]).toLowerCase();
    for (const rx of RX_NAMES) expect(all, rx).not.toMatch(new RegExp(`\\b${rx}\\b`));
  });
  it('never prints a dose: every number is a time, count, age or temperature', () => {
    const all = JSON.stringify([INGREDIENTS, SYMPTOMS]);
    expect(all).not.toMatch(/\b\d+\s?(mg|mcg|ml|milligrams?|tablets? every|capsules?)\b/i);
  });
  it('covers every symptom asked for', () => {
    const want = ['headache', 'aches', 'fever', 'congestion', 'allergies', 'cough', 'sore-throat', 'heartburn', 'diarrhea', 'constipation', 'nausea', 'itching', 'rash', 'bites', 'burns', 'sleep', 'gas', 'dry-eyes'];
    expect(SYMPTOMS.map((s) => s.id)).toEqual(expect.arrayContaining(want));
  });
});

describe('symptom matching', () => {
  it.each([
    ['I have a bad headache', 'headache'],
    ['my back hurts, back pain', 'aches'],
    ['running a fever', 'fever'],
    ['stuffy nose from a cold', 'congestion'],
    ['sneezing and a runny nose', 'allergies'],
    ['dry cough at night', 'cough'],
    ['my throat hurts', 'sore-throat'],
    ['heartburn after dinner', 'heartburn'],
    ['I have diarrhea', 'diarrhea'],
    ['I’m constipated', 'constipation'],
    ['I get car sick', 'nausea'],
    ['itchy skin', 'itching'],
    ['poison ivy rash', 'rash'],
    ['mosquito bites', 'bites'],
    ['I got a sunburn', 'burns'],
    ['I can’t sleep', 'sleep'],
    ['so bloated and gassy', 'gas'],
    ['my eyes are dry', 'dry-eyes'],
  ])('“%s” → %s', (q, id) => {
    expect(matchSymptoms(q).map((s) => s.id)).toContain(id);
  });
  it('understands sentences with punctuation, as speech recognition writes them', () => {
    expect(matchSymptoms('Hey MediBro, I heard that vitamin D is like good for constipation. What do you think of that?').map((s) => s.id)).toEqual(['constipation']);
    expect(matchSymptoms('I have a headache.').map((s) => s.id)).toEqual(['headache']);
    expect(matchSymptoms('My throat hurts!').map((s) => s.id)).toEqual(['sore-throat']);
  });
  it('suggests matching OTC ingredients', () => {
    expect(ids(answer('headache', none))).toEqual(['acetaminophen', 'ibuprofen', 'naproxen', 'aspirin']);
    expect(ids(answer('heartburn', none))).toContain('famotidine');
  });
  it('answers nothing for words it doesn’t know', () => {
    expect(answer('what is the weather', none).kind).toBe('none');
    expect(answer('   ', none).kind).toBe('none');
  });
});

describe('red flags skip suggestions', () => {
  const cases: [string, string][] = [
    ['chest-pain', 'I have chest pain and a headache'],
    ['breathing', 'I can’t breathe well'],
    ['stroke', 'my face is drooping and I have slurred speech'],
    ['anaphylaxis', 'after a bee sting my throat is swelling'],
    ['meningitis', 'high fever and a stiff neck'],
    ['bleeding', 'there is blood in my stool and diarrhea'],
    ['suicide', 'I want to kill myself, can’t sleep'],
    ['poisoning', 'I took too many pills'],
    ['severe-pain', 'severe pain in my stomach'],
    ['infant', 'my 3 month old baby has a fever'],
  ];
  it('has a test for every red flag', () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(RED_FLAGS.map((f) => f.id).sort());
  });
  it.each(cases)('%s', (id, q) => {
    const a = answer(q, none);
    expect(a.kind).toBe('emergency');
    if (a.kind !== 'emergency') return;
    expect(a.flags.map((f) => f.id)).toContain(id);
    expect(answerText(a).join(' ')).not.toMatch(/acetaminophen|ibuprofen|diphenhydramine/i);
  });
  it('gives the right numbers to call', () => {
    const calls = (q: string) => (matchRedFlags(q)[0]?.calls ?? []).map((c) => c.number);
    expect(calls('chest pain')).toEqual(['911']);
    expect(calls('I want to end my life')).toEqual(['988', '911']);
    expect(calls('he swallowed some pills, overdose')).toEqual(['18002221222', '911']);
  });
  it('doesn’t treat everyday words as emergencies', () => {
    expect(matchRedFlags('poison ivy rash')).toEqual([]);
    expect(matchRedFlags('baby aspirin for a headache')).toEqual([]);
    expect(matchRedFlags('stuffy nose')).toEqual([]);
  });
});

describe('prescription guard', () => {
  const rxQuestions = ['can I get amoxicillin', 'oxycodone for pain', 'hydrocodone', 'sertraline', 'prednisone for my rash', 'azithromycin', 'lisinopril', 'metformin', 'ondansetron for nausea', 'codeine cough syrup', 'tramadol', 'alprazolam to sleep', 'zolpidem', 'gabapentin'];
  const everyQuery = [...rxQuestions, ...SYMPTOMS.flatMap((s) => s.words), 'cure my diabetes', 'treat my infection', 'what is good for a cold and a headache'];
  it.each(rxQuestions)('never says a prescription name back: “%s”', (q) => {
    const text = answerText(answer(q, none)).join(' ').toLowerCase();
    for (const rx of RX_NAMES) expect(text, rx).not.toMatch(new RegExp(`\\b${rx}\\b`));
  });
  it('no answer to any query contains a prescription name', () => {
    for (const q of everyQuery) {
      const text = [...answerText(answer(q, none)), ...spokenAnswer(answer(q, none))].join(' ').toLowerCase();
      for (const rx of RX_NAMES) expect(text, `${q} → ${rx}`).not.toMatch(new RegExp(`\\b${rx}\\b`));
    }
  });
  it('sends prescription questions to the pharmacist', () => {
    const a = answer('can I have oxycodone', none);
    expect(a.kind).toBe('rx');
    expect(answerText(a).join(' ')).toMatch(/only covers over-the-counter/);
    expect(answerText(a).join(' ')).toMatch(/pharmacist or doctor/);
  });
  it('won’t treat a disease', () => {
    expect(answer('how do I cure my diabetes', none).kind).toBe('disease');
    expect(answer('treat my infection', none).kind).toBe('disease');
  });
  it('still helps with a symptom when a prescription or disease is mentioned, with a note', () => {
    const a = answer('I take lisinopril and have a headache', none);
    expect(a.kind).toBe('suggest');
    if (a.kind !== 'suggest') return;
    expect(a.notes.join(' ')).toMatch(/prescription/);
    expect(a.suggestions.every((s) => s.warnings.length > 0)).toBe(true);
  });
});

describe('personal checks', () => {
  it('leaves out ingredients the person is allergic to', () => {
    const a = answer('headache', { ...none, allergies: ['Aspirin'] });
    expect(ids(a)).toEqual(['acetaminophen']); // aspirin allergy rules out NSAIDs too
    if (a.kind === 'suggest') expect(a.leftOut.map((l) => l.ingredient.id)).toEqual(['ibuprofen', 'naproxen', 'aspirin']);
    expect(allergyFor(byId('bismuth'), ['aspirin'])).toBe('aspirin');
    expect(allergyFor(byId('acetaminophen'), ['Tylenol'])).toBe('Tylenol');
    expect(allergyFor(byId('acetaminophen'), ['penicillin', 'latex'])).toBeNull();
  });
  it('warns about the same ingredient in a saved medicine', () => {
    const a = answer('fever', { ...none, medicines: ['HYDROCODONE/ACETAMINOPHEN 5-325MG TAKE 1 TABLET EVERY 6 HOURS'] });
    if (a.kind !== 'suggest') throw new Error(a.kind);
    const apap = a.suggestions.find((s) => s.ingredient.id === 'acetaminophen')!;
    expect(apap.warnings.some((w) => w.level === 'stop' && /already contains acetaminophen/.test(w.text))).toBe(true);
    // and never names the saved prescription
    expect(answerText(a).join(' ').toLowerCase()).not.toMatch(/hydrocodone/);
  });
  it('warns about NSAIDs with a blood thinner', () => {
    const a = answer('back pain', { ...none, medicines: ['ELIQUIS 5 MG'] });
    if (a.kind !== 'suggest') throw new Error(a.kind);
    for (const id of ['ibuprofen', 'naproxen', 'aspirin']) {
      expect(a.suggestions.find((s) => s.ingredient.id === id)?.warnings.some((w) => w.level === 'stop' && /blood thinner/.test(w.text)), id).toBe(true);
    }
    expect(a.suggestions[0].ingredient.id).toBe('acetaminophen'); // the safe one first
  });
  it('warns about decongestants with blood pressure medicine and sleep aids at 65+', () => {
    const a = answer('stuffy nose', { ...none, medicines: ['LISINOPRIL 10MG'] });
    if (a.kind !== 'suggest') throw new Error(a.kind);
    expect(a.suggestions.find((s) => s.ingredient.id === 'pseudoephedrine')!.warnings[0].text).toMatch(/blood pressure/);
    const b = answer('can’t sleep', { ...none, age: 72 });
    if (b.kind !== 'suggest') throw new Error(b.kind);
    expect(b.suggestions[0].warnings.some((w) => /65 and older/.test(w.text))).toBe(true);
  });
  it('lists who should ask a pharmacist first', () => {
    const a = answer('headache', none);
    if (a.kind !== 'suggest') throw new Error(a.kind);
    expect(a.checkFirst.join(' ')).toMatch(/pregnant/);
    expect(a.checkFirst.join(' ')).toMatch(/kidney/);
    expect(a.checkFirst.join(' ')).toMatch(/65 or older/);
  });
  it('works out age from a birth date', () => {
    expect(ageFrom('1950-06-15', new Date(2026, 5, 14))).toBe(75);
    expect(ageFrom('1950-06-15', new Date(2026, 5, 15))).toBe(76);
    expect(ageFrom('')).toBeNull();
  });
});

describe('disclaimers', () => {
  it('puts the disclaimer and label reminder in every suggestion answer, and speaks it', () => {
    for (const s of SYMPTOMS) {
      const a = answer(s.words[0], none);
      const text = answerText(a).join(' ');
      expect(text, s.id).toMatch(/not medical advice/);
      expect(text, s.id).toMatch(/Follow the package label/);
      expect(spokenAnswer(a).join(' '), s.id).toMatch(/not medical advice/);
    }
  });
});

describe('consent gate', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage;
  });
  it('starts not accepted, and remembers once accepted', () => {
    expect(hasOtcConsent()).toBe(false);
    acceptOtcConsent();
    expect(hasOtcConsent()).toBe(true);
  });
  it('asks again when the wording version changes', () => {
    mem.set('readrx:otc-consent', JSON.stringify({ version: 0 }));
    expect(hasOtcConsent()).toBe(false);
    mem.set('readrx:otc-consent', 'garbage');
    expect(hasOtcConsent()).toBe(false);
  });
});

describe('short spoken answers', () => {
  it('names at most two choices, one caution each, then the disclaimer', async () => {
    const { shortSpoken } = await import('../src/lib/otc/assistant');
    const lines = shortSpoken(answer('headache', none));
    expect(lines[0]).toMatch(/^For headache, you could try acetaminophen, like Tylenol\.$/);
    expect(lines[2]).toMatch(/^Or ibuprofen, like Advil\.$/);
    expect(lines).toHaveLength(5);
    expect(lines.at(-1)).toBe('Follow the package label. This isn’t medical advice.');
  });
  it('speaks the person’s own warning instead of the general caution', async () => {
    const { shortSpoken } = await import('../src/lib/otc/assistant');
    const lines = shortSpoken(answer('back pain', { ...none, medicines: ['WARFARIN 5MG'] }));
    expect(lines.join(' ')).toMatch(/blood thinner/);
  });
  it('leads emergencies with the emergency line, and never suggests a medicine', async () => {
    const { shortSpoken } = await import('../src/lib/otc/assistant');
    const lines = shortSpoken(answer('chest pain', none));
    expect(lines[0]).toMatch(/^Call 911/);
    expect(lines.join(' ')).not.toMatch(/acetaminophen|ibuprofen/i);
  });
  it('never says a prescription name for any query', async () => {
    const { shortSpoken } = await import('../src/lib/otc/assistant');
    for (const q of ['oxycodone for pain', 'cure my diabetes', ...SYMPTOMS.flatMap((s) => s.words)]) {
      const text = shortSpoken(answer(q, none)).join(' ').toLowerCase();
      for (const rx of RX_NAMES) expect(text, `${q} → ${rx}`).not.toMatch(new RegExp(`\\b${rx}\\b`));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { parseSig, writeSig } from '../src/lib/sig';

const ok = (t: string) => {
  const r = parseSig(t);
  expect(r.unknown).toEqual([]);
  return r.sig!;
};

describe('parseSig', () => {
  it('reads common pharmacy shorthand', () => {
    const s = ok('TAKE 1 TAB PO BID');
    expect([s.amount, s.unit, s.route, s.timesPerDay]).toEqual([1, 'tablet', 'mouth', 2]);
  });
  it('does not misread TWICE DAILY as once a day', () => {
    expect(ok('TAKE 1 TABLET BY MOUTH TWICE DAILY').timesPerDay).toBe(2);
  });
  it('reads every-N-hours ranges, as needed and reasons', () => {
    const s = ok('TAKE 1 TO 2 TABLETS BY MOUTH EVERY 4 TO 6 HOURS AS NEEDED FOR PAIN'.replace('1 TO 2', '2'));
    expect(s.everyHours).toEqual([4, 6]);
    expect([s.asNeeded, s.reason]).toEqual([true, 'pain']);
  });
  it('keeps the purpose line without blocking translation', () => {
    const r = parseSig('TAKE 1 TABLET BY MOUTH ONCE DAILY FOR BLOOD PRESSURE');
    expect(r.unknown).toEqual([]);
    expect(r.purpose).toBe('BLOOD PRESSURE');
  });
  it('reads orally disintegrating tablet directions', () => {
    const s = ok('DISSOLVE 1 TABLET ON TONGUE EVERY 8 HRS AS NEEDED FOR NAUSEA OR VOMITING');
    expect([s.action, s.route, s.everyHours, s.reason]).toEqual(['dissolve', 'on_tongue', [8, 8], 'nausea']);
    expect(writeSig(s, 'en')).toBe('Dissolve 1 tablet on the tongue every 8 hours only when needed for nausea.');
    expect(ok('PLACE 1 TABLET ON THE TONGUE AND LET DISSOLVE EVERY 8 HOURS AS NEEDED').action).toBe('dissolve');
    expect(ok('DISSOLVE 1 TABLET IN MOUTH TWICE DAILY').route).toBe('in_mouth');
    for (const lang of ['es', 'pt', 'zh', 'vi', 'fr'] as const) expect(writeSig(s, lang)).not.toMatch(/undefined/);
  });
  it('reads eye drops, half tablets, food and duration', () => {
    expect(ok('INSTILL 1 DROP IN EACH EYE AT BEDTIME').route).toBe('eye_each');
    expect(ok('TAKE 1/2 TABLET BY MOUTH EVERY MORNING').amount).toBe(0.5);
    const amox = ok('TAKE 1 CAPSULE BY MOUTH 3 TIMES DAILY WITH FOOD FOR 10 DAYS');
    expect([amox.timesPerDay, amox.food, amox.days]).toEqual([3, 'with', 10]);
  });
  it('refuses to translate what it does not fully understand', () => {
    expect(parseSig('TAKE 2 CAPSULES NOW THEN 1 CAPSULE DAILY').unknown.length).toBeGreaterThan(0);
    expect(parseSig('TAKE AS DIRECTED').unknown.length).toBeGreaterThan(0);
    expect(parseSig('').sig).toBeNull();
  });
});

describe('writeSig', () => {
  const lis = parseSig('TAKE 1 TABLET BY MOUTH ONCE DAILY').sig!;
  it('writes plain English', () => expect(writeSig(lis, 'en')).toBe('Take 1 tablet by mouth once a day.'));
  it('writes Spanish', () => expect(writeSig(lis, 'es')).toBe('Tome 1 tableta por vía oral una vez al día.'));
  it('writes Portuguese', () => expect(writeSig(lis, 'pt')).toBe('Tome 1 comprimido por via oral uma vez ao dia.'));
  it('writes French', () => expect(writeSig(lis, 'fr')).toBe('Prenez 1 comprimé par la bouche une fois par jour.'));
  it('writes Chinese', () => expect(writeSig(lis, 'zh')).toBe('每天1次，每次口服1片。'));
  it('writes Vietnamese', () => expect(writeSig(lis, 'vi')).toBe('Uống 1 viên, mỗi ngày 1 lần.'));
  it('handles plurals, as-needed reasons and duration', () => {
    const s = parseSig('TAKE 2 TABLETS BY MOUTH EVERY 6 HOURS AS NEEDED FOR PAIN').sig!;
    expect(writeSig(s, 'en')).toBe('Take 2 tablets by mouth every 6 hours only when needed for pain.');
    expect(writeSig(s, 'es')).toBe('Tome 2 tabletas por vía oral cada 6 horas solo cuando sea necesario para el dolor.');
    expect(writeSig(s, 'zh')).toBe('每6小时1次，疼痛时才用，每次口服2片。');
  });
  it('handles eye drops in every language', () => {
    const s = parseSig('INSTILL 1 DROP IN EACH EYE AT BEDTIME').sig!;
    expect(writeSig(s, 'en')).toBe('Put 1 drop in each eye at bedtime.');
    expect(writeSig(s, 'vi')).toBe('Nhỏ 1 giọt vào mỗi mắt, trước khi đi ngủ.');
    expect(writeSig(s, 'zh')).toBe('睡前，每次1滴，滴入双眼。');
  });
});

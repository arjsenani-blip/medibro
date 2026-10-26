import { normalize } from './otc/assistant';
import { telHref } from './store';

/* Getting rid of old or unused medicines, from FDA and DEA public guidance.
   Offline: nothing here looks anything up. Calls are only ever to numbers the
   person saved (police non-emergency, pharmacy) and never to 911. */

export const DISPOSAL_NOTE = 'General guidance from the FDA. Your local rules may differ.';
export const DEA_LOCATOR = 'https://apps.deadiversion.usdoj.gov/pubdispsearch';

/** The FDA flush list: medicines that may be flushed when no take-back is
    available soon, because they're so dangerous if someone else takes them. */
export const FLUSH_LIST: { name: string; aliases: string[] }[] = [
  { name: 'Benzhydrocodone with acetaminophen', aliases: ['benzhydrocodone', 'apadaz'] },
  { name: 'Buprenorphine', aliases: ['buprenorphine', 'suboxone', 'subutex', 'zubsolv', 'butrans', 'belbuca'] },
  { name: 'Diazepam rectal gel', aliases: ['diastat', 'diazepam rectal'] },
  { name: 'Fentanyl', aliases: ['fentanyl', 'duragesic', 'actiq', 'fentora', 'abstral'] },
  { name: 'Hydrocodone', aliases: ['hydrocodone', 'vicodin', 'norco', 'lortab', 'hysingla', 'zohydro'] },
  { name: 'Hydromorphone', aliases: ['hydromorphone', 'dilaudid', 'exalgo'] },
  { name: 'Meperidine', aliases: ['meperidine', 'demerol'] },
  { name: 'Methadone', aliases: ['methadone', 'dolophine', 'methadose'] },
  { name: 'Methylphenidate patch', aliases: ['daytrana', 'methylphenidate patch', 'methylphenidate transdermal'] },
  { name: 'Morphine', aliases: ['morphine', 'ms contin', 'kadian'] },
  { name: 'Oxycodone', aliases: ['oxycodone', 'oxycontin', 'percocet', 'roxicodone', 'xtampza', 'endocet'] },
  { name: 'Oxymorphone', aliases: ['oxymorphone', 'opana'] },
  { name: 'Sodium oxybate', aliases: ['sodium oxybate', 'xyrem', 'xywav'] },
  { name: 'Tapentadol', aliases: ['tapentadol', 'nucynta'] },
];

export const onFlushList = (text: string) => {
  const t = normalize(text);
  return FLUSH_LIST.some((f) => f.aliases.some((a) => t.includes(normalize(a))));
};

export interface Step {
  title: string;
  lines: string[];
}

/** The general steps. They name no medicine; specific advice is only for the person's own saved ones. */
export const STEPS: Step[] = [
  {
    title: 'Best: a take-back site',
    lines: [
      'Many police stations and pharmacies have a drop box for old medicines.',
      'Bring them in their bottles. You can black out your name on the label.',
      'National Take Back Days are in April and October.',
    ],
  },
  {
    title: 'No take-back nearby? Use the trash',
    lines: [
      'Mix the medicine with something unpleasant, like used coffee grounds, dirt or cat litter. Don’t crush tablets or capsules.',
      'Seal it in a bag or container.',
      'Throw it in the trash.',
      'Scratch out your name and details on the empty bottle.',
    ],
  },
  {
    title: 'Don’t flush',
    lines: ['Only flush a medicine if it’s on the FDA flush list (some strong pain medicines) and no take-back is available soon.'],
  },
];

export const SPECIAL: { item: string; how: string }[] = [
  { item: 'Pain patches', how: 'Fold the sticky sides together. Patches on the flush list can then be flushed.' },
  { item: 'Inhalers', how: 'Don’t puncture or burn them. Ask your pharmacy or trash service.' },
  { item: 'Needles and sharps', how: 'Use a sharps container, never loose in the trash.' },
];

// ---------- understanding the question ----------

const MED = ['medicine', 'medicines', 'medication', 'medications', 'meds', 'pills', 'pill', 'tablets', 'capsules', 'drugs', 'prescriptions', 'prescription', 'painkillers', 'pain killers', 'bottles', 'patches', 'inhaler', 'inhalers', 'needles', 'sharps', 'medicinas', 'medicamentos', 'pastillas'];
const ACTION = ['dispose', 'disposal', 'dispose of', 'get rid of', 'throw away', 'throw out', 'toss', 'discard', 'destroy', 'flush', 'drop off', 'what do i do with', 'what to do with', 'tirar', 'desechar', 'deshacerme', 'botar'];
const OLD = ['old', 'expired', 'leftover', 'left over', 'unused', 'unwanted', 'out of date', 'viejas', 'viejos', 'vencidas', 'vencidos', 'caducadas'];
const DIRECT = ['take back', 'takeback', 'take-back', 'drug drop box', 'drop box', 'medicine disposal', 'drug disposal', 'medication disposal'];

const has = (t: string, p: string) => t.includes(normalize(p));

/** True for "how do I get rid of old pills", "drug take back", "tirar medicinas vencidas"…
    `medNames` adds medicine names (saved ones, prescription names) to the medicine words. */
export function isDisposalQuestion(query: string, medNames: string[] = []): boolean {
  const t = normalize(query);
  if (DIRECT.some((p) => has(t, p))) return true;
  const med = MED.some((p) => has(t, p)) || medNames.some((p) => has(t, p));
  if (!med) return false;
  return ACTION.some((p) => has(t, p)) || OLD.some((p) => has(t, p));
}

/** The person's saved medicines they named in the question, and whether each is on the flush list. */
export function savedMentioned(query: string, saved: { name: string; text: string }[]): { name: string; flush: boolean }[] {
  const t = normalize(query);
  return saved
    .filter((m) => {
      const words = normalize(m.name).trim().split(' ').filter((w) => w.length >= 4 && !/^\d/.test(w));
      return words.length > 0 && words.some((w) => has(t, w));
    })
    .map((m) => ({ name: m.name, flush: onFlushList(m.text) }));
}

export const ASK_TO_CALL = 'Do you want to call your police station?';

export function spokenDisposal(saved: { name: string; flush: boolean }[]): string[] {
  const lines: string[] = ['Here’s how to get rid of old medicines safely.'];
  for (const m of saved) lines.push(m.flush ? `${m.name} is on the FDA flush list. Take it to a take-back site if you can. If none is available soon, you may flush it.` : `${m.name} is not on the flush list. Don’t flush it.`);
  for (const s of STEPS) {
    lines.push(s.title + '.');
    lines.push(...s.lines);
  }
  lines.push(DISPOSAL_NOTE, ASK_TO_CALL);
  return lines;
}

// ---------- actions ----------

export interface Action {
  id: 'police' | 'find-police' | 'pharmacy' | 'takeback';
  label: string;
  href: string;
}

/** A dialable number, but never 911: disposal isn't an emergency. */
function safeTel(phone: string): string | null {
  const href = telHref(phone);
  if (!href) return null;
  const digits = href.replace(/\D/g, '');
  return digits === '911' || digits === '1911' ? null : href;
}

export function mapsSearch(native: boolean) {
  return native ? 'maps://?q=police%20station' : 'https://maps.apple.com/?q=police%20station';
}

export function disposalActions(p: { policePhone: string; policeName: string; pharmacyPhone: string; pharmacyName: string }, native = false): Action[] {
  const out: Action[] = [];
  const police = safeTel(p.policePhone);
  out.push(police ? { id: 'police', label: 'Call police station', href: police } : { id: 'find-police', label: 'Find nearby police', href: mapsSearch(native) });
  const pharmacy = safeTel(p.pharmacyPhone);
  if (pharmacy) out.push({ id: 'pharmacy', label: 'Call my pharmacy', href: pharmacy });
  out.push({ id: 'takeback', label: 'Find a take-back site', href: DEA_LOCATOR });
  return out;
}

/** The answer to "Do you want to call?": yes, no, or not clear. */
export function yesNo(text: string): 'yes' | 'no' | null {
  const t = normalize(text);
  if (/ (no|nope|nah|not now|don't|dont|cancel|stop|later) /.test(t)) return 'no';
  if (/ (yes|yeah|yep|yup|sure|ok|okay|please|call|call them|do it|sí|si) /.test(t)) return 'yes';
  return null;
}

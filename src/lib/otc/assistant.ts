import { CONDITION_TEXT, INGREDIENTS, LABEL_REMINDER, byId, type Condition, type Ingredient, type Tag } from './otc-data';
import { SYMPTOMS, type Symptom } from './symptoms';
import { DISPOSAL_NOTE, SPECIAL, STEPS, isDisposalQuestion, savedMentioned, spokenDisposal } from '../disposal';

/* The symptom assistant. Runs entirely on the phone from the data in this
   folder: no model, no network. It answers in this order:
   1. Emergency warning signs → no suggestions, only "call 911" (or 988 / Poison Control).
   2. Getting rid of old medicines → disposal steps (src/lib/disposal.ts), not suggestions.
   3. A prescription medicine or a disease, with no symptom → "only OTC symptom relief; ask your pharmacist or doctor".
   4. Known symptoms → OTC ingredients from otc-data.ts, checked against the person's
      allergies and saved medicines.
   Answers never repeat the prescription name someone typed, and never print a dose. */

export const DISCLAIMER = 'This is general information, not medical advice. It doesn’t diagnose or treat any disease. Read and follow the Drug Facts label, and ask your pharmacist or doctor if you’re not sure.';
export const SPOKEN_DISCLAIMER = 'Remember: this is not medical advice, and it does not treat any disease. Follow the package label, and ask your pharmacist or doctor if you are not sure.';

// ---------- emergencies ----------

export interface Call {
  label: string;
  number: string; // dialable
}
export const CALL_911: Call = { label: 'Call 911', number: '911' };
export const CALL_988: Call = { label: 'Call or text 988', number: '988' };
export const CALL_POISON: Call = { label: 'Call Poison Control', number: '18002221222' };

export interface RedFlag {
  id: string;
  title: string;
  message: string;
  calls: Call[];
  patterns: RegExp[];
}

const ER = 'Call 911 or go to the emergency room now. Don’t wait, and don’t take a medicine for this first.';

export const RED_FLAGS: RedFlag[] = [
  { id: 'chest-pain', title: 'Chest pain can be a heart attack', message: ER, calls: [CALL_911], patterns: [/\bchest (pain|pains|hurts?|pressure|tightness|tight)\b/, /\b(pain|pressure|tightness) in (my |the )?chest\b/, /\bheart attack\b/] },
  { id: 'breathing', title: 'Trouble breathing is an emergency', message: ER, calls: [CALL_911], patterns: [/\b(can ?not|can t|cant|trouble|hard to|difficulty|struggling to) breath(e|ing)?\b/, /\bshort(ness)? of breath\b/, /\bgasping\b/, /\bchoking\b/, /\bwheezing badly\b/] },
  { id: 'stroke', title: 'These can be signs of a stroke', message: `${ER} Note the time the signs started.`, calls: [CALL_911], patterns: [/\bstroke\b/, /\bface (is )?droop(ing|y)?\b/, /\bdrooping face\b/, /\bslurred speech\b/, /\bslurring\b/, /\b(can ?not|can t|cant|trouble) (speak|talk)ing?\b/, /\b(arm|leg|side) (is )?(weak|numb)\b/, /\bsudden (numbness|weakness|confusion)\b/, /\bone side of (my |the )?(face|body)\b/] },
  { id: 'anaphylaxis', title: 'This may be a severe allergic reaction', message: `${ER} If you have an epinephrine auto-injector (like an EpiPen), use it.`, calls: [CALL_911], patterns: [/\banaphyla/, /\b(throat|tongue|lips?|face) (is |are |feels? )?(swollen|swelling|closing|tight)\b/, /\bswollen (throat|tongue|lips?|face)\b/, /\bswelling of (my |the )?(throat|tongue|lips?|face)\b/, /\bthroat (is )?closing\b/] },
  { id: 'meningitis', title: 'High fever with a stiff neck needs care now', message: ER, calls: [CALL_911], patterns: [/\bstiff neck\b/, /\bneck (is )?stiff\b/] },
  { id: 'bleeding', title: 'Blood in vomit or stool needs care now', message: ER, calls: [CALL_911], patterns: [/\b(vomit(ing)?|throwing up|threw up) blood\b/, /\bblood in (my )?(vomit|stool|stools|poop|throw up)\b/, /\b(bloody|black|tarry) (stool|stools|poop)\b/, /\bcoffee grounds?\b/, /\bcoughing (up )?blood\b/] },
  { id: 'suicide', title: 'You don’t have to go through this alone', message: 'Call or text 988, the Suicide & Crisis Lifeline, any time, day or night. If you might act on these thoughts now, call 911.', calls: [CALL_988, CALL_911], patterns: [/\bsuicid/, /\bkill (my ?self|me)\b/, /\bend (my|it all|my life)\b/, /\bwant to die\b/, /\b(hurt|harm)(ing)? my ?self\b/, /\bself harm/, /\bno reason to live\b/] },
  { id: 'poisoning', title: 'For a possible overdose or poisoning', message: 'Call Poison Control at 1-800-222-1222, any time. If the person is hard to wake, has trouble breathing or is having a seizure, call 911.', calls: [CALL_POISON, CALL_911], patterns: [/\boverdos/, /\btook too (many|much)\b/, /\btaken too (many|much)\b/, /\bpoison(ed|ing)?\b(?! ivy| oak)/, /\bswallowed\b.*\b(battery|batteries|bleach|chemicals?|cleaner|pills?|medicines?|medications?|tablets?|capsules?|meds)\b/, /\b(child|kid|baby|son|daughter|grandchild|grandson|granddaughter|toddler|dog|cat) (took|ate|swallowed|got into)\b/, /\bdouble dose\b/] },
  { id: 'severe-pain', title: 'Severe or sudden pain needs a doctor now', message: ER, calls: [CALL_911], patterns: [/\b(severe|unbearable|excruciating|extreme|worst) (pain|headache|stomach|belly)/, /\bworst headache\b/, /\bpain (is )?(severe|unbearable|excruciating)\b/, /\bthunderclap\b/] },
  { id: 'infant', title: 'Babies need their own doctor’s advice', message: 'Call your baby’s doctor or nurse line now. For a baby under 3 months with any fever, or any baby who is hard to wake or breathing oddly, call 911.', calls: [CALL_911], patterns: [/\b(baby|babies|infant|infants|newborn)\b(?! aspirin)/, /\b\d{1,2} (month|months|mo) old\b/, /\bweeks? old\b/] },
];

// ---------- the OTC-only guard ----------

/** Prescription-only names. Never suggested, never printed back. Used to notice
    that someone is asking about one, and to read a person's saved medicines. */
export const RX_NAMES = [
  'amoxicillin', 'augmentin', 'azithromycin', 'zithromax', 'z pack', 'zpak', 'penicillin', 'cephalexin', 'keflex', 'doxycycline', 'ciprofloxacin', 'cipro', 'levofloxacin', 'clindamycin', 'nitrofurantoin', 'bactrim', 'sulfamethoxazole', 'metronidazole', 'flagyl',
  'oxycodone', 'oxycontin', 'percocet', 'hydrocodone', 'vicodin', 'norco', 'codeine', 'tramadol', 'ultram', 'morphine', 'fentanyl', 'hydromorphone', 'dilaudid', 'methadone', 'buprenorphine', 'suboxone', 'tapentadol',
  'sertraline', 'zoloft', 'fluoxetine', 'prozac', 'citalopram', 'escitalopram', 'lexapro', 'paroxetine', 'paxil', 'venlafaxine', 'effexor', 'duloxetine', 'cymbalta', 'bupropion', 'wellbutrin', 'trazodone', 'mirtazapine', 'amitriptyline', 'phenelzine', 'tranylcypromine', 'selegiline', 'isocarboxazid',
  'alprazolam', 'xanax', 'lorazepam', 'ativan', 'diazepam', 'valium', 'clonazepam', 'klonopin', 'zolpidem', 'ambien', 'eszopiclone', 'temazepam',
  'prednisone', 'prednisolone', 'methylprednisolone', 'medrol', 'dexamethasone',
  'lisinopril', 'losartan', 'valsartan', 'amlodipine', 'metoprolol', 'atenolol', 'carvedilol', 'hydrochlorothiazide', 'furosemide', 'lasix', 'spironolactone', 'enalapril', 'ramipril', 'diltiazem', 'clonidine',
  'metformin', 'glipizide', 'glyburide', 'insulin', 'semaglutide', 'ozempic', 'wegovy', 'tirzepatide', 'mounjaro', 'jardiance', 'empagliflozin',
  'atorvastatin', 'lipitor', 'simvastatin', 'rosuvastatin', 'crestor', 'pravastatin',
  'warfarin', 'coumadin', 'jantoven', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'dabigatran', 'pradaxa', 'edoxaban', 'clopidogrel', 'plavix', 'prasugrel', 'ticagrelor', 'brilinta', 'enoxaparin', 'lovenox', 'heparin',
  'ondansetron', 'zofran', 'promethazine', 'phenergan', 'metoclopramide', 'reglan', 'prochlorperazine',
  'gabapentin', 'neurontin', 'pregabalin', 'lyrica', 'cyclobenzaprine', 'flexeril', 'methocarbamol', 'baclofen', 'tizanidine', 'meloxicam', 'mobic', 'celecoxib', 'celebrex', 'diclofenac tablets', 'indomethacin',
  'levothyroxine', 'synthroid', 'albuterol', 'montelukast', 'singulair', 'benzonatate', 'tessalon', 'hydroxyzine', 'valacyclovir', 'valtrex', 'acyclovir', 'oseltamivir', 'tamiflu', 'paxlovid', 'fluconazole', 'diflucan',
  'sildenafil', 'viagra', 'tadalafil', 'cialis', 'adderall', 'amphetamine', 'methylphenidate', 'ritalin', 'lithium', 'quetiapine', 'seroquel', 'aripiprazole', 'abilify', 'risperidone', 'olanzapine',
  'allopurinol', 'colchicine', 'tamsulosin', 'finasteride', 'pantoprazole', 'protonix', 'esomeprazole tablets', 'sucralfate', 'isotretinoin', 'accutane', 'tretinoin', 'triamcinolone', 'clobetasol', 'mupirocin', 'antibiotic', 'antibiotics', 'opioid', 'opioids', 'steroid pills', 'steroid shot',
];

// interaction classes, read from saved medicines (never printed)
const BLOOD_THINNERS = ['warfarin', 'coumadin', 'jantoven', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'dabigatran', 'pradaxa', 'edoxaban', 'savaysa', 'clopidogrel', 'plavix', 'prasugrel', 'effient', 'ticagrelor', 'brilinta', 'enoxaparin', 'lovenox', 'heparin'];
const BP_MEDS = ['lisinopril', 'enalapril', 'ramipril', 'benazepril', 'losartan', 'valsartan', 'olmesartan', 'irbesartan', 'amlodipine', 'metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'hydrochlorothiazide', 'chlorthalidone', 'furosemide', 'spironolactone', 'diltiazem', 'verapamil', 'clonidine'];
const SEDATIVES = ['oxycodone', 'hydrocodone', 'codeine', 'tramadol', 'morphine', 'hydromorphone', 'methadone', 'buprenorphine', 'alprazolam', 'lorazepam', 'diazepam', 'clonazepam', 'temazepam', 'zolpidem', 'eszopiclone', 'gabapentin', 'pregabalin', 'cyclobenzaprine', 'methocarbamol', 'tizanidine', 'baclofen', 'trazodone', 'quetiapine', 'mirtazapine', 'hydroxyzine', 'promethazine'];
const MAOIS = ['phenelzine', 'nardil', 'tranylcypromine', 'parnate', 'isocarboxazid', 'marplan', 'selegiline', 'emsam', 'rasagiline', 'azilect'];
const SEROTONERGIC = ['sertraline', 'fluoxetine', 'citalopram', 'escitalopram', 'paroxetine', 'venlafaxine', 'desvenlafaxine', 'duloxetine', 'trazodone', 'tramadol'];

const DISEASES = ['diabetes', 'cancer', 'tumor', 'hypertension', 'high blood pressure', 'heart disease', 'heart failure', 'asthma', 'copd', 'depression', 'anxiety', 'bipolar', 'schizophrenia', 'adhd', 'infection', 'infected', 'pneumonia', 'bronchitis', 'strep', 'uti', 'urinary tract infection', 'std', 'sti', 'chlamydia', 'gonorrhea', 'herpes', 'hiv', 'covid', 'shingles', 'epilepsy', 'seizures', 'kidney disease', 'liver disease', 'hepatitis', 'thyroid', 'cholesterol', 'gout', 'ulcer', 'crohn', 'colitis', 'dementia', 'alzheimer', 'parkinson', 'lupus', 'sinus infection', 'ear infection', 'pink eye', 'erectile dysfunction', 'cure', 'cured'];

// ---------- matching ----------

/** Lowercase, straight apostrophes, punctuation as spaces. */
export function normalize(s: string): string {
  // a period is kept only inside a number ("2.5"); speech recognition ends sentences with one
  return ` ${s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\.(?!\d)/g, ' ').replace(/[^a-z0-9'%.]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}
const has = (text: string, phrase: string) => text.includes(normalize(phrase));

export function matchSymptoms(query: string): Symptom[] {
  const t = normalize(query);
  return SYMPTOMS.filter((s) => s.words.some((w) => has(t, w)));
}

export function matchRedFlags(query: string): RedFlag[] {
  const t = normalize(query).replace(/'/g, ' ');
  return RED_FLAGS.filter((f) => f.patterns.some((p) => p.test(t)));
}

const mentions = (text: string, names: string[]) => names.some((n) => has(text, n));
export const mentionsRx = (query: string) => mentions(normalize(query), RX_NAMES);
export const mentionsDisease = (query: string) => mentions(normalize(query), DISEASES);

// ---------- answers ----------

export interface Warning {
  level: 'stop' | 'caution';
  text: string;
}
export interface Suggestion {
  ingredient: Ingredient;
  forSymptoms: string[]; // labels
  warnings: Warning[]; // from this person's allergies, medicines and age
}
export type Answer =
  | { kind: 'emergency'; flags: RedFlag[] }
  | { kind: 'dispose'; saved: { name: string; flush: boolean }[] } // saved medicines the person named
  | { kind: 'rx' }
  | { kind: 'disease' }
  | { kind: 'none' }
  | {
      kind: 'suggest';
      symptoms: Symptom[];
      suggestions: Suggestion[];
      leftOut: { ingredient: Ingredient; reason: string }[]; // because of an allergy
      notes: string[]; // e.g. "you mentioned a prescription medicine"
      checkFirst: string[]; // ask your pharmacist first if…
    };

export interface Context {
  allergies: string[];
  medicines: string[]; // text of saved medicines (drug name and label text)
  names?: string[]; // display names of the same saved medicines, same order
  age?: number | null;
}

/** Turns a saved medicine into text the checks can search. */
export const medicineText = (m: { fields: { drug: string }; raw: string }) => `${m.fields.drug} ${m.raw}`;

export function ageFrom(birthDate: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  let age = today.getFullYear() - Number(m[1]);
  if (today.getMonth() + 1 < Number(m[2]) || (today.getMonth() + 1 === Number(m[2]) && today.getDate() < Number(m[3]))) age--;
  return age >= 0 && age < 130 ? age : null;
}

const TAG_WORDS: Record<Tag, string[]> = {
  nsaid: ['nsaid', 'nsaids', 'anti inflammatory', 'anti-inflammatory', 'aspirin', 'ibuprofen', 'naproxen'],
  salicylate: ['salicylate', 'salicylates', 'aspirin'],
  antihistamine: ['antihistamine', 'antihistamines'],
  sedating: [],
  decongestant: ['decongestant', 'decongestants'],
  acetaminophen: ['acetaminophen', 'tylenol', 'paracetamol'],
  'cough-suppressant': [],
};

/** The allergy (as the person wrote it) that rules this ingredient out, if any. */
export function allergyFor(ing: Ingredient, allergies: string[]): string | null {
  for (const a of allergies) {
    const t = normalize(a);
    if (t.trim().length < 3) continue;
    const names = [ing.name, ...ing.aliases, ...ing.brands.map((b) => b.replace(/\s*\(.*\)/, ''))];
    if (names.some((n) => has(t, n) || normalize(n).includes(t))) return a;
    if (ing.tags.some((tag) => TAG_WORDS[tag].some((w) => has(t, w)))) return a;
    if (ing.id === 'bacitracin' && has(t, 'neomycin')) return a;
  }
  return null;
}

/** Warnings for this ingredient from the person's saved medicines and age. */
export function warningsFor(ing: Ingredient, ctx: Context, queryMentionsRx = false): Warning[] {
  const out: Warning[] = [];
  const meds = ctx.medicines.map(normalize);
  const inMeds = (names: string[]) => meds.some((m) => names.some((n) => has(m, n)));
  // the same ingredient twice
  if (inMeds(ing.aliases.filter((a) => a.length > 3))) {
    out.push({ level: 'stop', text: `One of the medicines you saved in MediBro already contains ${ing.name.toLowerCase()}. Taking both could be too much. Ask your pharmacist before using this.` });
  }
  const nsaid = ing.tags.includes('nsaid') || ing.tags.includes('salicylate');
  if (nsaid && inMeds(BLOOD_THINNERS)) {
    out.push({ level: 'stop', text: `One of the medicines you saved looks like a blood thinner. ${ing.name} with a blood thinner raises the chance of serious bleeding. Don’t take it unless your doctor or pharmacist says it’s OK.` });
  }
  if (ing.tags.includes('nsaid') && !out.some((w) => w.level === 'stop') && inMeds(['ibuprofen', 'naproxen', 'meloxicam', 'celecoxib', 'diclofenac', 'indomethacin', 'aspirin'].filter((n) => !ing.aliases.includes(n)))) {
    out.push({ level: 'stop', text: 'One of the medicines you saved is already a pain reliever of the same kind (an NSAID). Don’t take two together. Ask your pharmacist.' });
  }
  if ((ing.tags.includes('nsaid') || ing.tags.includes('decongestant')) && inMeds(BP_MEDS)) {
    out.push({ level: 'caution', text: `You have a blood pressure medicine saved. ${ing.name} can raise blood pressure or make that medicine work less well. Ask your pharmacist first.` });
  }
  if (ing.tags.includes('sedating') && inMeds(SEDATIVES)) {
    out.push({ level: 'stop', text: 'One of the medicines you saved can make you sleepy. Together with this, the drowsiness can be dangerous. Ask your pharmacist first.' });
  }
  if (ing.id === 'dextromethorphan' && inMeds(MAOIS)) out.push({ level: 'stop', text: 'One of the medicines you saved looks like an MAOI. Don’t use dextromethorphan with it.' });
  else if (ing.id === 'dextromethorphan' && inMeds(SEROTONERGIC)) out.push({ level: 'caution', text: 'One of the medicines you saved affects serotonin. Ask your pharmacist before adding dextromethorphan.' });
  if (ing.tags.includes('sedating') && ctx.age != null && ctx.age >= 65) {
    out.push({ level: 'caution', text: 'At 65 and older, this kind of medicine can cause confusion, dizziness and falls. Ask your pharmacist about a non-drowsy choice.' });
  }
  if (queryMentionsRx && !out.length) out.push({ level: 'caution', text: 'You mentioned a prescription medicine. Ask your pharmacist whether this is safe to take with it.' });
  return out;
}

const MAX_SUGGESTIONS = 4;

export function answer(query: string, ctx: Context): Answer {
  if (!query.trim()) return { kind: 'none' };
  const flags = matchRedFlags(query);
  if (flags.length) return { kind: 'emergency', flags };
  const saved = (ctx.names ?? []).map((name, i) => ({ name, text: ctx.medicines[i] ?? name }));
  if (isDisposalQuestion(query, [...RX_NAMES, ...saved.flatMap((m) => m.name.split(/\s+/).filter((w) => w.length >= 4 && !/^\d/.test(w)))])) {
    return { kind: 'dispose', saved: savedMentioned(query, saved) };
  }

  const symptoms = matchSymptoms(query);
  const rx = mentionsRx(query);
  const disease = mentionsDisease(query);
  if (!symptoms.length) return rx ? { kind: 'rx' } : disease ? { kind: 'disease' } : { kind: 'none' };

  // ingredients in the order they appear across the matched symptoms
  const order: string[] = [];
  for (const s of symptoms) for (const id of s.ingredients) if (!order.includes(id)) order.push(id);
  const suggestions: Suggestion[] = [];
  const leftOut: { ingredient: Ingredient; reason: string }[] = [];
  for (const id of order) {
    const ing = byId(id);
    const allergy = allergyFor(ing, ctx.allergies);
    if (allergy) {
      leftOut.push({ ingredient: ing, reason: `You listed an allergy to “${allergy}”.` });
      continue;
    }
    suggestions.push({ ingredient: ing, forSymptoms: symptoms.filter((s) => s.ingredients.includes(id)).map((s) => s.label), warnings: warningsFor(ing, ctx, rx) });
  }
  // ones that are safe for this person first, then by how commonly they're used
  suggestions.sort((a, b) => Number(a.warnings.some((w) => w.level === 'stop')) - Number(b.warnings.some((w) => w.level === 'stop')));
  const shown = suggestions.slice(0, MAX_SUGGESTIONS);

  const conditions: Condition[] = [];
  for (const s of shown) for (const c of s.ingredient.checkFirst) if (!conditions.includes(c)) conditions.push(c);
  const checkFirst = [...conditions.map((c) => CONDITION_TEXT[c]), 'You take other medicines, vitamins or supplements'];

  const notes: string[] = [];
  if (rx) notes.push('You mentioned a prescription medicine. MediBro only talks about over-the-counter medicines. Ask your pharmacist or doctor about prescriptions.');
  if (disease) notes.push('These only ease symptoms for a short time. They don’t treat any disease. Ask your doctor about the condition itself.');
  return { kind: 'suggest', symptoms, suggestions: shown, leftOut, notes, checkFirst };
}

/** Every piece of text an answer shows or speaks, for the guard tests and for reading aloud. */
export function answerText(a: Answer): string[] {
  switch (a.kind) {
    case 'emergency':
      return a.flags.flatMap((f) => [f.title, f.message, ...f.calls.map((c) => c.label)]);
    case 'dispose':
      return [...STEPS.flatMap((s) => [s.title, ...s.lines]), ...SPECIAL.flatMap((x) => [x.item, x.how]), DISPOSAL_NOTE];
    case 'rx':
      return [RX_REPLY];
    case 'disease':
      return [DISEASE_REPLY];
    case 'none':
      return [NONE_REPLY];
    case 'suggest':
      return [
        ...a.notes,
        ...a.symptoms.flatMap((s) => [s.label, s.selfCare, s.seeDoctor]),
        ...a.suggestions.flatMap((s) => [s.ingredient.name, s.ingredient.helps, ...s.ingredient.brands, ...s.ingredient.cautions, ...s.warnings.map((w) => w.text), LABEL_REMINDER]),
        ...a.leftOut.flatMap((l) => [l.ingredient.name, l.reason]),
        ...a.checkFirst,
        DISCLAIMER,
      ];
  }
}

export const RX_REPLY = 'MediBro’s assistant only covers over-the-counter medicines for short-term symptom relief. It can’t advise about prescription medicines. Please ask your pharmacist or doctor.';
export const DISEASE_REPLY = 'MediBro’s assistant can’t help treat a disease or condition. It only suggests over-the-counter medicines to ease everyday symptoms for a short time. Please ask your doctor or pharmacist.';
export const NONE_REPLY = 'MediBro didn’t recognize a symptom it knows about. Try a few words, like “headache”, “runny nose”, “heartburn” or “can’t sleep”. Or ask your pharmacist.';

/** What gets read aloud: the short version of the answer, then the disclaimer. */
export function spokenAnswer(a: Answer): string[] {
  const lines: string[] = [];
  if (a.kind === 'dispose') return spokenDisposal(a.saved);
  if (a.kind === 'emergency') a.flags.forEach((f) => lines.push(f.title + '.', f.message));
  else if (a.kind === 'rx') lines.push(RX_REPLY);
  else if (a.kind === 'disease') lines.push(DISEASE_REPLY);
  else if (a.kind === 'none') lines.push(NONE_REPLY);
  else {
    lines.push(...a.notes);
    lines.push(`For ${a.symptoms.map((s) => s.label.toLowerCase()).join(' and ')}, over-the-counter choices include:`);
    for (const s of a.suggestions) {
      lines.push(`${s.ingredient.name}${s.ingredient.brands.length ? `, for example ${s.ingredient.brands[0]}` : ''}. ${s.ingredient.helps}`);
      for (const w of s.warnings) lines.push(w.text);
    }
    lines.push(LABEL_REMINDER);
  }
  if (a.kind !== 'emergency') lines.push(SPOKEN_DISCLAIMER);
  else lines.push('This app can’t help with emergencies. Please call now.');
  return lines;
}

export { INGREDIENTS };

export const SHORT_DISCLAIMER = 'Follow the package label. This isn’t medical advice.';

/** What's said out loud automatically: short. The full answer stays on screen.
    Emergencies lead with the emergency line; disposal is the steps and the call question. */
export function shortSpoken(a: Answer): string[] {
  switch (a.kind) {
    case 'emergency':
      return [...a.flags.flatMap((f) => [f.message, f.title + '.']), 'Please call now.'];
    case 'dispose':
      return spokenDisposal(a.saved);
    case 'rx':
      return ['I only cover over-the-counter medicines for symptoms. Please ask your pharmacist or doctor.', SHORT_DISCLAIMER];
    case 'disease':
      return ['I can’t help treat a disease. I only suggest over-the-counter medicines for everyday symptoms. Please ask your doctor.', SHORT_DISCLAIMER];
    case 'none':
      return ['I didn’t recognize a symptom. Try a few words, like headache or runny nose.'];
    case 'suggest': {
      const lines: string[] = [];
      const top = a.suggestions.slice(0, 2);
      const what = a.symptoms.map((s) => s.label.toLowerCase()).join(' and ');
      if (!top.length) lines.push(`For ${what}, please ask your pharmacist.`);
      top.forEach((s, i) => {
        const ing = s.ingredient;
        const brand = ing.brands[0] ? `, like ${ing.brands[0].replace(/\s*\(.*\)/, '')}` : '';
        lines.push(i === 0 ? `For ${what}, you could try ${ing.name.toLowerCase()}${brand}.` : `Or ${ing.name.toLowerCase()}${brand}.`);
        // the person's own warning matters most; otherwise the first caution
        lines.push(s.warnings[0]?.text ?? ing.cautions[0]);
      });
      if (a.leftOut.length) lines.push('I left out some because of your allergies.');
      lines.push(SHORT_DISCLAIMER);
      return lines;
    }
  }
}

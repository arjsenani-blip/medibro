/* ────────────────────────────────────────────────────────────────────
   Directions ("sig") reader.

   Pharmacy directions use a small, regular vocabulary ("TAKE 1 TAB PO BID").
   We parse them into a structure, then write that structure out in each
   language from checked sentence templates. We never machine-translate:
   if any word in the directions isn't understood, `parseSig` reports it and
   the app shows the original text instead of guessing.
   ──────────────────────────────────────────────────────────────────── */

export type Lang = 'en' | 'es' | 'pt' | 'zh' | 'vi' | 'fr';

export const LANGUAGES: { code: Lang; name: string; english: string; speech: string }[] = [
  { code: 'en', name: 'English', english: 'English', speech: 'en-US' },
  { code: 'es', name: 'Español', english: 'Spanish', speech: 'es-US' },
  { code: 'pt', name: 'Português', english: 'Portuguese', speech: 'pt-BR' },
  { code: 'zh', name: '中文', english: 'Chinese', speech: 'zh-CN' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', speech: 'vi-VN' },
  { code: 'fr', name: 'Français', english: 'French', speech: 'fr-FR' },
];

type Action = 'take' | 'apply' | 'inhale' | 'instill' | 'use' | 'inject' | 'place' | 'insert' | 'chew' | 'dissolve';
type Unit = 'tablet' | 'capsule' | 'puff' | 'drop' | 'ml' | 'teaspoon' | 'patch' | 'spray' | 'unit';
type Route = 'mouth' | 'skin' | 'under_tongue' | 'on_tongue' | 'in_mouth' | 'eye_each' | 'eye_left' | 'eye_right' | 'ear_each' | 'nose_each';
type Reason = 'pain' | 'nausea' | 'sleep' | 'anxiety' | 'breath' | 'itching' | 'fever' | 'cough' | 'headache';

export interface Sig {
  action: Action;
  amount: number | null; // 0.5, 1, 2…
  unit: Unit | null;
  route: Route | null;
  timesPerDay: number | null;
  everyHours: [number, number] | null; // [4, 6] = every 4 to 6 hours
  weekly: boolean;
  morning: boolean;
  bedtime: boolean;
  asNeeded: boolean;
  reason: Reason | null;
  food: 'with' | 'empty' | null;
  days: number | null;
}

export interface SigResult {
  sig: Sig | null;
  /** what it's for, as printed ("BLOOD PRESSURE") — shown as-is, never translated */
  purpose: string | null;
  /** words we couldn't interpret — if any, don't translate */
  unknown: string[];
}

const NUMBER_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, EIGHT: 8, TEN: 10, TWELVE: 12, HALF: 0.5 };

const ACTIONS: Record<string, Action> = {
  TAKE: 'take', GIVE: 'take', APPLY: 'apply', RUB: 'apply', INHALE: 'inhale', INSTILL: 'instill', PUT: 'instill',
  USE: 'use', SPRAY: 'use', INJECT: 'inject', PLACE: 'place', INSERT: 'insert', CHEW: 'chew', DISSOLVE: 'dissolve',
};

const UNITS: [RegExp, Unit][] = [
  [/^(TABLETS?|TABS?)$/, 'tablet'],
  [/^(CAPSULES?|CAPS?)$/, 'capsule'],
  [/^(PUFFS?|INHALATIONS?)$/, 'puff'],
  [/^(DROPS?|GTTS?)$/, 'drop'],
  [/^(ML|MLS|MILLILITERS?)$/, 'ml'],
  [/^(TEASPOONS?|TEASPOONFULS?|TSP)$/, 'teaspoon'],
  [/^(PATCH|PATCHES)$/, 'patch'],
  [/^(SPRAYS?)$/, 'spray'],
  [/^(UNITS?)$/, 'unit'],
];

const REASONS: [RegExp, Reason][] = [
  [/^(PAIN)$/, 'pain'],
  [/^(NAUSEA|VOMITING)$/, 'nausea'],
  [/^(SLEEP|INSOMNIA)$/, 'sleep'],
  [/^(ANXIETY)$/, 'anxiety'],
  [/^(WHEEZING|SOB)$/, 'breath'],
  [/^(ITCHING|ITCH)$/, 'itching'],
  [/^(FEVER)$/, 'fever'],
  [/^(COUGH)$/, 'cough'],
  [/^(HEADACHE|HEADACHES)$/, 'headache'],
];

/** Phrases replaced before word-by-word parsing (order matters: longest first). */
const PHRASES: [RegExp, string][] = [
  [/\bSHORTNESS OF BREATH\b/g, ' SOB '],
  [/\bBY MOUTH\b|\bORALLY\b|\bP\.?O\.?\b/g, ' @MOUTH '],
  [/\bUNDER THE TONGUE\b|\bSUBLINGUALLY\b|\bS\.?L\.?\b/g, ' @UNDERTONGUE '],
  // orally disintegrating tablets: "PLACE 1 TABLET ON THE TONGUE AND LET DISSOLVE"
  [/\bON (TOP OF )?(THE )?TONGUE\b/g, ' @ONTONGUE '],
  [/\bIN (THE )?MOUTH\b/g, ' @INMOUTH '],
  [/\b(AND )?(LET|ALLOW) (IT )?(TO )?(DISSOLVE|MELT)\b/g, ' @LETDISSOLVE '],
  [/\bNAUSEA (OR|AND|\/) VOMITING\b/g, ' NAUSEA '],
  [/\bTO (THE )?(AFFECTED )?(AREA|SKIN)S?\b|\bTOPICALLY\b|\bON (THE )?SKIN\b/g, ' @SKIN '],
  [/\bIN(TO)? (EACH|BOTH) EYES?\b|\bO\.?U\.?\b/g, ' @EYEEACH '],
  [/\bIN(TO)? (THE )?LEFT EYE\b|\bO\.?S\.?\b/g, ' @EYELEFT '],
  [/\bIN(TO)? (THE )?RIGHT EYE\b|\bO\.?D\.?\b/g, ' @EYERIGHT '],
  [/\bIN(TO)? (EACH|BOTH) EARS?\b/g, ' @EAREACH '],
  [/\bIN(TO)? (EACH|BOTH) NOSTRILS?\b|\bIN(TO)? EACH SIDE OF (THE )?NOSE\b/g, ' @NOSEEACH '],
  [/\bTWICE (A |PER )?DAY\b|\bTWICE DAILY\b|\b2 TIMES (A |PER |EACH )?DAY\b|\b2 TIMES DAILY\b|\bBID\b|\bB\.I\.D\.\b/g, ' @X2 '],
  [/\b(THREE|3) TIMES (A |PER |EACH )?DAY\b|\b(THREE|3) TIMES DAILY\b|\bTID\b|\bT\.I\.D\.\b/g, ' @X3 '],
  [/\b(FOUR|4) TIMES (A |PER |EACH )?DAY\b|\b(FOUR|4) TIMES DAILY\b|\bQID\b|\bQ\.I\.D\.\b/g, ' @X4 '],
  [/\bONCE (A |PER |EVERY )?DAY\b|\bONCE DAILY\b|\bEVERY DAY\b|\bDAILY\b|\bQD\b|\bQ\.D\.\b/g, ' @X1 '],
  [/\bONCE (A |PER |EVERY )?WEEK\b|\bONCE WEEKLY\b|\bWEEKLY\b|\bEVERY WEEK\b/g, ' @WEEKLY '],
  [/\bAT BEDTIME\b|\bBEFORE BED(TIME)?\b|\bQHS\b|\bHS\b/g, ' @BEDTIME '],
  [/\bIN THE MORNING\b|\bEVERY MORNING\b|\bQAM\b/g, ' @MORNING '],
  [/\bAS NEEDED\b|\bIF NEEDED\b|\bPRN\b|\bWHEN NEEDED\b/g, ' @PRN '],
  [/\bWITH (FOOD|MEALS?|A MEAL)\b/g, ' @WITHFOOD '],
  [/\bON AN EMPTY STOMACH\b|\bON EMPTY STOMACH\b/g, ' @EMPTY '],
  [/\bONE[- ]HALF\b|\b1\/2\b|\bHALF (A|OF A)\b/g, ' HALF '],
];

const FILLER = new Set(['A', 'AN', 'THE', 'AND', 'THEN', 'OF', 'TO', 'FOR', 'UP']);

export function parseSig(text: string): SigResult {
  let s = ` ${text.toUpperCase().replace(/[,;:]/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ')} `;
  for (const [re, rep] of PHRASES) s = s.replace(re, rep);

  // "EVERY 4 TO 6 HOURS", "EVERY 8 HOURS", "Q6H", "Q4-6H"
  let everyHours: [number, number] | null = null;
  s = s.replace(/\bEVERY (\d{1,2})(?: ?(?:TO|-) ?(\d{1,2}))? (?:HOURS?|HRS?)\b|\bQ(\d{1,2})(?:-(\d{1,2}))?H\b/g, (_m, a, b, c, d) => {
    const lo = Number(a ?? c);
    const hi = Number(b ?? d ?? lo);
    everyHours = [lo, hi];
    return ' @EVERYH ';
  });
  // "FOR 10 DAYS"
  let days: number | null = null;
  s = s.replace(/\bFOR (\d{1,3}) DAYS?\b/g, (_m, n) => {
    days = Number(n);
    return ' @DAYS ';
  });

  const words = s.trim().split(' ').filter(Boolean);
  const sig: Sig = { action: 'take', amount: null, unit: null, route: null, timesPerDay: null, everyHours, weekly: false, morning: false, bedtime: false, asNeeded: false, reason: null, food: null, days };
  const unknown: string[] = [];
  let sawAction = false;
  let purpose: string | null = null;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "… FOR BLOOD PRESSURE": the purpose, kept in the label's words
    if (w === 'FOR' && words[i - 1] !== '@PRN' && words[i + 1] && !words[i + 1].startsWith('@')) {
      const rest: string[] = [];
      while (words[i + 1] && !words[i + 1].startsWith('@')) rest.push(words[++i]);
      purpose = rest.join(' ');
      continue;
    }
    if (!sawAction && ACTIONS[w]) {
      sig.action = ACTIONS[w];
      sawAction = true;
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(w) && sig.amount == null) {
      sig.amount = Number(w);
      continue;
    }
    if (NUMBER_WORDS[w] != null && sig.amount == null) {
      sig.amount = NUMBER_WORDS[w];
      continue;
    }
    const unit = UNITS.find(([re]) => re.test(w));
    if (unit && !sig.unit) {
      sig.unit = unit[1];
      continue;
    }
    const reason = REASONS.find(([re]) => re.test(w));
    if (reason && sig.asNeeded && !sig.reason) {
      sig.reason = reason[1];
      continue;
    }
    switch (w) {
      case '@MOUTH': sig.route = 'mouth'; continue;
      case '@UNDERTONGUE': sig.route = 'under_tongue'; continue;
      case '@ONTONGUE': sig.route = 'on_tongue'; continue;
      case '@INMOUTH': sig.route = 'in_mouth'; continue;
      case '@LETDISSOLVE': sig.action = 'dissolve'; continue;
      case '@SKIN': sig.route = 'skin'; continue;
      case '@EYEEACH': sig.route = 'eye_each'; continue;
      case '@EYELEFT': sig.route = 'eye_left'; continue;
      case '@EYERIGHT': sig.route = 'eye_right'; continue;
      case '@EAREACH': sig.route = 'ear_each'; continue;
      case '@NOSEEACH': sig.route = 'nose_each'; continue;
      case '@X1': sig.timesPerDay = 1; continue;
      case '@X2': sig.timesPerDay = 2; continue;
      case '@X3': sig.timesPerDay = 3; continue;
      case '@X4': sig.timesPerDay = 4; continue;
      case '@WEEKLY': sig.weekly = true; continue;
      case '@BEDTIME': sig.bedtime = true; continue;
      case '@MORNING': sig.morning = true; continue;
      case '@PRN': sig.asNeeded = true; continue;
      case '@WITHFOOD': sig.food = 'with'; continue;
      case '@EMPTY': sig.food = 'empty'; continue;
      case '@EVERYH':
      case '@DAYS':
        continue;
    }
    if (FILLER.has(w)) continue;
    unknown.push(w);
  }

  if (!sawAction) return { sig: null, purpose, unknown: ['(no action word like TAKE or APPLY)', ...unknown] };
  const hasTiming = sig.timesPerDay || sig.everyHours || sig.weekly || sig.morning || sig.bedtime || sig.asNeeded;
  if (!hasTiming) unknown.push('(no timing like DAILY or EVERY 8 HOURS)');
  if (sig.amount != null && !sig.unit && sig.action !== 'apply') unknown.push('(amount without a unit)');
  return { sig, purpose, unknown };
}

/* ── Writing directions out ──────────────────────────────────────── */

const half = (n: number) => (n === 0.5 ? '½' : String(n));
const plural = (n: number | null) => n != null && n > 1;

interface Vocab {
  verb: Record<Action, string>;
  unit: Record<Unit, [string, string]>; // singular, plural
  route: Record<Route, string>;
  times: (n: number) => string;
  everyHours: (lo: number, hi: number) => string;
  weekly: string;
  morning: string;
  bedtime: string;
  asNeeded: string;
  forReason: (r: string) => string;
  reason: Record<Reason, string>;
  withFood: string;
  empty: string;
  days: (n: number) => string;
}

const EN: Vocab = {
  verb: { take: 'Take', apply: 'Apply', inhale: 'Inhale', instill: 'Put', use: 'Use', inject: 'Inject', place: 'Place', insert: 'Insert', chew: 'Chew', dissolve: 'Dissolve' },
  unit: { tablet: ['tablet', 'tablets'], capsule: ['capsule', 'capsules'], puff: ['puff', 'puffs'], drop: ['drop', 'drops'], ml: ['mL', 'mL'], teaspoon: ['teaspoon', 'teaspoons'], patch: ['patch', 'patches'], spray: ['spray', 'sprays'], unit: ['unit', 'units'] },
  route: { mouth: 'by mouth', skin: 'to the skin', under_tongue: 'under the tongue', on_tongue: 'on the tongue', in_mouth: 'in the mouth', eye_each: 'in each eye', eye_left: 'in the left eye', eye_right: 'in the right eye', ear_each: 'in each ear', nose_each: 'in each nostril' },
  times: (n) => (n === 1 ? 'once a day' : n === 2 ? 'twice a day' : `${n} times a day`),
  everyHours: (lo, hi) => (lo === hi ? `every ${lo} hours` : `every ${lo} to ${hi} hours`),
  weekly: 'once a week',
  morning: 'in the morning',
  bedtime: 'at bedtime',
  asNeeded: 'only when needed',
  forReason: (r) => `for ${r}`,
  reason: { pain: 'pain', nausea: 'nausea', sleep: 'sleep', anxiety: 'anxiety', breath: 'shortness of breath', itching: 'itching', fever: 'fever', cough: 'cough', headache: 'headache' },
  withFood: 'with food',
  empty: 'on an empty stomach',
  days: (n) => `for ${n} days`,
};

const ES: Vocab = {
  verb: { take: 'Tome', apply: 'Aplique', inhale: 'Inhale', instill: 'Aplique', use: 'Use', inject: 'Inyecte', place: 'Coloque', insert: 'Inserte', chew: 'Mastique', dissolve: 'Disuelva' },
  unit: { tablet: ['tableta', 'tabletas'], capsule: ['cápsula', 'cápsulas'], puff: ['inhalación', 'inhalaciones'], drop: ['gota', 'gotas'], ml: ['mL', 'mL'], teaspoon: ['cucharadita', 'cucharaditas'], patch: ['parche', 'parches'], spray: ['atomización', 'atomizaciones'], unit: ['unidad', 'unidades'] },
  route: { mouth: 'por vía oral', skin: 'en la piel', under_tongue: 'debajo de la lengua', on_tongue: 'sobre la lengua', in_mouth: 'en la boca', eye_each: 'en cada ojo', eye_left: 'en el ojo izquierdo', eye_right: 'en el ojo derecho', ear_each: 'en cada oído', nose_each: 'en cada fosa nasal' },
  times: (n) => (n === 1 ? 'una vez al día' : `${n} veces al día`),
  everyHours: (lo, hi) => (lo === hi ? `cada ${lo} horas` : `cada ${lo} a ${hi} horas`),
  weekly: 'una vez a la semana',
  morning: 'por la mañana',
  bedtime: 'a la hora de acostarse',
  asNeeded: 'solo cuando sea necesario',
  forReason: (r) => `para ${r}`,
  reason: { pain: 'el dolor', nausea: 'las náuseas', sleep: 'dormir', anxiety: 'la ansiedad', breath: 'la falta de aire', itching: 'la picazón', fever: 'la fiebre', cough: 'la tos', headache: 'el dolor de cabeza' },
  withFood: 'con alimentos',
  empty: 'en ayunas',
  days: (n) => `durante ${n} días`,
};

const PT: Vocab = {
  verb: { take: 'Tome', apply: 'Aplique', inhale: 'Inale', instill: 'Pingue', use: 'Use', inject: 'Injete', place: 'Coloque', insert: 'Insira', chew: 'Mastigue', dissolve: 'Dissolva' },
  unit: { tablet: ['comprimido', 'comprimidos'], capsule: ['cápsula', 'cápsulas'], puff: ['inalação', 'inalações'], drop: ['gota', 'gotas'], ml: ['mL', 'mL'], teaspoon: ['colher de chá', 'colheres de chá'], patch: ['adesivo', 'adesivos'], spray: ['jato', 'jatos'], unit: ['unidade', 'unidades'] },
  route: { mouth: 'por via oral', skin: 'na pele', under_tongue: 'debaixo da língua', on_tongue: 'sobre a língua', in_mouth: 'na boca', eye_each: 'em cada olho', eye_left: 'no olho esquerdo', eye_right: 'no olho direito', ear_each: 'em cada ouvido', nose_each: 'em cada narina' },
  times: (n) => (n === 1 ? 'uma vez ao dia' : `${n} vezes ao dia`),
  everyHours: (lo, hi) => (lo === hi ? `a cada ${lo} horas` : `a cada ${lo} a ${hi} horas`),
  weekly: 'uma vez por semana',
  morning: 'pela manhã',
  bedtime: 'na hora de dormir',
  asNeeded: 'somente quando necessário',
  forReason: (r) => `para ${r}`,
  reason: { pain: 'dor', nausea: 'náusea', sleep: 'dormir', anxiety: 'ansiedade', breath: 'falta de ar', itching: 'coceira', fever: 'febre', cough: 'tosse', headache: 'dor de cabeça' },
  withFood: 'com alimentos',
  empty: 'em jejum',
  days: (n) => `por ${n} dias`,
};

const FR: Vocab = {
  verb: { take: 'Prenez', apply: 'Appliquez', inhale: 'Inhalez', instill: 'Instillez', use: 'Utilisez', inject: 'Injectez', place: 'Placez', insert: 'Insérez', chew: 'Mâchez', dissolve: 'Laissez fondre' },
  unit: { tablet: ['comprimé', 'comprimés'], capsule: ['gélule', 'gélules'], puff: ['bouffée', 'bouffées'], drop: ['goutte', 'gouttes'], ml: ['mL', 'mL'], teaspoon: ['cuillère à café', 'cuillères à café'], patch: ['patch', 'patchs'], spray: ['pulvérisation', 'pulvérisations'], unit: ['unité', 'unités'] },
  route: { mouth: 'par la bouche', skin: 'sur la peau', under_tongue: 'sous la langue', on_tongue: 'sur la langue', in_mouth: 'dans la bouche', eye_each: 'dans chaque œil', eye_left: "dans l'œil gauche", eye_right: "dans l'œil droit", ear_each: 'dans chaque oreille', nose_each: 'dans chaque narine' },
  times: (n) => (n === 1 ? 'une fois par jour' : `${n} fois par jour`),
  everyHours: (lo, hi) => (lo === hi ? `toutes les ${lo} heures` : `toutes les ${lo} à ${hi} heures`),
  weekly: 'une fois par semaine',
  morning: 'le matin',
  bedtime: 'au coucher',
  asNeeded: 'seulement si nécessaire',
  forReason: (r) => `en cas de ${r}`,
  reason: { pain: 'douleur', nausea: 'nausées', sleep: 'troubles du sommeil', anxiety: 'anxiété', breath: 'essoufflement', itching: 'démangeaisons', fever: 'fièvre', cough: 'toux', headache: 'mal de tête' },
  withFood: 'pendant un repas',
  empty: 'à jeun',
  days: (n) => `pendant ${n} jours`,
};

/** Latin-script languages share one sentence shape: verb · amount unit · route · timing · food · duration. */
function westernSentence(s: Sig, v: Vocab): string {
  const parts: string[] = [v.verb[s.action]];
  if (s.amount != null && s.unit) parts.push(`${half(s.amount)} ${v.unit[s.unit][plural(s.amount) ? 1 : 0]}`);
  else if (s.amount != null) parts.push(half(s.amount));
  if (s.route) parts.push(v.route[s.route]);
  const timing: string[] = [];
  if (s.timesPerDay) timing.push(v.times(s.timesPerDay));
  if (s.everyHours) timing.push(v.everyHours(s.everyHours[0], s.everyHours[1]));
  if (s.weekly) timing.push(v.weekly);
  if (s.morning) timing.push(v.morning);
  if (s.bedtime) timing.push(v.bedtime);
  if (s.asNeeded) timing.push(s.reason ? `${v.asNeeded} ${v.forReason(v.reason[s.reason])}` : v.asNeeded);
  if (s.food) timing.push(s.food === 'with' ? v.withFood : v.empty);
  if (s.days) timing.push(v.days(s.days));
  return `${[...parts, ...timing].join(' ')}.`;
}

/* Chinese: timing first, then "each time" + action + amount. */
const ZH_UNIT: Record<Unit, string> = { tablet: '片', capsule: '粒', puff: '喷', drop: '滴', ml: '毫升', teaspoon: '茶匙', patch: '贴', spray: '喷', unit: '单位' };
const ZH_REASON: Record<Reason, string> = { pain: '疼痛', nausea: '恶心', sleep: '失眠', anxiety: '焦虑', breath: '气短', itching: '瘙痒', fever: '发烧', cough: '咳嗽', headache: '头痛' };
function zhSentence(s: Sig): string {
  const timing: string[] = [];
  if (s.weekly) timing.push('每周1次');
  if (s.timesPerDay) timing.push(`每天${s.timesPerDay}次`);
  if (s.everyHours) timing.push(s.everyHours[0] === s.everyHours[1] ? `每${s.everyHours[0]}小时1次` : `每${s.everyHours[0]}到${s.everyHours[1]}小时1次`);
  if (s.morning) timing.push('早上');
  if (s.bedtime) timing.push('睡前');
  if (s.asNeeded) timing.push(s.reason ? `${ZH_REASON[s.reason]}时才用` : '需要时才用');
  const amt = s.amount != null ? `${half(s.amount)}${s.unit ? ZH_UNIT[s.unit] : ''}` : '';
  let dose: string;
  switch (s.route) {
    case 'mouth':
      dose = `每次口服${amt}`;
      break;
    case 'under_tongue':
      dose = `每次舌下含服${amt}`;
      break;
    case 'on_tongue':
      dose = `每次${amt}，放在舌头上溶化`;
      break;
    case 'in_mouth':
      dose = `每次${amt}，放在口中溶化`;
      break;
    case 'eye_each':
    case 'eye_left':
    case 'eye_right':
      dose = `每次${amt}，滴入${s.route === 'eye_each' ? '双眼' : s.route === 'eye_left' ? '左眼' : '右眼'}`;
      break;
    case 'ear_each':
      dose = `每次${amt}，滴入双耳`;
      break;
    case 'nose_each':
      dose = `每次${amt}，喷入每侧鼻孔`;
      break;
    case 'skin':
      dose = amt ? `每次${amt}，涂于皮肤` : '涂于皮肤';
      break;
    default:
      dose = s.action === 'inhale' ? `每次吸入${amt}` : s.action === 'inject' ? `每次注射${amt}` : s.action === 'chew' ? `每次嚼服${amt}` : `每次${amt}`;
  }
  const extra: string[] = [];
  if (s.food) extra.push(s.food === 'with' ? '随餐服用' : '空腹服用');
  if (s.days) extra.push(`连续${s.days}天`);
  return `${[...timing, dose, ...extra].filter(Boolean).join('，')}。`;
}

/* Vietnamese: verb chosen by route, then timing. */
const VI_UNIT: Record<Unit, string> = { tablet: 'viên', capsule: 'viên', puff: 'nhát', drop: 'giọt', ml: 'mL', teaspoon: 'thìa cà phê', patch: 'miếng dán', spray: 'lần xịt', unit: 'đơn vị' };
const VI_REASON: Record<Reason, string> = { pain: 'đau', nausea: 'buồn nôn', sleep: 'mất ngủ', anxiety: 'lo âu', breath: 'khó thở', itching: 'ngứa', fever: 'sốt', cough: 'ho', headache: 'đau đầu' };
function viSentence(s: Sig): string {
  const amt = s.amount != null ? `${half(s.amount)}${s.unit ? ` ${VI_UNIT[s.unit]}` : ''}` : '';
  let dose: string;
  switch (s.route) {
    case 'mouth':
      dose = s.action === 'chew' ? `Nhai ${amt}` : `Uống ${amt}`;
      break;
    case 'under_tongue':
      dose = `Ngậm ${amt} dưới lưỡi`;
      break;
    case 'on_tongue':
      dose = `Đặt ${amt} lên lưỡi cho tan`;
      break;
    case 'in_mouth':
      dose = `Ngậm ${amt} trong miệng cho tan`;
      break;
    case 'eye_each':
      dose = `Nhỏ ${amt} vào mỗi mắt`;
      break;
    case 'eye_left':
      dose = `Nhỏ ${amt} vào mắt trái`;
      break;
    case 'eye_right':
      dose = `Nhỏ ${amt} vào mắt phải`;
      break;
    case 'ear_each':
      dose = `Nhỏ ${amt} vào mỗi tai`;
      break;
    case 'nose_each':
      dose = `Xịt ${amt} vào mỗi bên mũi`;
      break;
    case 'skin':
      dose = amt ? `Bôi ${amt} lên da` : 'Bôi lên da';
      break;
    default:
      dose = s.action === 'inhale' ? `Hít ${amt}` : s.action === 'inject' ? `Tiêm ${amt}` : s.action === 'chew' ? `Nhai ${amt}` : `Dùng ${amt}`;
  }
  const timing: string[] = [];
  if (s.timesPerDay) timing.push(`mỗi ngày ${s.timesPerDay} lần`);
  if (s.everyHours) timing.push(s.everyHours[0] === s.everyHours[1] ? `cứ ${s.everyHours[0]} giờ một lần` : `cứ ${s.everyHours[0]} đến ${s.everyHours[1]} giờ một lần`);
  if (s.weekly) timing.push('mỗi tuần 1 lần');
  if (s.morning) timing.push('vào buổi sáng');
  if (s.bedtime) timing.push('trước khi đi ngủ');
  if (s.asNeeded) timing.push(s.reason ? `chỉ khi cần, khi bị ${VI_REASON[s.reason]}` : 'chỉ khi cần');
  if (s.food) timing.push(s.food === 'with' ? 'trong bữa ăn' : 'khi bụng đói');
  if (s.days) timing.push(`trong ${s.days} ngày`);
  return `${[dose.trim(), ...timing].join(', ')}.`;
}

export function writeSig(s: Sig, lang: Lang): string {
  switch (lang) {
    case 'en':
      return westernSentence(s, EN);
    case 'es':
      return westernSentence(s, ES);
    case 'pt':
      return westernSentence(s, PT);
    case 'fr':
      return westernSentence(s, FR);
    case 'zh':
      return zhSentence(s);
    case 'vi':
      return viSentence(s);
  }
}

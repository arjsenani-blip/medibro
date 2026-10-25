import type { Lang } from './sig';

/* Standard pharmacy warning stickers ("auxiliary labels"), found by keyword
   and written out from fixed translations. */

export type WarningId =
  | 'drowsy' | 'dizzy' | 'alcohol' | 'driving' | 'food' | 'empty' | 'water' | 'finish'
  | 'sun' | 'whole' | 'fridge' | 'shake' | 'external' | 'grapefruit';

const RULES: { id: WarningId; test: RegExp }[] = [
  { id: 'drowsy', test: /DROWS|SLEEPY/ },
  { id: 'dizzy', test: /DIZZ/ },
  { id: 'alcohol', test: /ALCOHOL/ },
  { id: 'driving', test: /\bDRIV|OPERAT\w* (HEAVY )?MACHIN/ },
  { id: 'food', test: /WITH (FOOD|MEALS?|MILK)/ },
  { id: 'empty', test: /EMPTY STOMACH|1 HOUR BEFORE|ONE HOUR BEFORE/ },
  { id: 'water', test: /(FULL|PLENTY OF|LOTS OF) (GLASS OF )?WATER/ },
  { id: 'finish', test: /FINISH ALL|COMPLETE (THE )?(ENTIRE )?(COURSE|PRESCRIPTION)/ },
  { id: 'sun', test: /\bSUN(LIGHT|LAMP)?\b|SUNBURN|ULTRAVIOLET/ },
  { id: 'whole', test: /SWALLOW WHOLE|DO NOT (CRUSH|CHEW|BREAK)/ },
  { id: 'fridge', test: /REFRIGERAT/ },
  { id: 'shake', test: /SHAKE WELL/ },
  { id: 'external', test: /EXTERNAL USE|FOR USE ON (THE )?SKIN|DO NOT SWALLOW/ },
  { id: 'grapefruit', test: /GRAPEFRUIT/ },
];

export const WARNING_TEXT: Record<WarningId, Record<Lang, string>> = {
  drowsy: {
    en: 'May make you drowsy.',
    es: 'Puede causar somnolencia.',
    pt: 'Pode causar sonolência.',
    zh: '可能引起嗜睡。',
    vi: 'Có thể gây buồn ngủ.',
    fr: 'Peut provoquer une somnolence.',
  },
  dizzy: {
    en: 'May make you dizzy.',
    es: 'Puede causar mareos.',
    pt: 'Pode causar tontura.',
    zh: '可能引起头晕。',
    vi: 'Có thể gây chóng mặt.',
    fr: 'Peut provoquer des étourdissements.',
  },
  alcohol: {
    en: 'Do not drink alcohol while taking this medicine.',
    es: 'No tome bebidas alcohólicas mientras use este medicamento.',
    pt: 'Não beba álcool enquanto usar este medicamento.',
    zh: '服用本药期间请勿饮酒。',
    vi: 'Không uống rượu bia trong thời gian dùng thuốc này.',
    fr: "Ne buvez pas d'alcool pendant que vous prenez ce médicament.",
  },
  driving: {
    en: 'Be careful driving or using machines.',
    es: 'Tenga cuidado al manejar o usar máquinas.',
    pt: 'Tenha cuidado ao dirigir ou operar máquinas.',
    zh: '驾驶或操作机器时请小心。',
    vi: 'Cẩn thận khi lái xe hoặc vận hành máy móc.',
    fr: 'Soyez prudent en conduisant ou en utilisant des machines.',
  },
  food: {
    en: 'Take with food.',
    es: 'Tómelo con alimentos.',
    pt: 'Tome com alimentos.',
    zh: '随餐服用。',
    vi: 'Uống trong bữa ăn.',
    fr: 'À prendre pendant un repas.',
  },
  empty: {
    en: 'Take on an empty stomach.',
    es: 'Tómelo en ayunas.',
    pt: 'Tome em jejum.',
    zh: '空腹服用。',
    vi: 'Uống khi bụng đói.',
    fr: 'À prendre à jeun.',
  },
  water: {
    en: 'Take with a full glass of water.',
    es: 'Tómelo con un vaso lleno de agua.',
    pt: 'Tome com um copo cheio de água.',
    zh: '用一整杯水送服。',
    vi: 'Uống với một cốc nước đầy.',
    fr: "À prendre avec un grand verre d'eau.",
  },
  finish: {
    en: 'Finish all of this medicine, even if you feel better.',
    es: 'Termine todo este medicamento, aunque se sienta mejor.',
    pt: 'Termine todo este medicamento, mesmo que se sinta melhor.',
    zh: '即使感觉好转，也要服完全部药物。',
    vi: 'Dùng hết thuốc này, kể cả khi bạn thấy đỡ hơn.',
    fr: 'Prenez tout ce médicament, même si vous vous sentez mieux.',
  },
  sun: {
    en: 'Stay out of strong sunlight. Your skin may burn more easily.',
    es: 'Evite la luz solar intensa. Su piel puede quemarse con más facilidad.',
    pt: 'Evite sol forte. Sua pele pode se queimar com mais facilidade.',
    zh: '避免强烈日晒，皮肤可能更容易晒伤。',
    vi: 'Tránh ánh nắng gắt. Da của bạn có thể dễ bị cháy nắng hơn.',
    fr: 'Évitez le soleil fort. Votre peau peut brûler plus facilement.',
  },
  whole: {
    en: 'Swallow whole. Do not crush or chew.',
    es: 'Tráguelo entero. No lo triture ni lo mastique.',
    pt: 'Engula inteiro. Não esmague nem mastigue.',
    zh: '整片吞服，不要压碎或咀嚼。',
    vi: 'Nuốt nguyên viên. Không nghiền hoặc nhai.',
    fr: "Avalez en entier. Ne pas écraser ni croquer.",
  },
  fridge: {
    en: 'Keep in the refrigerator.',
    es: 'Guárdelo en el refrigerador.',
    pt: 'Guarde na geladeira.',
    zh: '请冷藏保存。',
    vi: 'Bảo quản trong tủ lạnh.',
    fr: 'À conserver au réfrigérateur.',
  },
  shake: {
    en: 'Shake well before using.',
    es: 'Agítelo bien antes de usarlo.',
    pt: 'Agite bem antes de usar.',
    zh: '使用前摇匀。',
    vi: 'Lắc kỹ trước khi dùng.',
    fr: 'Bien agiter avant emploi.',
  },
  external: {
    en: 'For use on the skin only. Do not swallow.',
    es: 'Solo para uso en la piel. No lo trague.',
    pt: 'Somente para uso na pele. Não engula.',
    zh: '仅供外用，切勿吞服。',
    vi: 'Chỉ dùng ngoài da. Không được nuốt.',
    fr: 'Usage externe uniquement. Ne pas avaler.',
  },
  grapefruit: {
    en: 'Do not eat grapefruit or drink grapefruit juice.',
    es: 'No coma toronja ni tome jugo de toronja.',
    pt: 'Não coma toranja nem beba suco de toranja.',
    zh: '不要吃西柚或喝西柚汁。',
    vi: 'Không ăn bưởi chùm hoặc uống nước bưởi chùm.',
    fr: 'Ne mangez pas de pamplemousse et ne buvez pas de jus de pamplemousse.',
  },
};

/** Warnings printed on a label. `exclude` drops ones the directions already say (e.g. "with food"). */
export function findWarnings(text: string, exclude: WarningId[] = []): WarningId[] {
  const t = text.toUpperCase();
  return RULES.filter((r) => r.test.test(t) && !exclude.includes(r.id)).map((r) => r.id);
}

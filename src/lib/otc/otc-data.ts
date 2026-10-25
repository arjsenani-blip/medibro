/* The symptom assistant's whole vocabulary of medicines. Only over-the-counter
   active ingredients sold in the US without a prescription (FDA OTC monograph
   ingredients, or ones the FDA switched to OTC). There are no prescription
   entries, so the assistant has none to name. tests/otc.test.ts fails if an
   entry isn't marked OTC.

   No dose numbers anywhere: every answer tells the person to follow the Drug
   Facts label on the package. */

export type Condition = 'pregnancy' | 'breastfeeding' | 'children' | 'older' | 'kidney' | 'liver' | 'heart' | 'bloodPressure' | 'stomach' | 'glaucomaProstate' | 'diabetes';

export const CONDITION_TEXT: Record<Condition, string> = {
  pregnancy: 'You are pregnant or could be',
  breastfeeding: 'You are breastfeeding',
  children: 'It’s for a child (many products have a separate children’s version, and some aren’t for children at all)',
  older: 'You are 65 or older',
  kidney: 'You have kidney disease',
  liver: 'You have liver disease, or drink 3 or more alcoholic drinks a day',
  heart: 'You have heart disease or have had a heart attack or stroke',
  bloodPressure: 'You have high blood pressure',
  stomach: 'You have had stomach ulcers or bleeding',
  glaucomaProstate: 'You have glaucoma or trouble urinating from an enlarged prostate',
  diabetes: 'You have diabetes or thyroid disease',
};

/** Tags used for allergy and interaction checks. */
export type Tag = 'nsaid' | 'salicylate' | 'antihistamine' | 'sedating' | 'decongestant' | 'acetaminophen' | 'cough-suppressant';

export interface Ingredient {
  id: string;
  name: string; // the active ingredient, as on the Drug Facts label
  otc: true; // every entry must be OTC; the type allows nothing else
  behindCounter?: boolean; // sold without a prescription, but kept behind the pharmacy counter
  form?: string; // "nasal spray", "cream", …
  brands: string[]; // common examples, not endorsements
  helps: string; // plain words
  cautions: string[];
  checkFirst: Condition[];
  tags: Tag[];
  aliases: string[]; // other names on labels, for spotting the same ingredient twice (lowercase)
}

const LABEL = 'Follow the package label for how much and how often.';
export const LABEL_REMINDER = LABEL;

export const INGREDIENTS: Ingredient[] = [
  // ---- pain and fever ----
  {
    id: 'acetaminophen', name: 'Acetaminophen', otc: true, brands: ['Tylenol'],
    helps: 'Eases headache, aches and sore throat pain, and lowers fever. Gentle on the stomach.',
    cautions: [
      'Many cold, flu and sleep products also contain acetaminophen. Use only one product with it at a time.',
      'Taking more than the label says can cause severe liver damage.',
    ],
    checkFirst: ['liver', 'children'], tags: ['acetaminophen'], aliases: ['acetaminophen', 'apap', 'paracetamol', 'tylenol'],
  },
  {
    id: 'ibuprofen', name: 'Ibuprofen', otc: true, brands: ['Advil', 'Motrin IB'],
    helps: 'Eases headache, muscle and joint aches, menstrual cramps and toothache, and lowers fever.',
    cautions: [
      'Can cause stomach bleeding. The risk is higher if you are 60 or older, take a blood thinner or steroid, or drink alcohol.',
      'Don’t take it with other pain relievers like naproxen or aspirin.',
      'Take it with food or milk if it upsets your stomach.',
    ],
    checkFirst: ['pregnancy', 'older', 'kidney', 'heart', 'bloodPressure', 'stomach', 'children'], tags: ['nsaid'], aliases: ['ibuprofen', 'advil', 'motrin'],
  },
  {
    id: 'naproxen', name: 'Naproxen sodium', otc: true, brands: ['Aleve'],
    helps: 'Eases aches, pain and menstrual cramps, and lowers fever. Lasts longer than ibuprofen.',
    cautions: [
      'Can cause stomach bleeding, especially if you are 60 or older or take a blood thinner.',
      'Don’t take it with other pain relievers like ibuprofen or aspirin.',
    ],
    checkFirst: ['pregnancy', 'older', 'kidney', 'heart', 'bloodPressure', 'stomach', 'children'], tags: ['nsaid'], aliases: ['naproxen', 'aleve'],
  },
  {
    id: 'aspirin', name: 'Aspirin', otc: true, brands: ['Bayer', 'Ecotrin'],
    helps: 'Eases headache and minor aches, and lowers fever.',
    cautions: [
      'Never give aspirin to children or teenagers who have or are getting over a viral illness like flu or chickenpox (risk of Reye’s syndrome).',
      'Can cause stomach bleeding, especially with a blood thinner.',
      'Don’t start daily aspirin for your heart unless your doctor tells you to.',
    ],
    checkFirst: ['pregnancy', 'older', 'kidney', 'stomach', 'children'], tags: ['nsaid', 'salicylate'], aliases: ['aspirin', 'acetylsalicylic', 'bayer', 'ecotrin'],
  },

  // ---- allergy ----
  {
    id: 'cetirizine', name: 'Cetirizine', otc: true, brands: ['Zyrtec'],
    helps: 'Eases sneezing, runny nose, itchy watery eyes and hives from allergies. Once a day.',
    cautions: ['Can make some people drowsy. See how it affects you before driving.', 'Avoid alcohol while taking it.'],
    checkFirst: ['kidney', 'liver', 'pregnancy', 'breastfeeding', 'children'], tags: ['antihistamine'], aliases: ['cetirizine', 'zyrtec'],
  },
  {
    id: 'loratadine', name: 'Loratadine', otc: true, brands: ['Claritin', 'Alavert'],
    helps: 'Eases sneezing, runny nose and itchy eyes from allergies. Usually doesn’t cause drowsiness.',
    cautions: ['Products marked “D” also contain a decongestant, which can raise blood pressure.'],
    checkFirst: ['kidney', 'liver', 'children'], tags: ['antihistamine'], aliases: ['loratadine', 'claritin', 'alavert'],
  },
  {
    id: 'fexofenadine', name: 'Fexofenadine', otc: true, brands: ['Allegra'],
    helps: 'Eases sneezing, runny nose and itchy eyes from allergies. Usually doesn’t cause drowsiness.',
    cautions: ['Take it with water, not fruit juice: juice can stop it working well.'],
    checkFirst: ['kidney', 'children'], tags: ['antihistamine'], aliases: ['fexofenadine', 'allegra'],
  },
  {
    id: 'diphenhydramine', name: 'Diphenhydramine', otc: true, brands: ['Benadryl', 'ZzzQuil (for sleep)'],
    helps: 'Eases sneezing, runny nose, itching and hives. Also sold to help with an occasional sleepless night.',
    cautions: [
      'Causes strong drowsiness. Don’t drive or use machines after taking it.',
      'In people 65 and older it can cause confusion, dizziness and falls. Ask a pharmacist about other choices.',
      'Don’t use two products with diphenhydramine at once, including creams on large areas of skin.',
    ],
    checkFirst: ['older', 'glaucomaProstate', 'pregnancy', 'breastfeeding', 'children'], tags: ['antihistamine', 'sedating'], aliases: ['diphenhydramine', 'benadryl', 'zzzquil'],
  },
  {
    id: 'chlorpheniramine', name: 'Chlorpheniramine', otc: true, brands: ['Chlor-Trimeton'],
    helps: 'Eases sneezing, runny nose and itchy watery eyes.',
    cautions: ['Causes drowsiness. Don’t drive after taking it.', 'Can cause confusion and falls in people 65 and older.'],
    checkFirst: ['older', 'glaucomaProstate', 'children'], tags: ['antihistamine', 'sedating'], aliases: ['chlorpheniramine', 'chlor-trimeton'],
  },
  {
    id: 'doxylamine', name: 'Doxylamine', otc: true, brands: ['Unisom SleepTabs'],
    helps: 'Helps with an occasional night when you can’t fall asleep.',
    cautions: ['You may still feel drowsy the next morning. Don’t drive until you’re fully awake.', 'Not for nightly use for more than 2 weeks: see a doctor if sleep trouble goes on.', 'Can cause confusion and falls in people 65 and older.'],
    checkFirst: ['older', 'glaucomaProstate', 'pregnancy', 'children'], tags: ['antihistamine', 'sedating'], aliases: ['doxylamine', 'unisom'],
  },
  {
    id: 'fluticasone', name: 'Fluticasone', otc: true, form: 'nasal spray', brands: ['Flonase'],
    helps: 'Eases stuffy, runny nose and sneezing from allergies. Works best used every day; it can take a few days to help fully.',
    cautions: ['Can cause nosebleeds or nose irritation.', 'Ask a doctor before using it for more than 6 months a year in children.'],
    checkFirst: ['children', 'glaucomaProstate'], tags: [], aliases: ['fluticasone', 'flonase'],
  },
  {
    id: 'ketotifen', name: 'Ketotifen', otc: true, form: 'eye drops', brands: ['Zaditor', 'Alaway'],
    helps: 'Eases itchy eyes from allergies.',
    cautions: ['Take out contact lenses first and wait 10 minutes before putting them back in.'],
    checkFirst: ['children'], tags: ['antihistamine'], aliases: ['ketotifen', 'zaditor', 'alaway'],
  },

  // ---- cold, congestion, cough, throat ----
  {
    id: 'pseudoephedrine', name: 'Pseudoephedrine', otc: true, behindCounter: true, brands: ['Sudafed (from behind the pharmacy counter)'],
    helps: 'Eases a stuffy nose and sinus pressure.',
    cautions: [
      'Kept behind the pharmacy counter. You’ll need to show ID, and there’s a limit on how much you can buy.',
      'Can raise blood pressure and heart rate, and make it hard to sleep.',
    ],
    checkFirst: ['bloodPressure', 'heart', 'diabetes', 'glaucomaProstate', 'children'], tags: ['decongestant'], aliases: ['pseudoephedrine', 'sudafed 12', 'sudafed 24'],
  },
  {
    id: 'phenylephrine', name: 'Phenylephrine', otc: true, brands: ['Sudafed PE'],
    helps: 'Sold for a stuffy nose.',
    cautions: [
      'FDA advisers found in 2023 that phenylephrine taken by mouth doesn’t work well as a decongestant. Ask your pharmacist about other choices.',
      'Can raise blood pressure.',
    ],
    checkFirst: ['bloodPressure', 'heart', 'diabetes', 'glaucomaProstate'], tags: ['decongestant'], aliases: ['phenylephrine', 'sudafed pe'],
  },
  {
    id: 'oxymetazoline', name: 'Oxymetazoline', otc: true, form: 'nasal spray', brands: ['Afrin'],
    helps: 'Quickly opens a stuffy nose.',
    cautions: ['Don’t use it for more than 3 days in a row: the stuffiness can come back worse.'],
    checkFirst: ['bloodPressure', 'heart', 'glaucomaProstate', 'children'], tags: ['decongestant'], aliases: ['oxymetazoline', 'afrin'],
  },
  {
    id: 'saline', name: 'Saline (salt water)', otc: true, form: 'nasal spray or rinse', brands: ['Ocean', 'Simply Saline', 'NeilMed'],
    helps: 'Loosens mucus and soothes a dry or stuffy nose. Safe to use often.',
    cautions: ['For rinses, use distilled, sterile or boiled-then-cooled water, never water straight from the tap.'],
    checkFirst: [], tags: [], aliases: ['saline'],
  },
  {
    id: 'dextromethorphan', name: 'Dextromethorphan', otc: true, brands: ['Delsym', 'Robitussin Cough (DM)'],
    helps: 'Quiets a dry, hacking cough.',
    cautions: [
      'Don’t use it if you take an MAOI medicine for depression or Parkinson’s, or took one in the last 2 weeks.',
      'Many “DM” and multi-symptom products contain it. Use only one at a time.',
    ],
    checkFirst: ['children', 'pregnancy'], tags: ['cough-suppressant'], aliases: ['dextromethorphan', 'delsym'],
  },
  {
    id: 'guaifenesin', name: 'Guaifenesin', otc: true, brands: ['Mucinex', 'Robitussin Chest Congestion'],
    helps: 'Thins mucus so a chesty cough brings it up more easily.',
    cautions: ['Drink plenty of water while you take it.', 'See a doctor if a cough lasts more than a week or comes with fever, rash or a lasting headache.'],
    checkFirst: ['children'], tags: [], aliases: ['guaifenesin', 'mucinex'],
  },
  {
    id: 'menthol-lozenge', name: 'Menthol', otc: true, form: 'lozenges or cough drops', brands: ['Halls', 'Vicks VapoDrops'],
    helps: 'Soothes a sore throat and calms a cough for a short time.',
    cautions: ['Not for children under 5 unless the label says so (choking risk).'],
    checkFirst: ['children'], tags: [], aliases: ['menthol'],
  },
  {
    id: 'benzocaine', name: 'Benzocaine', otc: true, form: 'throat lozenges', brands: ['Cepacol Extra Strength'],
    helps: 'Numbs a sore throat.',
    cautions: ['Never give to children under 2. Rarely it causes a serious blood problem: get help right away for pale, gray or blue skin, headache or a fast heartbeat.'],
    checkFirst: ['children'], tags: [], aliases: ['benzocaine', 'cepacol'],
  },
  {
    id: 'phenol', name: 'Phenol', otc: true, form: 'throat spray', brands: ['Chloraseptic'],
    helps: 'Numbs a sore throat.',
    cautions: ['See a doctor if a sore throat is severe, lasts more than 2 days, or comes with fever, headache, rash or vomiting.'],
    checkFirst: ['children'], tags: [], aliases: ['phenol', 'chloraseptic'],
  },

  // ---- stomach and bowels ----
  {
    id: 'calcium-carbonate', name: 'Calcium carbonate (antacid)', otc: true, form: 'chewable tablets', brands: ['Tums', 'Rolaids'],
    helps: 'Quickly eases heartburn, sour stomach and indigestion.',
    cautions: ['Can stop some other medicines from being absorbed. Take it at a different time from your other medicines; ask your pharmacist.'],
    checkFirst: ['kidney'], tags: [], aliases: ['calcium carbonate', 'tums', 'rolaids'],
  },
  {
    id: 'famotidine', name: 'Famotidine', otc: true, brands: ['Pepcid AC'],
    helps: 'Prevents and eases heartburn and acid indigestion. Lasts longer than an antacid.',
    cautions: ['See a doctor if you have heartburn for more than 2 weeks, trouble or pain swallowing, or vomiting.'],
    checkFirst: ['kidney', 'children'], tags: [], aliases: ['famotidine', 'pepcid'],
  },
  {
    id: 'omeprazole', name: 'Omeprazole', otc: true, brands: ['Prilosec OTC'],
    helps: 'For frequent heartburn (2 or more days a week). Taken as a 14-day course; it takes a day or more to work.',
    cautions: ['Not for quick relief of a single bout of heartburn.', 'Don’t use more than 3 courses a year without asking a doctor.'],
    checkFirst: ['liver', 'pregnancy', 'breastfeeding'], tags: [], aliases: ['omeprazole', 'prilosec'],
  },
  {
    id: 'loperamide', name: 'Loperamide', otc: true, brands: ['Imodium A-D'],
    helps: 'Slows down diarrhea.',
    cautions: [
      'Don’t use it if you have a fever, or blood or mucus in your stool.',
      'Taking more than the label says can cause serious heart problems.',
      'Drink plenty of fluids to replace what you lose.',
    ],
    checkFirst: ['liver', 'children'], tags: [], aliases: ['loperamide', 'imodium'],
  },
  {
    id: 'bismuth', name: 'Bismuth subsalicylate', otc: true, brands: ['Pepto-Bismol', 'Kaopectate'],
    helps: 'Eases diarrhea, upset stomach, nausea, heartburn and indigestion.',
    cautions: [
      'It is related to aspirin. Don’t use it if you’re allergic to aspirin, or give it to children or teenagers getting over flu or chickenpox.',
      'Can turn your tongue or stool black. That’s harmless.',
      'Ask first if you take a blood thinner or medicine for gout or diabetes.',
    ],
    checkFirst: ['pregnancy', 'breastfeeding', 'children'], tags: ['salicylate'], aliases: ['bismuth', 'subsalicylate', 'pepto', 'kaopectate'],
  },
  {
    id: 'peg', name: 'Polyethylene glycol 3350', otc: true, form: 'powder you mix into a drink', brands: ['MiraLAX'],
    helps: 'Softens stool and eases constipation. Usually works in 1 to 3 days.',
    cautions: ['See a doctor if you have constipation with stomach pain, nausea or vomiting, or need it for more than a week.'],
    checkFirst: ['kidney', 'children'], tags: [], aliases: ['polyethylene glycol', 'miralax'],
  },
  {
    id: 'docusate', name: 'Docusate', otc: true, brands: ['Colace'],
    helps: 'A stool softener: makes stool easier to pass.',
    cautions: ['See a doctor if constipation lasts more than a week or you have rectal bleeding.'],
    checkFirst: ['children'], tags: [], aliases: ['docusate', 'colace'],
  },
  {
    id: 'senna', name: 'Senna (sennosides)', otc: true, brands: ['Senokot', 'Ex-Lax'],
    helps: 'A stimulant laxative for occasional constipation. Usually works overnight.',
    cautions: ['Can cause cramping.', 'Don’t use it for more than a week unless a doctor says to.'],
    checkFirst: ['children', 'pregnancy'], tags: [], aliases: ['senna', 'sennosides', 'senokot', 'ex-lax'],
  },
  {
    id: 'psyllium', name: 'Psyllium (fiber)', otc: true, brands: ['Metamucil', 'Konsyl'],
    helps: 'Adds fiber to help keep bowel movements regular.',
    cautions: ['Take it with a full glass of water. Without enough water it can cause choking.', 'Take other medicines 2 hours apart from it.'],
    checkFirst: ['children'], tags: [], aliases: ['psyllium', 'metamucil'],
  },
  {
    id: 'simethicone', name: 'Simethicone', otc: true, brands: ['Gas-X', 'Mylanta Gas'],
    helps: 'Eases gas, bloating and pressure.',
    cautions: ['See a doctor if gas comes with severe stomach pain.'],
    checkFirst: [], tags: [], aliases: ['simethicone', 'gas-x'],
  },
  {
    id: 'meclizine', name: 'Meclizine', otc: true, brands: ['Bonine', 'Dramamine Less Drowsy'],
    helps: 'Prevents and eases nausea, vomiting and dizziness from motion sickness. Take it before you travel.',
    cautions: ['Can cause drowsiness. Don’t drive until you know how it affects you.'],
    checkFirst: ['older', 'glaucomaProstate', 'children'], tags: ['antihistamine', 'sedating'], aliases: ['meclizine', 'bonine'],
  },
  {
    id: 'dimenhydrinate', name: 'Dimenhydrinate', otc: true, brands: ['Dramamine'],
    helps: 'Prevents and eases nausea, vomiting and dizziness from motion sickness.',
    cautions: ['Causes drowsiness. Don’t drive after taking it.', 'Can cause confusion and falls in people 65 and older.'],
    checkFirst: ['older', 'glaucomaProstate', 'children'], tags: ['antihistamine', 'sedating'], aliases: ['dimenhydrinate', 'dramamine'],
  },
  {
    id: 'emetrol', name: 'Phosphorated carbohydrate solution', otc: true, brands: ['Emetrol'],
    helps: 'Eases nausea from an upset stomach.',
    cautions: ['It contains sugar (fructose).', 'See a doctor if nausea lasts more than an hour or you keep vomiting.'],
    checkFirst: ['diabetes', 'children'], tags: [], aliases: ['emetrol', 'phosphorated carbohydrate'],
  },

  // ---- skin ----
  {
    id: 'hydrocortisone', name: 'Hydrocortisone 1%', otc: true, form: 'cream or ointment', brands: ['Cortizone-10'],
    helps: 'Eases itching and redness from minor rashes, bug bites, poison ivy and eczema flares.',
    cautions: ['For the skin only. Don’t use it on the face for long, on broken skin, or for more than 7 days without asking a doctor.'],
    checkFirst: ['children'], tags: [], aliases: ['hydrocortisone', 'cortizone'],
  },
  {
    id: 'calamine', name: 'Calamine', otc: true, form: 'lotion', brands: ['Caladryl Clear'],
    helps: 'Soothes itching from bug bites, poison ivy and minor rashes, and dries oozing skin.',
    cautions: ['For the skin only. Keep it out of the eyes.'],
    checkFirst: [], tags: [], aliases: ['calamine'],
  },
  {
    id: 'pramoxine', name: 'Pramoxine', otc: true, form: 'cream or lotion', brands: ['Sarna Sensitive', 'Itch-X'],
    helps: 'Numbs itching and minor skin pain.',
    cautions: ['For the skin only. Stop and see a doctor if it gets worse or lasts more than 7 days.'],
    checkFirst: [], tags: [], aliases: ['pramoxine'],
  },
  {
    id: 'lidocaine', name: 'Lidocaine (for the skin)', otc: true, form: 'gel or spray', brands: ['Solarcaine', 'Aspercreme with Lidocaine'],
    helps: 'Numbs the pain of minor burns, sunburn, scrapes and bug bites.',
    cautions: ['Only on small areas of unbroken or minor burned skin. Not on deep or large burns.'],
    checkFirst: ['children'], tags: [], aliases: ['lidocaine'],
  },
  {
    id: 'bacitracin', name: 'Bacitracin (first-aid ointment)', otc: true, form: 'ointment', brands: ['Bacitracin', 'Neosporin'],
    helps: 'Helps prevent infection in minor cuts, scrapes and burns.',
    cautions: ['Only for small, shallow wounds. See a doctor for deep cuts, animal bites or serious burns.', 'Some people are allergic to Neosporin’s neomycin.'],
    checkFirst: [], tags: [], aliases: ['bacitracin', 'neosporin'],
  },

  // ---- eyes ----
  {
    id: 'artificial-tears', name: 'Artificial tears (lubricant eye drops)', otc: true, form: 'eye drops', brands: ['Refresh', 'Systane', 'TheraTears'],
    helps: 'Moistens and soothes dry, gritty, tired eyes.',
    cautions: ['If you use them more than 4 times a day, choose a “preservative-free” kind.', 'See a doctor for eye pain, vision changes or redness that won’t go away.'],
    checkFirst: [], tags: [], aliases: ['carboxymethylcellulose', 'polyethylene glycol 400', 'artificial tears', 'refresh', 'systane'],
  },
];

export const byId = (id: string) => INGREDIENTS.find((i) => i.id === id)!;

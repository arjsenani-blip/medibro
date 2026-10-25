/* Symptoms the assistant knows, the words people use for them, and which OTC
   ingredients (otc-data.ts) are labeled to relieve them. */

export interface Symptom {
  id: string;
  label: string;
  words: string[]; // lowercase phrases; matched on word boundaries
  ingredients: string[]; // ids in otc-data.ts, most commonly suggested first
  selfCare: string;
  seeDoctor: string; // when to stop and get help
}

export const SYMPTOMS: Symptom[] = [
  {
    id: 'headache', label: 'Headache',
    words: ['headache', 'headaches', 'head ache', 'head hurts', 'head is pounding', 'migraine', 'tension headache'],
    ingredients: ['acetaminophen', 'ibuprofen', 'naproxen', 'aspirin'],
    selfCare: 'Drink water, rest in a quiet, dark room, and try a cool cloth on your forehead.',
    seeDoctor: 'Get help right away for a sudden, very bad headache, or one with a stiff neck, fever, confusion, weakness or trouble seeing or speaking. See a doctor if headaches keep coming back.',
  },
  {
    id: 'aches', label: 'Minor aches and pains',
    words: ['ache', 'aches', 'aching', 'body aches', 'muscle pain', 'muscle ache', 'sore muscles', 'back pain', 'backache', 'joint pain', 'arthritis pain', 'toothache', 'tooth hurts', 'cramps', 'period pain', 'menstrual cramps', 'sprain', 'pain'],
    ingredients: ['acetaminophen', 'ibuprofen', 'naproxen', 'aspirin'],
    selfCare: 'Rest the sore area. Ice can help in the first 2 days after an injury, then gentle heat.',
    seeDoctor: 'See a doctor if pain lasts more than 10 days, gets worse, or comes with swelling, redness or fever.',
  },
  {
    id: 'fever', label: 'Fever',
    words: ['fever', 'feverish', 'temperature', 'chills', 'running hot'],
    ingredients: ['acetaminophen', 'ibuprofen', 'naproxen'],
    selfCare: 'Drink plenty of fluids and rest. Dress in light clothes.',
    seeDoctor: 'See a doctor if a fever lasts more than 3 days, goes above 103°F (39.4°C), or comes with a stiff neck, rash, confusion or trouble breathing.',
  },
  {
    id: 'congestion', label: 'Stuffy nose and colds',
    words: ['stuffy nose', 'stuffy', 'stuffed up', 'congested', 'congestion', 'nasal congestion', 'blocked nose', 'sinus', 'sinus pressure', 'cold', 'a cold', 'common cold', 'flu', 'the flu'],
    ingredients: ['saline', 'pseudoephedrine', 'oxymetazoline', 'fluticasone', 'phenylephrine'],
    selfCare: 'Breathe steam from a shower, use a humidifier, and drink warm fluids.',
    seeDoctor: 'See a doctor if it lasts more than 10 days, or you have a high fever, bad face pain or trouble breathing. If you think you have the flu, call your doctor early: some treatments work best in the first 2 days.',
  },
  {
    id: 'allergies', label: 'Runny nose and allergies',
    words: ['runny nose', 'runny', 'sneezing', 'sneeze', 'allergies', 'allergy', 'hay fever', 'itchy eyes', 'watery eyes', 'pollen', 'post nasal drip'],
    ingredients: ['loratadine', 'fexofenadine', 'cetirizine', 'fluticasone', 'ketotifen', 'chlorpheniramine', 'diphenhydramine'],
    selfCare: 'Keep windows closed on high-pollen days, and shower after being outside.',
    seeDoctor: 'Get help right away for any swelling of the lips, tongue or throat, or trouble breathing.',
  },
  {
    id: 'cough', label: 'Cough',
    words: ['cough', 'coughing', 'hacking', 'chest congestion', 'phlegm', 'mucus', 'chesty'],
    ingredients: ['dextromethorphan', 'guaifenesin', 'menthol-lozenge'],
    selfCare: 'Drink warm fluids. A spoon of honey can calm a cough in adults and children over 1 year (never give honey to babies).',
    seeDoctor: 'See a doctor if a cough lasts more than a week, brings up blood, or comes with fever, wheezing or shortness of breath.',
  },
  {
    id: 'sore-throat', label: 'Sore throat',
    words: ['sore throat', 'throat hurts', 'scratchy throat', 'throat pain', 'painful swallowing'],
    ingredients: ['acetaminophen', 'ibuprofen', 'menthol-lozenge', 'benzocaine', 'phenol'],
    selfCare: 'Gargle with warm salt water and drink warm fluids.',
    seeDoctor: 'See a doctor if it is severe, lasts more than 2 days, or comes with fever, rash, swollen glands or trouble swallowing.',
  },
  {
    id: 'heartburn', label: 'Heartburn and indigestion',
    words: ['heartburn', 'acid reflux', 'reflux', 'indigestion', 'acid stomach', 'sour stomach', 'upset stomach', 'stomach ache after eating', 'burning in my chest after eating'],
    ingredients: ['calcium-carbonate', 'famotidine', 'omeprazole', 'bismuth'],
    selfCare: 'Eat smaller meals, avoid lying down for 3 hours after eating, and raise the head of your bed.',
    seeDoctor: 'Chest pain can be a heart attack: call 911 if you’re not sure. See a doctor for heartburn more than 2 weeks, trouble swallowing or weight loss.',
  },
  {
    id: 'diarrhea', label: 'Diarrhea',
    words: ['diarrhea', 'diarrhoea', 'loose stool', 'loose stools', 'the runs', 'watery stool'],
    ingredients: ['loperamide', 'bismuth'],
    selfCare: 'Drink plenty of fluids, like water, broth or an oral rehydration drink, to replace what you lose.',
    seeDoctor: 'See a doctor if it lasts more than 2 days, or with a fever, blood in the stool, bad stomach pain or signs of dehydration (very dark urine, dizziness).',
  },
  {
    id: 'constipation', label: 'Constipation',
    words: ['constipation', 'constipated', 'can’t poop', "can't poop", 'cannot poop', 'hard stool', 'hard stools', 'not regular', 'haven’t pooped', "haven't pooped"],
    ingredients: ['peg', 'psyllium', 'docusate', 'senna'],
    selfCare: 'Drink more water, eat more fiber (fruit, vegetables, whole grains) and walk if you can.',
    seeDoctor: 'See a doctor if it lasts more than a week, or with bad stomach pain, vomiting or blood in the stool.',
  },
  {
    id: 'nausea', label: 'Nausea and motion sickness',
    words: ['nausea', 'nauseous', 'nauseated', 'queasy', 'feel sick to my stomach', 'motion sickness', 'car sick', 'carsick', 'seasick', 'sea sick', 'airsick', 'travel sickness'],
    ingredients: ['meclizine', 'dimenhydrinate', 'bismuth', 'emetrol'],
    selfCare: 'Sip clear fluids slowly. For motion sickness, look at the horizon and get fresh air.',
    seeDoctor: 'See a doctor if you can’t keep fluids down for a day, or vomit blood or something that looks like coffee grounds.',
  },
  {
    id: 'itching', label: 'Itching and hives',
    words: ['itch', 'itchy', 'itching', 'hives', 'itchy skin'],
    ingredients: ['hydrocortisone', 'calamine', 'pramoxine', 'cetirizine', 'loratadine', 'diphenhydramine'],
    selfCare: 'Use a cool compress, wear loose cotton clothes, and try not to scratch.',
    seeDoctor: 'Get help right away if hives come with swelling of the face, lips or tongue, or trouble breathing.',
  },
  {
    id: 'rash', label: 'Minor rashes',
    words: ['rash', 'rashes', 'poison ivy', 'poison oak', 'eczema', 'red skin', 'skin irritation', 'contact dermatitis'],
    ingredients: ['hydrocortisone', 'calamine', 'pramoxine'],
    selfCare: 'Wash the area with mild soap and cool water, and avoid what caused it.',
    seeDoctor: 'See a doctor if the rash spreads, blisters, is on the face or genitals, comes with fever, or lasts more than a week.',
  },
  {
    id: 'bites', label: 'Insect bites and stings',
    words: ['bug bite', 'bug bites', 'insect bite', 'insect bites', 'mosquito', 'mosquito bite', 'bee sting', 'sting', 'stung', 'bitten'],
    ingredients: ['hydrocortisone', 'calamine', 'pramoxine', 'cetirizine', 'loratadine'],
    selfCare: 'Wash with soap and water and use a cold pack. Scrape out a bee stinger with a card edge.',
    seeDoctor: 'Call 911 for trouble breathing or swelling of the face or throat. See a doctor for a tick bite with a spreading rash, or a bite that gets red, warm and swollen.',
  },
  {
    id: 'burns', label: 'Minor burns and sunburn',
    words: ['burn', 'burns', 'burned', 'burnt', 'sunburn', 'sun burn', 'scald', 'scalded'],
    ingredients: ['lidocaine', 'bacitracin', 'acetaminophen', 'ibuprofen'],
    selfCare: 'Cool the burn under cool (not ice-cold) running water for 10 to 20 minutes. Don’t pop blisters.',
    seeDoctor: 'Get medical care for burns larger than your palm, deep burns, or burns on the face, hands, feet, genitals or a joint.',
  },
  {
    id: 'sleep', label: 'Trouble sleeping (once in a while)',
    words: ['can’t sleep', "can't sleep", 'cannot sleep', 'trouble sleeping', 'insomnia', 'sleepless', 'hard to fall asleep', 'awake at night', 'sleep aid', 'help me sleep'],
    ingredients: ['diphenhydramine', 'doxylamine'],
    selfCare: 'Keep the same bedtime, avoid caffeine after noon and screens before bed, and keep the bedroom dark and cool.',
    seeDoctor: 'See a doctor if sleep trouble lasts more than 2 weeks. Sleep aids are for occasional use only.',
  },
  {
    id: 'gas', label: 'Gas and bloating',
    words: ['gas', 'gassy', 'bloating', 'bloated', 'flatulence', 'burping', 'wind'],
    ingredients: ['simethicone', 'calcium-carbonate'],
    selfCare: 'Eat slowly, skip fizzy drinks, and take a short walk after meals.',
    seeDoctor: 'See a doctor for bad stomach pain, weight loss, or a change in bowel habits that doesn’t go away.',
  },
  {
    id: 'dry-eyes', label: 'Dry eyes',
    words: ['dry eyes', 'dry eye', 'eyes are dry', 'gritty eyes', 'tired eyes', 'eye irritation', 'burning eyes'],
    ingredients: ['artificial-tears'],
    selfCare: 'Take screen breaks, blink often, and use a humidifier.',
    seeDoctor: 'See a doctor for eye pain, light sensitivity, a change in vision, or a red eye that won’t clear.',
  },
];

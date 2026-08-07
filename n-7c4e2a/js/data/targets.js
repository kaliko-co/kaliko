// Reference intakes, from the D-A-CH values used in Germany, Austria and
// Switzerland, with EFSA figures where D-A-CH has none (EPA+DHA in particular).
// These are the European numbers, which differ from US RDAs — the right ones
// for someone eating in Berlin.
//
// Energy comes from Mifflin-St Jeor times a PAL activity factor.
//
// Two kinds of entry:
//   goals   — aim for at least this much
//   limits  — stay under this much
//
// `span: 'week'` marks nutrients the body stores, which are meaningless to
// judge one day at a time (B12, vitamin A, selenium). The app averages those
// over 7 days instead of flagging a single low day.

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'mostly sitting', pal: 1.4, note: 'desk work, little exercise' },
  { id: 'light', label: 'lightly active', pal: 1.55, note: 'on your feet part of the day' },
  { id: 'moderate', label: 'moderately active', pal: 1.7, note: 'standing work, or regular exercise' },
  { id: 'active', label: 'very active', pal: 1.85, note: 'physical work, or daily hard training' },
];

// Display metadata for every tracked nutrient.
export const NUTRIENTS = {
  kcal: { label: 'energy', unit: 'kcal', decimals: 0, kind: 'energy' },
  pro: { label: 'protein', unit: 'g', decimals: 0, kind: 'macro' },
  carb: { label: 'carbs', unit: 'g', decimals: 0, kind: 'macro' },
  fat: { label: 'fat', unit: 'g', decimals: 0, kind: 'macro' },
  fib: { label: 'fibre', unit: 'g', decimals: 0, kind: 'macro' },
  sat: { label: 'saturated fat', unit: 'g', decimals: 0, kind: 'limit' },
  sug: { label: 'sugars', unit: 'g', decimals: 0, kind: 'limit' },
  na: { label: 'sodium', unit: 'mg', decimals: 0, kind: 'limit', asSalt: true },
  fe: { label: 'iron', unit: 'mg', decimals: 1, kind: 'mineral' },
  ca: { label: 'calcium', unit: 'mg', decimals: 0, kind: 'mineral' },
  mg: { label: 'magnesium', unit: 'mg', decimals: 0, kind: 'mineral' },
  zn: { label: 'zinc', unit: 'mg', decimals: 1, kind: 'mineral' },
  k: { label: 'potassium', unit: 'mg', decimals: 0, kind: 'mineral' },
  i: { label: 'iodine', unit: 'µg', decimals: 0, kind: 'mineral' },
  se: { label: 'selenium', unit: 'µg', decimals: 0, kind: 'mineral' },
  va: { label: 'vitamin A', unit: 'µg', decimals: 0, kind: 'vitamin' },
  vc: { label: 'vitamin C', unit: 'mg', decimals: 0, kind: 'vitamin' },
  vd: { label: 'vitamin D', unit: 'µg', decimals: 1, kind: 'vitamin' },
  ve: { label: 'vitamin E', unit: 'mg', decimals: 1, kind: 'vitamin' },
  b1: { label: 'thiamin (B1)', unit: 'mg', decimals: 1, kind: 'vitamin' },
  b2: { label: 'riboflavin (B2)', unit: 'mg', decimals: 1, kind: 'vitamin' },
  b6: { label: 'vitamin B6', unit: 'mg', decimals: 1, kind: 'vitamin' },
  b12: { label: 'vitamin B12', unit: 'µg', decimals: 1, kind: 'vitamin' },
  fol: { label: 'folate', unit: 'µg', decimals: 0, kind: 'vitamin' },
  ala: { label: 'omega-3 (ALA)', unit: 'g', decimals: 1, kind: 'fat' },
  epa: { label: 'omega-3 (EPA+DHA)', unit: 'mg', decimals: 0, kind: 'fat' },
};

// Nutrients judged as a weekly average rather than day by day.
export const WEEKLY_NUTRIENTS = new Set(['b12', 'va', 'se', 'vd', 'i', 'epa', 'ala']);

// Short, honest notes shown next to specific nutrients.
export const NUTRIENT_NOTES = {
  vd: 'Mostly made in skin from sunlight, not eaten. Between October and March at Berlin\'s latitude there isn\'t enough UVB to make any, whatever you eat — this is the one worth asking a doctor about rather than solving with food.',
  b12: 'Only reliably in animal foods and fortified products. On a low-meat diet this is the number to confirm with a blood test, not a food diary — stores last years, so intake and status can disagree for a long time.',
  fe: 'Plant iron absorbs several times better alongside vitamin C, and worse alongside coffee or tea. When you eat it matters nearly as much as how much.',
  i: 'Germany is a naturally iodine-poor region. Iodised salt and dairy do most of the work; sea fish and a little seaweed do the rest.',
  ca: 'Absorption needs vitamin D, so a long winter shortfall in one shows up as a shortfall in both.',
  epa: 'The long-chain omega-3s, from oily fish or an algae oil. Your body converts only a few percent of plant ALA into these, so ALA is not a substitute.',
  na: 'Shown as salt too, since that\'s what\'s on labels. Most of it arrives in bread, cheese and anything cured — rarely from the salt cellar.',
};

// Per-sex adult reference intakes (D-A-CH, ages 19-65).
const BASE = {
  female: {
    fib: 30, fe: 15, ca: 1000, mg: 300, zn: 8, k: 4000, i: 200, se: 60,
    va: 700, vc: 95, vd: 20, ve: 12, b1: 1, b2: 1.1, b6: 1.4, b12: 4, fol: 300,
    epa: 250,
  },
  male: {
    fib: 30, fe: 10, ca: 1000, mg: 350, zn: 14, k: 4000, i: 200, se: 70,
    va: 850, vc: 110, vd: 20, ve: 14, b1: 1.2, b2: 1.4, b6: 1.6, b12: 4, fol: 300,
    epa: 250,
  },
};

/**
 * Reference intakes for one person.
 *
 * @param {object} p profile
 * @param {'female'|'male'} p.sex
 * @param {number} p.age years
 * @param {number} p.weight kg
 * @param {number} p.height cm
 * @param {string} p.activity one of ACTIVITY_LEVELS ids
 * @param {boolean} [p.pregnant]
 * @param {boolean} [p.breastfeeding]
 * @param {boolean} [p.lowMeat] raises the iron goal — plant iron absorbs worse
 * @returns {{goals: object, limits: object, kcal: number}}
 */
export function referenceIntakes(p) {
  const sex = p.sex === 'male' ? 'male' : 'female';
  const goals = { ...BASE[sex] };

  // Energy — Mifflin-St Jeor resting rate × activity factor.
  const bmr = sex === 'male'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
  const pal = (ACTIVITY_LEVELS.find((a) => a.id === p.activity) || ACTIVITY_LEVELS[1]).pal;
  let kcal = Math.round((bmr * pal) / 10) * 10;

  // Protein: 0.8 g/kg to 65, 1.0 g/kg after — D-A-CH raises it with age
  // because older muscle uses dietary protein less efficiently.
  let proPerKg = p.age >= 65 ? 1.0 : 0.8;

  // Age adjustments.
  if (p.age >= 51 && sex === 'female') goals.fe = 10;   // post-menopausal
  if (p.age >= 65) { goals.vd = 20; goals.ca = 1000; }

  if (p.pregnant) {
    kcal += 250;
    proPerKg = 1.0;
    Object.assign(goals, { fe: 30, fol: 550, i: 230, vc: 105, b6: 1.9, b12: 4.5, zn: 9, va: 800 });
  } else if (p.breastfeeding) {
    kcal += 500;
    proPerKg = 1.2;
    Object.assign(goals, { fe: 20, fol: 450, i: 260, vc: 125, b6: 1.9, b12: 5.5, zn: 11, va: 1300, ca: 1000 });
  }

  // A low-meat diet doesn't change how much iron you need in your body, but it
  // does change how much you have to eat to get it — non-haem iron absorbs at
  // roughly a third the rate. D-A-CH doesn't publish a separate figure, so this
  // is a deliberate, visible adjustment rather than an official value.
  if (p.lowMeat) goals.fe = Math.round(goals.fe * 1.4);

  goals.pro = Math.round(p.weight * proPerKg);
  goals.kcal = kcal;

  // Energy-proportional goals.
  goals.ala = +((kcal * 0.005) / 9).toFixed(1);  // 0.5% of energy from ALA
  goals.carb = Math.round((kcal * 0.5) / 4);      // ~50% of energy
  goals.fat = Math.round((kcal * 0.3) / 9);       // ~30% of energy

  const limits = {
    sat: Math.round((kcal * 0.1) / 9),   // under 10% of energy
    sug: Math.round((kcal * 0.1) / 4),   // free sugars under 10% of energy (WHO)
    na: 2300,                            // ≈ 5.8 g salt
  };

  return { goals, limits, kcal };
}

export const DEFAULT_PROFILE = {
  sex: 'female',
  age: 35,
  weight: 65,
  height: 168,
  activity: 'light',
  pregnant: false,
  breastfeeding: false,
  lowMeat: true,
};

// Absorption and pairing tips, surfaced with the matching suggestion.
export const PAIRING_TIPS = {
  fe: [
    'Add something sharp — lemon, peppers, tomato, a handful of parsley. Vitamin C alongside plant iron can multiply absorption several times over.',
    'Keep coffee and black tea about an hour clear of an iron-heavy meal; the tannins bind it.',
    'Calcium competes with iron for the same transporter, so a big dairy hit is better in a different meal from your lentils.',
  ],
  ca: ['Pairs with vitamin D — without enough D you absorb noticeably less of whatever calcium you eat.'],
  va: ['Fat-soluble: carrots and greens give up much more of their vitamin A cooked with a little oil than raw.'],
  ve: ['Also fat-soluble, and mostly arrives in oils, nuts and seeds already.'],
  zn: ['Soaking or sprouting legumes and grains cuts the phytate that otherwise holds zinc back.'],
  epa: ['If you don\'t eat fish, an algae oil is the only plant source of the long-chain forms — flax and walnuts give ALA, which converts at only a few percent.'],
  fol: ['Heat-sensitive and water-soluble: raw or lightly steamed keeps far more of it than long boiling.'],
};

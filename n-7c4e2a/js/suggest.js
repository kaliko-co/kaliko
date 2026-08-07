// Gaps → what to put in the next meal, and patterns → what that tends to feel
// like.
//
// Two deliberate constraints:
//   · Suggestions name a *kind* of food and an amount, with two examples. Not
//     recipes. You know how to cook; you don't know that 200 g of lentils is
//     a third of your iron.
//   · Anything about how you feel is tied to a *sustained* pattern over weeks,
//     never a single day, and is phrased as what a shortfall typically feels
//     like — not as a diagnosis. With one person and no control group, the app
//     can say two things moved together and nothing stronger.

import { FOODS } from './data/foods.js';
import { NUTRIENTS, PAIRING_TIPS } from './data/targets.js';
import { nutrientsOf, groupsOf, lastNDays, PRIORITY } from './nutrition.js';

// ─── Where each nutrient actually comes from ────────────────────────────────
// Categories, not single foods. `ids` are ordered best-first within a category;
// the app picks whichever you're most likely to actually eat.

const SOURCES = {
  pro: [
    { cat: 'lentils, beans or tofu', ids: ['lentils_cooked', 'chickpeas_cooked', 'tofu_firm', 'tempeh'], amount: 180 },
    { cat: 'a high-protein dairy', ids: ['skyr', 'quark', 'yoghurt_greek'], amount: 150 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'fish', ids: ['salmon', 'mackerel', 'tuna_can'], amount: 120 },
    { cat: 'poultry or meat', ids: ['chicken_breast', 'turkey_breast', 'beef_mince'], amount: 120 },
    { cat: 'nuts or seeds', ids: ['pumpkin_seeds', 'almonds', 'hemp_seeds'], amount: 30 },
  ],
  fib: [
    { cat: 'lentils or beans', ids: ['lentils_cooked', 'black_beans_cooked', 'chickpeas_cooked'], amount: 180 },
    { cat: 'wholegrain bread or oats', ids: ['bread_wholemeal', 'oats_dry', 'crispbread'], amount: 70 },
    { cat: 'seeds', ids: ['chia_seeds', 'flaxseed_ground'], amount: 15 },
    { cat: 'vegetables, more of them', ids: ['broccoli', 'brussels_sprouts', 'carrot'], amount: 150 },
    { cat: 'berries or dried fruit', ids: ['raspberries', 'prunes', 'figs_dried'], amount: 80 },
  ],
  fe: [
    { cat: 'lentils or beans', ids: ['lentils_cooked', 'white_beans_cooked', 'chickpeas_cooked'], amount: 200 },
    { cat: 'seeds', ids: ['pumpkin_seeds', 'sesame_seeds', 'hemp_seeds'], amount: 20 },
    { cat: 'tofu or tempeh', ids: ['tofu_firm', 'tempeh'], amount: 150 },
    { cat: 'dark leafy greens', ids: ['spinach', 'kale', 'chard'], amount: 100 },
    { cat: 'tahini', ids: ['tahini'], amount: 20 },
    { cat: 'dark chocolate', ids: ['dark_chocolate'], amount: 25 },
    { cat: 'red meat', ids: ['beef_steak', 'beef_mince', 'liver'], amount: 120 },
    { cat: 'mussels', ids: ['mussels'], amount: 120 },
  ],
  ca: [
    { cat: 'yoghurt, milk or kefir', ids: ['yoghurt_natural', 'milk_semi', 'kefir', 'skyr'], amount: 200 },
    { cat: 'a fortified plant milk', ids: ['oat_milk', 'soy_milk', 'almond_milk'], amount: 200 },
    { cat: 'hard cheese', ids: ['cheese_gouda', 'cheese_parmesan'], amount: 40 },
    { cat: 'tahini or sesame', ids: ['tahini', 'sesame_seeds'], amount: 20 },
    { cat: 'tofu', ids: ['tofu_firm'], amount: 150 },
    { cat: 'kale or rocket', ids: ['kale', 'rocket'], amount: 100 },
    { cat: 'tinned sardines', ids: ['sardines'], amount: 90 },
  ],
  mg: [
    { cat: 'seeds', ids: ['pumpkin_seeds', 'sunflower_seeds', 'hemp_seeds'], amount: 25 },
    { cat: 'nuts', ids: ['almonds', 'cashews', 'brazil_nuts'], amount: 30 },
    { cat: 'wholegrains', ids: ['oats_dry', 'buckwheat_cooked', 'quinoa_cooked'], amount: 180 },
    { cat: 'dark chocolate', ids: ['dark_chocolate'], amount: 25 },
    { cat: 'legumes', ids: ['white_beans_cooked', 'black_beans_cooked'], amount: 180 },
  ],
  zn: [
    { cat: 'seeds', ids: ['pumpkin_seeds', 'hemp_seeds', 'sesame_seeds'], amount: 25 },
    { cat: 'cashews', ids: ['cashews'], amount: 30 },
    { cat: 'legumes', ids: ['lentils_cooked', 'chickpeas_cooked'], amount: 180 },
    { cat: 'oats or wholegrains', ids: ['oats_dry', 'spelt_cooked'], amount: 60 },
    { cat: 'hard cheese', ids: ['cheese_gouda', 'cheese_parmesan'], amount: 40 },
    { cat: 'meat or shellfish', ids: ['beef_mince', 'mussels'], amount: 120 },
  ],
  k: [
    { cat: 'potatoes', ids: ['potato_baked', 'sweet_potato'], amount: 250 },
    { cat: 'legumes', ids: ['white_beans_cooked', 'lentils_cooked'], amount: 180 },
    { cat: 'banana or dried fruit', ids: ['banana', 'apricots_dried', 'prunes'], amount: 120 },
    { cat: 'leafy greens', ids: ['spinach', 'chard'], amount: 150 },
    { cat: 'avocado', ids: ['avocado'], amount: 100 },
    { cat: 'tinned or dried tomatoes', ids: ['tomato_tinned', 'sundried_tomato'], amount: 150 },
  ],
  i: [
    { cat: 'iodised salt, in cooking', ids: ['salt'], amount: 2 },
    { cat: 'dairy', ids: ['milk_semi', 'yoghurt_natural'], amount: 200 },
    { cat: 'white sea fish', ids: ['cod', 'pollock'], amount: 130 },
    { cat: 'a little seaweed', ids: ['nori'], amount: 3 },
  ],
  se: [
    { cat: 'brazil nuts — two is plenty', ids: ['brazil_nuts'], amount: 10 },
    { cat: 'fish', ids: ['tuna_can', 'sardines', 'salmon'], amount: 100 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'wholegrains', ids: ['oats_dry', 'bread_wholemeal'], amount: 70 },
  ],
  va: [
    { cat: 'orange vegetables', ids: ['carrot', 'sweet_potato', 'pumpkin'], amount: 150 },
    { cat: 'dark leafy greens', ids: ['spinach', 'kale'], amount: 100 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'butter or full-fat dairy', ids: ['butter', 'cheese_cheddar'], amount: 20 },
  ],
  vc: [
    { cat: 'raw pepper', ids: ['bell_pepper'], amount: 100 },
    { cat: 'citrus or kiwi', ids: ['orange', 'kiwi', 'mandarin'], amount: 140 },
    { cat: 'broccoli, kale or sprouts', ids: ['broccoli', 'kale', 'brussels_sprouts'], amount: 120 },
    { cat: 'berries', ids: ['strawberries', 'blackberries'], amount: 120 },
    { cat: 'a handful of parsley', ids: ['parsley'], amount: 10 },
  ],
  vd: [
    { cat: 'oily fish', ids: ['herring', 'salmon', 'mackerel'], amount: 120 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'a fortified plant milk', ids: ['oat_milk', 'soy_milk'], amount: 200 },
    { cat: 'a supplement', ids: ['supp_vitamin_d'], amount: 1 },
  ],
  ve: [
    { cat: 'seeds and nuts', ids: ['sunflower_seeds', 'almonds', 'hazelnuts'], amount: 25 },
    { cat: 'a vegetable oil', ids: ['sunflower_oil', 'rapeseed_oil', 'olive_oil'], amount: 12 },
    { cat: 'avocado', ids: ['avocado'], amount: 100 },
  ],
  b1: [
    { cat: 'wholegrains', ids: ['oats_dry', 'spelt_cooked', 'bread_wholemeal'], amount: 70 },
    { cat: 'sunflower seeds', ids: ['sunflower_seeds'], amount: 25 },
    { cat: 'legumes', ids: ['lentils_cooked', 'peas_cooked'], amount: 180 },
  ],
  b2: [
    { cat: 'dairy', ids: ['milk_semi', 'yoghurt_natural', 'quark'], amount: 200 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'almonds', ids: ['almonds'], amount: 30 },
    { cat: 'nutritional yeast', ids: ['nutritional_yeast'], amount: 8 },
    { cat: 'mushrooms', ids: ['mushroom'], amount: 120 },
  ],
  b6: [
    { cat: 'potatoes', ids: ['potato_baked'], amount: 250 },
    { cat: 'banana', ids: ['banana'], amount: 120 },
    { cat: 'pistachios or sunflower seeds', ids: ['pistachios', 'sunflower_seeds'], amount: 30 },
    { cat: 'chickpeas', ids: ['chickpeas_cooked'], amount: 180 },
    { cat: 'fish or poultry', ids: ['salmon', 'chicken_breast'], amount: 120 },
  ],
  b12: [
    { cat: 'oily fish', ids: ['mackerel', 'herring', 'salmon', 'sardines'], amount: 120 },
    { cat: 'dairy', ids: ['yoghurt_greek', 'milk_semi', 'cheese_gouda'], amount: 200 },
    { cat: 'eggs', ids: ['egg'], amount: 110 },
    { cat: 'a fortified plant milk', ids: ['oat_milk', 'soy_milk'], amount: 200 },
    { cat: 'nutritional yeast', ids: ['nutritional_yeast'], amount: 8 },
    { cat: 'a supplement', ids: ['supp_b12'], amount: 1 },
  ],
  fol: [
    { cat: 'lentils, chickpeas or edamame', ids: ['lentils_cooked', 'chickpeas_cooked', 'edamame'], amount: 180 },
    { cat: 'dark leafy greens, raw or barely cooked', ids: ['spinach', 'rocket'], amount: 100 },
    { cat: 'asparagus or brassicas', ids: ['asparagus', 'broccoli', 'brussels_sprouts'], amount: 120 },
    { cat: 'beetroot', ids: ['beetroot'], amount: 120 },
    { cat: 'avocado', ids: ['avocado'], amount: 100 },
  ],
  ala: [
    { cat: 'ground flaxseed', ids: ['flaxseed_ground'], amount: 10 },
    { cat: 'walnuts', ids: ['walnuts'], amount: 20 },
    { cat: 'chia seeds', ids: ['chia_seeds'], amount: 12 },
    { cat: 'hemp seeds', ids: ['hemp_seeds'], amount: 20 },
    { cat: 'rapeseed oil', ids: ['rapeseed_oil'], amount: 12 },
  ],
  epa: [
    { cat: 'oily fish', ids: ['salmon', 'mackerel', 'herring', 'sardines'], amount: 110 },
    { cat: 'an algae oil capsule', ids: ['supp_omega3'], amount: 1 },
  ],
};

// What a sustained shortfall tends to feel like. Written to be accurate:
// `felt` describes a real, documented pattern; `caveat` says what intake data
// genuinely cannot tell you.
const EFFECTS = {
  fe: {
    felt: 'Sustained low iron is the commonest cause of exactly what you\'d expect: tired by mid-afternoon, out of breath on stairs, cold hands, and harder to hold concentration. It\'s also the most common deficiency in women who menstruate.',
    caveat: 'Intake is not status. A ferritin test is the only thing that actually answers it — stores and intake can disagree for months in both directions.',
    test: 'ferritin',
  },
  b12: {
    felt: 'This is the one worth taking seriously. Chronic shortfall causes fatigue and memory trouble, and prolonged deficiency can do nerve damage that doesn\'t fully reverse.',
    caveat: 'Your stores last years, so a food diary genuinely cannot tell you where you stand.',
    test: 'B12 (and ideally homocysteine or MMA if it comes back low-normal)',
  },
  vd: {
    felt: 'Low vitamin D shows up as aching, low mood through the winter, and worse calcium absorption whatever your calcium intake looks like.',
    caveat: 'Almost none of this comes from food. At Berlin\'s latitude your skin makes essentially none between October and March, so diet can\'t fix it and a food diary can\'t measure it.',
    test: '25-OH vitamin D',
  },
  pro: {
    felt: 'A sustained shortfall shows up as slower recovery after physical work, feeling hungry again soon after eating, and brittle hair and nails. Muscle loss follows over years rather than weeks.',
    caveat: 'Being a little under target is not a deficiency — the effects above need a real, prolonged gap.',
  },
  ca: {
    felt: 'Nothing you can feel. Calcium is a decades-long story about bone density, which is precisely why it\'s easy to neglect.',
    caveat: 'Absorption depends on vitamin D, so a winter shortfall in one quietly becomes a shortfall in both.',
  },
  mg: {
    felt: 'Low magnesium is associated with muscle cramps, restless legs and poorer sleep.',
    caveat: 'Blood magnesium is a poor measure of body stores, so testing rarely settles this one.',
  },
  zn: {
    felt: 'Shows up as slower wound healing, more frequent minor infections, and sometimes a dulled sense of taste.',
    caveat: 'Plant zinc absorbs worse because of phytate; soaking and sprouting help.',
  },
  i: {
    felt: 'Iodine feeds the thyroid, so a long shortfall shows up as fatigue, feeling cold, and weight that shifts without a reason.',
    caveat: 'Germany is a naturally iodine-poor region — this is a local problem, not a personal failing.',
    test: 'TSH, and iodine in urine if your doctor thinks it\'s worth it',
  },
  fib: {
    felt: 'Low fibre means less regular digestion, less staying-power after meals, and over years a worse cholesterol picture.',
    caveat: null,
  },
  fol: {
    felt: 'Fatigue and mouth ulcers are the usual signs of a long shortfall.',
    caveat: 'Folate is heat-sensitive: long boiling destroys much of what was in the vegetable.',
  },
  vc: {
    felt: 'Bleeding gums and slow-healing cuts are the classic signs, but the everyday cost is quieter — vitamin C is what makes plant iron absorb.',
    caveat: null,
  },
  epa: {
    felt: 'The evidence here is softer than for iron or B12, but low long-chain omega-3 is associated with dry eyes, dry skin and lower mood.',
    caveat: 'Plant ALA converts to these at only a few percent, so flax and walnuts are not a substitute for fish or algae oil.',
  },
  ala: {
    felt: 'The plant omega-3. A shortfall is rarely felt on its own, and it matters mostly as the raw material your body converts — inefficiently — into the long-chain forms.',
    caveat: 'One tablespoon of ground flaxseed covers a day of this, which makes it among the cheapest gaps on this list to close.',
  },
  se: {
    felt: 'Rarely felt directly. Selenium supports thyroid function and antioxidant defence.',
    caveat: 'European soils are low in selenium, so intake here is genuinely lower than the same diet would give in the US.',
  },
  va: { felt: 'A long shortfall affects night vision first, then skin and immune function.', caveat: null },
  ve: { felt: 'Rarely low enough to feel in a normal diet.', caveat: null },
  b1: { felt: 'A long shortfall causes fatigue and irritability.', caveat: null },
  b2: { felt: 'Cracks at the corners of the mouth and sore eyes are the usual signs.', caveat: null },
  b6: { felt: 'Associated with low mood and tiredness when sustained.', caveat: null },
  k: { felt: 'Mostly a blood-pressure story rather than something you notice day to day.', caveat: null },
};

const EXCESS_EFFECTS = {
  sat: 'Sustained high saturated fat raises LDL cholesterol, which is a cardiovascular story measured in decades. One rich day is irrelevant; a rich month is the thing.',
  sug: 'Free sugars crowd out nutrients per calorie and are hard on teeth. The tracked figure is added and fruit-juice sugar, not the sugar inside whole fruit.',
  na: 'Most dietary sodium arrives in bread, cheese and anything cured rather than from the salt cellar. Sustained high intake raises blood pressure in people who are salt-sensitive, which you can\'t know without measuring.',
};

// ─── Preference model ───────────────────────────────────────────────────────

/**
 * What you actually eat, learned by counting. No AI, no server — this runs on
 * every log and is what makes suggestions fit you rather than fit a textbook.
 *
 * @returns {{groupPerWeek: object, foodCounts: object, daysLogged: number,
 *            recentFoods: Set<string>, autoExcluded: string[]}}
 */
export function learnPreferences(days, { windowDays = 28, customFoods = {} } = {}) {
  const keys = lastNDays(windowDays);
  const groupDays = {};
  const foodCounts = {};
  const recentFoods = new Set();
  const recentKeys = new Set(lastNDays(3));
  let daysLogged = 0;

  for (const key of keys) {
    const items = days[key]?.items || [];
    if (!items.length) continue;
    daysLogged++;
    const groupsToday = new Set();
    for (const it of items) {
      if (it.excluded) continue;
      foodCounts[it.foodId] = (foodCounts[it.foodId] || 0) + 1;
      if (recentKeys.has(key)) recentFoods.add(it.foodId);
      for (const g of groupsOf(it.kind, it.foodId, customFoods)) groupsToday.add(g);
    }
    for (const g of groupsToday) groupDays[g] = (groupDays[g] || 0) + 1;
  }

  const weeks = Math.max(daysLogged / 7, 1 / 7);
  const groupPerWeek = {};
  for (const [g, n] of Object.entries(groupDays)) groupPerWeek[g] = +(n / weeks).toFixed(1);

  // A group with nothing at all in a fortnight-plus of logging is a group you
  // don't eat. Proposed, never applied silently — the UI shows it with an undo.
  const autoExcluded = daysLogged >= 14
    ? ['meat', 'fish', 'dairy', 'egg'].filter((g) => !groupDays[g])
    : [];

  return { groupPerWeek, foodCounts, daysLogged, recentFoods, autoExcluded };
}

/** How willing we should be to suggest a given food, 0 = never. */
function affinity(foodId, prefs, settings) {
  const food = FOODS[foodId];
  if (!food) return 0;
  const groups = food.g || [];

  if ((settings.excludedGroups || []).some((g) => groups.includes(g))) return 0;
  if ((settings.dislikedFoods || []).includes(foodId)) return 0;
  if (foodId.startsWith('supp_') && !settings.suggestSupplements) return 0.35;

  // Base on how often you eat this group. An unlogged group scores low but not
  // zero — it might just be early days.
  const perWeek = Math.max(...groups.map((g) => prefs.groupPerWeek?.[g] ?? 0), 0);
  let score = prefs.daysLogged >= 7 ? Math.min(1, 0.25 + perWeek / 6) : 0.7;

  // You've eaten this exact food before: mild boost.
  if (prefs.foodCounts?.[foodId]) score *= 1.15;

  // Eaten in the last three days: mild penalty, for variety's sake.
  if (prefs.recentFoods?.has(foodId)) score *= 0.8;

  // Whether you acted on this suggestion last time is the strongest signal
  // available, so it gets the strongest weight.
  const fb = settings.feedback?.[foodId];
  if (fb?.accepted) score *= 1 + Math.min(0.5, fb.accepted * 0.15);
  if (fb?.ignored) score *= Math.max(0.4, 1 - fb.ignored * 0.15);

  return score;
}

// ─── Turning an amount into something you'd actually measure ────────────────

// Household units, with the largest count that still reads naturally. Nobody
// measures anything in seven handfuls — past the cap it's clearer in grams.
const HOUSEHOLD_UNITS = [
  ['capsule', 'capsule', 4], ['tablet', 'tablet', 4],
  ['tbsp', 'tbsp', 5], ['tsp', 'tsp', 4],
  ['handful', 'handful', 3], ['each', '', 4],
  ['slice', 'slice', 4], ['clove', 'clove', 4], ['square', 'square', 6],
];

/** "20 g of pumpkin seeds" → "2 tbsp / 20 g". Falls back to grams alone. */
function describeAmount(foodId, grams) {
  const food = FOODS[foodId];
  const g = grams >= 100 ? Math.round(grams / 10) * 10 : Math.round(grams);
  if (!food?.units) return `${g} g`;

  for (const [unit, label, cap] of HOUSEHOLD_UNITS) {
    const w = food.units[unit];
    if (!w) continue;
    const n = grams / w;
    if (n < 0.5 || n > cap) continue;
    const rounded = n < 2 ? Math.round(n * 2) / 2 : Math.round(n);
    if (rounded <= 0) continue;
    const plural = rounded === 1 ? '' : 's';
    const noun = label ? `${label}${label === 'tbsp' || label === 'tsp' ? '' : plural}` : '';
    const text = noun ? `${rounded} ${noun}` : `${rounded}×`;
    return `${text} / ${g} g`;
  }
  return `${g} g`;
}

// ─── The suggestion itself ──────────────────────────────────────────────────

/**
 * What to put in the next meal.
 *
 * @param {Array} gaps from nutrition.shortfalls()
 * @param {object} opts
 * @param {object} opts.prefs from learnPreferences()
 * @param {object} opts.settings excludedGroups, dislikedFoods, feedback, suggestSupplements
 * @param {number} opts.remainingKcal energy left in the day (may be <= 0)
 * @param {object} [opts.customFoods]
 * @param {number} [opts.maxLines]
 * @returns {{lines: Array, modifiers: Array, kcal: number, tight: boolean}}
 */
export function suggestNextMeal(gaps, {
  prefs = {}, settings = {}, remainingKcal = 800, customFoods = {}, maxLines = 4,
} = {}) {
  const tight = remainingKcal < 350;
  const lines = [];
  const usedCategories = new Set();
  const usedFoods = new Set();
  const usedGroups = new Set();
  let kcal = 0;

  for (const gap of gaps) {
    if (lines.length >= maxLines) break;
    const options = SOURCES[gap.key];
    if (!options) continue;

    // Rank every category by what it delivers, weighted by whether you'd eat
    // it — and when the day is nearly full, by nutrient per calorie instead.
    const ranked = [];
    for (const opt of options) {
      if (usedCategories.has(opt.cat)) continue;
      const candidates = opt.ids
        .map((id) => ({ id, aff: affinity(id, prefs, settings) }))
        .filter((c) => c.aff > 0 && !usedFoods.has(c.id))
        .sort((a, b) => b.aff - a.aff);
      if (!candidates.length) continue;

      const pick = candidates[0];
      const per100 = nutrientsOf('food', pick.id, 100, customFoods);
      const density = per100[gap.key] || 0;
      if (density <= 0) continue;

      // Aim to close a decent share of the gap without one line dominating.
      const wanted = Math.min(gap.missing, gap.target * 0.45);
      let grams = (wanted / density) * 100;
      const base = FOODS[pick.id]?.portion || 100;
      grams = Math.max(base * 0.4, Math.min(base * 2.2, grams));

      const delivers = nutrientsOf('food', pick.id, grams, customFoods);
      const perKcal = delivers[gap.key] / Math.max(delivers.kcal, 1);

      ranked.push({
        opt,
        pick,
        grams,
        delivers,
        score: (tight ? perKcal * 400 : delivers[gap.key] / gap.target) * pick.aff,
        alternatives: candidates.slice(1, 3).map((c) => c.id),
      });
    }

    ranked.sort((a, b) => b.score - a.score);

    // One line per food group. "A high-protein dairy" and "yoghurt, milk or
    // kefir" are two different categories and the same trip to the fridge —
    // a list of four things should mean four different things.
    const groupsOfPick = (id) => (FOODS[id]?.g || []).filter((g) => g !== 'starch' && g !== 'other');
    let best = ranked.find((r) => !groupsOfPick(r.pick.id).some((g) => usedGroups.has(g)));
    if (!best && lines.length < 2) [best] = ranked;   // early on, repetition beats silence
    if (!best) continue;
    if (tight && kcal + best.delivers.kcal > Math.max(remainingKcal, 250)) continue;

    usedCategories.add(best.opt.cat);
    usedFoods.add(best.pick.id);
    for (const g of groupsOfPick(best.pick.id)) usedGroups.add(g);
    kcal += best.delivers.kcal;

    lines.push({
      forNutrient: gap.key,
      forLabel: NUTRIENTS[gap.key]?.label ?? gap.key,
      category: best.opt.cat,
      amount: describeAmount(best.pick.id, best.grams),
      grams: Math.round(best.grams),
      examples: [best.pick.id, ...best.alternatives].map((id) => ({
        id, label: FOODS[id]?.n ?? id, amount: describeAmount(id, best.grams * scaleFor(id, best.pick.id, gap.key, customFoods)),
      })),
      delivers: best.delivers[gap.key],
      deliversText: formatNutrient(gap.key, best.delivers[gap.key]),
      coversPct: Math.round((best.delivers[gap.key] / gap.target) * 100),
      kcal: Math.round(best.delivers.kcal),
    });
  }

  // Absorption modifiers — advice attached to a suggestion, not another item to
  // buy. Marked separately so the UI can't render it as a shopping line.
  const modifiers = [];
  for (const gap of gaps.slice(0, 3)) {
    const tips = PAIRING_TIPS[gap.key];
    if (tips && lines.some((l) => l.forNutrient === gap.key)) {
      modifiers.push({ forNutrient: gap.key, text: tips[0], extra: tips.slice(1) });
    }
  }

  return { lines, modifiers, kcal: Math.round(kcal), tight };
}

/** Keep an alternative's amount nutritionally comparable to the pick's. */
function scaleFor(altId, pickId, key, customFoods) {
  const a = nutrientsOf('food', altId, 100, customFoods)[key] || 0;
  const p = nutrientsOf('food', pickId, 100, customFoods)[key] || 0;
  if (!a || !p) return 1;
  return Math.max(0.4, Math.min(2.5, p / a));
}

function formatNutrient(key, value) {
  const meta = NUTRIENTS[key];
  if (!meta) return String(Math.round(value));
  return `${value.toFixed(meta.decimals)} ${meta.unit}`;
}

// ─── The pattern read ───────────────────────────────────────────────────────

/**
 * Sustained patterns over three weeks, in plain language, with the felt effects
 * and the honest caveats. Requires a real amount of logged data before it says
 * anything at all.
 *
 * @returns {{ready: boolean, daysLogged: number, observations: Array, wins: Array}}
 */
export function patternRead({ average, perDay, logged }, counts, { goals, limits }, { minDays = 10 } = {}) {
  if (logged < minDays) {
    return { ready: false, daysLogged: logged, needed: minDays - logged, observations: [], wins: [] };
  }

  const observations = [];
  for (const [key, target] of Object.entries(goals)) {
    if (!NUTRIENTS[key] || !target) continue;
    const avg = average[key] || 0;
    const pct = Math.round((avg / target) * 100);
    const c = counts[key] || { short: 0, logged: 0 };
    const shortShare = c.logged ? c.short / c.logged : 0;

    // A pattern, not a bad day: low on average *and* low on most days.
    if (pct >= 75 || shortShare < 0.5) continue;

    const effect = EFFECTS[key];
    observations.push({
      key,
      label: NUTRIENTS[key].label,
      average: avg,
      averageText: formatNutrient(key, avg),
      target,
      targetText: formatNutrient(key, target),
      pct,
      shortDays: c.short,
      loggedDays: c.logged,
      // Weighted, not raw: vitamin E at 4% of a target nobody misses in real
      // life would otherwise bury iron at 24%, which is the finding that
      // matters. Same weighting the daily gap list uses.
      severity: pct / (PRIORITY[key] ?? 1),
      felt: effect?.felt ?? null,
      caveat: effect?.caveat ?? null,
      test: effect?.test ?? null,
    });
  }
  observations.sort((a, b) => a.severity - b.severity);

  // EPA+DHA and ALA are one conversation about omega-3, not two findings. Both
  // qualifying would spend two of a handful of slots saying the same thing, and
  // push out something actionable.
  if (observations.some((o) => o.key === 'epa')) {
    const i = observations.findIndex((o) => o.key === 'ala');
    if (i > -1) observations.splice(i, 1);
  }

  for (const [key, limit] of Object.entries(limits)) {
    if (!NUTRIENTS[key]) continue;
    const avg = average[key] || 0;
    const pct = Math.round((avg / limit) * 100);
    if (pct <= 115) continue;
    observations.push({
      key,
      label: NUTRIENTS[key].label,
      average: avg,
      averageText: formatNutrient(key, avg),
      target: limit,
      targetText: formatNutrient(key, limit),
      pct,
      over: true,
      severity: 1000 - pct,
      felt: EXCESS_EFFECTS[key] ?? null,
    });
  }

  // One thing going well, because a list of only failures gets ignored.
  const wins = Object.entries(goals)
    .filter(([k, t]) => NUTRIENTS[k] && t && (average[k] || 0) / t >= 1.1)
    .map(([k, t]) => ({
      key: k,
      label: NUTRIENTS[k].label,
      pct: Math.round(((average[k] || 0) / t) * 100),
      averageText: formatNutrient(k, average[k] || 0),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);

  return { ready: true, daysLogged: logged, observations: observations.slice(0, 6), wins };
}

// ─── Check-in correlation ───────────────────────────────────────────────────

const MIN_CORRELATION_DAYS = 14;
const CORRELATION_FLOOR = 0.35;

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (!dx || !dy) return 0;
  return num / Math.sqrt(dx * dy);
}

/**
 * Line your own check-ins up against nutrient intake.
 *
 * Deliberately conservative: needs a fortnight of paired days, reports only
 * moderate-or-stronger relationships, and phrases everything as "moved
 * together". With one person and no control there is no causal claim available,
 * and pretending otherwise would be the most harmful thing this app could do.
 */
export function correlateCheckins(days, dayKeys, { goals }, customFoods = {}, metric = 'energy') {
  const pairs = [];
  for (const key of dayKeys) {
    const day = days[key];
    const score = day?.checkin?.[metric];
    if (!day?.items?.length || score == null) continue;
    pairs.push({ key, score, items: day.items });
  }
  if (pairs.length < MIN_CORRELATION_DAYS) {
    return { ready: false, days: pairs.length, needed: MIN_CORRELATION_DAYS - pairs.length, findings: [] };
  }

  const scores = pairs.map((p) => p.score);
  const findings = [];
  for (const [key, target] of Object.entries(goals)) {
    if (!NUTRIENTS[key] || !target) continue;
    const values = pairs.map((p) => {
      let v = 0;
      for (const it of p.items) {
        if (it.excluded) continue;
        v += nutrientsOf(it.kind, it.foodId, it.grams, customFoods)[key] || 0;
      }
      return v / target;
    });
    const r = pearson(values, scores);
    if (Math.abs(r) < CORRELATION_FLOOR) continue;
    findings.push({ key, label: NUTRIENTS[key].label, r: +r.toFixed(2), direction: r > 0 ? 'together' : 'opposite' });
  }

  findings.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { ready: true, days: pairs.length, metric, findings: findings.slice(0, 3) };
}

export const _internals = { SOURCES, EFFECTS, EXCESS_EFFECTS, describeAmount, affinity, pearson };

// node n-7c4e2a/tests/run.mjs
//
// Assertions, not eyeballing. Most of these exist because the behaviour they
// check was broken at some point and the smoke test caught it.

import { parse } from '../js/parse.js';
import {
  totalsFor, targetsFor, assess, shortfalls, nutrientsOf, saltFromSodium,
  aggregate, shortDayCounts, dayKey,
} from '../js/nutrition.js';
import { referenceIntakes } from '../js/data/targets.js';
import { learnPreferences, suggestNextMeal, patternRead, correlateCheckins } from '../js/suggest.js';
import { DISHES } from '../js/data/dishes.js';
import { FOODS } from '../js/data/foods.js';

let pass = 0;
const fails = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-9;
const find = (items, name) => items.find((i) => i.name.includes(name));

// ─── Parser ─────────────────────────────────────────────────────────────────

{
  const { items } = parse('a big plate of baked potatoes baked in olive oil and 100g feta, and one small medium leek sauteed in some olive oil and 50ml sweet cream');
  ok('plate × big = 350 g', find(items, 'baked potato')?.grams === 350);
  ok('exact weight is exact', find(items, 'feta')?.grams === 100);
  ok('one medium leek', find(items, 'leek')?.grams === 90);
  ok('50 ml cream ≈ 50 g', near(find(items, 'cream')?.grams, 50.5));
  ok('two cooking fats emitted', items.filter((i) => i.cookingFatFor).length === 2);
  ok('fat scales with the food', find(items, 'baked potato')
    && items.find((i) => i.cookingFatFor === find(items, 'baked potato').id).grams > 10);
  ok('size conflict surfaced', Array.isArray(find(items, 'leek')?.sizeConflict));
  ok('ambiguous cream asks', find(items, 'cream')?.needs === 'sweet cream');
}

{
  // Regression: the second food used to be dropped entirely.
  const { items } = parse('half an avocado on sourdough');
  ok('both foods survive', items.length === 2, items.map((i) => i.name).join(','));
  ok('half applies to the avocado', find(items, 'avocado')?.grams === 75);
}

{
  // Regression: "plate" fuzzy-matched "latte" at 0.75.
  const { items } = parse('a plate of potatoes');
  ok('plate is not a latte', !items.some((i) => i.name.includes('latte')));
}

{
  // Regression: a dish name must beat its own first word.
  const { items } = parse('coffee with oat milk');
  ok('dish beats first word', items.length === 1 && items[0].foodId === 'oat_latte',
    items.map((i) => i.name).join(','));
}

{
  // Regression: teaching a genuinely novel phrase used to not persist — only
  // the six fixed AMBIGUOUS_KEYS terms (cream, milk, cheese...) were ever
  // consulted on a later parse. A supplement name is exactly this case.
  const first = parse('zvornikian slop');
  ok('novel phrase starts unknown', first.unknown.length === 1 && first.items.length === 0);

  const second = parse('zvornikian slop', { resolved: { 'zvornikian slop': 'food:egg' } });
  ok('taught phrase resolves next time', second.items.length === 1 && second.items[0].foodId === 'egg',
    JSON.stringify(second));
  ok('taught item reads as remembered, not fuzzy', second.items[0].taught === true && second.items[0].fuzzy === false);
}

{
  // Regression: teaching a phrase to a *dish* used to always be stored (and
  // read back) as kind 'food' regardless — the ternary that was supposed to
  // preserve it was a no-op. That silently failed to resolve on replay.
  const { items } = parse('zvornikian goop', { resolved: { 'zvornikian goop': 'dish:lentil_soup' } });
  ok('taught dish keeps its kind', items.length === 1 && items[0].kind === 'dish' && items[0].foodId === 'lentil_soup',
    JSON.stringify(items));
}

{
  // Backward compatibility: settings saved before this fix stored a bare id
  // with no kind prefix for the six fixed ambiguous terms — must keep working.
  const { items } = parse('cream', { resolved: { cream: 'cream_single' } });
  ok('pre-fix bare-id resolved format still works', items.length === 1 && items[0].foodId === 'cream_single' && !items[0].needs);
}

{
  // Regression: a dry weight must not select a composite dish.
  const { items } = parse('100g dry pasta with pesto');
  ok('dry weight → cooked food', near(find(items, 'pasta')?.grams, 240));
  ok('pesto still found', !!find(items, 'pesto'));
}

{
  // Regression: a unit must attach to its own food, not a deferred one.
  const { items } = parse('owsianka z jagodami i lyzka masla orzechowego');
  ok('tablespoon lands on the nut butter', near(find(items, 'peanut butter')?.grams, 16));
  ok('inflected Polish resolves', !!find(items, 'blueberries'));
}

{
  const { items } = parse('zwei Scheiben Vollkornbrot mit Kase');
  ok('German counts and units', near(find(items, 'wholemeal bread')?.grams, 70));
}

{
  const { items, unknown } = parse('a bowl of zvornikian slop');
  ok('nonsense is reported, not swallowed', unknown.length >= 1 && items.length === 0,
    JSON.stringify({ items: items.map((i) => i.name), unknown: unknown.map((u) => u.text) }));
}

// ─── Nutrition ──────────────────────────────────────────────────────────────

{
  const { items } = parse('100g feta');
  const t = totalsFor(items);
  ok('feta energy', near(t.kcal, 264));
  ok('feta calcium', near(t.ca, 493));
  ok('salt conversion', near(saltFromSodium(1116), 2.84, 0.01));
}

{
  // A dish must equal the sum of its recipe, at any scale.
  const dish = DISHES.porridge;
  const whole = nutrientsOf('dish', 'porridge', dish.portion);
  let sum = 0;
  for (const [id, g] of dish.r) sum += (FOODS[id].kcal || 0) * (g / 100);
  ok('dish = sum of its recipe', near(whole.kcal, sum));
  const half = nutrientsOf('dish', 'porridge', dish.portion / 2);
  ok('dishes scale linearly', near(half.kcal, whole.kcal / 2));
}

{
  const t = referenceIntakes({
    sex: 'female', age: 38, weight: 64, height: 170, activity: 'moderate',
  });
  // Mifflin-St Jeor: 10·64 + 6.25·170 − 5·38 − 161 = 1351; × 1.7 PAL ≈ 2300
  ok('energy from Mifflin-St Jeor × PAL', near(t.kcal, 2300, 0.01), String(t.kcal));
  ok('protein 0.8 g/kg', t.goals.pro === 51);
  ok('iron 15 mg for a menstruating adult', t.goals.fe === 15);

  const low = referenceIntakes({
    sex: 'female', age: 38, weight: 64, height: 170, activity: 'moderate', lowMeat: true,
  });
  ok('low-meat raises iron 40%', low.goals.fe === 21);

  const older = referenceIntakes({
    sex: 'female', age: 55, weight: 64, height: 170, activity: 'moderate',
  });
  ok('iron drops after 51', older.goals.fe === 10);

  const preg = referenceIntakes({
    sex: 'female', age: 32, weight: 64, height: 170, activity: 'light', pregnant: true,
  });
  ok('pregnancy raises folate and iron', preg.goals.fol === 550 && preg.goals.fe === 30);
}

{
  // Energy and carbohydrate must never appear as gaps to chase.
  const { items } = parse('an apple');
  const targets = targetsFor({
    sex: 'female', age: 38, weight: 64, height: 170, activity: 'moderate',
  });
  const gaps = shortfalls(assess(totalsFor(items), targets));
  ok('energy is not a gap', !gaps.some((g) => g.key === 'kcal'));
  ok('carbs are not a gap', !gaps.some((g) => g.key === 'carb'));
  ok('gap list is capped', gaps.length <= 6);
  ok('iron outranks vitamin E', gaps.findIndex((g) => g.key === 'fe') < gaps.findIndex((g) => g.key === 've')
    || !gaps.some((g) => g.key === 've'));
}

{
  // The "add a supplement" form stores label dose × 100, following the same
  // per-100g convention as every other food. Confirm it comes back out exact.
  const label = { vd: 25, b12: 100, fe: 6, ca: 120 };
  const stored = Object.fromEntries(Object.entries(label).map(([k, v]) => [k, v * 100]));
  const t = nutrientsOf('food', 'x', 1, { x: { n: 'test supp', g: ['supplement'], portion: 1, ...stored } });
  ok('custom supplement dose round-trips exactly', near(t.vd, 25) && near(t.b12, 100) && near(t.fe, 6) && near(t.ca, 120),
    JSON.stringify(t));
}

// ─── Suggestions ────────────────────────────────────────────────────────────

{
  const days = {};
  for (let i = 1; i <= 20; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const { items } = parse('porridge, big mixed salad with olive oil, wholemeal bread');
    days[dayKey(d)] = { items, checkin: { energy: 3 } };
  }
  const prefs = learnPreferences(days);
  ok('learns group frequency', prefs.groupPerWeek.grain > 0);
  ok('proposes excluding never-eaten groups', prefs.autoExcluded.includes('meat'));

  const targets = targetsFor({
    sex: 'female', age: 38, weight: 64, height: 170, activity: 'moderate', lowMeat: true,
  });
  const { items } = parse('porridge and an apple');
  const gaps = shortfalls(assess(totalsFor(items), targets));
  const s = suggestNextMeal(gaps, {
    prefs, settings: { excludedGroups: ['meat', 'fish'], dislikedFoods: [], feedback: {} }, remainingKcal: 1500,
  });

  ok('suggests something', s.lines.length > 0);
  ok('never suggests an excluded group', s.lines.every(
    (l) => !(FOODS[l.examples[0].id]?.g || []).some((g) => ['meat', 'fish'].includes(g)),
  ), s.lines.map((l) => l.examples[0].id).join(','));
  ok('amounts read like amounts', s.lines.every((l) => !/\b([5-9]|\d\d)\s+handful/.test(l.amount)),
    s.lines.map((l) => l.amount).join(' | '));
  ok('one line per food group', (() => {
    const seen = new Set();
    for (const l of s.lines) {
      for (const g of (FOODS[l.examples[0].id]?.g || []).filter((x) => x !== 'starch' && x !== 'other')) {
        if (seen.has(g) && s.lines.length > 2) return false;
        seen.add(g);
      }
    }
    return true;
  })(), s.lines.map((l) => l.category).join(' | '));
  ok('suggestions fit the energy left', s.kcal <= 1500);

  const tightSugg = suggestNextMeal(gaps, {
    prefs, settings: { excludedGroups: [], dislikedFoods: [], feedback: {} }, remainingKcal: 150,
  });
  ok('tight day is flagged tight', tightSugg.tight);
  ok('tight day suggests less', tightSugg.kcal < s.kcal);
}

{
  // The pattern read must refuse to speak too early, and must require a
  // sustained pattern rather than one thin day.
  const days = {};
  const targets = targetsFor({
    sex: 'female', age: 38, weight: 64, height: 170, activity: 'moderate', lowMeat: true,
  });
  const keys = [];
  for (let i = 1; i <= 21; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  const few = { [keys[0]]: { items: parse('porridge').items } };
  const aggFew = aggregate(few, keys);
  ok('says nothing on one day', !patternRead(aggFew, shortDayCounts(aggFew.perDay, targets.goals), targets).ready);

  for (const k of keys) days[k] = { items: parse('porridge, an apple, white bread').items, checkin: { energy: 2 } };
  const agg = aggregate(days, keys);
  const read = patternRead(agg, shortDayCounts(agg.perDay, targets.goals), targets);
  ok('speaks once there is a pattern', read.ready);
  ok('reports iron as chronically low', read.observations.some((o) => o.key === 'fe'));
  ok('attaches the felt effect', read.observations.every((o) => o.felt || o.over));
  ok('names the test for iron', read.observations.find((o) => o.key === 'fe')?.test === 'ferritin');

  const corr = correlateCheckins(days, keys, targets);
  ok('correlation needs paired days', corr.ready === true);
  ok('correlation reports no cause', !JSON.stringify(corr).includes('caus'));
}

// ─── Storage — corrupted data is rescued, not silently destroyed ──────────────

{
  const backing = new Map();
  globalThis.localStorage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  };
  const store = await import('../js/store.js');

  backing.set('nourish.v1', 'not valid json{');
  ok('unreadable save is flagged', store.hasReadError());
  ok('the raw string is rescued', store.getRescuedData() === 'not valid json{');

  store.setNote('logged something after the corruption');
  ok('a later write does not touch the rescue copy', store.getRescuedData() === 'not valid json{');

  store.clearRescuedData();
  ok('rescue copy can be cleared', store.getRescuedData() === null);
  ok('clearing drops the error flag', !store.hasReadError());
}

// ─── Result ─────────────────────────────────────────────────────────────────

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);

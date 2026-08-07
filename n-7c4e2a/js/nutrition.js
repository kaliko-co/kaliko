// Nutrition arithmetic: items → totals → gaps → weekly patterns.
//
// Dishes are resolved through their recipes rather than carrying their own
// numbers, so a dish and its ingredients can never disagree.

import { FOODS, NUTRIENT_KEYS } from './data/foods.js';
import { DISHES } from './data/dishes.js';
import { NUTRIENTS, WEEKLY_NUTRIENTS, referenceIntakes } from './data/targets.js';

/** Sodium mg → salt g. Labels are in salt; bodies care about sodium. */
export const saltFromSodium = (mgNa) => (mgNa * 2.542) / 1000;

const zero = () => {
  const t = {};
  for (const k of NUTRIENT_KEYS) t[k] = 0;
  return t;
};

/**
 * Nutrients contributed by `grams` of one food or dish.
 * Dishes recurse into their recipe, scaled by portion.
 */
export function nutrientsOf(kind, id, grams, customFoods = {}) {
  const out = zero();
  if (!grams || grams <= 0) return out;

  if (kind === 'dish') {
    const dish = DISHES[id];
    if (!dish) return out;
    const scale = grams / dish.portion;
    for (const [foodId, amount] of dish.r) {
      const part = nutrientsOf('food', foodId, amount * scale, customFoods);
      for (const k of NUTRIENT_KEYS) out[k] += part[k];
    }
    return out;
  }

  const food = FOODS[id] || customFoods[id];
  if (!food) return out;
  const f = grams / 100;
  for (const k of NUTRIENT_KEYS) out[k] += (food[k] || 0) * f;
  return out;
}

/** Sum a day's items. */
export function totalsFor(items, customFoods = {}) {
  const out = zero();
  for (const it of items || []) {
    if (it.excluded) continue;
    const part = nutrientsOf(it.kind, it.foodId, it.grams, customFoods);
    for (const k of NUTRIENT_KEYS) out[k] += part[k];
  }
  return out;
}

/** Which food groups a logged item belongs to (dishes inherit from ingredients). */
export function groupsOf(kind, id, customFoods = {}) {
  if (kind === 'dish') {
    const dish = DISHES[id];
    if (!dish) return [];
    const g = new Set();
    for (const [foodId, amount] of dish.r) {
      // Only count ingredients present in a meaningful amount — a teaspoon of
      // parmesan shouldn't make a dish count as "you ate dairy today".
      if (amount < 15) continue;
      for (const gr of (FOODS[foodId]?.g || [])) g.add(gr);
    }
    return [...g];
  }
  return (FOODS[id] || customFoods[id])?.g || [];
}

export const STATUS = { MET: 'met', CLOSE: 'close', SHORT: 'short', OVER: 'over', LOW: 'low' };

/**
 * Compare totals against targets.
 *
 * @returns {object} nutrient key → {value, target, pct, status, kind, weekly}
 */
export function assess(totals, { goals, limits }) {
  const out = {};

  for (const [k, target] of Object.entries(goals)) {
    if (!NUTRIENTS[k] || !target) continue;
    const value = totals[k] || 0;
    const pct = Math.round((value / target) * 100);
    out[k] = {
      value,
      target,
      pct,
      kind: 'goal',
      weekly: WEEKLY_NUTRIENTS.has(k),
      status: pct >= 95 ? STATUS.MET : pct >= 75 ? STATUS.CLOSE : STATUS.SHORT,
    };
  }

  for (const [k, limit] of Object.entries(limits)) {
    if (!NUTRIENTS[k]) continue;
    const value = totals[k] || 0;
    const pct = Math.round((value / limit) * 100);
    out[k] = {
      value,
      target: limit,
      pct,
      kind: 'limit',
      weekly: false,
      status: pct > 110 ? STATUS.OVER : pct > 90 ? STATUS.CLOSE : STATUS.MET,
    };
  }

  return out;
}

// Energy, carbs and fat are reported but never chased. "You're 35% of the way
// to your carbohydrate target" is not a gap anyone should act on, and putting
// energy in a shortfall list turns a nutrition tool into one that tells you to
// eat more, which is not what it's for.
export const NOT_A_GAP = new Set(['kcal', 'carb', 'fat']);

// Not all shortfalls are equally worth a line and a few hundred calories.
// Iron, calcium, protein and fibre are the ones that actually go short on a
// mostly-plant diet and actually have consequences; vitamin E and thiamin are
// rarely low enough to matter in a normal diet and would otherwise crowd them
// out purely by being a lower percentage. Higher number = surfaced sooner.
export const PRIORITY = {
  fe: 3, pro: 2.6, fib: 2.5, ca: 2.5, i: 2, fol: 2, epa: 2, b12: 2, vd: 1.8,
  mg: 1.5, zn: 1.5, vc: 1.5, se: 1.4, ala: 1.3, va: 1.2, k: 1,
  b2: 0.8, b6: 0.8, ve: 0.6, b1: 0.6,
};

/**
 * Today's shortfalls, worst first — the input to suggestions.
 * Weekly-scale nutrients are excluded here; they're judged over 7 days
 * elsewhere, and flagging B12 at 3pm on a Tuesday is noise.
 */
export function shortfalls(assessment, { includeWeekly = false, limit = 6 } = {}) {
  return Object.entries(assessment)
    .filter(([key, a]) => a.kind === 'goal'
      && a.status === STATUS.SHORT
      && !NOT_A_GAP.has(key)
      && (includeWeekly || !a.weekly))
    .map(([key, a]) => ({
      key, ...a, missing: Math.max(0, a.target - a.value), urgency: a.pct / (PRIORITY[key] ?? 1),
    }))
    .sort((a, b) => a.urgency - b.urgency)
    .slice(0, limit);
}

/** Limits being exceeded, worst first. */
export function excesses(assessment) {
  return Object.entries(assessment)
    .filter(([, a]) => a.kind === 'limit' && a.status === STATUS.OVER)
    .map(([key, a]) => ({ key, ...a }))
    .sort((a, b) => b.pct - a.pct);
}

// ─── Multi-day ──────────────────────────────────────────────────────────────

export const dayKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export function lastNDays(n, from = new Date()) {
  const out = [];
  const base = from instanceof Date ? from : new Date(from);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/**
 * Per-day totals plus the average across days that were actually logged.
 * Empty days are excluded from the average rather than counted as zeros —
 * a day you forgot to log is missing data, not a day you ate nothing.
 */
export function aggregate(days, dayKeys, customFoods = {}) {
  const perDay = {};
  let logged = 0;
  const sum = zero();

  for (const key of dayKeys) {
    const items = days[key]?.items || [];
    if (!items.length) { perDay[key] = null; continue; }
    const t = totalsFor(items, customFoods);
    perDay[key] = t;
    logged++;
    for (const k of NUTRIENT_KEYS) sum[k] += t[k];
  }

  const average = zero();
  if (logged) for (const k of NUTRIENT_KEYS) average[k] = sum[k] / logged;

  return { perDay, average, logged, requested: dayKeys.length };
}

/**
 * How many logged days fell short of each goal — the number that turns
 * "low today" into "low most days", which is the only version worth acting on.
 */
export function shortDayCounts(perDay, goals) {
  const counts = {};
  for (const k of Object.keys(goals)) counts[k] = { short: 0, logged: 0 };
  for (const totals of Object.values(perDay)) {
    if (!totals) continue;
    for (const [k, target] of Object.entries(goals)) {
      if (!target || !NUTRIENTS[k]) continue;
      counts[k].logged++;
      if (totals[k] / target < 0.75) counts[k].short++;
    }
  }
  return counts;
}

/** Convenience: targets for a profile, memoised on the profile's JSON. */
let targetCache = { key: null, value: null };
export function targetsFor(profile) {
  const key = JSON.stringify(profile);
  if (targetCache.key !== key) targetCache = { key, value: referenceIntakes(profile) };
  return targetCache.value;
}

export function formatAmount(key, value) {
  const meta = NUTRIENTS[key];
  if (!meta) return String(Math.round(value));
  const v = value.toFixed(meta.decimals);
  return `${v} ${meta.unit}`;
}

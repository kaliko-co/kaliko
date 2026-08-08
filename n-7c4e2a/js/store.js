// Local storage. Everything the app knows lives here, on this phone, in this
// browser. Nothing is transmitted, there is no account, and the repository never
// contains a byte of it.
//
// The real risk isn't privacy, it's loss — clearing browser data wipes this —
// so export/import is a first-class feature and the app nags about it.

import { DEFAULT_PROFILE } from './data/targets.js';
import { dayKey } from './nutrition.js';

const KEY = 'nourish.v1';
const SCHEMA_VERSION = 1;

const blank = () => ({
  version: SCHEMA_VERSION,
  created: new Date().toISOString(),
  profile: { ...DEFAULT_PROFILE, onboarded: false },
  days: {},              // 'YYYY-MM-DD' → {items: [], checkin: {}, note: ''}
  bloods: [],            // [{date, marker, value, unit, labLow, labHigh}]
  settings: {
    excludedGroups: [],
    dislikedFoods: [],
    suggestSupplements: true,
    resolved: {},          // taught phrase → 'kind:id', e.g. 'food:supp_iron'
    portionOverrides: {},  // 'foodId:unit' → grams
    customFoods: {},       // taught foods, same shape as FOODS entries
    feedback: {},          // foodId → {accepted, ignored}
    dismissedAutoExclude: [],
    supplementsOn: [],     // supplement ids explicitly added to the Today list
    supplementsOff: [],    // supplement ids explicitly hidden from it
    lastBackup: null,
  },
});

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : blank();
  } catch (err) {
    // A corrupt blob shouldn't mean a blank app with no explanation.
    console.error('nourish: could not read saved data', err);
    cache = blank();
    cache.readError = true;
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    return true;
  } catch (err) {
    console.error('nourish: could not save', err);
    return false;
  }
}

// Another tab wrote: drop the cache so the next read picks its version up
// rather than overwriting it with ours.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) cache = null;
  });
}

function migrate(data) {
  const out = { ...blank(), ...data };
  out.settings = { ...blank().settings, ...(data.settings || {}) };
  out.profile = { ...blank().profile, ...(data.profile || {}) };
  out.version = SCHEMA_VERSION;
  return out;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export const getState = () => read();
export const getProfile = () => read().profile;
export const getSettings = () => read().settings;
export const getDays = () => read().days;
export const getBloods = () => read().bloods;

export function getDay(key = dayKey(new Date())) {
  const d = read().days[key];
  return d ? { items: [], checkin: {}, note: '', ...d } : { items: [], checkin: {}, note: '' };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

function mutateDay(key, fn) {
  const state = read();
  const current = { items: [], checkin: {}, note: '', ...(state.days[key] || {}) };
  const next = fn(current) || current;
  if (!next.items.length && !Object.keys(next.checkin).length && !next.note) {
    delete state.days[key];
  } else {
    state.days[key] = next;
  }
  write();
  return next;
}

export function addItems(items, key = dayKey(new Date())) {
  return mutateDay(key, (day) => ({ ...day, items: [...day.items, ...items] }));
}

export function updateItem(itemId, patch, key = dayKey(new Date())) {
  return mutateDay(key, (day) => ({
    ...day,
    items: day.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
  }));
}

export function removeItem(itemId, key = dayKey(new Date())) {
  return mutateDay(key, (day) => ({
    ...day,
    // Cooking fat belongs to its host: deleting the potatoes deletes the oil
    // that was assumed for them.
    items: day.items.filter((it) => it.id !== itemId && it.cookingFatFor !== itemId),
  }));
}

export function setCheckin(patch, key = dayKey(new Date())) {
  return mutateDay(key, (day) => ({ ...day, checkin: { ...day.checkin, ...patch } }));
}

export function setNote(note, key = dayKey(new Date())) {
  return mutateDay(key, (day) => ({ ...day, note }));
}

export function setProfile(patch) {
  const state = read();
  state.profile = { ...state.profile, ...patch };
  write();
  return state.profile;
}

export function setSettings(patch) {
  const state = read();
  state.settings = { ...state.settings, ...patch };
  write();
  return state.settings;
}

/**
 * Remember an answer to an ambiguous or unrecognised name, so it's asked (or
 * taught) once ever. `kind` matters — a taught phrase can resolve to a dish,
 * not just a food, and losing that meant it looked up the wrong table forever.
 */
export function resolveAmbiguity(name, foodId, kind = 'food') {
  const state = read();
  state.settings.resolved = { ...state.settings.resolved, [name]: `${kind}:${foodId}` };
  write();
}

/** Remember your idea of a portion, which beats the table's. */
export function setPortionOverride(foodId, unit, grams) {
  const state = read();
  state.settings.portionOverrides = {
    ...state.settings.portionOverrides,
    [`${foodId}:${unit || 'portion'}`]: grams,
  };
  write();
}

/** Teach the app a food it didn't know. */
export function addCustomFood(id, food) {
  const state = read();
  state.settings.customFoods = { ...state.settings.customFoods, [id]: food };
  write();
}

/** Did you act on a suggestion? The strongest learning signal available. */
export function recordFeedback(foodId, accepted) {
  const state = read();
  const current = state.settings.feedback[foodId] || { accepted: 0, ignored: 0 };
  state.settings.feedback = {
    ...state.settings.feedback,
    [foodId]: accepted
      ? { ...current, accepted: current.accepted + 1 }
      : { ...current, ignored: current.ignored + 1 },
  };
  write();
}

// ─── Blood results ──────────────────────────────────────────────────────────

// Widely used cutoffs. A lab's own range, when you enter one, always wins —
// they genuinely differ between labs and assays.
export const BLOOD_MARKERS = {
  ferritin: {
    label: 'ferritin', units: ['µg/L', 'ng/mL'], sameScale: true,
    bands: [[15, 'low'], [30, 'low-normal'], [150, 'in range'], [Infinity, 'high']],
    about: 'Iron stores. The test that actually answers whether low iron intake has cost you anything.',
  },
  b12: {
    label: 'vitamin B12', units: ['pmol/L', 'pg/mL'],
    convert: { 'pg/mL': (v) => v * 0.738 },
    bands: [[148, 'low'], [221, 'low-normal'], [650, 'in range'], [Infinity, 'high']],
    about: 'A low-normal result with symptoms is worth following up with homocysteine or MMA — serum B12 alone misses some deficiency.',
  },
  vitd: {
    label: 'vitamin D (25-OH)', units: ['nmol/L', 'ng/mL'],
    convert: { 'ng/mL': (v) => v * 2.5 },
    bands: [[30, 'deficient'], [50, 'insufficient'], [125, 'sufficient'], [Infinity, 'high']],
    about: 'Berlin sits too far north to make any between October and March, so a winter result is not a verdict on your diet.',
  },
  haemoglobin: {
    label: 'haemoglobin', units: ['g/L', 'g/dL'],
    convert: { 'g/dL': (v) => v * 10 },
    bandsBySex: {
      female: [[120, 'low'], [160, 'in range'], [Infinity, 'high']],
      male: [[130, 'low'], [175, 'in range'], [Infinity, 'high']],
    },
    about: 'Falls only after iron stores are already exhausted, so normal haemoglobin does not rule out low iron.',
  },
};

/** Classify one result. Returns a band name, never a diagnosis. */
export function classifyBlood(entry, profile = getProfile()) {
  const marker = BLOOD_MARKERS[entry.marker];
  if (!marker) return null;

  if (entry.labLow != null && entry.labHigh != null) {
    if (entry.value < entry.labLow) return 'below your lab\'s range';
    if (entry.value > entry.labHigh) return 'above your lab\'s range';
    const span = entry.labHigh - entry.labLow;
    return entry.value < entry.labLow + span * 0.2 ? 'low end of your lab\'s range' : 'in your lab\'s range';
  }

  const raw = marker.convert?.[entry.unit] ? marker.convert[entry.unit](entry.value) : entry.value;
  const bands = marker.bandsBySex ? marker.bandsBySex[profile.sex === 'male' ? 'male' : 'female'] : marker.bands;
  for (const [ceiling, name] of bands) if (raw < ceiling) return name;
  return null;
}

export function addBlood(entry) {
  const state = read();
  state.bloods = [...state.bloods, { id: `bl${Date.now().toString(36)}`, ...entry }]
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  write();
  return state.bloods;
}

export function removeBlood(id) {
  const state = read();
  state.bloods = state.bloods.filter((b) => b.id !== id);
  write();
}

/** Most recent result per marker, with its age in days. */
export function latestBloods() {
  const out = {};
  const today = new Date();
  for (const b of getBloods()) {
    if (out[b.marker]) continue;
    const ageDays = Math.round((today - new Date(b.date)) / 86400000);
    out[b.marker] = { ...b, ageDays, stale: ageDays > 240, band: classifyBlood(b) };
  }
  return out;
}

// ─── Export / import ────────────────────────────────────────────────────────

export function exportJSON() {
  const state = read();
  return JSON.stringify({ ...state, exported: new Date().toISOString() }, null, 2);
}

export function exportFilename() {
  return `nourish-backup-${dayKey(new Date())}.json`;
}

export function markBackedUp() {
  setSettings({ lastBackup: new Date().toISOString() });
}

/**
 * Import a backup.
 * @param {string} json
 * @param {'replace'|'merge'} mode
 */
export function importJSON(json, mode = 'merge') {
  const incoming = JSON.parse(json);
  if (!incoming || typeof incoming !== 'object' || !incoming.days) {
    throw new Error('That file doesn\'t look like a Nourish backup.');
  }
  const state = read();

  if (mode === 'replace') {
    cache = migrate(incoming);
    write();
    return { days: Object.keys(cache.days).length, mode };
  }

  let added = 0;
  for (const [key, day] of Object.entries(incoming.days || {})) {
    if (state.days[key]) continue;   // never overwrite a day you already have
    state.days[key] = day;
    added++;
  }
  state.bloods = [...state.bloods];
  for (const b of incoming.bloods || []) {
    if (!state.bloods.some((x) => x.date === b.date && x.marker === b.marker)) state.bloods.push(b);
  }
  state.bloods.sort((a, b) => (a.date < b.date ? 1 : -1));
  state.settings.customFoods = { ...(incoming.settings?.customFoods || {}), ...state.settings.customFoods };
  state.settings.resolved = { ...(incoming.settings?.resolved || {}), ...state.settings.resolved };
  state.settings.portionOverrides = {
    ...(incoming.settings?.portionOverrides || {}), ...state.settings.portionOverrides,
  };
  write();
  return { days: added, mode };
}

/** Days since the last export, or null if never. */
export function daysSinceBackup() {
  const last = getSettings().lastBackup;
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
}

/**
 * Does a write actually survive a read-back, right now? This catches Safari's
 * "Block All Cookies" (which blocks localStorage too, and fails silently) and
 * any other setting that turns every save into a no-op.
 *
 * It cannot catch — because nothing running in the page can — private/
 * incognito tabs or in-app browsers that wipe storage only once the tab
 * closes. Those look fine on this test and fail only on the next visit.
 */
export function checkPersistence() {
  const probe = '__nourish_probe__';
  try {
    localStorage.setItem(probe, '1');
    const ok = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

export function clearAll() {
  cache = blank();
  write();
}

/** Rough size of what's stored, for the settings screen. */
export function storageSize() {
  try {
    return new Blob([localStorage.getItem(KEY) || '']).size;
  } catch {
    return 0;
  }
}

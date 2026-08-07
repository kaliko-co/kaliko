// Free text → editable food items.
//
// The parser's job is not to be clever. It's to be *legible*: every guess it
// makes has to end up visible and editable on screen, and anything it can't
// place has to be shown rather than silently dropped. A tracker that quietly
// loses the olive oil is worse than no tracker.
//
// How it works: split on punctuation only, then walk each chunk left to right,
// collecting quantity/unit/size words until a food name matches, emit an item,
// and reset. That ordering matters — it's what lets one chunk carry two
// separately quantified foods ("...potatoes ... and 100g feta"), and it lets a
// multi-word dish name win over its own first word ("coffee with oat milk" is
// an oat latte, not a coffee plus a glass of oat milk).

import { FOODS } from './data/foods.js';
import { DISHES } from './data/dishes.js';
import {
  ALIASES, AMBIGUOUS, UNIT_WORDS, UNIT_FALLBACK, SIZE_MODIFIERS,
  VAGUE_QUANTIFIERS, NUMBER_WORDS, FRACTIONS, COOKING_VERBS, STOPWORDS,
  DRY_MULTIPLIERS, DRY_WORDS,
} from './data/portions.js';

// ─── Text normalisation ─────────────────────────────────────────────────────

/** Lowercase, strip diacritics, normalise punctuation and whitespace. */
export function normalise(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // combining accents: é→e, ü→u
    .replace(/ł/g, 'l')           // ł doesn't decompose
    .replace(/[‘’']/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[.!?]+(?=\s|$)/g, ' ')   // sentence punctuation carries nothing
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip common Slavic case endings. Used *only* as a fuzzy-match fallback, so a
 * wrong strip costs nothing: "jagodami" → "jagod", which then matches "jagody".
 * Polish declines its nouns and a food diary is written in whatever case the
 * sentence needed.
 */
function stemSlavic(word) {
  if (word.length < 6) return word;
  for (const suffix of ['ami', 'ach', 'ego', 'emu', 'ymi', 'imi', 'om', 'em', 'ie', 'ow']) {
    if (word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

/** Singularise crudely — enough for food names, not for English in general. */
function singular(word) {
  if (word.length < 4) return word;
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (/ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

// ─── Lookup index ───────────────────────────────────────────────────────────

const UNIT_LOOKUP = (() => {
  const m = new Map();
  for (const [canonical, words] of Object.entries(UNIT_WORDS)) {
    for (const w of words) m.set(w, canonical);
  }
  return m;
})();

/**
 * alias/name → {kind, id}. Dish names are added first so they win ties:
 * "lentil soup" should be the dish, not lentils and then soup.
 */
const NAME_INDEX = (() => {
  const m = new Map();
  const add = (name, kind, id) => {
    const key = normalise(name);
    if (key && !m.has(key)) m.set(key, { kind, id });
  };
  for (const [id, dish] of Object.entries(DISHES)) {
    add(dish.n, 'dish', id);
    for (const a of dish.a || []) add(a, 'dish', id);
  }
  for (const [alias, id] of Object.entries(ALIASES)) add(alias, 'food', id);
  for (const [id, food] of Object.entries(FOODS)) add(food.n, 'food', id);
  return m;
})();

const AMBIGUOUS_KEYS = new Set(Object.keys(AMBIGUOUS).map(normalise));
const MAX_NAME_WORDS = Math.max(...[...NAME_INDEX.keys()].map((k) => k.split(' ').length));
const VAGUE_PHRASES = VAGUE_QUANTIFIERS.map((v) => normalise(v).split(' '));
const SIZE_PHRASES = Object.keys(SIZE_MODIFIERS)
  .map((k) => normalise(k).split(' '))
  .sort((a, b) => b.length - a.length);
const DRY_PHRASES = DRY_WORDS.map((w) => normalise(w).split(' '));

// ─── Fuzzy matching ─────────────────────────────────────────────────────────

function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient over character bigrams. */
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

const FUZZY_THRESHOLD = 0.74;
const FUZZY_THRESHOLD_LOOSE = 0.86;

/**
 * Nearest name by bigram similarity — catches typos and inflected forms.
 *
 * A candidate that doesn't start with the same letter has to clear a much
 * higher bar: "plate" scores 0.75 against "latte" (same bigrams, shuffled), and
 * without this guard "a big plate of potatoes" parsed as a coffee.
 */
function fuzzyMatch(phrase) {
  if (phrase.length < 4) return null;
  let best = null;
  let bestScore = 0;
  for (const [name, entry] of NAME_INDEX) {
    if (Math.abs(name.length - phrase.length) > Math.max(4, phrase.length * 0.5)) continue;
    const score = similarity(phrase, name);
    if (score > bestScore) { bestScore = score; best = { ...entry, name }; }
  }
  if (!best) return null;
  const bar = best.name[0] === phrase[0] ? FUZZY_THRESHOLD : FUZZY_THRESHOLD_LOOSE;
  return bestScore >= bar ? { ...best, fuzzy: true, score: bestScore } : null;
}

// ─── Splitting ──────────────────────────────────────────────────────────────

// Punctuation only. Connectives are deliberately *not* split on, so a dish name
// can span them and so quantities stay next to their own food.
const HARD_SPLIT_RE = /\s*(?:,|;|:|\/|\||\+|&|\bthen\b|\balso\b)\s*/g;

function splitChunks(text) {
  return text.split('\n')
    .flatMap((line) => line.split(HARD_SPLIT_RE))
    .map((f) => f.trim())
    .filter(Boolean);
}

// ─── Cooking phrases ────────────────────────────────────────────────────────

// The verb must sit immediately before "in"/"with", give or take one adverb.
// Allowing arbitrary words between them made "baked potatoes baked in olive
// oil" swallow the potatoes into the phrase.
const COOKING_RE = new RegExp(
  `\\b(?:${COOKING_VERBS.join('|')})\\b(?:\\s+(?:lightly|gently|quickly|slowly|briefly|well))?`
  + `\\s+(?:in|with)\\s+(.{2,40}?)(?=$|,|;|\\band\\b)`,
  'gi',
);

const FAT_MARKER = '';

/**
 * Replace cooking phrases with a positional marker, so the fat they name keeps
 * its place in the word stream and can be attached to the food it preceded.
 * "leek sauteed in some olive oil" → "leek 1", fats: ['olive_oil']
 */
function extractCooking(chunk) {
  const fats = [];
  const text = chunk.replace(COOKING_RE, (_m, what) => {
    const cleaned = normalise(what)
      .split(' ')
      .filter((w) => !STOPWORDS.has(w))
      .join(' ');
    const hit = NAME_INDEX.get(cleaned) || NAME_INDEX.get(cleaned.split(' ').map(singular).join(' '));
    if (hit?.kind === 'food') {
      const food = FOODS[hit.id];
      if (food && (food.g.includes('fat') || food.g.includes('dairy'))) {
        fats.push(hit.id);
        return ` ${FAT_MARKER}${fats.length - 1} `;
      }
    }
    return ' ';   // a cooking phrase either way — never its own food line
  });
  return { text: text.replace(/\s+/g, ' ').trim(), fats };
}

// ─── Token classification ───────────────────────────────────────────────────

/**
 * Longest food/dish name starting exactly at `i`.
 *
 * `foodOnly` skips composite dishes. Set when a dry weight was given: you weigh
 * raw ingredients, not finished dishes, so "100g dry pasta with pesto" is dry
 * pasta plus pesto — not 100 g of a pasta-with-pesto dish.
 */
function matchAt(words, i, { foodOnly = false } = {}) {
  const max = Math.min(MAX_NAME_WORDS, words.length - i);
  for (let len = max; len >= 1; len--) {
    const slice = words.slice(i, i + len);
    for (const candidate of [slice.join(' '), slice.map(singular).join(' ')]) {
      const hit = NAME_INDEX.get(candidate);
      if (hit && !(foodOnly && hit.kind === 'dish')) return { ...hit, name: candidate, len };
    }
  }
  return null;
}

function phraseAt(words, i, phrases) {
  for (const p of phrases) {
    if (p.every((w, k) => words[i + k] === w)) return p.length;
  }
  return 0;
}

function readNumber(word) {
  if (/^\d+([.,]\d+)?$/.test(word)) return parseFloat(word.replace(',', '.'));
  if (/^\d+\/\d+$/.test(word)) {
    const [a, b] = word.split('/').map(Number);
    return b ? a / b : null;
  }
  if (FRACTIONS[word] !== undefined) return FRACTIONS[word];
  return null;
}

// ─── Gram arithmetic ────────────────────────────────────────────────────────

function unitWeight(entry, unit) {
  if (!unit) return null;
  if (unit === 'g') return 1;
  if (unit === 'kg') return 1000;
  if (unit === 'ml') return entry.units?.ml ?? 1;
  if (unit === 'l') return (entry.units?.ml ?? 1) * 1000;
  return entry.units?.[unit] ?? UNIT_FALLBACK[unit] ?? null;
}

function computeGrams({ entry, qty, unit, size, dry, id }) {
  let grams;
  let assumed = false;

  const w = unitWeight(entry, unit);
  if (unit && w !== null) {
    grams = (qty ?? 1) * w;
  } else if (qty !== null) {
    // A bare number counts pieces where the food has a piece weight,
    // portions otherwise.
    const each = entry.units?.each;
    grams = qty * (each ?? entry.portion);
    if (!each) assumed = true;
  } else {
    grams = entry.portion;
    assumed = true;
  }

  grams *= size;
  if (dry && DRY_MULTIPLIERS[id]) grams *= DRY_MULTIPLIERS[id];

  return { grams: Math.round(grams * 10) / 10, assumed };
}

// ─── Public API ─────────────────────────────────────────────────────────────

let itemSeq = 0;
const nextId = () => `it${Date.now().toString(36)}${(itemSeq++).toString(36)}`;

const blankMods = () => ({
  qty: null, unit: null, sizeWords: [], vague: false, dry: false,
});

/**
 * Parse a free-text description into items.
 *
 * @param {string} text what you typed
 * @param {object} [opts]
 * @param {object} [opts.customFoods] foods you taught the app
 * @param {object} [opts.resolved] remembered answers to ambiguous names
 * @param {object} [opts.portionOverrides] your corrected weights, keyed `id:unit`
 * @returns {{items: Array, unknown: Array}}
 */
export function parse(text, opts = {}) {
  const { customFoods = {}, resolved = {}, portionOverrides = {} } = opts;
  const items = [];
  const unknown = [];

  const lookup = (kind, id) => (kind === 'dish' ? DISHES[id] : (FOODS[id] || customFoods[id]));

  for (const chunk of splitChunks(normalise(text))) {
    const { text: stripped, fats } = extractCooking(chunk);
    const words = stripped.split(' ').filter(Boolean);

    let mods = blankMods();
    let leftover = [];
    let lastItem = null;
    const chunkItems = [];

    /**
     * Nothing matched exactly, so try fuzzily — over two-word groups first,
     * then single words, each also in stemmed form. A buffer can hold more than
     * one unrecognised food ("jagodami masla orzechowego" is two), so matching
     * the whole thing as one phrase finds neither.
     */
    const flushLeftover = () => {
      const buf = leftover.filter((w) => !STOPWORDS.has(w) && !STOPWORDS.has(singular(w)));
      leftover = [];
      if (!buf.length) return;

      let j = 0;
      let stillUnknown = [];
      while (j < buf.length) {
        let hit = null;
        let used = 0;
        for (const len of [2, 1]) {
          if (j + len > buf.length) continue;
          const slice = buf.slice(j, j + len);
          for (const form of [slice.join(' '), slice.map(stemSlavic).join(' ')]) {
            hit = matchAt(form.split(' '), 0) || fuzzyMatch(form);
            if (hit) break;
          }
          if (hit) { used = len; break; }
        }
        if (hit) {
          if (stillUnknown.length) {
            unknown.push({ id: nextId(), text: stillUnknown.join(' '), raw: chunk });
            stillUnknown = [];
          }
          emit({ ...hit, fuzzy: true }, buf.slice(j, j + used).join(' '));
          j += used;
        } else {
          stillUnknown.push(buf[j]);
          j++;
        }
      }
      if (stillUnknown.length) {
        unknown.push({
          id: nextId(), text: stillUnknown.join(' '), raw: chunk, qty: mods.qty, unit: mods.unit,
        });
        mods = blankMods();
      }
    };

    const emit = (match, matchedText) => {
      let resolvedMatch = match;
      let needs = null;
      if (AMBIGUOUS_KEYS.has(match.name)) {
        if (resolved[match.name]) resolvedMatch = { kind: 'food', id: resolved[match.name], name: match.name };
        else needs = match.name;
      }

      const entry = lookup(resolvedMatch.kind, resolvedMatch.id);
      if (!entry) {
        unknown.push({ id: nextId(), text: matchedText, raw: chunk });
        mods = blankMods();
        return;
      }

      // Size words: if several were given ("one small medium leek") the last
      // wins, and the conflict is surfaced rather than silently resolved.
      const sizeWord = mods.sizeWords.length ? mods.sizeWords[mods.sizeWords.length - 1] : null;
      const size = sizeWord ? SIZE_MODIFIERS[sizeWord] : 1;

      // Your corrected portion sizes override the table's.
      const key = `${resolvedMatch.id}:${mods.unit || 'portion'}`;
      const override = portionOverrides[key];
      const effective = override
        ? {
          ...entry,
          portion: mods.unit ? entry.portion : override,
          units: { ...entry.units, ...(mods.unit ? { [mods.unit]: override } : {}) },
        }
        : entry;

      const { grams, assumed } = computeGrams({
        entry: effective, qty: mods.qty, unit: mods.unit, size, dry: mods.dry, id: resolvedMatch.id,
      });

      const item = {
        id: nextId(),
        kind: resolvedMatch.kind,
        foodId: resolvedMatch.id,
        name: entry.n,
        grams,
        unit: mods.unit,
        qty: mods.qty,
        source: chunk,
        // Flags the UI renders as visible marks rather than hiding.
        estimated: assumed || mods.vague,
        fuzzy: !!match.fuzzy,
        needs,
        sizeWord,
        sizeConflict: mods.sizeWords.length > 1 ? [...mods.sizeWords] : null,
        dry: mods.dry,
      };
      items.push(item);
      chunkItems.push(item);
      lastItem = item;
      mods = blankMods();
    };

    for (let i = 0; i < words.length;) {
      const w = words[i];

      // Cooking-fat marker — attach to the food just named.
      if (w[0] === FAT_MARKER) {
        flushLeftover();
        const fatId = fats[Number(w.slice(1))];
        const host = lastItem ?? chunkItems[0];
        if (fatId && host) {
          const hostEntry = lookup(host.kind, host.foodId);
          const perHundred = hostEntry?.cook ?? 4;
          const fatGrams = Math.max(2, Math.round((host.grams / 100) * perHundred * 10) / 10);
          items.push({
            id: nextId(),
            kind: 'food',
            foodId: fatId,
            name: FOODS[fatId]?.n ?? fatId,
            grams: fatGrams,
            unit: null,
            qty: null,
            source: chunk,
            estimated: true,
            cookingFatFor: host.id,
            note: `assumed cooking fat for ${host.name}`,
          });
        }
        i++;
        continue;
      }

      // A food or dish name ends the modifier run.
      const hit = matchAt(words, i, { foodOnly: mods.dry });
      if (hit) {
        flushLeftover();
        emit(hit, words.slice(i, i + hit.len).join(' '));
        i += hit.len;
        continue;
      }

      // Everything below is a modifier, and modifiers always precede their
      // food. So reaching one means the previous run is finished — flush any
      // unmatched words now, or "jagodami i lyzka masla orzechowego" gives the
      // tablespoon to the blueberries instead of the peanut butter.
      const isModifier = phraseAt(words, i, VAGUE_PHRASES)
        || /^\d+([.,]\d+)?(g|kg|ml|l)?$/.test(w)
        || readNumber(w) !== null
        || (NUMBER_WORDS[w] !== undefined && !STOPWORDS.has(w))
        || phraseAt(words, i, DRY_PHRASES)
        || phraseAt(words, i, SIZE_PHRASES)
        || UNIT_LOOKUP.has(w) || UNIT_LOOKUP.has(singular(w));
      if (isModifier && leftover.length) flushLeftover();

      // Vague amounts: "some", "a bit of", "a couple of".
      const vagueLen = phraseAt(words, i, VAGUE_PHRASES);
      if (vagueLen) {
        mods.vague = true;
        const joined = words.slice(i, i + vagueLen).join(' ');
        if (/couple/.test(joined)) mods.qty = 2;
        else if (/few|kilka|pare/.test(joined)) mods.qty = 3;
        i += vagueLen;
        continue;
      }

      // Numbers and fractions, including glued forms like 100g / 50ml.
      const glued = /^(\d+([.,]\d+)?)(g|kg|ml|l)$/.exec(w);
      if (glued) {
        mods.qty = (mods.qty ?? 0) + parseFloat(glued[1].replace(',', '.'));
        mods.unit = glued[3];
        i++;
        continue;
      }
      const num = readNumber(w);
      if (num !== null) {
        mods.qty = (mods.qty ?? 0) + num;
        i++;
        continue;
      }
      if (NUMBER_WORDS[w] !== undefined && mods.qty === null && !STOPWORDS.has(w)) {
        mods.qty = NUMBER_WORDS[w];
        i++;
        continue;
      }

      // Dry-weight marker.
      const dryLen = phraseAt(words, i, DRY_PHRASES);
      if (dryLen) { mods.dry = true; i += dryLen; continue; }

      // Size words. Checked before units so "big" can't be eaten as a unit.
      const sizeLen = phraseAt(words, i, SIZE_PHRASES);
      if (sizeLen) {
        mods.sizeWords.push(words.slice(i, i + sizeLen).join(' '));
        i += sizeLen;
        continue;
      }

      // Units.
      const unit = UNIT_LOOKUP.get(w) || UNIT_LOOKUP.get(singular(w));
      if (unit) { mods.unit = unit; i++; continue; }

      // "a"/"an"/"one" as an article rather than a count.
      if (NUMBER_WORDS[w] !== undefined && mods.qty === null) { mods.qty = NUMBER_WORDS[w]; i++; continue; }

      if (STOPWORDS.has(w) || STOPWORDS.has(singular(w))) { i++; continue; }

      leftover.push(w);
      i++;
    }
    flushLeftover();
  }

  return { items, unknown };
}

/** Candidates for the "teach me this food" screen. */
export function searchFoods(query, { customFoods = {} } = {}) {
  const q = normalise(query);
  if (q.length < 2) return [];
  const seen = new Set();
  const results = [];

  for (const [name, entry] of NAME_INDEX) {
    if (!name.includes(q) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const target = entry.kind === 'dish' ? DISHES[entry.id] : FOODS[entry.id];
    if (target) results.push({ ...entry, label: target.n, exact: name === q });
  }
  for (const [id, food] of Object.entries(customFoods)) {
    if (normalise(food.n).includes(q) && !seen.has(id)) {
      results.push({ kind: 'food', id, label: food.n, custom: true });
    }
  }

  return results
    .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.label.length - b.label.length)
    .slice(0, 12);
}

export const _internals = {
  splitChunks, extractCooking, matchAt, fuzzyMatch, computeGrams,
  similarity, normalise, singular, readNumber, NAME_INDEX,
};

// Screens and interaction. No framework: four render functions and a re-render
// on every change. The data is small enough that this is both simpler and
// faster than anything cleverer.

import { FOODS, PREFERENCE_GROUPS } from './data/foods.js';
import { DISHES } from './data/dishes.js';
import { AMBIGUOUS } from './data/portions.js';
import {
  NUTRIENTS, NUTRIENT_NOTES, ACTIVITY_LEVELS, WEEKLY_NUTRIENTS,
} from './data/targets.js';
import { parse, searchFoods, normalise } from './parse.js';
import {
  totalsFor, assess, shortfalls, excesses, targetsFor, aggregate, shortDayCounts,
  lastNDays, dayKey, saltFromSodium, formatAmount, nutrientsOf,
} from './nutrition.js';
import {
  learnPreferences, suggestNextMeal, patternRead, correlateCheckins,
} from './suggest.js';
import * as store from './store.js';

// ─── Tiny helpers ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

const pct = (n) => `${Math.min(100, Math.max(0, Math.round(n)))}%`;
const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// Which nutrients get a meter, in the order they're shown.
const METER_ORDER = [
  'pro', 'fib', 'fe', 'ca', 'mg', 'zn', 'k', 'i', 'se',
  'va', 'vc', 'vd', 've', 'b1', 'b2', 'b6', 'b12', 'fol', 'ala', 'epa',
];
const HEAT_ROWS = ['kcal', 'pro', 'fib', 'fe', 'ca', 'vc', 'b12'];

let view = 'today';
let showAllMeters = false;
let editingProfile = false;

// ─── Today ──────────────────────────────────────────────────────────────────

// Checked once per load — a live page can't detect storage that will be wiped
// only once the tab closes (private tabs, most in-app browsers); it can only
// catch saves that are being silently blocked right now.
const storageWorks = store.checkPersistence();

function renderBanners() {
  const profile = store.getProfile();
  const settings = store.getSettings();
  const prefs = currentPrefs();
  const out = [];

  if (store.hasReadError()) {
    out.push(`<div class="banner ask">
      <b>What was saved here couldn't be read back.</b> That's a corrupted save,
      not necessarily an empty one — it's not the same as the tab-close data loss.
      The unreadable data has been set aside rather than erased.
      <div class="b-actions">
        <button class="btn small primary" data-act="download-rescue">download it as-is</button>
        <button class="btn small ghost" data-act="dismiss-rescue">discard it</button>
      </div>
    </div>`);
  }

  if (!storageWorks) {
    out.push(`<div class="banner ask">
      <b>Nothing you enter right now is being saved.</b> This usually means Safari's
      <i>Block All Cookies</i> setting is on for this site, which blocks storage too —
      Settings → Safari → Advanced → turn it off for kaliko.co, then reload.
    </div>`);
  }

  if (!profile.onboarded) {
    out.push(`<div class="banner ask">
      Your targets are generic until I know a little about you — age, weight,
      height and how active your days are. It changes the energy and protein
      numbers substantially.
      <div class="b-actions"><button class="btn small primary" data-act="go-profile">set that up</button>
      <button class="btn small ghost" data-act="dismiss-onboard">later</button></div>
    </div>`);
  }

  const since = store.daysSinceBackup();
  const dayCount = Object.keys(store.getDays()).length;
  if (dayCount >= 7 && (since === null || since > 30)) {
    out.push(`<div class="banner">
      ${since === null ? 'You\'ve never exported a backup.' : `Last backup was ${since} days ago.`}
      This all lives in this browser only — clearing your browsing data would take it with it.
      <div class="b-actions"><button class="btn small" data-act="export">export a copy</button></div>
    </div>`);
  }

  const proposed = prefs.autoExcluded.filter(
    (g) => !settings.excludedGroups.includes(g) && !settings.dismissedAutoExclude.includes(g),
  );
  if (proposed.length) {
    const names = proposed.map((g) => PREFERENCE_GROUPS.find((p) => p.id === g)?.label ?? g);
    out.push(`<div class="banner">
      In ${prefs.daysLogged} logged days you haven't eaten ${esc(names.join(' or '))} once.
      Shall I stop suggesting ${proposed.length > 1 ? 'them' : 'it'}?
      <div class="b-actions">
        <button class="btn small primary" data-act="accept-exclude" data-groups="${esc(proposed.join(','))}">yes, stop</button>
        <button class="btn small ghost" data-act="dismiss-exclude" data-groups="${esc(proposed.join(','))}">no, keep them</button>
      </div>
    </div>`);
  }

  $('#todayBanners').innerHTML = out.join('');
}

// ─── Supplements — a curated list you tap instead of typing ────────────────

// A dose is one capsule/tablet/drop, so only vitamins, minerals, fibre and
// omega-3 make sense here — the same fields the "add a supplement" form fills in.
const SUPP_FIELD_KEYS = [
  'vd', 'b12', 'fe', 'ca', 'i', 'mg', 'zn', 'se', 'fol', 'va', 'vc', 've',
  'b1', 'b2', 'b6', 'ala', 'epa', 'fib',
];

function allSupplementFoods() {
  const settings = store.getSettings();
  const out = [];
  for (const [id, food] of Object.entries(FOODS)) if (food.g?.includes('supplement')) out.push({ id, food });
  for (const [id, food] of Object.entries(settings.customFoods)) {
    if (food.g?.includes('supplement')) out.push({ id, food });
  }
  return out;
}

/** Every supplement id that's ever actually been logged, even once. */
function everLoggedSupplementIds() {
  const settings = store.getSettings();
  const ids = new Set();
  for (const day of Object.values(store.getDays())) {
    for (const it of day.items || []) {
      const food = FOODS[it.foodId] || settings.customFoods[it.foodId];
      if (food?.g?.includes('supplement')) ids.add(it.foodId);
    }
  }
  return ids;
}

/**
 * On the Today list by default the moment you've logged it once — no setup
 * required. `supplementsOn` is only for one you intend to start taking but
 * haven't logged yet; `supplementsOff` always wins, so hiding one is final
 * until you turn it back on.
 */
function isQuickSupplement(id, everLogged, settings) {
  return (everLogged.has(id) || settings.supplementsOn.includes(id)) && !settings.supplementsOff.includes(id);
}

function quickSupplementList() {
  const settings = store.getSettings();
  const everLogged = everLoggedSupplementIds();
  const counts = {};
  for (const day of Object.values(store.getDays())) {
    for (const it of day.items || []) counts[it.foodId] = (counts[it.foodId] || 0) + 1;
  }
  return allSupplementFoods()
    .filter(({ id }) => isQuickSupplement(id, everLogged, settings))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.food.n.localeCompare(b.food.n));
}

/** Foods from today's log that a supplement's dose would need to match to count as "taken". */
function takenSupplementIds(day) {
  return new Set(day.items.filter((it) => !it.cookingFatFor).map((it) => it.foodId));
}

function renderSupplementQuick() {
  const list = quickSupplementList();
  const box = $('#todaySupplements');
  if (!box) return;

  if (!list.length) {
    const known = allSupplementFoods().length;
    box.innerHTML = `<div class="card quiet">
      <span class="label">Your supplements</span>
      <p class="small muted" style="margin-top:.3rem">Nothing showing yet.
        ${known ? 'If one\'s already set up, turn it on below — ' : ''}
        add a new one with the doses off its label and it shows up here as
        a button from then on.</p>
      <div class="row" style="gap:.5rem;margin-top:.5rem;flex-wrap:wrap">
        ${known ? '<button class="btn small ghost" data-act="manage-supps">turn one on</button>' : ''}
        <button class="btn small" data-act="add-supp">add a supplement</button>
      </div>
    </div>`;
    return;
  }

  const taken = takenSupplementIds(store.getDay());

  box.innerHTML = `<div class="card">
    <div class="row between"><span class="label">Your supplements — took it today?</span>
      <button class="btn small ghost" data-act="manage-supps">manage</button></div>
    <div class="chips" style="margin-top:.55rem">
      ${list.map(({ id, food }) => `<button class="chip log" data-act="log-supp"
        data-food="${esc(id)}" aria-pressed="${taken.has(id)}">${esc(food.n)}</button>`).join('')}
    </div>
    <p class="small faint" style="margin-top:.6rem">One tap marks today's dose taken.
      Tap again if that was a mistake.</p>
  </div>`;
}

function itemRow(it, isSub) {
  const flags = [];
  if (it.needs) flags.push('<span class="flag ask" title="needs an answer">?</span>');
  if (it.estimated) flags.push('<span class="flag" title="an estimate — check it">~</span>');
  if (it.taught && !it.fuzzy) flags.push('<span class="flag ok" title="a food you taught me">✓</span>');
  else if (it.fuzzy) flags.push('<span class="flag" title="closest match to what you wrote">≈</span>');
  if (it.dry) flags.push('<span class="flag ok" title="converted from dry to cooked weight">↑</span>');

  const notes = [];
  if (it.note) notes.push(esc(it.note));
  if (it.sizeConflict) notes.push(`you wrote “${esc(it.sizeConflict.join(' '))}” — took “${esc(it.sizeWord)}”`);
  if (it.needs) notes.push(AMBIGUOUS[it.needs]?.question ?? 'which one?');

  return `<div class="item${isSub ? ' sub' : ''}" data-id="${it.id}">
    <span class="item-grams"><input type="number" inputmode="decimal" min="0" step="1"
      value="${Math.round(it.grams)}" data-act="grams" aria-label="grams of ${esc(it.name)}"> g</span>
    <span class="item-name">${esc(it.name)}<span class="flags">${flags.join('')}</span>
      ${notes.length ? `<span class="item-note">${notes.join(' · ')}</span>` : ''}</span>
    <button class="x" data-act="remove" aria-label="remove ${esc(it.name)}">×</button>
  </div>`;
}

function renderItems() {
  const day = store.getDay();
  const box = $('#todayItems');
  if (!day.items.length) {
    box.innerHTML = '';
    return;
  }
  const tops = day.items.filter((it) => !it.cookingFatFor);
  const rows = [];
  for (const it of tops) {
    rows.push(itemRow(it, false));
    for (const sub of day.items.filter((s) => s.cookingFatFor === it.id)) rows.push(itemRow(sub, true));
  }
  box.innerHTML = `<div class="card">
    <span class="label">Today's items — tap a number to correct it</span>
    <div class="items">${rows.join('')}</div>
    <p class="small faint" style="margin-top:.6rem">
      ~ is a guess, ≈ is the nearest name I knew, ? still needs an answer.
      Correcting grams teaches me your portions.
    </p>
  </div>`;
}

function meterRow(key, a, { tappable = true } = {}) {
  const meta = NUTRIENTS[key];
  if (!meta) return '';
  const note = NUTRIENT_NOTES[key];
  const suffix = meta.asSalt ? ` · ${saltFromSodium(a.value).toFixed(1)} g salt` : '';
  return `<div class="meter${tappable && note ? ' tap' : ''}" data-status="${a.status}"
      ${note ? `data-act="note" data-key="${key}"` : ''}>
    <span class="m-label">${esc(meta.label)}${a.weekly ? ' <span class="faint">·wk</span>' : ''}</span>
    <span class="track"><span class="fill" style="width:${pct(a.pct)}"></span></span>
    <span class="m-pct">${a.pct}%</span>
    <span class="sr">${formatAmount(key, a.value)} of ${formatAmount(key, a.target)}${suffix}</span>
  </div>`;
}

function renderTotals() {
  const day = store.getDay();
  const box = $('#todayTotals');
  if (!day.items.length) {
    box.innerHTML = `<div class="empty">
      <div class="display">Nothing logged yet today.</div>
      <div class="small">Write a sentence up there — it doesn't have to be tidy.</div>
    </div>`;
    return;
  }

  const settings = store.getSettings();
  const totals = totalsFor(day.items, settings.customFoods);
  const targets = targetsFor(store.getProfile());
  const a = assess(totals, targets);

  const headline = ['kcal', 'pro', 'fib'].map((k) => {
    const meta = NUTRIENTS[k];
    const v = a[k] ?? { value: totals[k], target: targets.goals[k], pct: 0 };
    return `<div><div class="n">${v.value.toFixed(meta.decimals)}</div>
      <div class="label">${esc(meta.label)}</div>
      <div class="of">of ${v.target}${meta.unit === 'kcal' ? '' : ` ${meta.unit}`}</div></div>`;
  }).join('');

  const short = shortfalls(a);
  const shortKeys = new Set(short.map((s) => s.key));
  const shown = showAllMeters
    ? METER_ORDER
    : METER_ORDER.filter((k) => shortKeys.has(k) || ['pro', 'fib', 'fe', 'ca'].includes(k));

  const limits = excesses(a);

  box.innerHTML = `<div class="card">
    <div class="headline">${headline}</div>
  </div>
  <div class="card">
    <span class="label">Against your targets</span>
    <div class="meters">${shown.map((k) => (a[k] ? meterRow(k, a[k]) : '')).join('')}</div>
    <div id="meterNote"></div>
    <button class="btn small ghost" data-act="toggle-meters" style="margin-top:.7rem">
      ${showAllMeters ? 'show fewer' : `show all ${METER_ORDER.length}`}
    </button>
    ${limits.length ? `<hr class="rule"><span class="label">Over</span>
      <div class="meters">${limits.map((l) => meterRow(l.key, a[l.key])).join('')}</div>` : ''}
    <p class="small faint" style="margin-top:.8rem">
      ·wk means this one is judged as a weekly average, not day by day — your
      body stores it.
    </p>
  </div>`;
}

const CHECKIN_ROWS = [
  ['energy', 'energy'], ['sleep', 'sleep'], ['mood', 'mood'], ['gut', 'digestion'],
];

function renderCheckin() {
  const day = store.getDay();
  const rows = CHECKIN_ROWS.map(([key, label]) => {
    const value = day.checkin?.[key];
    const dots = [1, 2, 3, 4, 5].map((n) => `<button class="dot" data-act="checkin"
      data-key="${key}" data-value="${n}" aria-pressed="${value >= n}"
      aria-label="${label} ${n} of 5"></button>`).join('');
    return `<div class="checkin-row"><span class="c-label">${label}</span><span class="dots">${dots}</span></div>`;
  }).join('');

  $('#todayCheckin').innerHTML = `<div class="card quiet">
    <span class="label">How's today been? — optional, four taps</span>
    <div class="checkin">${rows}</div>
    <p class="small faint" style="margin-top:.7rem">
      Skipping is fine and leaves no gap to fill in. After a fortnight I can line
      these up against what you've been eating — as things that moved together,
      never as cause and effect.
    </p>
  </div>`;
}

// ─── Missing ────────────────────────────────────────────────────────────────

function renderMissing() {
  const day = store.getDay();
  const settings = store.getSettings();
  const box = $('#missingBody');

  if (!day.items.length) {
    box.innerHTML = `<div class="empty">
      <div class="display">Nothing to go on yet.</div>
      <div class="small">Log something today and I'll tell you what's left.</div>
    </div>`;
    return;
  }

  const totals = totalsFor(day.items, settings.customFoods);
  const targets = targetsFor(store.getProfile());
  const a = assess(totals, targets);
  const gaps = shortfalls(a);
  const remainingKcal = Math.round(targets.goals.kcal - (totals.kcal || 0));
  const prefs = currentPrefs();

  if (!gaps.length) {
    box.innerHTML = `<div class="card"><span class="label">Still missing today</span>
      <p>Nothing worth chasing. Everything tracked daily is at or near its target.</p>
      <p class="small muted" style="margin-top:.5rem">
        ${remainingKcal > 200 ? `You've ${remainingKcal} kcal left if you're hungry.` : ''}
      </p></div>
      ${weeklyScaleCard(targets)}`;
    return;
  }

  const gapLines = gaps.map((g) => `<div class="gap-line">
      <span>${esc(NUTRIENTS[g.key].label)}</span>
      <span class="g-pct">${g.pct}%</span>
    </div>
    <div class="meter" data-status="${g.status}" style="grid-template-columns:1fr;margin-bottom:.45rem">
      <span class="track"><span class="fill" style="width:${pct(g.pct)}"></span></span>
    </div>`).join('');

  const { lines, modifiers, kcal, tight } = suggestNextMeal(gaps, {
    prefs, settings, remainingKcal, customFoods: settings.customFoods,
  });

  const suggHtml = lines.map((l) => {
    const alts = l.examples.slice(1);
    return `<div class="sugg">
      <div class="s-head">
        <span class="s-cat">${esc(l.category)}</span>
        <span class="s-amount">${esc(l.amount)}</span>
      </div>
      <div class="s-for">→ ${esc(l.deliversText)} ${esc(NUTRIENTS[l.forNutrient].label)}
        · covers ${l.coversPct}% of your day · ${l.kcal} kcal</div>
      ${alts.length ? `<div class="s-alts">e.g. ${alts.map((x) => `${esc(x.label)} ${esc(x.amount)}`).join(' · ')}</div>` : ''}
      <div class="s-actions">
        <button class="btn small" data-act="ate" data-food="${esc(l.examples[0].id)}" data-grams="${l.grams}">I had this</button>
        <button class="btn small ghost" data-act="skip-sugg" data-food="${esc(l.examples[0].id)}">not today</button>
      </div>
    </div>`;
  }).join('');

  const modHtml = modifiers.map((m) => `<div class="modifier">
    <span class="m-arrow">↳</span>
    <span>${esc(m.text)}</span>
  </div>`).join('');

  box.innerHTML = `
    <div class="card">
      <span class="label">Still missing today</span>
      ${gapLines}
    </div>
    <div class="card">
      <span class="label">For your next meal, include</span>
      ${suggHtml || '<p class="small muted">Nothing I can suggest that fits both your gaps and what you actually eat. Loosen an exclusion in <em>You</em> if that seems wrong.</p>'}
      ${modHtml}
      <div class="energy-fit">
        ${tight
    ? `You're near your energy for today (${remainingKcal > 0 ? `${remainingKcal} kcal left` : 'already past it'}), so this is a short list of the densest options. The rest is better left for tomorrow.`
    : `≈ ${kcal} kcal on top of what you've eaten, which still fits your day (${remainingKcal} kcal left).`}
      </div>
    </div>
    ${weeklyScaleCard(targets)}`;
}

function weeklyScaleCard(targets) {
  const settings = store.getSettings();
  const days = store.getDays();
  const week = lastNDays(7);
  const agg = aggregate(days, week, settings.customFoods);
  if (!agg.logged) return '';

  const rows = [...WEEKLY_NUTRIENTS]
    .filter((k) => targets.goals[k])
    .map((k) => {
      const avg = agg.average[k] || 0;
      const p = Math.round((avg / targets.goals[k]) * 100);
      return { k, p, avg };
    })
    .filter((r) => r.p < 80)
    // The ones with a note attached are the ones with consequences worth
    // reading. Three at most — a wall of eight is a wall nobody reads.
    .sort((a, b) => (NUTRIENT_NOTES[b.k] ? 1 : 0) - (NUTRIENT_NOTES[a.k] ? 1 : 0) || a.p - b.p)
    .slice(0, 3);

  if (!rows.length) return '';

  return `<div class="card">
    <span class="label">Over the week</span>
    ${rows.map((r) => `<p style="margin-bottom:.6rem">
      <b>${esc(NUTRIENTS[r.k].label)}</b> is running at ${r.p}% of a week's worth
      (${formatAmount(r.k, r.avg)} a day against ${formatAmount(r.k, targets.goals[r.k])}).
      ${NUTRIENT_NOTES[r.k] ? `<span class="muted">${esc(NUTRIENT_NOTES[r.k])}</span>` : ''}
    </p>`).join('')}
    <p class="small faint">Based on ${agg.logged} logged day${agg.logged === 1 ? '' : 's'} out of 7.</p>
  </div>`;
}

// ─── Week ───────────────────────────────────────────────────────────────────

function renderWeek() {
  const settings = store.getSettings();
  const days = store.getDays();
  const targets = targetsFor(store.getProfile());
  const week = lastNDays(7).reverse();
  const agg7 = aggregate(days, week, settings.customFoods);
  const box = $('#weekBody');

  if (!agg7.logged) {
    box.innerHTML = `<div class="empty"><div class="display">No days logged yet.</div>
      <div class="small">The grid fills in as you go.</div></div>`;
    return;
  }

  const header = week.map((k) => {
    const d = new Date(`${k}T12:00:00`);
    return `<th>${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</th>`;
  }).join('');

  const rows = HEAT_ROWS.filter((k) => targets.goals[k]).map((k) => {
    const cells = week.map((dk) => {
      const t = agg7.perDay[dk];
      if (!t) return '<td><span class="cell" data-status="none"></span></td>';
      const p = (t[k] || 0) / targets.goals[k];
      const status = p >= 0.95 ? 'met' : p >= 0.75 ? 'close' : p >= 0.4 ? 'low' : 'short';
      return `<td><span class="cell" data-status="${status}" title="${dk}: ${Math.round(p * 100)}% of target">${Math.round(p * 100)}</span></td>`;
    }).join('');
    return `<tr><th class="rowhead">${esc(NUTRIENTS[k].label)}</th>${cells}</tr>`;
  }).join('');

  // The pattern read, over three weeks rather than one.
  const three = lastNDays(21);
  const agg21 = aggregate(days, three, settings.customFoods);
  const counts = shortDayCounts(agg21.perDay, targets.goals);
  const read = patternRead(agg21, counts, targets);

  let readHtml;
  if (!read.ready) {
    readHtml = `<div class="card"><span class="label">The pattern</span>
      <p class="muted">Not enough logged yet to call anything a pattern —
      ${read.needed} more day${read.needed === 1 ? '' : 's'} and this fills in.
      One thin day means nothing; three thin weeks mean something.</p></div>`;
  } else {
    const obs = read.observations.map((o) => `<div class="obs${o.over ? '' : ''}">
      <div class="o-head">
        <span class="o-name">${esc(o.label)}</span>
        <span class="o-nums">${esc(o.averageText)}/day · ${o.over ? 'limit' : 'target'} ${esc(o.targetText)}</span>
      </div>
      ${o.shortDays ? `<div class="o-days">low on ${o.shortDays} of ${o.loggedDays} logged days</div>` : ''}
      ${o.felt ? `<p class="o-felt">${esc(o.felt)}</p>` : ''}
      ${o.caveat ? `<p class="o-caveat">${esc(o.caveat)}</p>` : ''}
      ${o.test ? `<p class="o-test">Worth testing: <b>${esc(o.test)}</b></p>` : ''}
    </div>`).join('');

    const wins = read.wins.map((w) => `<div class="obs win">
      <div class="o-head"><span class="o-name">${esc(w.label)}</span>
        <span class="o-nums">${esc(w.averageText)}/day · ${w.pct}%</span></div>
      <p class="o-felt muted">Above target across the period. Nothing to do here —
        worth knowing you're doing this one well.</p>
    </div>`).join('');

    readHtml = `<div class="card">
      <span class="label">The pattern — last ${read.daysLogged} logged days</span>
      ${obs || '<p class="muted">Nothing is chronically low. That\'s the whole report.</p>'}
      ${wins}
    </div>`;
  }

  // Check-in correlation, deliberately conservative.
  const corr = correlateCheckins(days, lastNDays(60), targets, settings.customFoods, 'energy');
  let corrHtml = '';
  if (corr.ready && corr.findings.length) {
    corrHtml = `<div class="card"><span class="label">Your check-ins, alongside your food</span>
      ${corr.findings.map((f) => `<p style="margin-bottom:.5rem">
        <b>${esc(f.label)}</b> and how much energy you reported moved
        ${f.direction === 'together' ? 'together' : 'in opposite directions'}
        across ${corr.days} days <span class="faint">(r = ${f.r})</span>.
      </p>`).join('')}
      <p class="small muted">That's a relationship, not a cause. With one person
      and no control there is no way to tell which way it runs, or whether
      something else drives both.</p></div>`;
  } else if (corr.ready) {
    corrHtml = `<div class="card quiet"><span class="label">Your check-ins</span>
      <p class="small muted">${corr.days} days paired up, and nothing moved with
      your energy strongly enough to be worth reporting. That's a real result,
      not a missing feature.</p></div>`;
  } else if (corr.days > 0) {
    corrHtml = `<div class="card quiet"><span class="label">Your check-ins</span>
      <p class="small muted">${corr.days} of the ${14} days needed before I'll
      compare these to your food. Below that it's noise.</p></div>`;
  }

  box.innerHTML = `<div class="card">
      <span class="label">Last 7 days — % of target</span>
      <div class="grid-scroll"><table class="heat">
        <thead><tr><th class="rowhead"></th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="small faint" style="margin-top:.6rem">Dashed = nothing logged.
        A missing day is missing data, not a day you ate nothing — it's left out
        of every average.</p>
    </div>
    ${readHtml}
    ${corrHtml}`;
}

// ─── You ────────────────────────────────────────────────────────────────────

function renderYou() {
  const p = store.getProfile();
  const settings = store.getSettings();
  const prefs = currentPrefs();
  const targets = targetsFor(p);
  const bloods = store.latestBloods();

  const profileCard = editingProfile ? `<div class="card">
    <span class="label">You</span>
    <div class="field-row">
      <label class="field"><span class="label">age</span>
        <input class="text" type="number" id="p-age" value="${p.age}" min="14" max="100"></label>
      <label class="field"><span class="label">sex</span>
        <select class="text" id="p-sex">
          <option value="female" ${p.sex === 'female' ? 'selected' : ''}>female</option>
          <option value="male" ${p.sex === 'male' ? 'selected' : ''}>male</option>
        </select></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="label">weight kg</span>
        <input class="text" type="number" id="p-weight" value="${p.weight}" min="30" max="200" step="0.5"></label>
      <label class="field"><span class="label">height cm</span>
        <input class="text" type="number" id="p-height" value="${p.height}" min="120" max="220"></label>
    </div>
    <label class="field"><span class="label">how active are your days</span>
      <select class="text" id="p-activity">
        ${ACTIVITY_LEVELS.map((l) => `<option value="${l.id}" ${p.activity === l.id ? 'selected' : ''}>${esc(l.label)} — ${esc(l.note)}</option>`).join('')}
      </select></label>
    <div class="chips" style="margin:.5rem 0 .8rem">
      <button class="chip" data-act="p-toggle" data-key="lowMeat" aria-pressed="${!!p.lowMeat}">low-meat diet</button>
      <button class="chip" data-act="p-toggle" data-key="pregnant" aria-pressed="${!!p.pregnant}">pregnant</button>
      <button class="chip" data-act="p-toggle" data-key="breastfeeding" aria-pressed="${!!p.breastfeeding}">breastfeeding</button>
    </div>
    <p class="small faint">Low-meat raises the iron target by 40%. Not because you
      need more iron in your body, but because plant iron absorbs at roughly a
      third the rate, so you have to eat more to end up in the same place. It's a
      deliberate adjustment, not an official figure.</p>
    <div class="d-actions"><button class="btn primary small" data-act="save-profile">save</button></div>
  </div>` : `<div class="card">
    <div class="row between"><span class="label">You</span>
      <button class="btn small ghost" data-act="edit-profile">edit</button></div>
    <p>${p.age} · ${esc(p.sex)} · ${p.weight} kg · ${p.height} cm ·
      ${esc(ACTIVITY_LEVELS.find((l) => l.id === p.activity)?.label ?? p.activity)}</p>
    <p class="small muted" style="margin-top:.4rem">
      ${targets.goals.kcal} kcal · ${targets.goals.pro} g protein · ${targets.goals.fe} mg iron
      ${p.lowMeat ? ' <span class="faint">(iron raised for a low-meat diet)</span>' : ''}
    </p>
  </div>`;

  const bloodRows = Object.entries(store.BLOOD_MARKERS).map(([key, marker]) => {
    const b = bloods[key];
    const cls = (b?.band || '').replace(/[^a-z]/g, '');
    return `<div class="blood ${b ? cls : ''} ${b?.stale ? 'stale' : ''}">
      <span>${esc(marker.label)}
        <span class="item-note">${b ? `${b.date}${b.stale ? ' · older than 8 months' : ''}` : 'not entered'}</span></span>
      <span class="b-val">${b ? `${b.value} ${esc(b.unit)}` : '—'}</span>
      ${b?.band
    ? `<button class="b-band" data-act="add-blood" data-marker="${key}" title="add a newer result">${esc(b.band)} ↻</button>`
    : `<button class="btn small" data-act="add-blood" data-marker="${key}">add</button>`}
    </div>`;
  }).join('');

  const prefRows = PREFERENCE_GROUPS.map((g) => {
    const freq = prefs.groupPerWeek[g.id] ?? 0;
    const excluded = settings.excludedGroups.includes(g.id);
    return `<div class="pref">
      <span>${esc(g.label)}</span>
      <span class="p-freq">${prefs.daysLogged ? `${freq}×/week` : '—'}</span>
      <button class="chip" data-act="toggle-group" data-group="${g.id}" aria-pressed="${!excluded}">
        ${excluded ? 'not suggested' : 'suggest'}
      </button>
    </div>`;
  }).join('');

  const taught = Object.entries(settings.customFoods);
  const size = (store.storageSize() / 1024).toFixed(0);
  const dayCount = Object.keys(store.getDays()).length;

  const everLoggedSupp = everLoggedSupplementIds();
  const suppRows = allSupplementFoods().map(({ id, food }) => {
    const on = isQuickSupplement(id, everLoggedSupp, settings);
    const dose = SUPP_FIELD_KEYS
      .filter((k) => food[k])
      .slice(0, 3)
      .map((k) => `${NUTRIENTS[k].label} ${(food[k] / 100).toFixed(NUTRIENTS[k].decimals ?? 1)}${NUTRIENTS[k].unit}`)
      .join(' · ');
    return `<div class="pref">
      <span>${esc(food.n)}${dose ? `<span class="item-note">${esc(dose)}</span>` : ''}</span>
      <span></span>
      <button class="chip" data-act="toggle-supp" data-supp="${esc(id)}" aria-pressed="${on}">
        ${on ? 'on Today' : 'hidden'}
      </button>
    </div>`;
  }).join('');

  $('#youBody').innerHTML = `${profileCard}
    <div class="card">
      <span class="label">Blood results — what food can't tell you</span>
      ${bloodRows}
      <p class="small faint" style="margin-top:.7rem">
        Bands use widely published cutoffs, and your own lab's range wins if you
        enter one. This says low or in range — it can't diagnose anything, and it
        never suggests changing a dose a doctor set.
      </p>
    </div>
    <div class="card">
      <span class="label">What I've learned you eat</span>
      ${prefRows}
      <p class="small faint" style="margin-top:.7rem">
        Counted from ${prefs.daysLogged} logged day${prefs.daysLogged === 1 ? '' : 's'} in the last 28.
        Turning a group off only stops suggestions — you can still log it.
      </p>
    </div>
    <div class="card" id="suppManagerCard">
      <span class="label">Your supplements</span>
      ${suppRows || '<p class="small muted">None yet.</p>'}
      <button class="btn small" data-act="add-supp" style="margin-top:.7rem">+ add a supplement</button>
      <p class="small faint" style="margin-top:.6rem">
        Anything you've logged even once — by typing it — turns on automatically.
        Hiding one here just removes its button on Today; the food itself, and
        anything already logged, is untouched.
      </p>
    </div>
    <div class="card">
      <span class="label">Your data</span>
      <p class="small muted">Everything lives in this browser on this device.
        Nothing is uploaded, there's no account, and none of it is in the
        repository. ${size} kB so far, ${dayCount} day${dayCount === 1 ? '' : 's'},
        ${taught.length} food${taught.length === 1 ? '' : 's'} you taught me.</p>
      ${!storageWorks ? `<p class="small" style="color:var(--short);margin-top:.5rem">
        Saving isn't working right now on this device — see the banner on Today
        for how to fix it. Nothing you enter will survive a reload until it's fixed.</p>` : ''}
      <p class="small faint" style="margin-top:.6rem">
        Three things wipe this even when saving works fine: a private/incognito
        tab (storage is deliberately destroyed when it closes — by design, not a
        bug); a link opened inside another app's built-in browser (Messages,
        WhatsApp, Notes, Instagram) rather than real Safari, which often uses
        temporary storage; and switching between the installed icon and a Safari
        tab — iOS keeps those as two separate storage areas that don't share
        data. Add to Home Screen once and always open it from there, in normal
        (non-private) Safari, and this stays put.
      </p>
      <div class="row wrap-row" style="margin-top:.8rem">
        <button class="btn small" data-act="export">export a backup</button>
        <button class="btn small" data-act="import">import</button>
        <button class="btn small ghost" data-act="wipe">erase everything</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" class="sr">
    </div>
    <p class="disclaimer">
      Nourish estimates what you ate from what you typed. Portion guesses, cooking
      losses and natural variation put micronutrients within roughly ±20–25%,
      which is right for spotting a chronic pattern and wrong for anything
      clinical. It isn't medical advice and it can't diagnose a deficiency — for
      iron, B12 and vitamin D in particular, a blood test is the only thing that
      answers the question.
    </p>`;
}

// ─── Ambiguity + teaching dialogs ───────────────────────────────────────────

function askNext() {
  const day = store.getDay();
  const pending = day.items.find((it) => it.needs);
  if (!pending) return;
  const spec = AMBIGUOUS[pending.needs];
  if (!spec) return;

  $('#askTitle').textContent = spec.question;
  $('#askBody').textContent = `You wrote “${pending.needs}”. ${
    pending.needs.includes('cream') ? 'The fat content is a 130 kcal per 100 g difference, so it\'s worth one tap.' : 'I\'ll remember your answer.'}`;
  $('#askOptions').innerHTML = spec.options.map((o) => `<button class="chip"
    data-act="resolve" data-item="${pending.id}" data-name="${esc(pending.needs)}"
    data-food="${esc(o.id)}">${esc(o.label)}</button>`).join('');
  $('#askDialog').showModal();
}

let bloodMarker = null;

function openBlood(marker) {
  bloodMarker = marker;
  const spec = store.BLOOD_MARKERS[marker];
  $('#bloodTitle').textContent = spec.label;
  $('#bloodAbout').textContent = spec.about;
  $('#bloodUnit').innerHTML = spec.units.map((u) => `<option>${esc(u)}</option>`).join('');
  $('#bloodValue').value = '';
  $('#bloodLow').value = '';
  $('#bloodHigh').value = '';
  $('#bloodDate').value = dayKey(new Date());
  $('#bloodDialog').showModal();
  $('#bloodValue').focus();
}

function openSupplementForm() {
  $('#suppName').value = '';
  $('#suppFields').innerHTML = SUPP_FIELD_KEYS.map((k) => {
    const meta = NUTRIENTS[k];
    return `<label class="field"><span class="label">${esc(meta.label)} (${esc(meta.unit)})</span>
      <input class="text" type="number" step="any" inputmode="decimal" data-nutrient="${k}" placeholder="0"></label>`;
  }).join('');
  $('#suppDialog').showModal();
  $('#suppName').focus();
}

let teaching = null;

function openTeach(unknownText) {
  teaching = unknownText;
  $('#teachWhat').textContent = `I don't know “${unknownText}”.`;
  $('#teachSearch').value = unknownText;
  renderTeachResults(unknownText);
  $('#teachDialog').showModal();
}

function renderTeachResults(query) {
  const settings = store.getSettings();
  const hits = searchFoods(query, { customFoods: settings.customFoods });
  $('#teachResults').innerHTML = hits.length
    ? hits.map((h) => `<button class="chip" data-act="teach-pick" data-kind="${h.kind}"
        data-id="${esc(h.id)}">${esc(h.label)}</button>`).join('')
    : '<span class="small faint">Nothing close. Try another word, or leave it out.</span>';
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

function currentPrefs() {
  return learnPreferences(store.getDays(), { customFoods: store.getSettings().customFoods });
}

function renderAll() {
  const d = new Date();
  $('#dateLabel').textContent = fmtDate(d);
  const day = store.getDay();
  $('#loggedLabel').textContent = day.items.length
    ? `${day.items.length} item${day.items.length === 1 ? '' : 's'} logged`
    : 'nothing logged yet';

  renderBanners();
  renderSupplementQuick();
  renderItems();
  renderTotals();
  renderCheckin();
  renderMissing();
  renderWeek();
  renderYou();
}

function switchView(next) {
  view = next;
  for (const el of document.querySelectorAll('.view')) el.classList.remove('active');
  $(`#view-${next}`).classList.add('active');
  for (const b of document.querySelectorAll('nav.tabs button')) {
    b.setAttribute('aria-current', String(b.dataset.view === next));
  }
  const titles = { today: 'Today', missing: 'Missing', week: 'Week', you: 'You' };
  $('#greeting').textContent = titles[next];
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function doRead() {
  const text = $('#logInput').value.trim();
  if (!text) return;
  const settings = store.getSettings();
  const { items, unknown } = parse(text, {
    customFoods: settings.customFoods,
    resolved: settings.resolved,
    portionOverrides: settings.portionOverrides,
  });

  if (!items.length && !unknown.length) {
    toast('I couldn\'t find any food in that.');
    return;
  }

  if (items.length) store.addItems(items);
  $('#logInput').value = '';
  renderAll();

  if (items.some((it) => it.needs)) { askNext(); return; }
  if (unknown.length) { openTeach(unknown[0].text); return; }
  toast(`Added ${items.length} item${items.length === 1 ? '' : 's'}.`);
}

function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act], nav.tabs button');
  if (!t) return;

  if (t.matches('nav.tabs button')) { switchView(t.dataset.view); return; }
  const act = t.dataset.act;

  switch (act) {
    case 'remove':
      store.removeItem(t.closest('.item').dataset.id);
      renderAll();
      break;

    case 'toggle-meters':
      showAllMeters = !showAllMeters;
      renderTotals();
      break;

    case 'note': {
      const box = $('#meterNote');
      const key = t.dataset.key;
      box.innerHTML = box.dataset.key === key
        ? (box.dataset.key = '', '')
        : `<div class="meter-note">${esc(NUTRIENT_NOTES[key])}</div>`;
      box.dataset.key = box.innerHTML ? key : '';
      break;
    }

    case 'checkin': {
      const key = t.dataset.key;
      const value = Number(t.dataset.value);
      const current = store.getDay().checkin?.[key];
      store.setCheckin({ [key]: current === value ? undefined : value });
      renderAll();
      break;
    }

    case 'resolve':
      store.resolveAmbiguity(t.dataset.name, t.dataset.food);
      store.updateItem(t.dataset.item, {
        foodId: t.dataset.food,
        name: FOODS[t.dataset.food]?.n ?? t.dataset.food,
        needs: null,
      });
      $('#askDialog').close();
      renderAll();
      askNext();
      break;

    case 'teach-pick': {
      const { kind, id } = t.dataset;
      const entry = kind === 'dish' ? DISHES[id] : FOODS[id];
      store.addItems([{
        id: `it${Date.now().toString(36)}`,
        kind,
        foodId: id,
        name: entry.n,
        grams: entry.portion,
        estimated: true,
        source: teaching,
        note: `you told me “${teaching}” means this`,
      }]);
      // Remembering the word means it's recognised next time. The kind has to
      // be stored too — losing it made a taught dish look up the food table
      // and quietly resolve to nothing.
      store.resolveAmbiguity(teaching, id, kind);
      $('#teachDialog').close();
      renderAll();
      toast('Noted, and remembered.');
      break;
    }

    case 'ate': {
      const id = t.dataset.food;
      const grams = Number(t.dataset.grams);
      store.addItems([{
        id: `it${Date.now().toString(36)}`,
        kind: 'food',
        foodId: id,
        name: FOODS[id]?.n ?? id,
        grams,
        estimated: true,
        source: 'from a suggestion',
      }]);
      store.recordFeedback(id, true);
      renderAll();
      toast('Added, and I\'ll suggest it more readily.');
      break;
    }

    case 'skip-sugg':
      store.recordFeedback(t.dataset.food, false);
      renderAll();
      toast('Noted — I\'ll lean on it less.');
      break;

    case 'log-supp': {
      const id = t.dataset.food;
      const settings = store.getSettings();
      const food = FOODS[id] || settings.customFoods[id];
      if (!food) break;
      const already = store.getDay().items.filter((it) => it.foodId === id && !it.cookingFatFor);
      if (already.length) {
        for (const it of already) store.removeItem(it.id);
        toast(`Marked as not taken today.`);
      } else {
        store.addItems([{
          id: `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          kind: 'food',
          foodId: id,
          name: food.n,
          grams: food.portion,
          estimated: false,
          source: 'tapped from your list',
        }]);
        toast(`Marked as taken today.`);
      }
      renderAll();
      break;
    }

    case 'manage-supps':
      switchView('you');
      renderYou();
      setTimeout(() => $('#suppManagerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      break;

    case 'toggle-supp': {
      const id = t.dataset.supp;
      const settings = store.getSettings();
      const on = isQuickSupplement(id, everLoggedSupplementIds(), settings);
      store.setSettings(on
        ? {
          supplementsOff: [...new Set([...settings.supplementsOff, id])],
          supplementsOn: settings.supplementsOn.filter((x) => x !== id),
        }
        : {
          supplementsOn: [...new Set([...settings.supplementsOn, id])],
          supplementsOff: settings.supplementsOff.filter((x) => x !== id),
        });
      renderAll();
      break;
    }

    case 'add-supp':
      openSupplementForm();
      break;

    case 'toggle-group': {
      const g = t.dataset.group;
      const list = store.getSettings().excludedGroups;
      store.setSettings({
        excludedGroups: list.includes(g) ? list.filter((x) => x !== g) : [...list, g],
      });
      renderAll();
      break;
    }

    case 'accept-exclude': {
      const groups = t.dataset.groups.split(',');
      const list = store.getSettings().excludedGroups;
      store.setSettings({ excludedGroups: [...new Set([...list, ...groups])] });
      renderAll();
      toast('Stopped suggesting those. Undo in You.');
      break;
    }

    case 'dismiss-exclude':
      store.setSettings({
        dismissedAutoExclude: [
          ...store.getSettings().dismissedAutoExclude, ...t.dataset.groups.split(','),
        ],
      });
      renderAll();
      break;

    case 'dismiss-onboard':
      store.setProfile({ onboarded: true });
      renderAll();
      break;

    case 'go-profile':
      editingProfile = true;
      switchView('you');
      renderYou();
      break;

    case 'edit-profile':
      editingProfile = true;
      renderYou();
      break;

    case 'save-profile':
      store.setProfile({
        age: Number($('#p-age').value) || 35,
        sex: $('#p-sex').value,
        weight: Number($('#p-weight').value) || 65,
        height: Number($('#p-height').value) || 168,
        activity: $('#p-activity').value,
        onboarded: true,
      });
      editingProfile = false;
      renderAll();
      toast('Targets updated.');
      break;

    case 'p-toggle': {
      const key = t.dataset.key;
      store.setProfile({ [key]: !store.getProfile()[key] });
      renderYou();
      break;
    }

    case 'add-blood':
      openBlood(t.dataset.marker);
      break;

    case 'export':
      store.markBackedUp();
      download(store.exportFilename(), store.exportJSON());
      renderAll();
      toast('Backup downloaded.');
      break;

    case 'download-rescue': {
      const raw = store.getRescuedData();
      if (raw) download(`nourish-corrupted-${dayKey(new Date())}.json`, raw);
      renderAll();
      toast('Downloaded — a developer may be able to make sense of it.');
      break;
    }

    case 'dismiss-rescue':
      store.clearRescuedData();
      renderAll();
      break;

    case 'import':
      $('#importFile').click();
      break;

    case 'wipe':
      if (confirm('Erase every day, blood result and preference on this device? This cannot be undone, and there is no copy anywhere else.')) {
        store.clearAll();
        renderAll();
        toast('Erased.');
      }
      break;

    default:
      break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('.item-grams input')) {
    const row = e.target.closest('.item');
    const grams = Math.max(0, Number(e.target.value) || 0);
    const day = store.getDay();
    const item = day.items.find((it) => it.id === row.dataset.id);
    if (item) {
      store.updateItem(item.id, { grams, estimated: false, corrected: true });
      // Your correction becomes your portion for next time.
      if (item.foodId && !item.cookingFatFor) {
        store.setPortionOverride(item.foodId, item.unit, grams);
      }
    }
    renderAll();
  }

  if (e.target.id === 'importFile') {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = store.importJSON(String(reader.result), 'merge');
        renderAll();
        toast(`Merged ${res.days} day${res.days === 1 ? '' : 's'}.`);
      } catch (err) {
        toast(err.message || 'That file couldn\'t be read.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
});

$('#readBtn').addEventListener('click', doRead);
$('#logInput').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doRead();
});
$('#bloodCancel').addEventListener('click', () => $('#bloodDialog').close());
$('#bloodSave').addEventListener('click', () => {
  const value = parseFloat(String($('#bloodValue').value).replace(',', '.'));
  if (Number.isNaN(value)) { toast('Needs a number.'); return; }
  const low = parseFloat(String($('#bloodLow').value).replace(',', '.'));
  const high = parseFloat(String($('#bloodHigh').value).replace(',', '.'));
  store.addBlood({
    marker: bloodMarker,
    value,
    unit: $('#bloodUnit').value,
    date: $('#bloodDate').value || dayKey(new Date()),
    labLow: Number.isNaN(low) ? null : low,
    labHigh: Number.isNaN(high) ? null : high,
  });
  $('#bloodDialog').close();
  renderAll();
  toast('Saved, on this device only.');
});

$('#suppCancel').addEventListener('click', () => $('#suppDialog').close());
$('#suppSave').addEventListener('click', () => {
  const name = $('#suppName').value.trim();
  if (!name) { toast('Needs a name.'); return; }

  // Stored the same way every other food is: value per 100 g. A dose is
  // portion=1, so the actual per-capsule number × 100 gets it back out exactly
  // when nutrientsOf() divides by 100 at grams=1.
  const dose = {};
  let any = false;
  for (const input of document.querySelectorAll('#suppFields input')) {
    const v = parseFloat(String(input.value).replace(',', '.'));
    if (!v) continue;
    dose[input.dataset.nutrient] = v * 100;
    any = true;
  }
  if (!any) { toast('Add at least one amount from the label.'); return; }

  const slug = normalise(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const id = `supp_custom_${slug || 'item'}_${Date.now().toString(36).slice(-4)}`;
  store.addCustomFood(id, {
    n: name, g: ['supplement'], portion: 1,
    units: { each: 1, tablet: 1, capsule: 1, drop: 1 },
    ...dose,
  });
  store.setSettings({ supplementsOn: [...store.getSettings().supplementsOn, id] });
  $('#suppDialog').close();
  renderAll();
  toast('Added — it’s on Today now.');
});

$('#askSkip').addEventListener('click', () => $('#askDialog').close());
$('#teachSkip').addEventListener('click', () => $('#teachDialog').close());
$('#teachSearch').addEventListener('input', (e) => renderTeachResults(e.target.value));

renderAll();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' means the browser's own HTTP cache is never
    // consulted for sw.js — without it, a short Cache-Control from GitHub
    // Pages could make "check for updates" keep re-serving yesterday's worker.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // Browsers only refetch sw.js occasionally on their own — ask now, so a
      // just-pushed update is picked up on this load rather than some future one.
      reg.update().catch(() => {});
    }).catch(() => { /* offline is a bonus, not a requirement */ });

    // A new worker taking control means new code is in charge but the page
    // still has the old code loaded — reload once so what's on screen matches.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

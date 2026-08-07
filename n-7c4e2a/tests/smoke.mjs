// Quick parser sanity check: node n-7c4e2a/tests/smoke.mjs
import { parse } from '../js/parse.js';

const cases = [
  'a big plate of baked potatoes baked in olive oil and 100g feta, and one small medium leek sauteed in some olive oil and 50ml sweet cream',
  'oat porridge with blueberries and a spoon of peanut butter, coffee with oat milk, big lentil salad with feta, two squares of dark chocolate',
  '2 eggs, 150g chicken breast, handful of almonds',
  '100g dry pasta with pesto',
  'sniadanie: owsianka z jagodami i lyzka masla orzechowego',
  'zwei Scheiben Vollkornbrot mit Kase und ein grosser Apfel',
  'half an avocado on sourdough, a squeeze of lemon',
  'my mums lentil soup and some weird thing i cant name',
];

for (const text of cases) {
  const { items, unknown } = parse(text);
  console.log(`\n"${text}"`);
  for (const it of items) {
    const marks = [
      it.estimated ? '~' : '',
      it.fuzzy ? '≈' : '',
      it.needs ? '⚠' : '',
      it.sizeConflict ? `!${it.sizeConflict.join('/')}` : '',
      it.cookingFatFor ? '(fat)' : '',
      it.dry ? '(dry→cooked)' : '',
    ].filter(Boolean).join(' ');
    console.log(`   ${String(it.grams).padStart(7)} g  ${it.name.padEnd(26)} ${marks}`);
  }
  for (const u of unknown) console.log(`         ?  "${u.text}"  ← unrecognised`);
}

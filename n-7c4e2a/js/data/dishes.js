// Composite dishes, defined as recipes over the base food table rather than as
// hand-typed nutrition numbers. Two reasons: far fewer numbers to get wrong,
// and a dish can never drift out of step with its ingredients.
//
//   r        [[foodId, grams], ...] for one default portion
//   portion  default grams (should roughly equal the sum of r)
//   units    what "a bowl" / "a slice" of this dish weighs
//   a        aliases, including German and Polish names
//
// Amounts are for one ordinary restaurant-or-home serving. Scaling is
// proportional: "two bowls of dal" doubles every ingredient.

export const DISHES = {

  // ─── Breakfast ────────────────────────────────────────────────────────────
  porridge: {
    n: 'porridge', portion: 300, units: { bowl: 300, plate: 300, cup: 200 },
    a: ['porridge', 'oat porridge', 'oatmeal', 'haferbrei', 'owsianka na mleku'],
    r: [['oats_dry', 50], ['milk_semi', 250]],
  },
  porridge_water: {
    n: 'porridge (on water)', portion: 300, units: { bowl: 300 },
    a: ['porridge on water', 'water porridge', 'oats with water'],
    r: [['oats_dry', 50], ['water', 250]],
  },
  overnight_oats: {
    n: 'overnight oats', portion: 320, units: { bowl: 320, jar: 320, pot: 320 },
    a: ['overnight oats', 'bircher muesli', 'bircher'],
    r: [['oats_dry', 50], ['yoghurt_natural', 120], ['milk_semi', 100], ['chia_seeds', 10], ['blueberries', 40]],
  },
  muesli_bowl: {
    n: 'muesli with yoghurt', portion: 210, units: { bowl: 210 },
    a: ['muesli with yoghurt', 'muesli bowl', 'müsli mit joghurt'],
    r: [['muesli', 60], ['yoghurt_natural', 150]],
  },
  granola_yoghurt: {
    n: 'granola with yoghurt', portion: 250, units: { bowl: 250 },
    a: ['granola with yoghurt', 'granola bowl', 'yoghurt with granola'],
    r: [['granola', 50], ['yoghurt_natural', 150], ['blueberries', 50]],
  },
  scrambled_eggs: {
    n: 'scrambled eggs', portion: 133, units: { portion: 133, plate: 133 },
    a: ['scrambled eggs', 'scrambled egg', 'ruhrei', 'rührei', 'jajecznica'],
    r: [['egg', 110], ['butter', 8], ['milk_whole', 15]],
  },
  omelette: {
    n: 'omelette', portion: 138, units: { each: 138, portion: 138 },
    a: ['omelette', 'omelet', 'omelett', 'omlet'],
    r: [['egg', 110], ['butter', 8], ['cheese_gouda', 20]],
  },
  pancakes: {
    n: 'pancakes', portion: 185, units: { each: 60, portion: 185, plate: 185 },
    a: ['pancakes', 'pancake', 'pfannkuchen', 'nalesniki', 'naleśniki', 'placki'],
    r: [['oats_dry', 40], ['egg', 55], ['milk_semi', 80], ['butter', 10]],
  },
  avocado_toast: {
    n: 'avocado toast', portion: 150, units: { each: 150, slice: 75, portion: 150 },
    a: ['avocado toast', 'avocado on toast', 'avocado bread'],
    r: [['bread_wholemeal', 70], ['avocado', 75], ['olive_oil', 5]],
  },
  bread_butter_jam: {
    n: 'bread with butter and jam', portion: 98, units: { slice: 49, each: 49 },
    a: ['bread with jam', 'toast with jam', 'bread butter jam', 'marmeladenbrot'],
    r: [['bread_wholemeal', 70], ['butter', 8], ['jam', 20]],
  },

  // ─── Sandwiches, wraps, handhelds ─────────────────────────────────────────
  cheese_sandwich: {
    n: 'cheese sandwich', portion: 118, units: { each: 118 },
    a: ['cheese sandwich', 'cheese roll', 'kasebrot', 'käsebrot', 'kanapka z serem'],
    r: [['bread_wholemeal', 70], ['cheese_gouda', 40], ['butter', 8]],
  },
  ham_sandwich: {
    n: 'ham sandwich', portion: 128, units: { each: 128 },
    a: ['ham sandwich', 'schinkenbrot', 'kanapka z szynka'],
    r: [['bread_wholemeal', 70], ['ham', 40], ['butter', 8], ['lettuce', 10]],
  },
  hummus_sandwich: {
    n: 'hummus sandwich', portion: 140, units: { each: 140 },
    a: ['hummus sandwich', 'hummus roll', 'hummus bread'],
    r: [['bread_wholemeal', 70], ['hummus', 40], ['cucumber', 30]],
  },
  falafel_wrap: {
    n: 'falafel wrap', portion: 250, units: { each: 250 },
    a: ['falafel wrap', 'falafel roll', 'falafel durum', 'falafel sandwich'],
    r: [['tortilla_wrap', 60], ['falafel', 90], ['hummus', 30], ['mixed_salad', 40], ['tomato', 30]],
  },
  doner: {
    n: 'döner kebab', portion: 320, units: { each: 320 },
    a: ['doner', 'döner', 'kebab', 'donner', 'doner kebab', 'durum'],
    r: [['bread_white', 120], ['chicken_thigh', 100], ['cabbage_white', 40], ['tomato', 30], ['sour_cream', 30]],
  },
  burger: {
    n: 'burger', portion: 270, units: { each: 270 },
    a: ['burger', 'hamburger', 'cheeseburger', 'beef burger'],
    r: [['bread_white', 90], ['beef_mince', 110], ['cheese_cheddar', 20], ['lettuce', 15], ['tomato', 20], ['ketchup', 15]],
  },
  veggie_burger_meal: {
    n: 'veggie burger', portion: 235, units: { each: 235 },
    a: ['veggie burger meal', 'vegan burger meal', 'veggie cheeseburger'],
    r: [['bread_white', 90], ['veggie_burger', 90], ['lettuce', 15], ['tomato', 20], ['mayonnaise', 12]],
  },
  burrito: {
    n: 'burrito', portion: 320, units: { each: 320 },
    a: ['burrito', 'wrap burrito', 'bean burrito'],
    r: [['tortilla_wrap', 60], ['rice_white_cooked', 100], ['black_beans_cooked', 80], ['cheese_cheddar', 30], ['tomato', 30], ['sour_cream', 20]],
  },

  // ─── Pasta, rice, potato mains ────────────────────────────────────────────
  pasta_tomato: {
    n: 'pasta with tomato sauce', portion: 390, units: { plate: 390, bowl: 390, portion: 390 },
    a: ['pasta with tomato sauce', 'pasta al pomodoro', 'tomato pasta', 'pasta with tomatoes', 'nudeln mit tomatensauce', 'makaron z pomidorami'],
    r: [['pasta_cooked', 220], ['tomato_tinned', 150], ['olive_oil', 10], ['garlic', 4], ['cheese_parmesan', 10]],
  },
  pasta_pesto: {
    n: 'pasta with pesto', portion: 270, units: { plate: 270, bowl: 270 },
    a: ['pasta with pesto', 'pesto pasta', 'nudeln mit pesto'],
    r: [['pasta_cooked', 220], ['pesto', 30], ['cheese_parmesan', 10], ['pine_nuts', 8]],
  },
  spaghetti_bolognese: {
    n: 'spaghetti bolognese', portion: 470, units: { plate: 470, bowl: 470, portion: 470 },
    a: ['spaghetti bolognese', 'bolognese', 'spag bol', 'pasta bolognese', 'ragu'],
    r: [['pasta_cooked', 200], ['beef_mince', 100], ['tomato_tinned', 150], ['onion', 40], ['olive_oil', 10], ['cheese_parmesan', 10]],
  },
  lasagne: {
    n: 'lasagne', portion: 440, units: { portion: 440, slice: 440, piece: 440 },
    a: ['lasagne', 'lasagna', 'lasagne al forno'],
    r: [['pasta_cooked', 120], ['beef_mince', 90], ['tomato_tinned', 120], ['milk_whole', 60], ['cheese_gouda', 40], ['olive_oil', 8]],
  },
  mac_and_cheese: {
    n: 'macaroni cheese', portion: 320, units: { bowl: 320, portion: 320 },
    a: ['mac and cheese', 'macaroni cheese', 'macaroni and cheese', 'kasenudeln'],
    r: [['pasta_cooked', 200], ['cheese_cheddar', 50], ['milk_whole', 60], ['butter', 12]],
  },
  gnocchi_pesto: {
    n: 'gnocchi with pesto', portion: 300, units: { plate: 300, portion: 300 },
    a: ['gnocchi with pesto', 'gnocchi pesto', 'pesto gnocchi'],
    r: [['gnocchi', 220], ['pesto', 30], ['tomato', 40], ['cheese_parmesan', 10]],
  },
  spatzle: {
    n: 'spätzle', portion: 260, units: { plate: 260, portion: 260 },
    a: ['spatzle', 'spätzle', 'spaetzle'],
    r: [['pasta_cooked', 220], ['egg', 30], ['butter', 10]],
  },
  kasespatzle: {
    n: 'käsespätzle', portion: 315, units: { plate: 315, portion: 315 },
    a: ['kasespatzle', 'käsespätzle', 'kaesespaetzle', 'cheese spatzle'],
    r: [['pasta_cooked', 200], ['cheese_gouda', 60], ['onion', 40], ['butter', 15]],
  },
  risotto: {
    n: 'risotto', portion: 305, units: { plate: 305, bowl: 305, portion: 305 },
    a: ['risotto', 'parmesan risotto'],
    r: [['rice_white_cooked', 220], ['onion', 30], ['butter', 15], ['cheese_parmesan', 20], ['wine_white', 20]],
  },
  mushroom_risotto: {
    n: 'mushroom risotto', portion: 385, units: { plate: 385, bowl: 385, portion: 385 },
    a: ['mushroom risotto', 'risotto with mushrooms', 'pilzrisotto'],
    r: [['rice_white_cooked', 220], ['mushroom', 100], ['onion', 30], ['butter', 15], ['cheese_parmesan', 20]],
  },
  fried_rice: {
    n: 'fried rice', portion: 340, units: { bowl: 340, plate: 340, portion: 340 },
    a: ['fried rice', 'egg fried rice', 'gebratener reis', 'ryz smazony'],
    r: [['rice_white_cooked', 200], ['egg', 55], ['peas_cooked', 40], ['carrot', 30], ['sunflower_oil', 10], ['soy_sauce', 15]],
  },
  pad_thai: {
    n: 'pad thai', portion: 385, units: { plate: 385, portion: 385, bowl: 385 },
    a: ['pad thai', 'padthai'],
    r: [['pasta_cooked', 200], ['tofu_firm', 80], ['egg', 55], ['peanuts', 20], ['sunflower_oil', 12], ['soy_sauce', 15]],
  },
  tortilla_espanola: {
    n: 'spanish tortilla', portion: 350, units: { portion: 175, slice: 120, each: 350 },
    a: ['spanish tortilla', 'tortilla espanola', 'spanish omelette', 'kartoffelomelett'],
    r: [['potato_boiled', 180], ['egg', 110], ['onion', 40], ['olive_oil', 20]],
  },
  pierogi: {
    n: 'pierogi', portion: 350, units: { each: 40, portion: 350, plate: 350 },
    a: ['pierogi', 'dumplings', 'pierogi ruskie', 'piroggen'],
    r: [['pasta_cooked', 200], ['potato_boiled', 80], ['quark', 40], ['butter', 12], ['onion', 20]],
  },
  schnitzel_meal: {
    n: 'schnitzel', portion: 200, units: { each: 200, portion: 200 },
    a: ['schnitzel', 'wiener schnitzel', 'breaded pork', 'kotlet schabowy', 'kotlet'],
    r: [['pork_loin', 130], ['egg', 20], ['bread_white', 30], ['sunflower_oil', 20]],
  },
  currywurst_meal: {
    n: 'currywurst with fries', portion: 340, units: { portion: 340 },
    a: ['currywurst with fries', 'currywurst pommes', 'currywurst and chips'],
    r: [['sausage', 150], ['ketchup', 40], ['potato_fried', 150]],
  },
  baked_salmon_veg: {
    n: 'baked salmon with vegetables', portion: 440, units: { plate: 440, portion: 440 },
    a: ['baked salmon with vegetables', 'salmon with veg', 'salmon and potatoes', 'lachs mit gemuse'],
    r: [['salmon', 130], ['broccoli', 120], ['potato_boiled', 180], ['olive_oil', 12]],
  },
  quiche: {
    n: 'quiche', portion: 290, units: { slice: 145, portion: 290, piece: 145 },
    a: ['quiche', 'quiche lorraine', 'tarte'],
    r: [['egg', 90], ['cream_single', 60], ['bread_white', 60], ['cheese_gouda', 40], ['leek', 40]],
  },
  pizza: {
    n: 'pizza margherita', portion: 460, units: { each: 460, slice: 115, piece: 115, portion: 460 },
    a: ['pizza', 'pizza margherita', 'margherita', 'cheese pizza'],
    r: [['bread_white', 250], ['tomato_tinned', 100], ['cheese_mozzarella', 100], ['olive_oil', 10]],
  },
  shakshuka: {
    n: 'shakshuka', portion: 420, units: { portion: 420, pan: 420, bowl: 420 },
    a: ['shakshuka', 'shakshouka', 'eggs in tomato sauce'],
    r: [['tomato_tinned', 200], ['egg', 110], ['bell_pepper', 60], ['onion', 40], ['olive_oil', 12]],
  },
  stir_fry_veg: {
    n: 'vegetable stir fry', portion: 305, units: { plate: 305, bowl: 305, portion: 305 },
    a: ['vegetable stir fry', 'stir fry', 'stir fried vegetables', 'gemusepfanne'],
    r: [['broccoli', 80], ['carrot', 60], ['bell_pepper', 60], ['onion', 40], ['sesame_oil', 10], ['soy_sauce', 15], ['tofu_firm', 40]],
  },

  // ─── Curries, stews, soups ────────────────────────────────────────────────
  dal: {
    n: 'dal', portion: 365, units: { bowl: 365, plate: 365, portion: 365 },
    a: ['dal', 'daal', 'dahl', 'lentil dal', 'red lentil dal', 'linsendal'],
    r: [['lentils_red_cooked', 250], ['onion', 40], ['tomato_tinned', 60], ['coconut_oil', 8], ['garlic', 6]],
  },
  veg_curry: {
    n: 'vegetable curry', portion: 400, units: { bowl: 400, plate: 400, portion: 400 },
    a: ['vegetable curry', 'veg curry', 'veggie curry', 'gemusecurry', 'curry'],
    r: [['cauliflower', 100], ['chickpeas_cooked', 90], ['tomato_tinned', 100], ['coconut_milk_tin', 70], ['onion', 30], ['coconut_oil', 8]],
  },
  chicken_curry: {
    n: 'chicken curry', portion: 400, units: { bowl: 400, plate: 400, portion: 400 },
    a: ['chicken curry', 'hahnchencurry', 'curry z kurczakiem'],
    r: [['chicken_thigh', 130], ['tomato_tinned', 100], ['coconut_milk_tin', 80], ['onion', 40], ['bell_pepper', 40], ['sunflower_oil', 10]],
  },
  chili_sin_carne: {
    n: 'chilli sin carne', portion: 420, units: { bowl: 420, plate: 420, portion: 420 },
    a: ['chilli sin carne', 'chili sin carne', 'veggie chilli', 'vegan chilli', 'bean chilli'],
    r: [['kidney_beans_cooked', 150], ['tomato_tinned', 150], ['soy_mince', 60], ['onion', 40], ['sweetcorn', 40], ['olive_oil', 8]],
  },
  lentil_soup: {
    n: 'lentil soup', portion: 420, units: { bowl: 420, plate: 420, cup: 250 },
    a: ['lentil soup', 'linsensuppe', 'zupa z soczewicy', 'soczewica zupa'],
    r: [['lentils_cooked', 150], ['carrot', 50], ['celery', 30], ['onion', 30], ['water', 150], ['olive_oil', 8]],
  },
  tomato_soup: {
    n: 'tomato soup', portion: 310, units: { bowl: 310, plate: 310, cup: 250 },
    a: ['tomato soup', 'tomatensuppe', 'zupa pomidorowa', 'pomidorowa'],
    r: [['tomato_tinned', 250], ['onion', 30], ['cream_single', 20], ['olive_oil', 8]],
  },
  pumpkin_soup: {
    n: 'pumpkin soup', portion: 330, units: { bowl: 330, plate: 330, cup: 250 },
    a: ['pumpkin soup', 'butternut soup', 'kurbissuppe', 'kürbissuppe', 'zupa dyniowa'],
    r: [['pumpkin', 250], ['onion', 30], ['coconut_milk_tin', 40], ['olive_oil', 8]],
  },
  minestrone: {
    n: 'minestrone', portion: 400, units: { bowl: 400, plate: 400, cup: 250 },
    a: ['minestrone', 'minestrone soup', 'vegetable soup', 'gemusesuppe', 'zupa warzywna'],
    r: [['tomato_tinned', 120], ['white_beans_cooked', 70], ['carrot', 40], ['celery', 30], ['courgette', 50], ['pasta_cooked', 60], ['olive_oil', 8], ['water', 30]],
  },
  ramen: {
    n: 'ramen', portion: 560, units: { bowl: 560, portion: 560 },
    a: ['ramen', 'ramen bowl', 'noodle soup', 'nudelsuppe'],
    r: [['pasta_cooked', 180], ['egg', 55], ['water', 280], ['soy_sauce', 15], ['mushroom', 40], ['onion', 15]],
  },
  bigos: {
    n: 'bigos', portion: 350, units: { bowl: 350, plate: 350, portion: 350 },
    a: ['bigos', 'sauerkraut stew', 'kraut stew'],
    r: [['cabbage_white', 150], ['sauerkraut', 100], ['sausage', 60], ['onion', 30], ['olive_oil', 8]],
  },

  // ─── Salads and bowls ─────────────────────────────────────────────────────
  greek_salad: {
    n: 'greek salad', portion: 345, units: { bowl: 345, plate: 345, portion: 345 },
    a: ['greek salad', 'griechischer salat', 'salatka grecka'],
    r: [['tomato', 120], ['cucumber', 100], ['cheese_feta', 60], ['olives', 30], ['onion', 20], ['olive_oil', 15]],
  },
  caesar_salad: {
    n: 'caesar salad', portion: 265, units: { bowl: 265, plate: 265, portion: 265 },
    a: ['caesar salad', 'chicken caesar', 'caesar'],
    r: [['lettuce', 120], ['chicken_breast', 80], ['cheese_parmesan', 15], ['mayonnaise', 25], ['bread_white', 25]],
  },
  mixed_salad_dressed: {
    n: 'mixed salad with dressing', portion: 195, units: { bowl: 195, plate: 195, portion: 195, side: 120 },
    a: ['side salad', 'green salad with dressing', 'mixed salad with dressing', 'dressed salad', 'gemischter salat'],
    r: [['mixed_salad', 100], ['tomato', 50], ['cucumber', 30], ['olive_oil', 10], ['vinegar_balsamic', 5]],
  },
  lentil_salad: {
    n: 'lentil salad', portion: 330, units: { bowl: 330, plate: 330, portion: 330 },
    a: ['lentil salad', 'linsensalat', 'salatka z soczewicy', 'salad with lentils'],
    r: [['lentils_cooked', 150], ['mixed_salad', 60], ['tomato', 50], ['onion', 20], ['olive_oil', 12], ['parsley', 8], ['vinegar_balsamic', 5], ['pumpkin_seeds', 15]],
  },
  buddha_bowl: {
    n: 'buddha bowl', portion: 380, units: { bowl: 380, portion: 380 },
    a: ['buddha bowl', 'grain bowl', 'quinoa bowl', 'power bowl', 'veggie bowl'],
    r: [['quinoa_cooked', 150], ['chickpeas_cooked', 80], ['mixed_salad', 60], ['avocado', 50], ['pumpkin_seeds', 15], ['olive_oil', 10], ['tahini', 15]],
  },
  poke_bowl: {
    n: 'poke bowl', portion: 420, units: { bowl: 420, portion: 420 },
    a: ['poke bowl', 'poké bowl', 'poke'],
    r: [['rice_white_cooked', 180], ['salmon', 100], ['avocado', 50], ['edamame', 40], ['cucumber', 40], ['soy_sauce', 10]],
  },
  potato_salad: {
    n: 'potato salad', portion: 270, units: { bowl: 270, portion: 270, side: 150 },
    a: ['potato salad', 'kartoffelsalat', 'salatka ziemniaczana'],
    r: [['potato_boiled', 200], ['mayonnaise', 30], ['onion', 20], ['pickles', 20]],
  },
  caprese: {
    n: 'caprese', portion: 240, units: { plate: 240, portion: 240 },
    a: ['caprese', 'caprese salad', 'tomato mozzarella salad'],
    r: [['tomato', 140], ['cheese_mozzarella', 80], ['basil', 8], ['olive_oil', 12]],
  },
  sushi_roll: {
    n: 'sushi roll', portion: 155, units: { each: 155, roll: 155, piece: 26, portion: 155 },
    a: ['sushi', 'sushi roll', 'maki', 'maki roll', 'california roll'],
    r: [['rice_white_cooked', 100], ['nori', 5], ['salmon', 30], ['cucumber', 20]],
  },

  // ─── Sweet things ─────────────────────────────────────────────────────────
  apple_strudel: {
    n: 'apple strudel', portion: 220, units: { slice: 110, portion: 220, piece: 110 },
    a: ['apple strudel', 'apfelstrudel', 'strudel', 'szarlotka', 'apple cake'],
    r: [['apple', 120], ['bread_white', 60], ['butter', 15], ['sugar', 15], ['raisins', 10]],
  },
  fruit_yoghurt: {
    n: 'yoghurt with fruit', portion: 230, units: { bowl: 230, pot: 230 },
    a: ['yoghurt with fruit', 'yoghurt with berries', 'joghurt mit obst'],
    r: [['yoghurt_natural', 150], ['strawberries', 60], ['honey', 15]],
  },

  // ─── Drinks ───────────────────────────────────────────────────────────────
  latte: {
    n: 'latte', portion: 260, units: { each: 260, cup: 260, glass: 260, mug: 300 },
    a: ['latte', 'caffe latte', 'milchkaffee', 'flat white', 'coffee with milk'],
    r: [['espresso', 60], ['milk_semi', 200]],
  },
  oat_latte: {
    n: 'oat latte', portion: 260, units: { each: 260, cup: 260, glass: 260, mug: 300 },
    a: ['oat latte', 'oat milk latte', 'oat flat white', 'coffee with oat milk', 'hafer latte'],
    r: [['espresso', 60], ['oat_milk', 200]],
  },
  cappuccino: {
    n: 'cappuccino', portion: 150, units: { each: 150, cup: 150 },
    a: ['cappuccino', 'cappucino'],
    r: [['espresso', 30], ['milk_semi', 120]],
  },
  coffee_with_milk: {
    n: 'coffee with a splash of milk', portion: 230, units: { cup: 230, mug: 280, each: 230 },
    a: ['coffee with a splash of milk', 'coffee with a dash of milk', 'kaffee mit milch'],
    r: [['coffee', 200], ['milk_semi', 30]],
  },
  berry_smoothie: {
    n: 'berry smoothie', portion: 350, units: { glass: 350, each: 350, bottle: 350 },
    a: ['berry smoothie', 'fruit smoothie', 'banana smoothie', 'green smoothie'],
    r: [['banana', 100], ['blueberries', 60], ['yoghurt_natural', 100], ['oat_milk', 90]],
  },
};

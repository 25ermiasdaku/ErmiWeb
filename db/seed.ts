import type { DatabaseSync } from "node:sqlite";
// Explicit .ts extensions because this file is also loaded by plain Node
// (scripts/reset-db.ts), whose ESM resolver does not guess extensions.
// Both modules are deliberately free of any database import, so there is no
// cycle back into ./db.
import { hashPasswordSync } from "../src/lib/password.ts";
import { PERMISSIONS, SYSTEM_ROLES } from "../src/lib/permissions.ts";

/**
 * Demo seed. Deterministic (fixed PRNG seed) so screenshots and dashboard
 * numbers are stable across resets.
 *
 * Re-derives member points from the generated order history, so the ledger
 * and the points balance always agree.
 */

const TAX_RATE = 0.0875;

/** mulberry32 */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------
// Static catalogue definitions
// ---------------------------------------------------------------

type ItemDef = {
  name: string;
  description: string;
  price: number; // cents
  icon: string;
  signature?: boolean;
};

const CATEGORIES: Array<{ slug: string; name: string }> = [
  { slug: "espresso", name: "Espresso Bar" },
  { slug: "brewed", name: "Brewed" },
  { slug: "signature", name: "Signature" },
  { slug: "pastry", name: "Pastry" },
  { slug: "retail", name: "Beans to Go" },
];

const MENU: Record<string, ItemDef[]> = {
  espresso: [
    { name: "Espresso", description: "A double ristretto of the house blend.", price: 280, icon: "☕" },
    { name: "Macchiato", description: "Espresso marked with a spoon of dense foam.", price: 330, icon: "🥃" },
    { name: "Cortado", description: "Equal parts espresso and warm milk in glass.", price: 370, icon: "🥛" },
    { name: "Cappuccino", description: "Six ounces, wet foam over a milk cap.", price: 440, icon: "☕" },
    { name: "Flat White", description: "Ristretto under thin, glossy microfoam.", price: 470, icon: "☕", signature: true },
    { name: "Cafe Latte", description: "Long pull, steamed milk, poured rosetta.", price: 500, icon: "🥛" },
    { name: "Americano", description: "Espresso lengthened with hot water.", price: 420, icon: "💧" },
    { name: "Mocha", description: "Single-origin chocolate, espresso, steamed milk.", price: 560, icon: "🍫" },
  ],
  brewed: [
    { name: "Pour Over", description: "Single origin, ground to order, four minutes.", price: 480, icon: "🫖" },
    { name: "Cold Brew", description: "Eighteen hours in the fridge, served tall.", price: 520, icon: "🧊" },
    { name: "French Press", description: "Coarse grind, four-minute steep, full bodied.", price: 520, icon: "🪣" },
    { name: "Iced Latte", description: "Double espresso over ice and cold milk.", price: 530, icon: "🧊" },
  ],
  signature: [
    { name: "Brown Butter Oat Latte", description: "House signature. Browned butter, oat milk, maple.", price: 640, icon: "🍁", signature: true },
    { name: "Caramel Macchiato", description: "Vanilla, steamed milk, caramel, long espresso.", price: 600, icon: "🍮" },
    { name: "Matcha Latte", description: "Ceremonial grade whisked to order.", price: 580, icon: "🍵" },
    { name: "Vanilla Latte", description: "Madagascar vanilla bean, light and floral.", price: 540, icon: "🌼" },
    { name: "Hazelnut Cortado", description: "Torrone hazelnut, 4 oz cortado cut.", price: 490, icon: "🌰", signature: true },
  ],
  pastry: [
    { name: "Butter Croissant", description: "Three-day laminate, French butter.", price: 400, icon: "🥐" },
    { name: "Almond Croissant", description: "Croissant filled with frangipane, dusted sugar.", price: 480, icon: "🥐" },
    { name: "Pain au Chocolat", description: "Bitter chocolate batons in laminated dough.", price: 460, icon: "🍫" },
    { name: "Banana Bread", description: "Dark sugar, black banana, walnut crumble.", price: 440, icon: "🍌" },
    { name: "Blueberry Muffin", description: "Topped with a lemon-sugar streusel.", price: 420, icon: "🫐" },
  ],
  retail: [
    { name: "House Blend 250g", description: "Chocolate and hazelnut. Works in every brewer.", price: 1800, icon: "🫘" },
    { name: "Ethiopia Yirgacheffe 250g", description: "Jasmine, bergamot, stone fruit. Filter roast.", price: 2600, icon: "🫘" },
    { name: "Colombia Huila 250g", description: "Red apple, caramel, soft acidity.", price: 2200, icon: "🫘" },
    { name: "Decaf Blend 250g", description: "Swiss water process, keeps all the sweetness.", price: 1900, icon: "🫘" },
  ],
};

type OptionDef = { group: string; label: string; delta: number; def?: boolean };

const DRINK_SIZES: OptionDef[] = [
  { group: "Size", label: "Small", delta: 0, def: true },
  { group: "Size", label: "Medium", delta: 60 },
  { group: "Size", label: "Large", delta: 110 },
];

const BREW_SIZES: OptionDef[] = [
  { group: "Size", label: "12 oz", delta: 0, def: true },
  { group: "Size", label: "16 oz", delta: 80 },
];

const MILKS: OptionDef[] = [
  { group: "Milk", label: "Whole", delta: 0, def: true },
  { group: "Milk", label: "Skim", delta: 0 },
  { group: "Milk", label: "Oat", delta: 80 },
  { group: "Milk", label: "Almond", delta: 80 },
  { group: "Milk", label: "None", delta: 0 },
];

const SWEETNESS: OptionDef[] = [
  { group: "Sweetness", label: "Unsweetened", delta: 0, def: true },
  { group: "Sweetness", label: "Half sweet", delta: 0 },
  { group: "Sweetness", label: "Full sweet", delta: 0 },
];

const EXTRAS: OptionDef[] = [
  { group: "Extras", label: "Extra shot", delta: 95 },
  { group: "Extras", label: "Vanilla", delta: 55 },
  { group: "Extras", label: "Caramel", delta: 55 },
  { group: "Extras", label: "Hazelnut", delta: 55 },
  { group: "Extras", label: "Chocolate", delta: 55 },
  { group: "Extras", label: "Whipped cream", delta: 65 },
  { group: "Extras", label: "Extra hot", delta: 0 },
];

const GRINDS: OptionDef[] = [
  { group: "Grind", label: "Whole bean", delta: 0, def: true },
  { group: "Grind", label: "Filter", delta: 0 },
  { group: "Grind", label: "Espresso", delta: 0 },
  { group: "Grind", label: "French press", delta: 0 },
];

const RETAIL_BEANS: OptionDef[] = [
  { group: "Size", label: "250 g", delta: 0, def: true },
  { group: "Size", label: "500 g", delta: 1500 },
  { group: "Size", label: "1 kg", delta: 4200 },
];

function optionsFor(slug: string, name: string): OptionDef[] {
  if (slug === "espresso") return [...DRINK_SIZES, ...MILKS, ...SWEETNESS, ...EXTRAS];
  if (slug === "brewed") return [...BREW_SIZES, ...MILKS, ...SWEETNESS, ...EXTRAS];
  if (slug === "signature") return [...DRINK_SIZES, ...MILKS, ...SWEETNESS, ...EXTRAS];
  if (slug === "pastry") return [{ group: "Preparation", label: "Warmed", delta: 0 }];
  if (name.includes("250g")) return [...RETAIL_BEANS, ...GRINDS];
  return GRINDS;
}

// ---------------------------------------------------------------
// Inventory: tracked in base units (g / mL / ea) so recipes deduct cleanly
// ---------------------------------------------------------------

type InvDef = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  reorder: number;
  reorderQty: number;
  unitCost: number; // cents per ONE base unit
  supplier: string;
};

const INVENTORY: InvDef[] = [
  { sku: "BEAN-HOUSE", name: "House Blend Beans", category: "Beans", unit: "g", onHand: 4200, reorder: 2500, reorderQty: 10000, unitCost: 9.6, supplier: "Meridian Roasters" },
  { sku: "BEAN-ETH", name: "Ethiopia Yirgacheffe", category: "Beans", unit: "g", onHand: 1650, reorder: 1000, reorderQty: 5000, unitCost: 13.5, supplier: "Meridian Roasters" },
  { sku: "BEAN-COL", name: "Colombia Huila", category: "Beans", unit: "g", onHand: 3100, reorder: 1000, reorderQty: 5000, unitCost: 11.2, supplier: "Meridian Roasters" },
  { sku: "BEAN-DECAF", name: "Decaf Blend Beans", category: "Beans", unit: "g", onHand: 780, reorder: 1000, reorderQty: 5000, unitCost: 10.4, supplier: "Meridian Roasters" },
  { sku: "MILK-WHOLE", name: "Whole Milk", category: "Dairy", unit: "mL", onHand: 9400, reorder: 8000, reorderQty: 40000, unitCost: 0.38, supplier: "Greenfield Dairy" },
  { sku: "MILK-SKIM", name: "Skim Milk", category: "Dairy", unit: "mL", onHand: 5200, reorder: 4000, reorderQty: 40000, unitCost: 0.36, supplier: "Greenfield Dairy" },
  { sku: "MILK-OAT", name: "Oat Milk", category: "Dairy", unit: "mL", onHand: 3400, reorder: 6000, reorderQty: 20000, unitCost: 0.98, supplier: "Oatfolk" },
  { sku: "MILK-ALMOND", name: "Almond Milk", category: "Dairy", unit: "mL", onHand: 6200, reorder: 6000, reorderQty: 20000, unitCost: 0.86, supplier: "Oatfolk" },
  { sku: "SYRUP-VAN", name: "Vanilla Syrup", category: "Syrups", unit: "mL", onHand: 1450, reorder: 750, reorderQty: 3000, unitCost: 0.55, supplier: "Sweet Provisions" },
  { sku: "SYRUP-CAR", name: "Caramel Syrup", category: "Syrups", unit: "mL", onHand: 1620, reorder: 750, reorderQty: 3000, unitCost: 0.52, supplier: "Sweet Provisions" },
  { sku: "SYRUP-HAZ", name: "Hazelnut Syrup", category: "Syrups", unit: "mL", onHand: 410, reorder: 750, reorderQty: 3000, unitCost: 0.62, supplier: "Sweet Provisions" },
  { sku: "SYRUP-CHOC", name: "Chocolate Sauce", category: "Syrups", unit: "mL", onHand: 2100, reorder: 750, reorderQty: 3000, unitCost: 0.74, supplier: "Sweet Provisions" },
  { sku: "SYRUP-MAPLE", name: "Maple Syrup", category: "Syrups", unit: "mL", onHand: 380, reorder: 500, reorderQty: 2000, unitCost: 0.9, supplier: "Sweet Provisions" },
  { sku: "SYRUP-BRB", name: "Browned Butter Syrup", category: "Syrups", unit: "mL", onHand: 900, reorder: 400, reorderQty: 1500, unitCost: 1.15, supplier: "Sweet Provisions" },
  { sku: "TEA-MATCHA", name: "Ceremonial Matcha", category: "Tea", unit: "g", onHand: 480, reorder: 200, reorderQty: 1000, unitCost: 5.4, supplier: "Tea & Co" },
  { sku: "COCOA", name: "Cocoa Powder", category: "Tea", unit: "g", onHand: 760, reorder: 300, reorderQty: 1000, unitCost: 3.1, supplier: "Tea & Co" },
  { sku: "PASTRY-CROIS", name: "Butter Croissant", category: "Bakery", unit: "ea", onHand: 34, reorder: 12, reorderQty: 48, unitCost: 145, supplier: "Boulangerie Dupont" },
  { sku: "PASTRY-ALMOND", name: "Almond Croissant", category: "Bakery", unit: "ea", onHand: 6, reorder: 10, reorderQty: 36, unitCost: 160, supplier: "Boulangerie Dupont" },
  { sku: "PASTRY-PACAKE", name: "Pain au Chocolat", category: "Bakery", unit: "ea", onHand: 22, reorder: 10, reorderQty: 36, unitCost: 150, supplier: "Boulangerie Dupont" },
  { sku: "PASTRY-BANANA", name: "Banana Bread Slice", category: "Bakery", unit: "ea", onHand: 14, reorder: 8, reorderQty: 30, unitCost: 85, supplier: "Boulangerie Dupont" },
  { sku: "PASTRY-MUFFIN", name: "Blueberry Muffin", category: "Bakery", unit: "ea", onHand: 26, reorder: 8, reorderQty: 30, unitCost: 80, supplier: "Boulangerie Dupont" },
  { sku: "CUP-DEMI", name: "Demitasse Cup 3oz", category: "Packaging", unit: "ea", onHand: 210, reorder: 100, reorderQty: 500, unitCost: 32, supplier: "Greenline Supply" },
  { sku: "CUP-12", name: "Hot Cup 12oz", category: "Packaging", unit: "ea", onHand: 640, reorder: 300, reorderQty: 1000, unitCost: 11, supplier: "Greenline Supply" },
  { sku: "CUP-16", name: "Hot Cup 16oz", category: "Packaging", unit: "ea", onHand: 410, reorder: 300, reorderQty: 1000, unitCost: 13, supplier: "Greenline Supply" },
  { sku: "LID-16", name: "Cup Lid 16oz", category: "Packaging", unit: "ea", onHand: 155, reorder: 300, reorderQty: 1000, unitCost: 5, supplier: "Greenline Supply" },
  { sku: "CUP-ICED", name: "Iced Cup 16oz", category: "Packaging", unit: "ea", onHand: 720, reorder: 300, reorderQty: 1000, unitCost: 12, supplier: "Greenline Supply" },
  { sku: "NAPKIN", name: "Napkins", category: "Packaging", unit: "ea", onHand: 1800, reorder: 500, reorderQty: 2000, unitCost: 1, supplier: "Greenline Supply" },
];

// ---------------------------------------------------------------
// Recipes: brew spec + what each drink consumes
// ---------------------------------------------------------------

type IngredientDef = { sku: string; qty: number };
type StepDef = { title: string; instruction: string; seconds: number };
type RecipeDef = {
  name: string;
  brewMethod: string;
  dose: number;
  water: number;
  ratio?: string;
  grind: string;
  temp: number;
  time: number;
  notes?: string;
  steps: StepDef[];
  ingredients: IngredientDef[];
};

const ESPRESSO_STEPS: StepDef[] = [
  { title: "Dose & tamp", instruction: "Dose 18 g, distribute, tamp level with a 58 mm tamper.", seconds: 20 },
  { title: "Pre-infusion", instruction: "Hold at 3 bar until first drops appear.", seconds: 5 },
  { title: "Extraction", instruction: "Let the machine run to 36 g out in 28–30 s. Aim for a honey-like flow.", seconds: 30 },
  { title: "Serve", instruction: "Wipe the rim and serve immediately.", seconds: 5 },
];

const MILK_STEPS: StepDef[] = [
  { title: "Steam milk", instruction: "Steam from the surface, dip the wand just under, then lower to a fine stretch.", seconds: 25 },
  { title: "Texturize", instruction: "Stop at 55 °C with a glossy microfoam, no big bubbles.", seconds: 10 },
  { title: "Pour", instruction: "Pour from a low height to integrate, finish high to draw a rosetta.", seconds: 12 },
];

const BREW_STEPS: StepDef[] = [
  { title: "Rinse filter", instruction: "Rinse the paper filter with hot water and discard the rinse water.", seconds: 20 },
  { title: "Dose", instruction: "Add 22 g of medium-fine coffee, level the bed.", seconds: 15 },
  { title: "Bloom", instruction: "Pour 60 g of water, swirl, wait 40 s for degassing.", seconds: 40 },
  { title: "Main pour", instruction: "Pour in slow spirals to 350 g, letting the bed drain between pours.", seconds: 120 },
  { title: "Drawdown", instruction: "Let it finish dripping, total time around 3:30.", seconds: 45 },
];

const RECIPES: RecipeDef[] = [
  {
    name: "Espresso",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 36,
    grind: "Fine",
    temp: 93,
    time: 28,
    notes: "Reject the shot if it gushes after 15 s — tighten the grind by half a step.",
    steps: ESPRESSO_STEPS,
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "CUP-DEMI", qty: 1 },
      { sku: "NAPKIN", qty: 1 },
    ],
  },
  {
    name: "Cortado",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 36,
    grind: "Fine",
    temp: 93,
    time: 28,
    notes: "Milk should be barely warm; a cortado is served in a 4 oz glass.",
    steps: [...ESPRESSO_STEPS.slice(0, 3), ...MILK_STEPS.slice(0, 2), { title: "Combine", instruction: "Pour the milk through the espresso to layer it.", seconds: 10 }],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 120 },
      { sku: "CUP-DEMI", qty: 1 },
    ],
  },
  {
    name: "Cappuccino",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 36,
    grind: "Fine",
    temp: 93,
    time: 28,
    notes: "Classic 6:3:1 ratio in the cup — six parts steamed milk, three parts foam, one part coffee.",
    steps: [...ESPRESSO_STEPS.slice(0, 3), ...MILK_STEPS, { title: "Dust", instruction: "Finish with a dusting of cocoa.", seconds: 8 }],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 180 },
      { sku: "COCOA", qty: 2 },
      { sku: "CUP-12", qty: 1 },
    ],
  },
  {
    name: "Flat White",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 94,
    time: 27,
    notes: "The house benchmark. A ristretto base keeps it sweet and dense under thin milk.",
    steps: [...ESPRESSO_STEPS.slice(0, 3), ...MILK_STEPS],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 160 },
      { sku: "CUP-12", qty: 1 },
    ],
  },
  {
    name: "Cafe Latte",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 93,
    time: 27,
    steps: [...ESPRESSO_STEPS.slice(0, 3), ...MILK_STEPS],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 240 },
      { sku: "CUP-16", qty: 1 },
      { sku: "LID-16", qty: 1 },
      { sku: "NAPKIN", qty: 1 },
    ],
  },
  {
    name: "Americano",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 220,
    grind: "Fine",
    temp: 95,
    time: 30,
    notes: "Hot water first, espresso on top, to protect the crema.",
    steps: [
      { title: "Heat water", instruction: "Fill the cup with 200 ml of water at 95 °C.", seconds: 20 },
      ...ESPRESSO_STEPS.slice(1, 3),
      { title: "Combine", instruction: "Pour the espresso over the water; the crema should stay intact.", seconds: 10 },
    ],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "CUP-12", qty: 1 },
    ],
  },
  {
    name: "Mocha",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 92,
    time: 27,
    steps: [
      { title: "Prepare chocolate", instruction: "Blend 20 ml of chocolate sauce with 60 ml of steamed milk until smooth.", seconds: 25 },
      ...ESPRESSO_STEPS.slice(0, 3),
      ...MILK_STEPS.slice(2),
    ],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 240 },
      { sku: "SYRUP-CHOC", qty: 20 },
      { sku: "CUP-16", qty: 1 },
      { sku: "LID-16", qty: 1 },
    ],
  },
  {
    name: "Pour Over",
    brewMethod: "V60 pour over",
    dose: 22,
    water: 350,
    ratio: "1:16",
    grind: "Medium-fine",
    temp: 94,
    time: 210,
    notes: "Rinse the filter properly or you will drink paper.",
    steps: BREW_STEPS,
    ingredients: [
      { sku: "BEAN-ETH", qty: 22 },
      { sku: "CUP-16", qty: 1 },
    ],
  },
  {
    name: "Cold Brew",
    brewMethod: "Immersion, 18 h",
    dose: 100,
    water: 1000,
    ratio: "1:10",
    grind: "Coarse",
    temp: 4,
    time: 64800,
    notes: "Steep in the walk-in at 4 °C, strain twice through a mesh and paper filter.",
    steps: [
      { title: "Combine", instruction: "100 g coarse grind into 1 L of filtered water.", seconds: 60 },
      { title: "Steep", instruction: "Cover and refrigerate for 18 hours.", seconds: 64800 },
      { title: "Strain", instruction: "Mesh strain, then paper filter for a clean finish.", seconds: 600 },
      { title: "Serve", instruction: "Serve over ice, one part concentrate to one part water and milk.", seconds: 45 },
    ],
    ingredients: [
      { sku: "BEAN-COL", qty: 100 },
      { sku: "CUP-ICED", qty: 1 },
    ],
  },
  {
    name: "French Press",
    brewMethod: "French press",
    dose: 30,
    water: 500,
    ratio: "1:16.6",
    grind: "Coarse",
    temp: 94,
    time: 240,
    notes: "Break the crust at 4:00, skim the foam, then wait another 30 s before plunging.",
    steps: [
      { title: "Dose", instruction: "30 g of coarse ground coffee into the preheated press.", seconds: 30 },
      { title: "Pour", instruction: "Pour 500 ml at 94 °C, saturating all the grounds.", seconds: 30 },
      { title: "Steep", instruction: "Place the lid on top and leave undisturbed for four minutes.", seconds: 240 },
      { title: "Press", instruction: "Skim the surface foam, then plunge slowly just below the water line.", seconds: 60 },
    ],
    ingredients: [
      { sku: "BEAN-COL", qty: 30 },
      { sku: "CUP-12", qty: 1 },
    ],
  },
  {
    name: "Iced Latte",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 90,
    time: 26,
    notes: "Serve with 150 g of ice so the drink keeps its body.",
    steps: [
      { title: "Prep ice", instruction: "Fill a 16 oz cup with 150 g of fresh ice.", seconds: 20 },
      ...ESPRESSO_STEPS.slice(1, 3),
      { title: "Add milk", instruction: "Pour cold milk over the ice, then the espresso on top.", seconds: 40 },
    ],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 200 },
      { sku: "CUP-ICED", qty: 1 },
    ],
  },
  {
    name: "Brown Butter Oat Latte",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 93,
    time: 27,
    notes: "The house signature. Toast the butter to a hazelnut colour before adding syrup.",
    steps: [
      { title: "Brown the butter", instruction: "Foam 30 ml of butter until the milk solids turn hazelnut brown and smell nutty.", seconds: 90 },
      { title: "Add syrups", instruction: "Stir in 15 ml browned butter syrup and 10 ml maple.", seconds: 15 },
      ...ESPRESSO_STEPS.slice(0, 3),
      { title: "Steam and pour", instruction: "Steam oat milk to 60 °C and pour a tight tulip over the espresso.", seconds: 45 },
    ],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-OAT", qty: 230 },
      { sku: "SYRUP-BRB", qty: 15 },
      { sku: "SYRUP-MAPLE", qty: 10 },
      { sku: "CUP-16", qty: 1 },
      { sku: "LID-16", qty: 1 },
    ],
  },
  {
    name: "Caramel Macchiato",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 93,
    time: 27,
    steps: [
      { title: "Drizzle", instruction: "Drizzle 15 ml of caramel down the inside of the cup.", seconds: 15 },
      ...ESPRESSO_STEPS.slice(0, 3),
      ...MILK_STEPS.slice(2),
      { title: "Finish", instruction: "Drizzle remaining caramel in a ladder pattern.", seconds: 15 },
    ],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 240 },
      { sku: "SYRUP-CAR", qty: 20 },
      { sku: "SYRUP-VAN", qty: 10 },
      { sku: "CUP-16", qty: 1 },
      { sku: "LID-16", qty: 1 },
    ],
  },
  {
    name: "Matcha Latte",
    brewMethod: "Whisked",
    dose: 4,
    water: 60,
    ratio: "1:15",
    grind: "Sifter",
    temp: 80,
    time: 60,
    notes: "Never whisk matcha above 80 °C — it turns bitter and loses its colour.",
    steps: [
      { title: "Sift", instruction: "Sift 4 g of matcha to remove any lumps.", seconds: 20 },
      { title: "Whisk", instruction: "Add 60 ml of water at 80 °C and whisk in W strokes until frothy.", seconds: 45 },
      { title: "Add milk", instruction: "Top with steamed milk and pour over ice if served cold.", seconds: 40 },
    ],
    ingredients: [
      { sku: "TEA-MATCHA", qty: 4 },
      { sku: "MILK-WHOLE", qty: 230 },
      { sku: "CUP-16", qty: 1 },
    ],
  },
  {
    name: "Vanilla Latte",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 40,
    grind: "Fine",
    temp: 93,
    time: 27,
    steps: [...ESPRESSO_STEPS.slice(0, 3), { title: "Sweeten", instruction: "Stir 10 ml of vanilla syrup into the steamed milk before pouring.", seconds: 15 }, ...MILK_STEPS.slice(2)],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 240 },
      { sku: "SYRUP-VAN", qty: 10 },
      { sku: "CUP-16", qty: 1 },
      { sku: "LID-16", qty: 1 },
    ],
  },
  {
    name: "Hazelnut Cortado",
    brewMethod: "Espresso machine",
    dose: 18,
    water: 36,
    grind: "Fine",
    temp: 93,
    time: 28,
    steps: [...ESPRESSO_STEPS.slice(0, 3), { title: "Add syrup", instruction: "Stir 10 ml of hazelnut syrup into the milk.", seconds: 10 }, { title: "Layer", instruction: "Pour through the espresso in a 4 oz glass.", seconds: 10 }],
    ingredients: [
      { sku: "BEAN-HOUSE", qty: 18 },
      { sku: "MILK-WHOLE", qty: 120 },
      { sku: "SYRUP-HAZ", qty: 10 },
      { sku: "CUP-DEMI", qty: 1 },
    ],
  },
  {
    name: "House Blend 250g",
    brewMethod: "Retail",
    dose: 15,
    water: 250,
    ratio: "1:16.6",
    grind: "Whole bean",
    temp: 93,
    time: 240,
    notes: "Rest opened bags for five days before grinding — degassing matters more than freshness.",
    steps: [
      { title: "Explain", instruction: "Hand over the bag and note the roast date on the label.", seconds: 30 },
    ],
    ingredients: [{ sku: "BEAN-HOUSE", qty: 250 }],
  },
  {
    name: "Ethiopia Yirgacheffe 250g",
    brewMethod: "Retail",
    dose: 15,
    water: 250,
    ratio: "1:16.6",
    grind: "Whole bean",
    temp: 94,
    time: 210,
    notes: "A light filter roast. Suggest a V60 or an AeroPress.",
    steps: [{ title: "Explain", instruction: "Recommend filter methods; it will taste thin in an espresso basket.", seconds: 30 }],
    ingredients: [{ sku: "BEAN-ETH", qty: 250 }],
  },
  {
    name: "Colombia Huila 250g",
    brewMethod: "Retail",
    dose: 15,
    water: 250,
    ratio: "1:16.6",
    grind: "Whole bean",
    temp: 93,
    time: 240,
    steps: [{ title: "Explain", instruction: "Balanced and forgiving — a good default for new brewers.", seconds: 30 }],
    ingredients: [{ sku: "BEAN-COL", qty: 250 }],
  },
  {
    name: "Decaf Blend 250g",
    brewMethod: "Retail",
    dose: 15,
    water: 250,
    ratio: "1:16.6",
    grind: "Whole bean",
    temp: 94,
    time: 240,
    notes: "Swiss water process, so no solvent notes.",
    steps: [{ title: "Explain", instruction: "Mention the water-based decaffeination process.", seconds: 30 }],
    ingredients: [{ sku: "BEAN-DECAF", qty: 250 }],
  },
];

const MEMBERS: Array<{ name: string; email: string; phone: string; notes: string }> = [
  { name: "Ava Mitchell", email: "ava.mitchell@example.com", phone: "555-0142", notes: "Oat milk, no sugar." },
  { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "555-0188", notes: "Buys retail beans monthly." },
  { name: "Priya Raman", email: "priya.raman@example.com", phone: "555-0119", notes: "Office orders every Tuesday." },
  { name: "Marcus Lindqvist", email: "marcus.lindqvist@example.com", phone: "555-0173", notes: "" },
  { name: "Sofia Bianchi", email: "sofia.bianchi@example.com", phone: "555-0126", notes: "Prefers decaf after 3pm." },
  { name: "Kenji Watanabe", email: "kenji.watanabe@example.com", phone: "555-0155", notes: "Allergy: no dairy." },
];

const REWARDS: Array<{
  name: string;
  description: string;
  points: number;
  kind: string;
  value: number;
}> = [
  { name: "Free pastry", description: "Any pastry from the counter, no minimum spend.", points: 150, kind: "item", value: 0 },
  { name: "$2 off your drink", description: "Take $2 off a single drink.", points: 200, kind: "discount", value: 200 },
  { name: "Free size upgrade", description: "Upgrade any drink to the next size, free.", points: 300, kind: "upgrade", value: 0 },
  { name: "Signature drink on us", description: "One drink from the Signature board.", points: 450, kind: "item", value: 0 },
  { name: "Bag of House Blend", description: "250 g bag of House Blend to take home.", points: 1200, kind: "item", value: 0 },
];

const CHANNELS = ["counter", "counter", "counter", "mobile", "mobile", "delivery"];

/**
 * Demo accounts. All share one password so the system is easy to try:
 *
 *   Staff     admin · manager · barista · cashier   ->  ermi1234
 *   Customers ava · priya · daniel · sofia · theo   ->  ermi1234
 *
 * `eli` is seeded switched off and `juno` archived, so the user list shows
 * every account state without anyone having to click a toggle first.
 *
 * The customers are not interchangeable: each one is parked at a different point
 * in the order flow, so signing in as each of them shows a different button.
 * `theo` has no loyalty record yet, which is the brand-new-customer path.
 */
export const DEMO_PASSWORD = "ermi1234";

const USERS: Array<{
  username: string;
  email: string;
  fullName: string;
  jobTitle: string;
  role: string;
  active?: boolean;
  archived?: boolean;
  /**
   * The loyalty record this account collects points into, matched by email.
   *
   * Staff leave this unset — they are not regulars. Customers set it, which is
   * what makes ordering and the points book the same person.
   */
  memberEmail?: string;
}> = [
  { username: "admin", email: "wren@ermi.cafe", fullName: "Wren Tesfaye", jobTitle: "Owner", role: "owner" },
  { username: "manager", email: "kai@ermi.cafe", fullName: "Kai Mwangi", jobTitle: "Cafe Manager", role: "manager" },
  { username: "barista", email: "noor@ermi.cafe", fullName: "Noor Haddad", jobTitle: "Senior Barista", role: "barista" },
  { username: "cashier", email: "sami@ermi.cafe", fullName: "Sami Okello", jobTitle: "Counter Staff", role: "cashier" },
  { username: "eli", email: "eli@ermi.cafe", fullName: "Eli Braun", jobTitle: "Barista", role: "barista", active: false },
  { username: "juno", email: "juno@ermi.cafe", fullName: "Juno Adeyemi", jobTitle: "Weekend Barista", role: "cashier", archived: true },

  // Customers. Each is an existing member, so they arrive with points and a
  // history worth looking at. `theo` is deliberately not a member yet — his
  // loyalty record is created by his first order, which is the path a
  // brand-new customer takes.
  {
    username: "ava",
    email: "ava.mitchell@example.com",
    fullName: "Ava Mitchell",
    jobTitle: "",
    role: "customer",
    memberEmail: "ava.mitchell@example.com",
  },
  {
    username: "priya",
    email: "priya.raman@example.com",
    fullName: "Priya Raman",
    jobTitle: "",
    role: "customer",
    memberEmail: "priya.raman@example.com",
  },
  {
    username: "daniel",
    email: "daniel.okafor@example.com",
    fullName: "Daniel Okafor",
    jobTitle: "",
    role: "customer",
    memberEmail: "daniel.okafor@example.com",
  },
  {
    username: "sofia",
    email: "sofia.bianchi@example.com",
    fullName: "Sofia Bianchi",
    jobTitle: "",
    role: "customer",
    memberEmail: "sofia.bianchi@example.com",
  },
  {
    username: "theo",
    email: "theo.bright@example.com",
    fullName: "Theo Bright",
    jobTitle: "",
    role: "customer",
  },
];

/** Who rings up orders, weighted the way a real shift splits the work. */
const TILL_WEIGHTS: Array<[string, number]> = [
  ["barista", 5],
  ["cashier", 3],
  ["manager", 1.5],
  ["admin", 0.5],
];

// ---------------------------------------------------------------

export function seed(db: DatabaseSync): void {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

  db.exec("BEGIN");
  try {
    // --- settings
    // tax_rate is stored as a percentage, matching SETTING_DEFS in
    // src/lib/settings.ts. Keep the two in step.
    const setSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    setSetting.run("cafe_name", "Ermi Coffee");
    setSetting.run("cafe_tagline", "Roastery & counter");
    setSetting.run("order_prefix", "E");
    setSetting.run("tax_rate", String(TAX_RATE * 100));
    setSetting.run("points_per_dollar", "1");

    // --- access control: permissions, roles, then users
    const insPerm = db.prepare(
      "INSERT INTO permissions (key, label, category, description, sort_order) VALUES (?, ?, ?, ?, ?)",
    );
    PERMISSIONS.forEach((p, i) => insPerm.run(p.key, p.label, p.category, p.description, i));

    const insRole = db.prepare(
      "INSERT INTO roles (slug, name, description, is_system) VALUES (?, ?, ?, 1)",
    );
    const roleIds = new Map<string, number>();
    for (const role of SYSTEM_ROLES) {
      roleIds.set(role.slug, Number(insRole.run(role.slug, role.name, role.description).lastInsertRowid));
    }

    const insRolePerm = db.prepare(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
    );
    const permIds = new Map<string, number>(
      (db.prepare("SELECT id, key FROM permissions").all() as Array<{ id: number; key: string }>).map((p) => [
        p.key,
        p.id,
      ]),
    );
    for (const role of SYSTEM_ROLES) {
      const roleId = roleIds.get(role.slug);
      if (roleId === undefined) continue;
      for (const key of role.permissions) {
        const permId = permIds.get(key);
        if (permId) insRolePerm.run(roleId, permId);
      }
    }

    // A fresh salt per account. They share a password, but they must not share
    // a salt: a shared one would let a single precomputation against the digest
    // recover every demo account at once, and would contradict the salting the
    // app does for real users. Eleven hashes cost well under a second.
    const insUser = db.prepare(
      `INSERT INTO users (username, email, full_name, password_hash, role_id, job_title,
                          is_active, must_change_password, last_login_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now', ?), ?)`,
    );
    const userIds = new Map<string, number>();
    for (const u of USERS) {
      const roleId = roleIds.get(u.role);
      if (roleId === undefined) continue;
      const seen = u.archived ? null : `-${1 + (USERS.indexOf(u) % 6)} hours`;
      const deleted = u.archived ? iso(new Date(now.getTime() - 86_400_000)) : null;
      const r = insUser.run(
        u.username,
        u.email,
        u.fullName,
        hashPasswordSync(DEMO_PASSWORD),
        roleId,
        u.jobTitle,
        u.active === false ? 0 : 1,
        seen,
        deleted,
      );
      userIds.set(u.username, Number(r.lastInsertRowid));
    }

    // Weighted picker over the till accounts, so the staff sales report has a
    // believable spread.
    const tillPool: Array<string> = [];
    for (const [username, weight] of TILL_WEIGHTS) {
      for (let i = 0; i < weight * 2; i++) tillPool.push(username);
    }
    const tillPicks = tillPool.map((u) => userIds.get(u)).filter((v): v is number => v !== undefined);

    // --- categories
    const catIds = new Map<string, number>();
    const insCat = db.prepare("INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)");
    CATEGORIES.forEach((c, i) => {
      const r = insCat.run(c.slug, c.name, i);
      catIds.set(c.slug, Number(r.lastInsertRowid));
    });

    // --- inventory
    const invIds = new Map<string, number>();
    const insInv = db.prepare(
      `INSERT INTO inventory_items
         (sku, name, category, unit, qty_on_hand, reorder_level, reorder_qty, unit_cost_cents, supplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const i of INVENTORY) {
      const r = insInv.run(i.sku, i.name, i.category, i.unit, i.onHand, i.reorder, i.reorderQty, i.unitCost, i.supplier);
      invIds.set(i.sku, Number(r.lastInsertRowid));
      db.prepare("INSERT INTO inventory_txns (inventory_item_id, delta, reason) VALUES (?, ?, ?)")
        .run(r.lastInsertRowid, i.onHand, "opening stock");
    }

    // --- menu items + options
    const itemIds = new Map<string, number>();
    const insItem = db.prepare(
      `INSERT INTO menu_items (category_id, name, description, base_price_cents, icon, is_signature)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insOpt = db.prepare(
      `INSERT INTO item_options (menu_item_id, group_name, label, price_delta_cents, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const [slug, items] of Object.entries(MENU)) {
      const catId = catIds.get(slug);
      if (catId === undefined) continue;
      for (const item of items) {
        const r = insItem.run(catId, item.name, item.description, item.price, item.icon, item.signature ? 1 : 0);
        const id = Number(r.lastInsertRowid);
        itemIds.set(item.name, id);
        optionsFor(slug, item.name).forEach((o, idx) => {
          insOpt.run(id, o.group, o.label, o.delta, o.def ? 1 : 0, idx);
        });
      }
    }

    // --- recipes
    const insRecipe = db.prepare(
      `INSERT INTO recipes (menu_item_id, brew_method, dose_g, water_g, ratio, grind, water_temp_c, brew_time_s, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insStep = db.prepare(
      "INSERT INTO recipe_steps (recipe_id, step_no, title, instruction, seconds) VALUES (?, ?, ?, ?, ?)",
    );
    const insIng = db.prepare(
      "INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, qty) VALUES (?, ?, ?)",
    );

    for (const rec of RECIPES) {
      const itemId = itemIds.get(rec.name);
      if (itemId === undefined) continue;
      const r = insRecipe.run(
        itemId,
        rec.brewMethod,
        rec.dose,
        rec.water,
        rec.ratio ?? "",
        rec.grind,
        rec.temp,
        rec.time,
        rec.notes ?? "",
      );
      const recipeId = Number(r.lastInsertRowid);
      rec.steps.forEach((s, i) => insStep.run(recipeId, i + 1, s.title, s.instruction, s.seconds));
      for (const ing of rec.ingredients) {
        const invId = invIds.get(ing.sku);
        if (invId !== undefined) insIng.run(recipeId, invId, ing.qty);
      }
    }

    // --- members
    const memberIds: number[] = [];
    const insMember = db.prepare("INSERT INTO members (name, email, phone, notes, joined_at) VALUES (?, ?, ?, ?, ?)");
    MEMBERS.forEach((m, i) => {
      const joined = new Date(now);
      joined.setDate(joined.getDate() - (200 - i * 26));
      const r = insMember.run(m.name, m.email, m.phone, m.notes, iso(joined));
      memberIds.push(Number(r.lastInsertRowid));
    });

    // Point the customer accounts at their loyalty records. This is what makes
    // "order coffee" and "earn points" the same person rather than two lists
    // that have to be matched by hand at the counter. Staff are left unlinked.
    const linkMember = db.prepare("UPDATE users SET member_id = ? WHERE id = ?");
    for (const u of USERS) {
      if (!u.memberEmail) continue;
      const userId = userIds.get(u.username);
      if (userId === undefined) continue;
      const memberId = memberIds[MEMBERS.findIndex((m) => m.email === u.memberEmail)];
      if (memberId !== undefined) linkMember.run(memberId, userId);
    }

    // --- rewards
    const insReward = db.prepare(
      "INSERT INTO rewards (name, description, points_cost, kind, value_cents) VALUES (?, ?, ?, ?, ?)",
    );
    for (const rw of REWARDS) {
      insReward.run(rw.name, rw.description, rw.points, rw.kind, rw.value);
    }

    // --- order history: 7 days of trading
    const rand = rng(20260928);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
    const drinkNames = Object.entries(MENU)
      .filter(([slug]) => slug !== "retail")
      .flatMap(([, items]) => items.map((i) => i.name));

    const insOrder = db.prepare(
      `INSERT INTO orders
         (order_number, status, channel, customer_name, member_id, placed_by, subtotal_cents, tax_cents,
          total_cents, points_earned, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insOrderItem = db.prepare(
      `INSERT INTO order_items
         (order_id, menu_item_id, name_snapshot, qty, unit_price_cents, line_total_cents, options_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insEvent = db.prepare("INSERT INTO order_events (order_id, status, at) VALUES (?, ?, ?)");
    const insLoyalty = db.prepare(
      "INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason, at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const addPoints = db.prepare("UPDATE members SET points = points + ? WHERE id = ?");

    let orderSeq = 1000;
    let memberBalance = new Map<number, number>(memberIds.map((id) => [id, 0]));
    const lastVisit = new Map<number, string>();

    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayOffset);
      // Closed Sundays, quieter Mondays.
      const isSunday = day.getDay() === 0;
      const ordersToday = isSunday ? 0 : dayOffset === 0 ? 14 : 22 + Math.floor(rand() * 16);

      for (let n = 0; n < ordersToday; n++) {
        const at = new Date(day);
        if (dayOffset === 0) {
          // Today: spread the orders across the part of the day that has
          // already happened. Otherwise seeding at 6am would place every
          // ticket in the future and skip it, leaving an empty dashboard.
          const open = new Date(day);
          open.setHours(7, 0, 0, 0);
          const start = open > now ? new Date(now.getTime() - 90 * 60 * 1000) : open;
          const span = Math.max(0, now.getTime() - start.getTime());
          at.setTime(start.getTime() + rand() * span);
        } else {
          at.setHours(7 + Math.floor(rand() * 11), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
        }
        if (at > now) continue;

        const usesMember = rand() < 0.42;
        const memberId = usesMember ? pick(memberIds) : null;
        const customer = memberId === null ? pick(["Walk-in", "Walk-in", "Walk-in", "Counter guest", "Alex R.", "Sam T.", "Jordan"]) : null;

        const lineCount = 1 + Math.floor(rand() * 3);
        const lines: Array<{ id: number; name: string; qty: number; unit: number; total: number; opts: unknown[] }> = [];
        let subtotal = 0;

        for (let l = 0; l < lineCount; l++) {
          const name = pick(drinkNames);
          const id = itemIds.get(name);
          if (id === undefined) continue;
          const def = MENU[Object.keys(MENU).find((k) => MENU[k]!.some((m) => m.name === name)) ?? "espresso"]!.find((m) => m.name === name)!;
          const opts = optionsFor(
            Object.keys(MENU).find((k) => MENU[k]!.some((m) => m.name === name)) ?? "espresso",
            name,
          );
          const chosen = opts
            .filter((o) => o.group !== "Extras" || rand() < 0.28)
            .map((o) => ({ label: o.label, priceDeltaCents: o.delta }));
          const qty = 1 + (rand() < 0.18 ? 1 : 0);
          const unit = def.price + chosen.reduce((s, o) => s + o.priceDeltaCents, 0);
          const total = unit * qty;
          subtotal += total;
          lines.push({ id, name, qty, unit, total, opts: chosen });
        }

        if (lines.length === 0) continue;

        const tax = Math.round(subtotal * TAX_RATE);
        const total = subtotal + tax;
        const points = Math.floor(total / 100);

        let status: string;
        if (dayOffset === 0) {
          status = at.getHours() < 10 ? "completed" : pick(["received", "brewing", "ready", "completed", "completed"]);
        } else {
          status = rand() < 0.9 ? "completed" : "cancelled";
        }

        orderSeq += 1;
        const orderNumber = `E-${orderSeq}`;
        const r = insOrder.run(
          orderNumber,
          status,
          pick(CHANNELS),
          customer ?? "",
          memberId,
          tillPicks.length > 0 ? pick(tillPicks) : null,
          subtotal,
          tax,
          total,
          status === "cancelled" ? 0 : points,
          "",
          iso(at),
          iso(at),
        );
        const orderId = Number(r.lastInsertRowid);

        for (const l of lines) {
          insOrderItem.run(orderId, l.id, l.name, l.qty, l.unit, l.total, JSON.stringify(l.opts));
        }
        insEvent.run(orderId, "received", iso(at));
        if (status === "cancelled") insEvent.run(orderId, "cancelled", iso(at));
        else if (status === "brewing") { insEvent.run(orderId, "brewing", iso(at)); insEvent.run(orderId, "ready", iso(at)); }
        else if (status === "ready") { insEvent.run(orderId, "brewing", iso(at)); insEvent.run(orderId, "ready", iso(at)); }
        else { insEvent.run(orderId, "brewing", iso(at)); insEvent.run(orderId, "ready", iso(at)); insEvent.run(orderId, "completed", iso(at)); }

        if (memberId !== null && status !== "cancelled") {
          const bal = (memberBalance.get(memberId) ?? 0) + points;
          memberBalance.set(memberId, bal);
          insLoyalty.run(memberId, orderId, points, bal, "Order earned", iso(at));
          addPoints.run(points, memberId);
          lastVisit.set(memberId, iso(at));
        }
      }
    }

    for (const [id, at] of lastVisit) {
      db.prepare("UPDATE members SET last_visit_at = ? WHERE id = ?").run(at, id);
    }

    // --- customer self-orders
    //
    // One per state the tracking page can show, so a demo sign-in lands on a
    // page that does something rather than an empty state. The `pending` one is
    // deliberately unconfirmed: that is exactly what the cafe sees when nobody
    // has pressed the button yet, and its stock is still on the shelf.
    //
    // At most one live order per customer, because that is the only state the
    // app allows — one order in progress, so "confirm" is never ambiguous.
    // Each live state therefore gets its own account to sign in as.
    //
    // placed_by is NULL throughout — nobody rang these up.
    type SelfOrder = {
      username: string;
      item: string;
      qty: number;
      opts: string[];
      status: "pending" | "received" | "brewing" | "ready" | "completed" | "cancelled";
      minutesAgo: number;
      note?: string;
    };
    const selfOrders: SelfOrder[] = [
      { username: "ava", item: "Flat White", qty: 1, opts: ["Oat milk"], status: "pending", minutesAgo: 3, note: "Extra hot please" },
      { username: "sofia", item: "Cappuccino", qty: 1, opts: [], status: "received", minutesAgo: 5 },
      { username: "priya", item: "Cortado", qty: 2, opts: [], status: "brewing", minutesAgo: 6 },
      { username: "daniel", item: "Cold Brew", qty: 1, opts: ["Oat milk", "Extra shot"], status: "ready", minutesAgo: 14 },
      { username: "priya", item: "Cappuccino", qty: 1, opts: [], status: "completed", minutesAgo: 1500 },
      { username: "ava", item: "Espresso", qty: 1, opts: ["Extra shot"], status: "cancelled", minutesAgo: 2900 },
    ];

    const customerByName = new Map(USERS.map((u) => [u.username, u]));

    // Refuse to seed a state the app itself would not allow, rather than
    // quietly creating an order nobody can confirm.
    const liveSeen = new Set<string>();
    for (const so of selfOrders) {
      const closed = so.status === "completed" || so.status === "cancelled";
      if (!closed) {
        if (liveSeen.has(so.username)) {
          throw new Error(`seed: ${so.username} would have two live orders; the app allows one`);
        }
        liveSeen.add(so.username);
      }

      const userId = userIds.get(so.username);
      const memberIndex = MEMBERS.findIndex(
        (m) => m.email === customerByName.get(so.username)?.memberEmail,
      );
      const memberId = memberIndex >= 0 ? memberIds[memberIndex] : undefined;
      if (userId === undefined || memberId === undefined) continue;

      const slug = Object.keys(MENU).find((k) => MENU[k]!.some((m) => m.name === so.item));
      const itemId = slug ? itemIds.get(so.item) : undefined;
      const def = slug ? MENU[slug]!.find((m) => m.name === so.item) : undefined;
      if (itemId === undefined || !def || !slug) continue;

      // Price the chosen options the way the app would, so the demo totals are
      // what the real flow would produce.
      const allOpts = optionsFor(slug, so.item);
      const chosen = so.opts.map((label) => allOpts.find((o) => o.label === label)).filter((o) => o !== undefined);
      const unit = def.price + chosen.reduce((s, o) => s + o.delta, 0);
      const subtotal = unit * so.qty;
      const tax = Math.round(subtotal * TAX_RATE);
      const total = subtotal + tax;
      const points = Math.floor(total / 100);

      const at = new Date(now.getTime() - so.minutesAgo * 60_000);
      orderSeq += 1;
      const orderNumber = `E-${orderSeq}`;

      const r = insOrder.run(
        orderNumber,
        so.status,
        "self",
        customerByName.get(so.username)!.fullName,
        memberId,
        null,
        subtotal,
        tax,
        total,
        so.status === "cancelled" ? 0 : points,
        so.note ?? "",
        iso(at),
        iso(at),
      );
      const orderId = Number(r.lastInsertRowid);
      insOrderItem.run(
        orderId,
        itemId,
        so.item,
        so.qty,
        unit,
        subtotal,
        JSON.stringify(chosen.map((o) => ({ label: o.label, priceDeltaCents: o.delta }))),
      );

      // The event trail. `pending` and `completed` are the customer's two
      // moments; the steps between are the bar working through it.
      const trail =
        so.status === "cancelled"
          ? ["pending", "cancelled"]
          : so.status === "pending"
            ? ["pending"]
            : so.status === "received"
              ? ["pending", "received"]
              : so.status === "brewing"
                ? ["pending", "received", "brewing"]
                : so.status === "ready"
                  ? ["pending", "received", "brewing", "ready"]
                  : ["pending", "received", "brewing", "ready", "completed"];
      for (const [i, step] of trail.entries()) {
        const when = new Date(at.getTime() + i * 90_000).toISOString().slice(0, 19).replace("T", " ");
        insEvent.run(orderId, step, when);
        // `confirmed_at` is when the customer said yes, which is the moment the
        // order left `pending`. Everything after that is the bar's doing.
        if (step === "received") db.prepare("UPDATE orders SET confirmed_at = ? WHERE id = ?").run(when, orderId);
        if (step === "completed") db.prepare("UPDATE orders SET collected_at = ? WHERE id = ?").run(when, orderId);
      }

      // Only a collected order banks points, exactly as the action does.
      if (so.status === "completed") {
        const bal = (memberBalance.get(memberId) ?? 0) + points;
        memberBalance.set(memberId, bal);
        insLoyalty.run(memberId, orderId, points, bal, "Order collected", iso(at));
        addPoints.run(points, memberId);
        lastVisit.set(memberId, iso(at));
      }
    }

    // --- a draft restock order for the low items already on the shelves
    const lowSkus = ["MILK-OAT", "SYRUP-HAZ", "PASTRY-ALMOND", "LID-16", "BEAN-DECAF"];
    const insRestock = db.prepare(
      "INSERT INTO restock_orders (supplier, status, note) VALUES (?, 'draft', ?)",
    );
    const insRestockLine = db.prepare(
      "INSERT INTO restock_lines (restock_order_id, inventory_item_id, qty, unit_cost_cents) VALUES (?, ?, ?, ?)",
    );

    // One purchase order per supplier.
    const bySupplier = new Map<string, InvDef[]>();
    for (const sku of lowSkus) {
      const def = INVENTORY.find((i) => i.sku === sku);
      if (!def) continue;
      bySupplier.set(def.supplier, [...(bySupplier.get(def.supplier) ?? []), def]);
    }

    for (const [supplier, defs] of bySupplier) {
      const ro = insRestock.run(supplier, "Auto-generated from low stock alerts");
      const roId = Number(ro.lastInsertRowid);
      for (const def of defs) {
        const invId = invIds.get(def.sku);
        if (invId === undefined) continue;
        insRestockLine.run(roId, invId, def.reorderQty, def.unitCost);
      }
    }

    // --- a plausible audit trail, so the admin log and the staff sales
    // report are not staring at an empty screen on first run.
    const insLog = db.prepare(
      `INSERT INTO activity_log (user_id, username, action, entity, entity_id, detail, ip, at)
       VALUES (?, ?, ?, ?, ?, ?, 'local', ?)`,
    );
    const logEntries: Array<[string, string, string, string, string, string, number]> = [
      ["admin", "admin", "user.create", "user", "", "manager (Kai Mwangi) as Manager", 7 * 86400],
      ["admin", "admin", "user.create", "user", "", "barista (Noor Haddad) as Barista", 7 * 86400],
      ["admin", "admin", "user.create", "user", "", "cashier (Sami Okello) as Cashier", 7 * 86400],
      ["admin", "admin", "user.deactivate", "user", "", "eli deactivated; sessions revoked", 2 * 86400],
      ["admin", "admin", "user.soft_delete", "user", "", "juno archived — orders and log entries keep their name", 1 * 86400],
      ["manager", "manager", "settings.update", "settings", "", "Saved 5 setting(s): cafe_name, cafe_tagline, order_prefix, tax_rate, points_per_dollar", 5 * 86400],
      ["manager", "manager", "role.update", "role", "", "Barista: +2 / -0 permission(s) (loyalty.view, loyalty.redeem)", 4 * 86400],
      ["barista", "barista", "order.place", "order", "", "E-1042 · 2 line(s) · $14.20", 2 * 3600],
      ["cashier", "cashier", "order.place", "order", "", "E-1043 · 1 line(s) · $5.30", 95 * 60],
      ["barista", "barista", "stock.adjust", "inventory_item", "", "MILK-OAT Oat milk: +5000 — Delivery from Oatly", 80 * 60],
      ["manager", "manager", "stock.restock", "restock_order", "", "PO received from Nordic Pantry", 70 * 60],
      ["barista", "barista", "order.place", "order", "", "E-1044 · 3 line(s) · $18.75", 40 * 60],
      ["cashier", "cashier", "member.points", "member", "", "Amara Diallo: +250 pts (1820 total) — Goodwill correction", 25 * 60],
      ["admin", "admin", "auth.login_failed", "user", "", 'Wrong password for "manager"', 18 * 60],
      ["manager", "manager", "auth.login", "user", "", "Role: manager", 17 * 60],
      ["barista", "barista", "auth.login", "user", "", "Role: barista", 12 * 60],
      ["barista", "barista", "recipe.save", "recipe", "", "Adjusted grind on Cafe Latte", 8 * 60],
      ["cashier", "cashier", "auth.login", "user", "", "Role: cashier", 5 * 60],
      ["cashier", "cashier", "member.redeem", "member", "", "Tom Iverson redeemed Free pastry for 120 pts", 3 * 60],
    ];
    for (const [username, who, action, entity, entityId, detail, secondsAgo] of logEntries) {
      insLog.run(
        userIds.get(username) ?? null,
        who,
        action,
        entity,
        entityId,
        detail,
        iso(new Date(now.getTime() - secondsAgo * 1000)),
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

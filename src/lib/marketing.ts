/**
 * Editorial content for the public marketing site.
 *
 * This module imports nothing — not the database, not React — so it can be read
 * from server components and client components alike. Anything that lives in the
 * database (the live catalogue, prices) stays in `queries.ts`; this file is the
 * parts of the brand that a barista would not edit at the till: the story, the
 * tasting notes, the seasonal offers, the store list.
 */
import type { Route } from "next";

export type Roast = "Light" | "Medium" | "Medium-Dark" | "Dark" | "-";

export type CoffeeMeta = {
  roast: Roast;
  origin: string;
  notes: string;
};

/**
 * Tasting notes keyed by menu item name. The catalogue is deliberately small and
 * stable, so a name-keyed table is honest here: an item the shop renames simply
 * falls back to its category (see `coffeeMeta`).
 */
export const COFFEE_META: Record<string, CoffeeMeta> = {
  Espresso: { roast: "Medium-Dark", origin: "House blend", notes: "Cocoa, toasted hazelnut, brown sugar" },
  Macchiato: { roast: "Medium-Dark", origin: "House blend", notes: "Cocoa, malt, a spoon of foam" },
  Cortado: { roast: "Medium-Dark", origin: "House blend", notes: "Balanced, caramel, warm milk" },
  Cappuccino: { roast: "Medium-Dark", origin: "House blend", notes: "Round, chocolatey, airy foam" },
  "Flat White": { roast: "Medium-Dark", origin: "House blend", notes: "Ristretto, glossy microfoam, cocoa" },
  "Cafe Latte": { roast: "Medium-Dark", origin: "House blend", notes: "Silky, sweet, poured rosetta" },
  Americano: { roast: "Medium-Dark", origin: "House blend", notes: "Clean, bright, long finish" },
  Mocha: { roast: "Medium", origin: "House blend + single-origin chocolate", notes: "Chocolate, espresso, steamed milk" },
  "Pour Over": { roast: "Light", origin: "Ethiopia Yirgacheffe", notes: "Jasmine, bergamot, stone fruit" },
  "Cold Brew": { roast: "Medium", origin: "House blend", notes: "Smooth, low-acid, eighteen hours" },
  "French Press": { roast: "Medium", origin: "Colombia Huila", notes: "Red apple, caramel, full body" },
  "Iced Latte": { roast: "Medium-Dark", origin: "House blend", notes: "Cold milk, espresso, clean finish" },
  "Brown Butter Oat Latte": { roast: "Medium", origin: "House blend", notes: "Browned butter, oat, maple" },
  "Caramel Macchiato": { roast: "Medium", origin: "House blend", notes: "Vanilla, caramel, long espresso" },
  "Matcha Latte": { roast: "-", origin: "Uji, Japan", notes: "Ceremonial matcha, grassy, sweet" },
  "Vanilla Latte": { roast: "Medium", origin: "House blend", notes: "Madagascar vanilla, floral" },
  "Hazelnut Cortado": { roast: "Medium-Dark", origin: "House blend", notes: "Torrone hazelnut, cortado cut" },
  "House Blend 250g": { roast: "Medium-Dark", origin: "Brazil + Colombia", notes: "Chocolate, hazelnut" },
  "Ethiopia Yirgacheffe 250g": { roast: "Light", origin: "Ethiopia", notes: "Jasmine, bergamot, stone fruit" },
  "Colombia Huila 250g": { roast: "Medium", origin: "Colombia", notes: "Red apple, caramel, soft acidity" },
  "Decaf Blend 250g": { roast: "Medium", origin: "Colombia (Swiss water)", notes: "Cocoa, cane sugar, all the sweetness" },
};

const CATEGORY_DEFAULT: Record<string, CoffeeMeta> = {
  espresso: { roast: "Medium-Dark", origin: "House blend", notes: "Cocoa and toasted nut" },
  brewed: { roast: "Medium", origin: "Rotating single origin", notes: "Clean and seasonal" },
  signature: { roast: "Medium", origin: "House blend", notes: "House signatures" },
  pastry: { roast: "-", origin: "Baked in house", notes: "Butter, laminate, fruit" },
  retail: { roast: "-", origin: "Roasted weekly", notes: "Beans to take home" },
};

/** The roast, origin and tasting notes for an item, with a category fallback. */
export function coffeeMeta(item: { name: string; category_slug?: string }): CoffeeMeta {
  if (COFFEE_META[item.name]) return COFFEE_META[item.name]!;
  if (item.category_slug && CATEGORY_DEFAULT[item.category_slug]) {
    return CATEGORY_DEFAULT[item.category_slug]!;
  }
  return { roast: "-", origin: "-", notes: "" };
}

export const ALL_ROASTS: Roast[] = ["Light", "Medium", "Medium-Dark", "Dark"];

// ---------------------------------------------------------------
// Brand story
// ---------------------------------------------------------------

export const BRAND = {
  storyTitle: "Coffee with a conscience, roasted in small batches",
  storyBody:
    "Ermi began at a single counter with one drum roaster and a stubborn idea: pay the farm properly, roast in small batches, and let the cup speak for itself. Every blend is built around a short, named supply chain — the same growers, season after season.",
  storyBody2:
    "We source direct where we can and through trusted importers where we must, and we publish what we pay. Nothing is a mystery, from the farm gate to your flat white.",
};

export const VALUES: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "🌱",
    title: "Direct trade",
    body: "Long-term relationships with growers, and a published price that beats the commodity market.",
  },
  {
    icon: "🔥",
    title: "Roasted weekly",
    body: "Small-batch roasting means the beans in your bag are days old, not months.",
  },
  {
    icon: "♻️",
    title: "Low waste",
    body: "Compostable cups, spent grounds to local gardens, and a discount for your own mug.",
  },
];

export const PROCESS: Array<{ step: string; title: string; body: string }> = [
  { step: "01", title: "Sourced", body: "Green coffee bought direct from named farms and cooperatives." },
  { step: "02", title: "Roasted", body: "Profiled by hand in small batches, cupped before it ships." },
  { step: "03", title: "Brewed", body: "Ground to order against a spec recorded for every drink." },
  { step: "04", title: "Poured", body: "Served with a tasting note card so you know what you are drinking." },
];

export const SOURCING: Array<{ region: string; detail: string }> = [
  { region: "Ethiopia · Yirgacheffe", detail: "Washed heirloom lots, 1,900–2,100 m. Floral and bright." },
  { region: "Colombia · Huila", detail: "Smallholder co-ops, 1,700 m. Red apple and caramel." },
  { region: "Brazil · Cerrado", detail: "Natural-process, 1,100 m. The chocolate backbone of the house blend." },
  { region: "Kenya · Nyeri", detail: "Seasonal AA lots, 1,800 m. Blackcurrant and cane sugar." },
];

// ---------------------------------------------------------------
// Promotions & subscriptions
// ---------------------------------------------------------------

export type Promotion = {
  id: string;
  badge: string;
  title: string;
  blurb: string;
  detail: string;
  cta: string;
  href: Route;
  accent: string;
};

export const PROMOTIONS: Promotion[] = [
  {
    id: "autumn",
    badge: "Seasonal",
    title: "Autumn spice, back on the bar",
    blurb: "Brown butter, cinnamon and maple return for the cooler months.",
    detail:
      "The Brown Butter Oat Latte and a new Spiced Maple Cortado are on the menu through the season. Loyalty members earn double points on every seasonal drink.",
    cta: "See the seasonal menu",
    href: "/menu",
    accent: "from-amber-500/20 to-transparent",
  },
  {
    id: "beans",
    badge: "Beans to go",
    title: "Take the roastery home",
    blurb: "Freshly roasted bags from $18, ground how you like it.",
    detail:
      "Every bag is stamped with its roast date. Subscribe and we deliver on the same day each month, with a free drink on your birthday.",
    cta: "Browse the beans",
    href: "/menu",
    accent: "from-espresso-500/25 to-transparent",
  },
  {
    id: "bring-your-own",
    badge: "Every day",
    title: "25¢ off for your own cup",
    blurb: "Bring a reusable cup and we knock a little off every drink.",
    detail:
      "No card, no app needed — just a clean cup at the counter. It adds up, and it keeps a disposable out of the bin.",
    cta: "How loyalty works",
    href: "/promotions/rewards",
    accent: "from-emerald-500/20 to-transparent",
  },
];

export type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  featured?: boolean;
};

export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: "casual",
    name: "The Casual",
    price: "$18",
    cadence: "/ month",
    description: "One 250 g bag of the House Blend, every month.",
    features: [
      "250 g roasted-to-order beans",
      "Ground how you brew, or whole bean",
      "Free drink on your birthday",
      "Cancel any time",
    ],
  },
  {
    id: "regular",
    name: "The Regular",
    price: "$34",
    cadence: "/ month",
    description: "Two bags a month, with a rotating single origin.",
    features: [
      "Two 250 g bags, one house and one single origin",
      "Tasting note card for each lot",
      "10% off everything at the counter",
      "First refusal on micro-lots",
    ],
    featured: true,
  },
  {
    id: "roastery",
    name: "The Roastery",
    price: "$62",
    cadence: "/ month",
    description: "For the home bar that never wants to run dry.",
    features: [
      "Three 250 g bags, including rare micro-lots",
      "A different origin every month",
      "15% off everything at the counter",
      "Free local delivery",
    ],
  },
];

export type RewardTier = {
  name: string;
  min: string;
  perks: string[];
  tone: string;
};

export const REWARD_TIERS: RewardTier[] = [
  {
    name: "Bronze",
    min: "0+ points",
    perks: ["1 point per dollar", "Birthday drink", "Member-only offers"],
    tone: "ring-amber-700/40",
  },
  {
    name: "Silver",
    min: "300+ points",
    perks: ["Everything in Bronze", "Free size upgrade once a month", "Early access to seasonal drinks"],
    tone: "ring-slate-400/50",
  },
  {
    name: "Gold",
    min: "900+ points",
    perks: ["Everything in Silver", "A free drink every 10th visit", "Invitations to cupping nights"],
    tone: "ring-yellow-500/60",
  },
];

export const REWARD_STEPS: Array<{ step: string; title: string; body: string }> = [
  { step: "01", title: "Join free", body: "Create an account in the app or the web portal — no card required." },
  { step: "02", title: "Order as usual", body: "Scan at the counter or order ahead. Points land on your account." },
  { step: "03", title: "Earn 1 point per dollar", body: "Every dollar you spend adds a point to your running balance." },
  { step: "04", title: "Redeem rewards", body: "Trade points for drinks, merchandise and upgrades in the app." },
];

// ---------------------------------------------------------------
// Locations
// ---------------------------------------------------------------

export type Location = {
  name: string;
  address: string;
  area: string;
  hours: string;
  note: string;
  mapQuery: string;
};

export const LOCATIONS: Location[] = [
  {
    name: "Ermi Roastery & Bar",
    address: "14 Kiln Lane",
    area: "Old Quarter",
    hours: "Mon–Fri 7:00–18:00 · Sat–Sun 8:00–17:00",
    note: "The original counter and the drum roaster. Cupping nights on Thursdays.",
    mapQuery: "coffee+roastery+old+quarter",
  },
  {
    name: "Ermi on the Park",
    address: "2 Market Row",
    area: "Riverside",
    hours: "Daily 7:30–19:00",
    note: "Largest seating, all-day pastries, and the cold brew tap.",
    mapQuery: "coffee+market+row+riverside",
  },
  {
    name: "Ermi Kiosk",
    address: "Station Concourse",
    area: "Central",
    hours: "Mon–Fri 6:30–16:00",
    note: "Grab-and-go espresso and pre-ordered pickup. No seating.",
    mapQuery: "coffee+kiosk+station+concourse",
  },
];

// ---------------------------------------------------------------
// Testimonials & app
// ---------------------------------------------------------------

export const TESTIMONIALS: Array<{ quote: string; name: string; role: string }> = [
  {
    quote: "The Brown Butter Oat Latte ruined every other coffee for me. I come back for it weekly.",
    name: "Ava Mitchell",
    role: "Regular since 2023",
  },
  {
    quote: "Ordering ahead in the app means my flat white is ready before I've crossed the road.",
    name: "Daniel Okafor",
    role: "Commuter",
  },
  {
    quote: "You can taste that the beans are fresh. The roast date on the bag says everything.",
    name: "Sofia Bianchi",
    role: "Home barista",
  },
];

export const APP_FEATURES: Array<{ icon: string; title: string; body: string }> = [
  { icon: "🛍️", title: "Order ahead", body: "Pick a pickup time and skip the queue." },
  { icon: "🎁", title: "Loyalty & rewards", body: "Watch points grow and redeem as you go." },
  { icon: "☕", title: "Your usual", body: "Reorder past drinks in a single tap." },
  { icon: "🔔", title: "Order updates", body: "Know the moment your cup is ready." },
];

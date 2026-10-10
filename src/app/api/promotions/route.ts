import { json } from "@/lib/api";
import { PROMOTIONS, REWARD_TIERS, SUBSCRIPTION_PLANS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/** Seasonal offers, subscription plans and the loyalty tiers. */
export async function GET(): Promise<Response> {
  return json({
    promotions: PROMOTIONS.map((p) => ({
      id: p.id,
      badge: p.badge,
      title: p.title,
      blurb: p.blurb,
      detail: p.detail,
      cta: p.cta,
      href: String(p.href),
    })),
    subscriptionPlans: SUBSCRIPTION_PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      cadence: p.cadence,
      description: p.description,
      features: p.features,
      featured: p.featured === true,
    })),
    rewardTiers: REWARD_TIERS.map((t) => ({ name: t.name, min: t.min, perks: t.perks })),
  });
}

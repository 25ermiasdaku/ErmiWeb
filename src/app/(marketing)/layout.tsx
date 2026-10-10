import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Ermi Coffee — Roastery & counter",
    template: "%s · Ermi Coffee",
  },
  description:
    "Small-batch, direct-trade coffee. Explore the menu, earn rewards on every cup, and order ahead on the web or in the app.",
};

/**
 * The public shell: header, footer, no session. It sits in its own route group
 * so the signed-in app shell (with the sidebar) stays untouched, and the two
 * can restyle independently.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cafeName = getSetting("cafe_name") || "Ermi Coffee";
  const tagline = getSetting("cafe_tagline") || "Roastery & counter";

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader cafeName={cafeName} />
      <main className="flex-1">{children}</main>
      <SiteFooter cafeName={cafeName} tagline={tagline} />
    </div>
  );
}

import { getMenu, getMembers, getRewards } from "@/lib/queries";
import { Pos } from "@/components/pos";
import { gate } from "@/lib/auth";
import { getPointsPerDollar, getTaxRate } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { user, denied } = await gate("pos.use");
  if (denied) return denied;

  // Read the live rates so the till's maths matches what an owner set.
  return (
    <Pos
      menu={getMenu()}
      members={getMembers()}
      rewards={getRewards()}
      taxRate={getTaxRate()}
      pointsPerDollar={getPointsPerDollar()}
      canManageMenu={user!.permissions.has("menu.manage")}
      canSell={user!.permissions.has("orders.create")}
    />
  );
}

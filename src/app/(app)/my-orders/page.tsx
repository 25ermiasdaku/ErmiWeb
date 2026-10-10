import { MyCoffee } from "@/components/my-coffee";
import { gate } from "@/lib/auth";
import { getMenu } from "@/lib/queries";
import { getPointsPerDollar, getTaxRate } from "@/lib/settings";
import { getLiveMyOrder, getMyMember, getMyOrders, getMyRewards } from "@/lib/my-order";

export const dynamic = "force-dynamic";

/**
 * Order a coffee on your own account.
 *
 * Reachable by every role, not just `customer` — the permission is
 * "order for yourself", and a member of staff on a break is allowed to use it
 * too. What they do not get is the till, the board or the stock book; those
 * still need their own permissions.
 */
export default async function MyOrdersPage() {
  const { user, denied } = await gate("orders.self");
  if (denied) return denied;

  const me = user!;

  return (
    <MyCoffee
      name={me.full_name}
      menu={getMenu()}
      member={getMyMember(me.id)}
      rewards={getMyRewards()}
      live={getLiveMyOrder(me.id)}
      history={getMyOrders(me.id)}
      taxRate={getTaxRate()}
      pointsPerDollar={getPointsPerDollar()}
    />
  );
}

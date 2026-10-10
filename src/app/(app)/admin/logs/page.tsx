import { Suspense } from "react";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ActivityFilters, ActivityTable } from "@/components/activity-log";
import { PurgeSessions } from "@/components/admin-widgets";
import { gate } from "@/lib/auth";
import { getActivity, getActivityActions, getActivityCounts, getUsers } from "@/lib/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; user?: string; search?: string }>;
}) {
  const { denied } = await gate("logs.view");
  if (denied) return denied;

  const params = await searchParams;
  const action = params.action ?? "all";
  const userId = Number(params.user ?? 0);
  const search = (params.search ?? "").slice(0, 80);

  const rows = getActivity({
    action,
    userId: userId || undefined,
    search: search || undefined,
    limit: 200,
  });
  const actions = getActivityActions();
  const counts = getActivityCounts();

  // Only offer people who appear in the log, so the filter is not a user
  // directory in disguise.
  const seen = new Map<number, { id: number; username: string; full_name: string }>();
  for (const u of getUsers()) {
    if (rows.some((r) => r.username === u.username)) {
      seen.set(u.id, { id: u.id, username: u.username, full_name: u.full_name });
    }
  }
  const people = [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));

  const filtered = action !== "all" || userId || search;

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Every state change, written by the server action that made it. Entries are never edited or removed."
        actions={<PurgeSessions />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entries" value={counts.total.toLocaleString()} hint="Since the system started" />
        <Stat label="Last 24 hours" value={counts.last24h.toLocaleString()} hint="Anything at all" />
        <Stat
          label="Failed sign-ins"
          value={counts.failures.toLocaleString()}
          tone={counts.failures > 0 ? "warn" : "good"}
          hint="Last 24 hours — wrong passwords only"
        />
        <Stat
          label="Showing"
          value={rows.length}
          hint={filtered ? "Matching the filters" : "Most recent 200"}
        />
      </div>

      <Card
        className="mb-4"
        title="Filters"
        bodyClassName="p-3"
        subtitle="Narrow by action, by person, or by free text across the detail."
      >
        <Suspense fallback={<div className="h-9" />}>
          <ActivityFilters
            actions={actions}
            users={people}
            current={{ action, userId: params.user ?? "", search }}
          />
        </Suspense>
      </Card>

      <Card
        title={filtered ? "Matching entries" : "Latest entries"}
        subtitle={`${rows.length} row${rows.length === 1 ? "" : "s"}. Timestamps are UTC.`}
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon="≡"
            title="Nothing matches"
            hint={filtered ? "Try a different action or clear the search." : "No activity recorded yet."}
          />
        ) : (
          <ActivityTable rows={rows} />
        )}
      </Card>

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">What gets written here</h2>
        <ul className="mt-2 grid gap-1.5 text-[0.8125rem] muted sm:grid-cols-2">
          <li>Sign-ins, sign-outs and every failed password attempt, with the source IP.</li>
          <li>Orders rung up and moved along, including cancellations.</li>
          <li>Stock corrections, reorder level changes and purchase orders.</li>
          <li>Loyalty adjustments and redemptions.</li>
          <li>Menu items taken off the till, and brew spec edits.</li>
          <li>
            Account and role changes: who was created, edited, archived, erased, or had their
            permissions rewritten.
          </li>
        </ul>
        <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          Erasing an account keeps its username in the rows above — only the link to the account is
          dropped — so the trail stays readable.
        </p>
      </section>
    </>
  );
}

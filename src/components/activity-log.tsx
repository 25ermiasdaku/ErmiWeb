"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { actionLabel } from "@/lib/activity-labels";
import { dateTime } from "@/lib/format";

type Row = {
  id: number;
  username: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  ip: string;
  at: string;
};

export function ActivityFilters({
  actions,
  users,
  current,
}: {
  actions: string[];
  users: Array<{ id: number; username: string; full_name: string }>;
  current: { action: string; userId: string; search: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(current.search);

  // Debounce the free-text box so every keystroke is not a server round trip.
  useEffect(() => {
    if (search === current.search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      router.replace(`/admin/logs?${next.toString()}`);
    }, 350);
    return () => clearTimeout(id);
  }, [search, current.search, params, router]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    router.replace(`/admin/logs?${next.toString()}`);
  }

  const dirty = current.search || current.action !== "all" || current.userId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="field max-w-[16rem] flex-1"
        placeholder="Search username, detail or action…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search the activity log"
      />

      <select
        className="field max-w-[13rem]"
        value={current.action}
        onChange={(e) => setParam("action", e.target.value)}
        aria-label="Filter by action"
      >
        <option value="all">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {actionLabel(a)}
          </option>
        ))}
      </select>

      <select
        className="field max-w-[13rem]"
        value={current.userId}
        onChange={(e) => setParam("user", e.target.value)}
        aria-label="Filter by person"
      >
        <option value="all">Everyone</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </select>

      {dirty && (
        <button className="btn" onClick={() => router.replace("/admin/logs")}>
          Clear
        </button>
      )}
    </div>
  );
}

export function ActivityTable({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
          <span
            className="num w-44 shrink-0 text-[0.6875rem]"
            style={{ color: "var(--text-faint)" }}
            title={a.at}
          >
            {dateTime(a.at)}
          </span>
          <span className="w-32 shrink-0 truncate text-[0.8125rem] font-medium">{a.username || "—"}</span>
          <span className="w-40 shrink-0 text-[0.8125rem]" style={{ color: "var(--brand)" }}>
            {actionLabel(a.action)}
          </span>
          <span className="min-w-0 flex-1 text-[0.75rem] muted">
            {a.detail || <span style={{ color: "var(--text-faint)" }}>—</span>}
          </span>
          {a.ip && (
            <span className="num shrink-0 text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
              {a.ip}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

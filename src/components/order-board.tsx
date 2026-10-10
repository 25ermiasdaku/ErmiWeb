"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setOrderStatus } from "@/lib/actions";
import { clockTime, money, timeAgo } from "@/lib/format";
import { ALLOWED_NEXT, customerNext, isCustomerTransition } from "@/lib/order-flow";
import { STATUS_META, type Order, type OrderStatus } from "@/lib/types";

type Column = { status: OrderStatus; orders: Order[] };

export function OrderBoard({ columns, canManage = false }: { columns: Column[]; canManage?: boolean }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  // Poll on an interval rather than fetching, so the server component
  // tree re-renders with fresh data.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [live, router]);

  if (columns.every((c) => c.orders.length === 0)) {
    return (
      <div className="card">
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="text-3xl opacity-40" aria-hidden>
            ✓
          </span>
          <p className="text-sm font-medium">The board is clear</p>
          <p className="max-w-sm text-xs faint">
            New tickets from the Point of Sale appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {columns.map((col) => {
        const meta = STATUS_META[col.status];
        const total = col.orders.reduce((s, o) => s + o.total_cents, 0);

        return (
          <section key={col.status} className="flex flex-col">
            <header
              className="flex items-center justify-between gap-2 rounded-t-xl border border-b-0 px-3 py-2"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
                <span
                  className="num rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold"
                  style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-muted)" }}
                >
                  {col.orders.length}
                </span>
              </span>
              <span className="num text-[0.6875rem] faint">{money(total)}</span>
            </header>

            <div
              className="flex min-h-[7rem] flex-1 flex-col gap-2.5 rounded-b-xl border-t-0 p-2.5"
              style={{ backgroundColor: "var(--surface-sunken)" }}
            >
              {col.orders.length === 0 ? (
                <p className="py-6 text-center text-[0.75rem] faint">Empty</p>
              ) : (
                col.orders.map((o) => <Ticket key={o.id} order={o} canManage={canManage} />)
              )}
            </div>
          </section>
        );
      })}

      <div className="lg:col-span-3">
        <AutoRefresh live={live} onToggle={() => setLive((v) => !v)} />
      </div>
    </div>
  );
}

function Ticket({ order, canManage }: { order: Order; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Steps the bar takes itself. A customer's two confirmations are excluded:
  // the server refuses them, so the button must not pretend otherwise.
  const next = ALLOWED_NEXT[order.status].filter(
    (s) => s !== "cancelled" && !isCustomerTransition(order.status, s),
  );
  const waitingOnCustomer = customerNext(order.status) !== null;

  function advance(status: OrderStatus) {
    startTransition(async () => {
      await setOrderStatus(order.id, status);
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      await setOrderStatus(order.id, "cancelled");
      router.refresh();
    });
  }

  return (
    <article className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="num text-[0.8125rem] font-semibold">{order.order_number}</p>
          <p className="truncate text-[0.6875rem] muted">
            {order.member_name ?? order.customer_name}
            <span className="capitalize"> · {order.channel}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[0.8125rem] font-semibold">{money(order.total_cents)}</p>
          <p className="num text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
            {clockTime(order.created_at)} · {timeAgo(order.created_at)}
          </p>
        </div>
      </div>

      <ul className="mt-2 space-y-1.5">
        {order.items?.map((i) => {
          const opts = safeParse(i.options_json);
          return (
            <li key={i.id} className="text-[0.75rem]">
              <span className="num font-semibold">{i.qty}×</span>{" "}
              <span>{i.name_snapshot}</span>
              {opts.length > 0 && (
                <span className="block pl-5 text-[0.6875rem] faint">{opts.join(" · ")}</span>
              )}
            </li>
          );
        })}
      </ul>

      {order.note && (
        <p
          className="mt-2 rounded-md px-2 py-1 text-[0.6875rem]"
          style={{ backgroundColor: "var(--brand-soft)", color: "var(--text-muted)" }}
        >
          {order.note}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        {canManage ? (
          <>
            {next.map((s) => (
              <button
                key={s}
                className={`btn flex-1 ${s === "completed" ? "btn-primary" : ""}`}
                disabled={pending}
                onClick={() => advance(s)}
              >
                {pending ? "…" : STATUS_META[s].label}
              </button>
            ))}
            <button
              className="btn px-2"
              disabled={pending}
              onClick={cancel}
              title={
                order.status === "pending"
                  ? "Cancel — nothing has been taken off the shelf yet"
                  : "Cancel and return stock"
              }
              aria-label={`Cancel ${order.order_number}`}
            >
              ✕
            </button>
          </>
        ) : (
          <p className="text-[0.6875rem] faint">
            Read only — moving tickets along needs the &quot;Move orders along&quot; permission.
          </p>
        )}
      </div>

      {waitingOnCustomer && order.channel === "self" && (
        <p
          className="mt-2 rounded-md px-2 py-1 text-[0.6875rem]"
          style={{ backgroundColor: "var(--brand-soft)", color: "var(--text-muted)" }}
        >
          {STATUS_META[order.status].customerPrompt}
        </p>
      )}
    </article>
  );
}

function AutoRefresh({ live, onToggle }: { live: boolean; onToggle: () => void }) {
  return (
    <button
      className="btn mx-auto flex"
      onClick={onToggle}
      title={live ? "The board refreshes every 15 seconds" : "Turn on live refresh"}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: live ? "rgb(16 185 129)" : "var(--text-faint)" }}
      />
      {live ? "Live · refreshing every 15s" : "Enable live refresh"}
    </button>
  );
}

function safeParse(json: string): string[] {
  try {
    return (JSON.parse(json || "[]") as Array<{ label: string }>).map((o) => o.label);
  } catch {
    return [];
  }
}

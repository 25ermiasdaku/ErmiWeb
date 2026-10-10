"use client";

import { useRouter } from "next/navigation";
import { ToggleActiveButton, UnlockButton, RevokeSessionsButton, RestoreUserButton } from "./admin-widgets";
import { EditUserForm, EraseUserForm, ResetPasswordForm, SoftDeleteForm } from "./user-forms";
import { dateTime, pluralize, timeAgo } from "@/lib/format";
import { isLocked, lockoutMinutes } from "@/lib/lockout";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  job_title: string;
  is_active: number;
  deleted_at: string | null;
  must_change_password: number;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  role_id: number;
  role_name: string;
  role_slug: string;
  session_count: number;
  orders_placed: number;
};

export type Panel = "edit" | "password" | "archive" | "erase" | null;

export function UserList({
  users,
  archived,
  roles,
  selfId,
  canEdit,
  canDelete,
  openPanel,
  openId,
}: {
  users: UserRow[];
  archived: UserRow[];
  roles: Array<{ id: number; name: string; slug: string }>;
  selfId: number;
  canEdit: boolean;
  canDelete: boolean;
  openPanel: Panel;
  openId: number;
}) {
  const router = useRouter();

  // After an inline form saves, drop the panel from the URL so it collapses.
  function close() {
    router.replace("/admin/users");
  }

  return (
    <div className="space-y-2">
      {users.map((u) => {
        const locked = isLocked(u);
        const expanded = openPanel !== null && openId === u.id;
        const isSelf = u.id === selfId;

        return (
          <article key={u.id} className="card overflow-hidden" style={isSelf ? { borderColor: "var(--brand)" } : undefined}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[0.875rem] font-semibold">
                  {u.full_name}
                  {isSelf && (
                    <span className="chip" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
                      you
                    </span>
                  )}
                  {u.must_change_password === 1 && (
                    <span className="chip bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
                      temp password
                    </span>
                  )}
                  {locked && (
                    <span
                      className="chip bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300"
                      title={`${u.failed_logins} failed sign-ins`}
                    >
                      locked {lockoutMinutes(u)}m
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  <code className="font-mono">{u.username}</code> · {u.email}
                  {u.job_title ? ` · ${u.job_title}` : ""}
                </p>
              </div>

              <span className="chip shrink-0 ring-1 ring-inset" style={{ backgroundColor: "var(--surface-sunken)" }}>
                {u.role_name}
              </span>

              <span
                className={`chip shrink-0 ring-1 ring-inset ${
                  u.is_active === 1
                    ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                    : "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300"
                }`}
              >
                {u.is_active === 1 ? "active" : "switched off"}
              </span>

              <div className="shrink-0 text-right text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                <p className="num">
                  {pluralize(u.orders_placed, "order")} · {pluralize(u.session_count, "session")}
                </p>
                <p>
                  {u.last_login_at ? `seen ${timeAgo(u.last_login_at)}` : `joined ${dateTime(u.created_at)}`}
                </p>
              </div>

              {canEdit && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <ToggleActiveButton userId={u.id} active={u.is_active === 1} self={isSelf} />
                  {locked && <UnlockButton userId={u.id} />}
                  {u.session_count > 0 && !isSelf && <RevokeSessionsButton userId={u.id} />}

                  <PanelLink panel="edit" id={u.id} label="Edit" />
                  <PanelLink panel="password" id={u.id} label="Password" />
                  {canDelete && !isSelf && <PanelLink panel="archive" id={u.id} label="Archive" />}
                  {canDelete && !isSelf && (
                    <PanelLink panel="erase" id={u.id} label="Erase" tone="rose" />
                  )}
                </div>
              )}
            </div>

            {expanded && openPanel === "edit" && canEdit && (
              <EditUserForm user={u} roles={roles} onDone={close} />
            )}
            {expanded && openPanel === "password" && canEdit && (
              <ResetPasswordForm user={u} onDone={close} />
            )}
            {expanded && openPanel === "archive" && canDelete && !isSelf && (
              <SoftDeleteForm user={u} onDone={close} />
            )}
            {expanded && openPanel === "erase" && canDelete && !isSelf && (
              <EraseUserForm user={u} onDone={close} />
            )}
          </article>
        );
      })}

      {archived.map((u) => (
        <article key={u.id} className="card overflow-hidden opacity-80">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[12rem] flex-1">
              <p className="text-[0.875rem] font-semibold">
                {u.full_name}{" "}
                <code className="font-mono text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {u.username}
                </code>
              </p>
              <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                {u.role_name} · archived {timeAgo(u.deleted_at ?? u.created_at)} ·{" "}
                {pluralize(u.orders_placed, "order")} on the books
              </p>
            </div>
            {canDelete && <RestoreUserButton userId={u.id} username={u.username} />}
          </div>
        </article>
      ))}
    </div>
  );
}

function PanelLink({
  panel,
  id,
  label,
  tone,
}: {
  panel: Exclude<Panel, null>;
  id: number;
  label: string;
  tone?: "rose";
}) {
  return (
    <a
      href={`/admin/users?panel=${panel}&id=${id}`}
      className={`btn px-2 py-1 ${tone === "rose" ? "text-rose-700 dark:text-rose-300" : ""}`}
    >
      {label}
    </a>
  );
}

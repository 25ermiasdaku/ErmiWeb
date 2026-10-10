"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteRoleAction, updateRolePermissionsAction } from "@/lib/admin-actions";
import { useActionState } from "react";
import { EMPTY_STATE } from "@/lib/action-state";
import { PERMISSIONS, type PermissionDef } from "@/lib/permissions";
import { FormMessage, PermissionCheckbox } from "./form-parts";

export type RoleRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_system: number;
  user_count: number;
  permission_count: number;
};

/** Permissions an owner role may never lose, whatever the checkbox says. */
const OWNER_ESSENTIAL = ["roles.manage", "users.delete", "admin.access"];

function isEssential(key: string): boolean {
  return OWNER_ESSENTIAL.includes(key);
}

function byCategory(perms: PermissionDef[]): Array<[string, PermissionDef[]]> {
  const out: Array<[string, PermissionDef[]]> = [];
  for (const p of perms) {
    const last = out[out.length - 1];
    if (last && last[0] === p.category) last[1].push(p);
    else out.push([p.category, [p]]);
  }
  return out;
}

const CATEGORIES = byCategory(PERMISSIONS);

export function RoleMatrix({
  roles,
  initial,
  selfRoleSlug,
  canEdit,
}: {
  roles: RoleRow[];
  /** role id -> granted permission keys, flattened for the client boundary. */
  initial: Record<number, string[]>;
  selfRoleSlug: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const firstId = roles[0]?.id ?? 0;
  const [selectedId, setSelectedId] = useState<number>(firstId);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(initial[firstId] ?? []));
  const [saved, setSaved] = useState<Set<string> | null>(null);
  const [pending, startTransition] = useTransition();
  const [reply, setReply] = useState<{ ok: boolean; message: string } | null>(null);

  const role = roles.find((r) => r.id === selectedId);
  const isOwner = role?.slug === "owner";

  // Effective ticks: the draft, with the owner's essentials forced on so the UI
  // never shows a state the server would reject.
  const ticked = useMemo(() => {
    const out = new Set(draft);
    if (isOwner) for (const k of OWNER_ESSENTIAL) out.add(k);
    return out;
  }, [draft, isOwner]);

  const dirty = !saved && !sameSet(ticked, new Set(initial[selectedId] ?? []));

  function select(id: number) {
    setSelectedId(id);
    setDraft(new Set(initial[id] ?? []));
    setSaved(null);
    setReply(null);
  }

  function toggle(key: string, on: boolean) {
    setSaved(null);
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function setAll(on: boolean) {
    setSaved(null);
    setDraft(on ? new Set(PERMISSIONS.map((p) => p.key)) : new Set(isOwner ? OWNER_ESSENTIAL : []));
  }

  function save() {
    if (!role) return;
    const keys = [...ticked];
    startTransition(async () => {
      const result = await updateRolePermissionsAction(role.id, keys);
      setReply(result);
      if (result.ok) setSaved(new Set(keys));
      router.refresh();
      setTimeout(() => setReply(null), 5000);
    });
  }

  if (!role) return <p className="text-[0.8125rem] muted">No roles defined yet.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Role list */}
      <nav className="space-y-1" aria-label="Roles">
        {roles.map((r) => {
          const active = r.id === selectedId;
          return (
            <button
              key={r.id}
              onClick={() => select(r.id)}
              className="block w-full rounded-lg px-3 py-2 text-left transition-colors"
              style={{
                backgroundColor: active ? "var(--brand-soft)" : "transparent",
                color: active ? "var(--brand)" : undefined,
              }}
              aria-current={active ? "true" : undefined}
            >
              <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                {r.name}
                {r.is_system === 1 && (
                  <span
                    className="chip ring-1 ring-inset"
                    style={{ backgroundColor: "var(--surface-sunken)", borderColor: "transparent" }}
                  >
                    system
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                {r.permission_count} permission{r.permission_count === 1 ? "" : "s"} ·{" "}
                {r.user_count} user{r.user_count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Matrix */}
      <div className="card overflow-hidden">
        <header
          className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              {role.name}
              {role.slug === selfRoleSlug && (
                <span
                  className="chip ml-1.5"
                  style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  your role
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-[0.75rem] muted">{role.description}</p>
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <button className="btn px-2 py-1" onClick={() => setAll(true)} disabled={pending}>
                Select all
              </button>
              <button className="btn px-2 py-1" onClick={() => setAll(false)} disabled={pending}>
                Clear
              </button>
              <button
                className="btn btn-primary px-3 py-1"
                onClick={save}
                disabled={pending || !dirty}
                title={dirty ? "Save and sign out everyone holding this role" : "No changes to save"}
              >
                {pending ? "Saving…" : dirty ? `Save ${ticked.size}` : "Saved"}
              </button>
            </div>
          )}
        </header>

        {!canEdit && (
          <p className="px-4 py-2 text-[0.75rem] muted">
            Read only — changing what a role can do needs the{" "}
            <code className="font-mono">roles.manage</code> permission.
          </p>
        )}

        {reply && (
          <div className="px-4 pt-3">
            <p
              className={`rounded-lg px-3 py-2 text-[0.8125rem] font-medium ring-1 ring-inset ${
                reply.ok
                  ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-800 ring-rose-500/25 dark:text-rose-300"
              }`}
              role="status"
            >
              {reply.message}
            </p>
          </div>
        )}

        <div className="divide-y">
          {CATEGORIES.map(([category, list]) => {
            const granted = list.filter((p) => ticked.has(p.key)).length;
            return (
              <section key={category} className="px-4 py-3">
                <header className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3
                    className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {category}
                  </h3>
                  <span
                    className="num text-[0.6875rem]"
                    style={{ color: granted === list.length ? "var(--brand)" : "var(--text-faint)" }}
                  >
                    {granted}/{list.length}
                  </span>
                </header>
                <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((p) => (
                    <PermissionRow
                      key={p.key}
                      permission={p}
                      checked={ticked.has(p.key)}
                      locked={!canEdit || (isOwner && isEssential(p.key))}
                      onChange={toggle}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {canEdit && (
          <footer
            className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-[0.75rem] muted"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span>
              Saving signs out everyone holding this role so their permissions take effect on the
              next sign-in.
            </span>
            <DeleteRoleButton role={role} />
          </footer>
        )}
      </div>
    </div>
  );
}

function PermissionRow({
  permission,
  checked,
  locked,
  onChange,
}: {
  permission: PermissionDef;
  checked: boolean;
  locked: boolean;
  onChange: (key: string, on: boolean) => void;
}) {
  return (
    <PermissionCheckbox
      name={`perm_${permission.key}`}
      label={permission.label}
      description={permission.description}
      defaultChecked={checked}
      disabled={locked}
      locked={locked}
    />
  );
}

/** System roles can never be deleted, and neither can a role with holders. */
function DeleteRoleButton({ role }: { role: RoleRow }) {
  const [state, formAction, pending] = useActionState(deleteRoleAction, EMPTY_STATE);

  if (role.is_system === 1) {
    return (
      <span className="ml-auto text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
        System roles cannot be deleted — they come back on every seed.
      </span>
    );
  }
  if (role.user_count > 0) {
    return (
      <span className="ml-auto text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
        Move the {role.user_count} user{role.user_count === 1 ? "" : "s"} on this role first.
      </span>
    );
  }

  return (
    <form action={formAction} className="ml-auto">
      <input type="hidden" name="role_id" value={role.id} />
      <button
        className="btn px-2 py-1 text-rose-700 dark:text-rose-300"
        disabled={pending}
        title={`Delete the role "${role.name}"`}
      >
        {pending ? "Deleting…" : "Delete role"}
      </button>
      {state.message && (
        <span className="ml-2 text-[0.6875rem] text-rose-600 dark:text-rose-400">{state.message}</span>
      )}
    </form>
  );
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

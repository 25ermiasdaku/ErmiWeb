"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  purgeExpiredSessionsAction,
  restoreUserAction,
  revokeUserSessionsAction,
  setUserActiveAction,
  unlockUserAction,
} from "@/lib/admin-actions";

/** Button that calls a plain (non-FormData) server action and shows the reply. */
export function ActionButton({
  action,
  idle,
  pending: pendingLabel,
  title,
  className = "btn",
  confirm,
}: {
  action: () => Promise<{ ok: boolean; message: string }>;
  idle: string;
  pending: string;
  title?: string;
  className?: string;
  /** Shown in a confirm() before the action runs. */
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reply, setReply] = useState<{ ok: boolean; message: string } | null>(null);

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      try {
        setReply(await action());
      } catch (error) {
        setReply({ ok: false, message: error instanceof Error ? error.message : "That did not work." });
      }
      router.refresh();
      setTimeout(() => setReply(null), 4000);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={className} onClick={run} disabled={pending} title={title}>
        {pending ? pendingLabel : idle}
      </button>
      {reply && (
        <span
          className="text-[0.6875rem] font-medium"
          style={{ color: reply.ok ? "rgb(5 150 105)" : "rgb(225 29 72)" }}
          role="status"
        >
          {reply.message}
        </span>
      )}
    </span>
  );
}

export function ToggleActiveButton({
  userId,
  active,
  self,
}: {
  userId: number;
  active: boolean;
  self: boolean;
}) {
  if (self) {
    return (
      <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
        you
      </span>
    );
  }
  return (
    <ActionButton
      className="btn px-2 py-1"
      idle={active ? "Switch off" : "Switch on"}
      pending="…"
      action={() => setUserActiveAction(userId, !active)}
      title={
        active
          ? "Deactivate: blocks sign-in and revokes live sessions. History is kept."
          : "Reactivate this account"
      }
    />
  );
}

export function UnlockButton({ userId }: { userId: number }) {
  return (
    <ActionButton
      className="btn px-2 py-1"
      idle="Unlock"
      pending="…"
      action={() => unlockUserAction(userId)}
      title="Clear the failed-password lockout"
    />
  );
}

export function RevokeSessionsButton({ userId }: { userId: number }) {
  return (
    <ActionButton
      className="btn px-2 py-1"
      idle="Sign out"
      pending="…"
      action={() => revokeUserSessionsAction(userId)}
      title="Revoke every live session for this account"
    />
  );
}

/** Bring an archived account back and switch it on. */
export function RestoreUserButton({ userId, username }: { userId: number; username: string }) {
  return (
    <ActionButton
      className="btn px-2 py-1"
      idle="Restore"
      pending="…"
      action={() => restoreUserAction(userId)}
      title={`Bring ${username} back from the archive and switch it on`}
    />
  );
}

export function PurgeSessions() {  return (
    <ActionButton
      className="btn px-2 py-1 text-[0.75rem]"
      idle="Purge expired"
      pending="Purging…"
      action={purgeExpiredSessionsAction}
      title="Delete session rows that have already expired"
    />
  );
}

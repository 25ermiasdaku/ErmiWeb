/**
 * Shown when an admin handed this account a temporary password. Persists
 * until the password is changed, so it is a plain server component rather
 * than a dismissable toast.
 */
export function MustChangePassword() {
  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-inset"
      style={{ backgroundColor: "var(--brand-soft)", borderColor: "transparent" }}
      role="alert"
    >
      <p className="text-[0.8125rem]">
        <strong>Set your own password.</strong>{" "}
        <span className="muted">
          You are signed in with a temporary one. Change it under My Account.
        </span>
      </p>
      <a href="/me#security" className="btn">
        Change password
      </a>
    </div>
  );
}

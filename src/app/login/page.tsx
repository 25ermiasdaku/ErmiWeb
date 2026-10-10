import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Only meaningful once the demo accounts exist. */
const DEMO_ACCOUNTS = [
  { username: "admin", role: "Owner", note: "Everything, including erasing accounts" },
  { username: "manager", role: "Manager", note: "Staff and settings, but no erasing or role redesign" },
  { username: "barista", role: "Barista", note: "Till, order board, recipes, stock read-only" },
  { username: "cashier", role: "Cashier", note: "Till and loyalty only" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in — no reason to show a second sign-in form.
  const current = await getCurrentUser();
  if (current) redirect(current.role_slug === "customer" ? "/my-orders" : "/dashboard");

  const { next } = await searchParams;
  const cafeName = getSetting("cafe_name") || "Ermi Coffee";
  const tagline = getSetting("cafe_tagline");
  const accounts = (get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0) > 0;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            style={{ backgroundColor: "var(--color-espresso-500)", color: "var(--color-cream-50)" }}
            aria-hidden
          >
            ☕
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{cafeName}</h1>
          {tagline && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {tagline}
            </p>
          )}
        </div>

        <div className="card p-5">
          <LoginForm next={next} />
          <p className="mt-4 text-center text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            New here?{" "}
            <Link href="/register" className="font-medium" style={{ color: "var(--brand)" }}>
              Create an account
            </Link>
          </p>
        </div>

        {accounts && (
          <div className="card mt-4 overflow-hidden">
            <header className="border-b px-4 py-2.5">
              <h2 className="text-xs font-semibold">Demo accounts</h2>
              <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                Password for all four: <code className="font-mono">ermi1234</code>
              </p>
            </header>
            <ul className="divide-y">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.username} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <code className="font-mono text-[0.8125rem] font-medium">{a.username}</code>
                    <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {a.role}
                    </span>
                  </div>
                  <p className="text-[0.6875rem]" style={{ color: "var(--text-muted)" }}>
                    {a.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-center text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          Sessions last 7 days. Five wrong passwords locks an account for 15 minutes.
        </p>
      </div>
    </div>
  );
}

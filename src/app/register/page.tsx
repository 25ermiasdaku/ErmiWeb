import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Join Ermi to order ahead, collect points on every coffee and redeem rewards in the app and on the web.",
};

export default async function RegisterPage() {
  // Already signed in — no reason to show a second sign-up form.
  if (await getCurrentUser()) redirect("/my-orders");

  const cafeName = getSetting("cafe_name") || "Ermi Coffee";
  const tagline = getSetting("cafe_tagline");

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
          <div className="mb-4">
            <h2 className="text-base font-semibold">Create your account</h2>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Free to join. Order ahead and earn a point on every dollar.
            </p>
          </div>
          <RegisterForm />
        </div>

        <p className="mt-4 text-center text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          By creating an account you agree to our{" "}
          <Link href="/about" className="underline">
            terms and privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

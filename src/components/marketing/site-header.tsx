"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export type MarketingNavItem = { href: Route; label: string };

export const MARKETING_NAV: MarketingNavItem[] = [
  { href: "/menu", label: "Menu" },
  { href: "/promotions", label: "Offers" },
  { href: "/promotions/rewards", label: "Rewards" },
  { href: "/promotions/subscriptions", label: "Subscriptions" },
  { href: "/locations", label: "Locations" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string, href: Route): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The public site's header. It knows nothing about sessions — a visitor who is
 * already signed in still sees "Sign in" here, and lands back in the app after.
 */
export function SiteHeader({ cafeName }: { cafeName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ backgroundColor: "color-mix(in oklab, var(--surface) 86%, transparent)" }}
    >
      <div className="mk-wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${cafeName} home`}>
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-lg"
            style={{ backgroundColor: "var(--color-espresso-500)", color: "var(--color-cream-50)" }}
            aria-hidden
          >
            ☕
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[0.9375rem] font-semibold tracking-tight">{cafeName}</span>
            <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
              roastery &amp; counter
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {MARKETING_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors"
                style={active ? { color: "var(--brand)" } : { color: "var(--text-muted)" }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="btn px-2.5 py-1.5" />
          <Link href="/login" className="btn hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary hidden sm:inline-flex">
            Create account
          </Link>
          <button
            className="btn px-2.5 py-1.5 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t lg:hidden" style={{ backgroundColor: "var(--surface-raised)" }}>
          <nav className="mk-wrap flex flex-col py-2">
            {MARKETING_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium"
                  style={active ? { color: "var(--brand)" } : { color: "var(--text-muted)" }}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 flex gap-2 border-t pt-3">
              <Link href="/login" className="btn flex-1">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary flex-1">
                Create account
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

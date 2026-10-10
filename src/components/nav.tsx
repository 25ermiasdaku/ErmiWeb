"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/format";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavLink = {
  href: Route;
  label: string;
  icon: string;
  group: "main" | "admin";
};

export type NavUser = {
  full_name: string;
  username: string;
  role_name: string;
  isAdmin: boolean;
};

/**
 * The sidebar. Which links appear is decided on the server from the signed-in
 * user's permissions — this component never decides what someone may reach,
 * it only hides what they already cannot use.
 */
export function Nav({ links, user }: { links: NavLink[]; user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  const main = links.filter((l) => l.group === "main");
  const admin = links.filter((l) => l.group === "admin");

  return (
    <>
      {/* Mobile bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden"
        style={{ backgroundColor: "var(--surface-raised)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="btn px-2.5 py-1.5"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {open && (
        <nav className="border-b px-3 py-2 lg:hidden" style={{ backgroundColor: "var(--surface-raised)" }}>
          <div className="mb-2 px-3">
            <Account user={user} />
          </div>
          {main.map((l) => (
            <NavRow key={l.href} link={l} pathname={pathname} />
          ))}
          {admin.length > 0 && <Divider label="Administration" />}
          {admin.map((l) => (
            <NavRow key={l.href} link={l} pathname={pathname} />
          ))}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden w-60 shrink-0 flex-col gap-1 border-r px-3 py-5 lg:flex"
        style={{ backgroundColor: "var(--surface-raised)" }}
      >
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
          <Brand />
        </Link>

        {main.map((l) => (
          <NavRow key={l.href} link={l} pathname={pathname} />
        ))}

        {admin.length > 0 && <Divider label="Administration" />}
        {admin.map((l) => (
          <NavRow key={l.href} link={l} pathname={pathname} />
        ))}

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <Account user={user} />
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
              v1.1
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}

function NavRow({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActive(pathname, link.href);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      style={
        active
          ? { backgroundColor: "var(--accent-soft)", color: "var(--accent)" }
          : { color: "var(--text-muted)" }
      }
    >
      <span aria-hidden className="w-4 text-center text-[0.9375rem]">
        {link.icon}
      </span>
      {link.label}
    </Link>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <p
      className="mt-4 mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-wider"
      style={{ color: "var(--text-faint)" }}
    >
      {label}
    </p>
  );
}

/** Signed-in identity plus the sign-out button. */
function Account({ user }: { user: NavUser | null }) {
  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary w-full">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold"
        style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
        aria-hidden
      >
        {initials(user.full_name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[0.8125rem] font-medium">{user.full_name}</p>
        <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          {user.role_name}
        </p>
      </div>
      <form action={logoutAction}>
        <button className="btn btn-ghost px-2 py-1.5" title="Sign out" aria-label="Sign out">
          ⏻
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <>
      <span
        className="grid h-9 w-9 place-items-center rounded-xl text-lg"
        style={{ backgroundColor: "var(--color-espresso-500)", color: "var(--color-cream-50)" }}
        aria-hidden
      >
        ☕
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.9375rem] font-semibold tracking-tight">Ermi Coffee</span>
        <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          cafe system
        </span>
      </span>
    </>
  );
}

function isActive(pathname: string, href: Route): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark switch. The chosen theme is applied before first paint by the
 * inline bootstrap in the root layout, so this only flips the class and stores
 * the choice — it never decides the initial theme itself.
 */
export function ThemeToggle({ className = "btn px-2 py-1.5" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ermi-theme", next ? "dark" : "light");
    } catch {
      // Private mode — the class is still applied for this session.
    }
  }

  return (
    <button
      className={className}
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {/* Render a stable glyph until mounted to avoid hydration mismatch. */}
      {mounted ? (dark ? "☀" : "☾") : "◐"}
    </button>
  );
}

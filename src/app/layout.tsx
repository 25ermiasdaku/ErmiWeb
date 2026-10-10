import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ermi Coffee — Cafe System",
  description:
    "A mini cafe system: point of sale, order board, inventory, loyalty and barista recipes.",
};

/**
 * Applies the saved theme before first paint so there is no flash of the
 * wrong colour scheme on reload.
 */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('ermi-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

/**
 * Document shell only. The navigation and the sign-in check live in the (app)
 * route group, so /login can render without a sidebar or a session.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

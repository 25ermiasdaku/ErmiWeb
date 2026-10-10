import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `node:sqlite` is a builtin, but keep it explicitly external so the
  // bundler never tries to inline the native binding into the server bundle.
  serverExternalPackages: ["node:sqlite"],
  typedRoutes: true,
  // Hide the floating Next.js dev-tools button in the corner during development.
  devIndicators: false,
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite driver must stay a runtime dependency (not bundled).
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // Lets phones on the same Wi-Fi reach the dev server via the computer's LAN IP (npm run mobile uses a production build instead).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").filter(Boolean) ?? [])],
  // Pin the project root so Turbopack never picks up a lockfile from a parent folder.
  turbopack: { root: path.resolve(import.meta.dirname) },
  experimental: {
    // Document uploads go through Server Actions; keep in sync with UPLOAD_MAX_MB.
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

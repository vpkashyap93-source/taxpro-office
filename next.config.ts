import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite driver must stay a runtime dependency (not bundled).
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // This app lives in a sub-folder of a repo that has its own lockfile.
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

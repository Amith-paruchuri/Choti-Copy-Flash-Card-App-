import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Local-network origins allowed to hit the dev server (e.g. testing on a phone
 * over WiFi at http://192.168.x.x:3000). Add your Mac's LAN IP here — it's the
 * "Network:" address `next dev` prints on start. Only used in development.
 */
const LAN_ORIGINS = ["192.168.1.4"];

const nextConfig: NextConfig = {
  // Lets those origins request dev-only endpoints (assets, HMR, Server Actions).
  allowedDevOrigins: LAN_ORIGINS,

  experimental: {
    serverActions: {
      // Anki imports can commit a few thousand cards in one call.
      bodySizeLimit: "6mb",
      // Satisfies the Server Action origin/host CSRF check for LAN testing.
      ...(isDev && {
        allowedOrigins: LAN_ORIGINS.map((ip) => `${ip}:3000`),
      }),
    },
  },
};

export default nextConfig;

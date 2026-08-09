import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// In dev, Next blocks cross-origin requests to dev-only assets — so opening the
// site from a phone on the same Wi-Fi (http://192.168.x.x:3000) would serve the
// HTML but never load the client JS, leaving every button dead. Allow this
// machine's own LAN addresses, looked up at startup so a new DHCP lease doesn't
// silently break it again. Dev-only; has no effect on the deployed site.
const lanOrigins = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanOrigins,
  experimental: {
    // Cache visited/prefetched page segments in the browser's client cache so
    // bouncing between pages (e.g. Stock <-> Dashboard) is instant instead of
    // re-fetching from the server every time. Dynamic pages default to 0s (no
    // caching); mutations still bust the cache via revalidatePath, so data
    // stays correct after edits.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

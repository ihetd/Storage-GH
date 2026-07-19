import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

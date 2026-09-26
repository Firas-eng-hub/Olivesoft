import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type checking runs explicitly before `next build`. Some sandboxed build
  // environments add non-JSON process output to Next's TypeScript probe.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

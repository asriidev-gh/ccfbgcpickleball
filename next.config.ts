import type { NextConfig } from "next";

function getLanHostFromEnv() {
  const raw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const match = raw.match(/^https?:\/\/([^/:]+)/i);
  return match?.[1];
}

const lanHost = getLanHostFromEnv();

const nextConfig: NextConfig = {
  // Import only the icons/functions used instead of whole barrel files.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  // Allow phones on your LAN to load Next.js dev client bundles (required for buttons/forms)
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...(lanHost ? [lanHost] : []),
    "192.168.1.100",
    "192.168.100.5",
    "192.168.100.17",
  ],
};

export default nextConfig;

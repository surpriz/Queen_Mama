import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingExcludes: {
    "*": ["node_modules/@prisma/engines/**/*"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "@prisma/client", "prisma"];
    }
    return config;
  },
};

export default nextConfig;

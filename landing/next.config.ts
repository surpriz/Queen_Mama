import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingExcludes: {
    "*": ["node_modules/@prisma/engines/**/*"],
  },
};

export default nextConfig;

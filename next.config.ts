import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail prod builds on lint warnings/errors — ESLint runs locally
  // and in CI; in prod we just want the binary out the door. The Prisma-
  // generated client (src/generated/prisma/**) trips no-require-imports
  // rules that we don't control.
  eslint: { ignoreDuringBuilds: true },

  // Same logic for TS: typecheck runs in CI/locally. Letting the prod
  // build fail on a stray type-only issue is unnecessary friction.
  typescript: { ignoreBuildErrors: true },

  // Keep these native / worker-using packages out of Next's server bundle so
  // they resolve from node_modules at runtime (workers, native bindings).
  serverExternalPackages: [
    "pdfjs-dist",
    "tesseract.js",
    "sharp",
    "@react-pdf/renderer",
  ],
};

export default nextConfig;

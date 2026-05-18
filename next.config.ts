import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

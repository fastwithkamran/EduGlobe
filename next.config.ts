import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Root redirects to the global feed
      { source: "/", destination: "/feed", permanent: false },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;

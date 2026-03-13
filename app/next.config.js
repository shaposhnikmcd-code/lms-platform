/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://dr-shaposhnik-platform.vercel.app",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.wayforpay.shop",
      },
      {
        protocol: "https",
        hostname: "w4p-merch.s3.eu-central-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "graph.facebook.com",
      },
    ],
  },
};

module.exports = nextConfig;
```
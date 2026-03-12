/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
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
    ],
  },
};

module.exports = nextConfig;
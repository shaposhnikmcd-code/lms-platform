/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
    dirs: [] // Пустий масив означає не перевіряти жодні директорії
  },
  swcMinify: true, // Це має бути ВСЕРЕДИНІ об'єкта nextConfig
};

module.exports = nextConfig;
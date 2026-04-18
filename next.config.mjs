import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    // AVIF дає додаткові −20-30% до WebP. Next сам обирає кращий формат,
    // підтримуваний браузером.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    // Tree-shaking для пакетів, що експортують багато іконок/утіліт —
    // тягнемо тільки те що справді імпортоване.
    optimizePackageImports: [
      'react-icons',
      'react-icons/fa',
      'react-icons/hi2',
      '@tiptap/react',
      '@tiptap/core',
      'date-fns',
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Довгий cache для static /public — картинки/шрифти/PDF.
      // /_next/static Next вже сам ставить immutable, тут тільки /public.
      {
        source: "/:path*.(jpg|jpeg|png|webp|avif|gif|svg|ico|woff|woff2|ttf|otf|pdf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

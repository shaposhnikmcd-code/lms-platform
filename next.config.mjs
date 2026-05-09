import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-inline' script/style — Next.js без nonce-middleware потребує inline для hydration.
// 'unsafe-eval' — тільки в dev (hot-reload eval); у prod не потрібно.
// form-action secure.wayforpay.com — [WayForPayButton.tsx](components/WayForPayButton.tsx)
// будує form і POST-ить на secure.wayforpay.com/pay.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:${isDev ? " 'unsafe-eval'" : ""} https://*.googletagmanager.com https://*.google-analytics.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://*.googletagmanager.com https://*.google-analytics.com https://flagcdn.com",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://res.cloudinary.com https://staticimgly.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // frame-src: дозволяємо YouTube embed (single video, playlist, shorts) у новинах.
  // Якщо frame-src не вказати — браузер фолбекається на child-src, де YouTube заблокований.
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com",
  "frame-ancestors 'self'",
  "form-action 'self' https://secure.wayforpay.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Playwright — node-only пакет з нативними binaries (Chromium); НЕ бандлити webpack-ом.
  serverExternalPackages: ["playwright", "playwright-core"],
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
          { key: "Content-Security-Policy", value: cspDirectives },
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

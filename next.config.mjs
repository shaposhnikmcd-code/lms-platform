import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-inline' script/style — Next.js без nonce-middleware потребує inline для hydration.
// 'unsafe-eval' — тільки в dev (hot-reload eval); у prod не потрібно.
// form-action secure.wayforpay.com — [WayForPayButton.tsx](components/WayForPayButton.tsx)
// будує form і POST-ить на secure.wayforpay.com/pay.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:${isDev ? " 'unsafe-eval'" : ""} https://*.googletagmanager.com https://*.google-analytics.com https://vercel.live`,
  // fonts.googleapis.com — stylesheet вибраних у білдері Google-шрифтів (Playfair/
  // Lora/Oswald…). Рендериться і в admin-білдері, і на public /news
  // (app/[locale]/news/layout.tsx). Без цього домену CSP блокував stylesheet і
  // шрифт падав на fallback навіть у самому білдері.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://*.googletagmanager.com https://*.google-analytics.com https://flagcdn.com https://vercel.live",
  // fonts.gstatic.com — самі файли шрифтів (woff2), на які посилається stylesheet.
  "font-src 'self' data: https://fonts.gstatic.com https://vercel.live https://assets.vercel.com",
  "connect-src 'self' blob: data: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://res.cloudinary.com https://staticimgly.com https://vercel.live wss://ws-us3.pusher.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // frame-src: дозволяємо YouTube embed (single video, playlist, shorts) у новинах.
  // vercel.live — для Vercel Live overlay (тільки preview-деплой, на проді не існує).
  // Якщо frame-src не вказати — браузер фолбекається на child-src, де YouTube заблокований.
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://vercel.live",
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
    // Next.js 16 робить білий-список обов'язковим; перераховуємо явно ті
    // значення, що реально використовуються (`quality={85}` і `={90}`).
    qualities: [75, 85, 90],
    // `?v=N` cache-buster на /Certificates/*.png (див. CertificatesSection.tsx).
    // Без цього паттерну Next 16 reject-не Image з query-рядком.
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/Certificates/**", search: "?v=2" },
    ],
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

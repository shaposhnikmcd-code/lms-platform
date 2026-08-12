import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * `/certificate/*` свідомо НЕ в disallow: сторінки верифікації відкриваються
 * по QR з PDF, і блокування в robots.txt зламало б їх для сканерів/прев'ю.
 * З індексу вони прибрані через `noindex` у власному generateMetadata.
 */
export default function robots(): MetadataRoute.Robots {
  const localePrefixed = (path: string) => [path, `/en${path}`, `/pl${path}`];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/auth/",
          ...localePrefixed("/news/preview"),
          ...localePrefixed("/payment/"),
          ...localePrefixed("/login"),
          ...localePrefixed("/forgot-password"),
          ...localePrefixed("/reset-password"),
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uk", "pl", "en"],
  defaultLocale: "uk",
  localePrefix: "as-needed",
  localeDetection: false,
});
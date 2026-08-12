"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/// Локалізована 404 для всього, що під /[locale]. Спрацьовує на `notFound()` з
/// новин, курсів, лендінгів. Navbar/Footer приходять з app/[locale]/layout.tsx —
/// тут лише контент.
///
/// Чому локаль з pathname, а не з params: у not-found.tsx Next не передає params
/// сегмента. Префікс шляху — детермінований (`localePrefix: "as-needed"`, тому
/// uk йде без префікса) і не залежить від внутрішніх механізмів next-intl.
const COPY = {
  uk: {
    title: "Сторінку не знайдено",
    text: "Схоже, сторінка була переміщена або більше не існує.",
    home: "На головну",
    courses: "Переглянути курси",
  },
  en: {
    title: "Page not found",
    text: "This page has either moved or no longer exists.",
    home: "Go home",
    courses: "Browse courses",
  },
  pl: {
    title: "Nie znaleziono strony",
    text: "Wygląda na to, że strona została przeniesiona lub już nie istnieje.",
    home: "Strona główna",
    courses: "Zobacz kursy",
  },
} as const;

type Locale = keyof typeof COPY;

export default function LocaleNotFound() {
  const pathname = usePathname() ?? "/";
  const first = pathname.split("/").filter(Boolean)[0];
  const locale: Locale = first === "en" || first === "pl" ? first : "uk";
  const c = COPY[locale];
  const prefix = locale === "uk" ? "" : `/${locale}`;

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-[#1C3A2E] mb-4">404</h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">
          {c.title}
        </h2>
        <p className="text-gray-600 mb-8">{c.text}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href={prefix || "/"}
            className="inline-block bg-[#1C3A2E] text-white px-6 py-3 rounded-lg hover:bg-[#2a4f3f] transition-colors"
          >
            {c.home}
          </Link>
          <Link
            href={`${prefix}/courses`}
            className="inline-block bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {c.courses}
          </Link>
        </div>
      </div>
    </div>
  );
}

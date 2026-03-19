import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PSYCHIATRY_COURSE } from "./psychiatry-basics/config";
import { PSYCHOLOGY_COURSE } from "./psychology-basics/config";
import { MENTORSHIP_COURSE } from "./mentorship/config";
import { BIBLICAL_HEROES_COURSE } from "./psychotherapy-of-biblical-heroes/config";
import { SEX_EDUCATION_COURSE } from "./sex-education/config";
import { getCurrency } from "@/lib/currency";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("CoursesPage");
  const currency = getCurrency(locale);

  const courses = [
    { key: "psychology", price: PSYCHOLOGY_COURSE.price, href: "/courses/psychology-basics", icon: "🧠" },
    { key: "psychiatry", price: PSYCHIATRY_COURSE.price, href: "/courses/psychiatry-basics", icon: "🩺" },
    { key: "mentorship", price: MENTORSHIP_COURSE.price, href: "/courses/mentorship", icon: "🫂" },
    { key: "christianPsy", price: "4200", href: "/courses/Fundamentals-of-Christian-Psychology-2.0", icon: "✝️" },
    { key: "biblicalHeroes", price: BIBLICAL_HEROES_COURSE.price, href: "/courses/psychotherapy-of-biblical-heroes", icon: "📖" },
    { key: "sexEd", price: SEX_EDUCATION_COURSE.price, href: "/courses/sex-education", icon: "👨‍👩‍👧" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b3d2e] to-[#022d23] p-4">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-[#e7e2c6]">{t("subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {courses.map((course, index) => (
            <Link
              key={course.key}
              href={course.href}
              className="bg-[#003d30] rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border border-[#1a5a48] group hover:scale-105"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col h-full">
                <div className="mb-3"><span className="text-3xl">{course.icon}</span></div>
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2 group-hover:text-white transition-colors">
                  {t(`courses.${course.key}.title` as any)}
                </h2>
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow">
                  {t(`courses.${course.key}.description` as any)}
                </p>
                <div className="flex justify-between items-center text-sm border-t border-[#1a5a48] pt-3 mt-auto">
                  <span className="text-[#e7e2c6] font-semibold group-hover:text-[#D4A017] transition-colors">
                    {course.price} {currency}
                  </span>
                  <span className="text-[#CFC8A9] text-xs">
                    {t(`courses.${course.key}.duration` as any)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mb-8">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 bg-[#D4A017]/20 text-[#D4A017] rounded-full text-sm font-medium mb-3">
              {t("charityBadge")}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t("charityTitle")}</h2>
            <p className="text-[#e7e2c6] text-sm">{t("charitySubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Link
              href="/courses/psychological-support"
              className="bg-[#D4A017]/10 rounded-2xl p-5 border border-[#D4A017]/30 group hover:scale-105 hover:border-[#D4A017] transition-all"
            >
              <div className="flex flex-col h-full">
                <div className="mb-3"><span className="text-3xl">{"🤝"}</span></div>
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2">{t("courses.support.title")}</h2>
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow">{t("courses.support.description")}</p>
                <div className="flex justify-between items-center text-sm border-t border-[#D4A017]/30 pt-3 mt-auto">
                  <span className="text-[#D4A017] font-semibold">{t("courses.support.price")}</span>
                  <span className="text-[#CFC8A9] text-xs">{t("courses.support.duration")}</span>
                </div>
              </div>
            </Link>
            <a
              href="https://t.me/zhyty_chysto_2_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#D4A017]/10 rounded-2xl p-5 border border-[#D4A017]/30 group hover:scale-105 hover:border-[#D4A017] transition-all"
            >
              <div className="flex flex-col h-full">
                <div className="mb-3"><span className="text-3xl">{"💪"}</span></div>
                <h2 className="text-[#e7e2c6] text-lg font-bold mb-2">{t("courses.porn.title")}</h2>
                <p className="text-[#CFC8A9] text-xs mb-4 flex-grow">{t("courses.porn.description")}</p>
                <div className="flex justify-between items-center text-sm border-t border-[#D4A017]/30 pt-3 mt-auto">
                  <span className="text-[#D4A017] font-semibold">{t("courses.porn.price")}</span>
                  <span className="text-[#CFC8A9] text-xs">{t("courses.porn.duration")}</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

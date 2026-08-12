import Link from "next/link";
import { FaPlay } from "react-icons/fa";
import { getTranslations } from "next-intl/server";

interface CourseEnrolledProps {
  courseId: string;
  /// Перший урок курсу в нашій LMS. `null` — уроків немає (навчання на SendPulse):
  /// тоді замість кнопки показуємо, де шукати матеріали.
  firstLessonId: string | null;
}

export default async function CourseEnrolled({ courseId, firstLessonId }: CourseEnrolledProps) {
  const t = await getTranslations("DynamicCourse");
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-12">
        <div className="text-5xl mb-4">{"✅"}</div>
        <h2 className="text-2xl font-bold text-[#1C3A2E] mb-4">
          {t("enrolledTitle")}
        </h2>
        {/* Кнопка веде на конкретний урок. Маршруту `/courses/[id]/learn` у застосунку
            немає — стара кнопка давала 404 одразу після оплати. */}
        {firstLessonId ? (
          <Link
            href={`/courses/${courseId}/lesson/${firstLessonId}`}
            className="inline-flex items-center gap-2 bg-[#1C3A2E] text-white font-bold py-4 px-8 rounded-xl hover:bg-[#2a5242] transition-colors"
          >
            <FaPlay /> {t("btnGoLearn")}
          </Link>
        ) : (
          <p className="text-gray-600 max-w-xl mx-auto">{t("enrolledExternal")}</p>
        )}
      </div>
    </section>
  );
}

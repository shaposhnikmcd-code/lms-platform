import { FaPlay, FaLock, FaClock } from "react-icons/fa";
import { getTranslations } from "next-intl/server";

interface Lesson {
  id: string;
  title: string;
  isFree: boolean;
  duration: number | null;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseProgramProps {
  modules: Module[];
  totalLessons: number;
  isEnrolled: boolean;
}

export default async function CourseProgram({ modules, totalLessons, isEnrolled }: CourseProgramProps) {
  const t = await getTranslations("DynamicCourse");
  return (
    <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">
          {t("planLabel")}
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">
          {t("programTitle")}
        </h2>
        <p className="text-gray-500 mt-2">
          {modules.length} {t("modulesLabel")} · {totalLessons} {t("lessons")}
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {t("programEmpty")}
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((module, i) => (
            <div
              key={module.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
            >
              <div className={`h-1 ${i % 2 === 0 ? "bg-[#1C3A2E]" : "bg-[#D4A017]"}`} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-[#1C3A2E]">{module.title}</h3>
                  <span className="text-sm text-gray-400">
                    {module.lessons.length} {t("lessons")}
                  </span>
                </div>
                <ul className="space-y-2">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex items-center gap-3 text-gray-600">
                      <span className="w-6 h-6 bg-[#FDF2EB] rounded-full flex items-center justify-center text-[#D4A017] text-xs flex-shrink-0">
                        {lesson.isFree || isEnrolled ? <FaPlay /> : <FaLock />}
                      </span>
                      <span className={lesson.isFree || isEnrolled ? "" : "text-gray-400"}>
                        {lesson.title}
                      </span>
                      {lesson.isFree && !isEnrolled && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {t("free")}
                        </span>
                      )}
                      {lesson.duration && (
                        <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                          <FaClock />
                          {Math.floor(lesson.duration / 60)}:
                          {String(lesson.duration % 60).padStart(2, "0")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { FaPlay, FaWallet, FaUsers } from "react-icons/fa";

interface CourseHeroProps {
  course: {
    title: string;
    description: string | null;
    price: number;
  };
  courseId: string;
  isEnrolled: boolean;
  totalLessons: number;
  enrollmentCount: number;
}

export default function CourseHero({
  course,
  courseId,
  isEnrolled,
  totalLessons,
  enrollmentCount,
}: CourseHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-[#D4A017] rounded-full mix-blend-multiply filter blur-xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
              {"🎓 Курс UIMP"}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {course.title}
            </h1>
            <p className="text-white/80 text-lg leading-relaxed max-w-xl">
              {course.description}
            </p>

            <div className="flex flex-wrap gap-4">
              {isEnrolled ? (
                <Link
                  href={`/courses/${courseId}/learn`}
                  className="inline-flex items-center gap-2 bg-[#D4A017] text-white font-medium px-8 py-4 rounded-lg hover:bg-[#b88913] transition-all"
                >
                  <FaPlay /> {"Продовжити навчання"}
                </Link>
              ) : (
                <Link
                  href="#price"
                  className="inline-flex items-center gap-2 bg-[#D4A017] text-white font-medium px-8 py-4 rounded-lg hover:bg-[#b88913] transition-all"
                >
                  <FaWallet /> {"Купити курс"}
                </Link>
              )}
              <Link
                href="#program"
                className="inline-flex items-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all"
              >
                {"Програма"}
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2 text-white/70">
                <FaUsers />
                <span className="text-white font-bold">{enrollmentCount}</span>{" студентів"}
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <FaPlay />
                <span className="text-white font-bold">{totalLessons}</span>{" уроків"}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
            <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
              <div className="text-center">
                <div className="text-8xl mb-4">{"📚"}</div>
                <p className="text-white/80 text-lg font-medium">{course.title}</p>
                <p className="text-[#D4A017] font-bold text-2xl mt-2">
                  {course.price.toLocaleString()} {"грн"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
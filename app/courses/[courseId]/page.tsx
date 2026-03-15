import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaCheck, FaWallet, FaLock, FaPlay, FaUsers, FaClock } from "react-icons/fa";
import WayForPayButton from "@/components/WayForPayButton";

type Props = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: Props) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  // Шукаємо по slug або id
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: courseId },
        { id: courseId },
      ],
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
          },
        },
      },
      courseTeachers: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) notFound();

  // Перевірка чи студент вже записаний
  const enrollment = userId && userId !== "test-student-1"
    ? await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      })
    : null;

  const isEnrolled = !!enrollment;

  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.length, 0
  );

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-[#D4A017] rounded-full mix-blend-multiply filter blur-xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">
                🎓 Курс UIMP
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
                    <FaPlay /> Продовжити навчання
                  </Link>
                ) : (
                  <Link
                    href="#price"
                    className="inline-flex items-center gap-2 bg-[#D4A017] text-white font-medium px-8 py-4 rounded-lg hover:bg-[#b88913] transition-all"
                  >
                    <FaWallet /> Купити курс
                  </Link>
                )}
                <Link
                  href="#program"
                  className="inline-flex items-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all"
                >
                  Програма
                </Link>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-white/70">
                  <FaUsers />
                  <span className="text-white font-bold">{course._count.enrollments}</span> студентів
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <FaPlay />
                  <span className="text-white font-bold">{totalLessons}</span> уроків
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
                <div className="text-center">
                  <div className="text-8xl mb-4">📚</div>
                  <p className="text-white/80 text-lg font-medium">{course.title}</p>
                  <p className="text-[#D4A017] font-bold text-2xl mt-2">
                    {course.price.toLocaleString()} грн
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ВИКЛАДАЧІ */}
      {course.courseTeachers.length > 0 && (
        <section className="bg-[#1C3A2E] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Експерти</span>
              <h2 className="text-3xl font-bold text-white mt-2">Викладачі курсу</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {course.courseTeachers.map((ct) => (
                <div key={ct.user.id} className="text-center">
                  <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white border-2 border-[#D4A017]">
                    {ct.user.image ? (
                      <img src={ct.user.image} alt={ct.user.name || ""} className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      (ct.user.name || "T")[0].toUpperCase()
                    )}
                  </div>
                  <p className="text-white font-semibold">{ct.user.name}</p>
                  <p className="text-white/60 text-sm">Викладач</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ПРОГРАМА КУРСУ */}
      <section id="program" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">Навчальний план</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mt-2">Програма курсу</h2>
          <p className="text-gray-500 mt-2">{course.modules.length} модулів · {totalLessons} уроків</p>
        </div>

        {course.modules.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            Програма курсу незабаром буде додана
          </div>
        ) : (
          <div className="space-y-4">
            {course.modules.map((module, i) => (
              <div key={module.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div className={`h-1 ${i % 2 === 0 ? "bg-[#1C3A2E]" : "bg-[#D4A017]"}`} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#1C3A2E]">
                      {module.title}
                    </h3>
                    <span className="text-sm text-gray-400">
                      {module.lessons.length} уроків
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {module.lessons.map((lesson, j) => (
                      <li key={lesson.id} className="flex items-center gap-3 text-gray-600">
                        <span className="w-6 h-6 bg-[#FDF2EB] rounded-full flex items-center justify-center text-[#D4A017] text-xs flex-shrink-0">
                          {lesson.isFree ? <FaPlay /> : isEnrolled ? <FaPlay /> : <FaLock />}
                        </span>
                        <span className={lesson.isFree || isEnrolled ? "" : "text-gray-400"}>
                          {lesson.title}
                        </span>
                        {lesson.isFree && !isEnrolled && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Безкоштовно</span>
                        )}
                        {lesson.duration && (
                          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                            <FaClock /> {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2, "0")}
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

      {/* ЦІНА */}
      {!isEnrolled && (
        <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative p-12 md:p-16">
              <div className="text-center mb-12">
                <span className="inline-block px-4 py-2 bg-[#D4A017] text-white rounded-full text-sm mb-6">
                  🎓 Інвестиція в себе
                </span>
                <h2 className="text-4xl font-bold text-white mb-4">Вартість курсу</h2>
              </div>
              <div className="max-w-md mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border-2 border-[#D4A017]/30 hover:border-[#D4A017] transition-all">
                  <div className="text-sm text-[#D4A017] font-semibold mb-4">Повний доступ</div>
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-6xl font-black text-white">{course.price.toLocaleString()}</span>
                    <span className="text-white/60">грн</span>
                  </div>
                  <div className="space-y-3 mb-8 text-white/80">
                    <p className="flex items-center justify-center gap-2">
                      <FaCheck className="text-[#D4A017]" /> {totalLessons} уроків
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <FaCheck className="text-[#D4A017]" /> Доступ назавжди
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <FaCheck className="text-[#D4A017]" /> Сертифікат після завершення
                    </p>
                  </div>
                  {session ? (
                    <WayForPayButton
                      courseName={course.title}
                      price={course.price}
                      courseId={course.id}
                    />
                  ) : (
                    <Link
                      href="/"
                      className="block w-full bg-[#D4A017] text-white font-bold py-4 rounded-xl hover:bg-[#b88913] transition-colors text-center"
                    >
                      Увійдіть щоб купити
                    </Link>
                  )}
                  <p className="text-white/50 text-sm mt-4">100% гарантія повернення коштів</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ВЖЕ ЗАПИСАНИЙ */}
      {isEnrolled && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-12">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-[#1C3A2E] mb-4">Ви вже записані на цей курс</h2>
            <Link
              href={`/courses/${courseId}/learn`}
              className="inline-flex items-center gap-2 bg-[#1C3A2E] text-white font-bold py-4 px-8 rounded-xl hover:bg-[#2a5242] transition-colors"
            >
              <FaPlay /> Перейти до навчання
            </Link>
          </div>
        </section>
      )}

    </main>
  );
}
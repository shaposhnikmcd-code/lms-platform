import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { FaBook, FaCertificate, FaCreditCard, FaCog, FaEnvelope, FaRegCalendarCheck } from "react-icons/fa";
import prisma from "@/lib/prisma";

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let enrollments: any[] = [];

  if (userId && userId !== 'test-student-1') {
    enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
  }

  const progressData = userId && userId !== 'test-student-1'
    ? await prisma.courseProgress.findMany({
        where: { userId },
      })
    : [];

  const progressMap = new Map(progressData.map((p) => [p.courseId, p]));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Вітання */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1C3A2E]">
          Вітаємо, {session?.user?.name}!
        </h1>
        <p className="text-gray-600">Продовжуйте навчання</p>
      </div>

      {/* Continue Learning */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#1C3A2E] mb-4">Продовжити навчання</h2>

        {enrollments.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <FaBook className="text-5xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">У вас ще немає активних курсів</p>
            <Link
              href="/courses"
              className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
            >
              Переглянути курси
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {enrollments.map(({ course }) => {
              const progress = progressMap.get(course.id);
              const percent = progress?.progressPercent ?? 0;

              return (
                <div key={course.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                  <h3 className="font-semibold text-lg mb-2 text-[#1C3A2E]">{course.title}</h3>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Прогрес</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#D4A017] h-2 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-[#D4A017] hover:text-[#b88913] text-sm font-medium"
                  >
                    Продовжити →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Навігація по розділах */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Link href="/dashboard/student/my-courses"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaBook className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Мої курси</span>
        </Link>

        <Link href="/dashboard/student/certificates"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCertificate className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Сертифікати</span>
        </Link>

        <Link href="/dashboard/student/payments"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCreditCard className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Платежі</span>
        </Link>

        <Link href="/dashboard/student/subscription"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaRegCalendarCheck className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Моя підписка</span>
        </Link>

        <Link href="/dashboard/student/settings"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCog className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Налаштування</span>
        </Link>

        <Link href="/dashboard/student/messages"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaEnvelope className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Повідомлення</span>
        </Link>
      </div>
    </div>
  );
}

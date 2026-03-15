import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { FaBook, FaUsers, FaChartLine, FaEnvelope } from "react-icons/fa";

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "TEACHER") redirect("/");

  const teacherId = session.user.id;

  const courseTeachers = await prisma.courseTeacher.findMany({
    where: { userId: teacherId },
    include: {
      course: {
        include: {
          _count: { select: { enrollments: true } },
          enrollments: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  const totalStudents = courseTeachers.reduce(
    (acc, ct) => acc + ct.course._count.enrollments, 0
  );

  const unreadMessages = await prisma.message.count({
    where: { receiverId: teacherId, read: false },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-2">
        Кабінет викладача
      </h1>
      <p className="text-gray-500 mb-8">
        Ласкаво просимо, {session.user.name || session.user.email}
      </p>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <FaBook className="text-green-600 text-xl" />
          </div>
          <div className="text-2xl font-bold text-[#1C3A2E] mb-1">
            {courseTeachers.length}
          </div>
          <div className="text-sm text-gray-500">Моїх курсів</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <FaUsers className="text-blue-600 text-xl" />
          </div>
          <div className="text-2xl font-bold text-[#1C3A2E] mb-1">
            {totalStudents}
          </div>
          <div className="text-sm text-gray-500">Студентів</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-4">
            <FaEnvelope className="text-yellow-600 text-xl" />
          </div>
          <div className="text-2xl font-bold text-[#1C3A2E] mb-1">
            {unreadMessages}
          </div>
          <div className="text-sm text-gray-500">Нових повідомлень</div>
        </div>
      </div>

      {/* Мої курси */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-xl font-semibold text-[#1C3A2E] mb-4 flex items-center gap-2">
          <FaBook /> Мої курси
        </h2>

        {courseTeachers.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Вам ще не призначено жодного курсу. Зверніться до адміністратора.
          </p>
        ) : (
          <div className="space-y-4">
            {courseTeachers.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div>
                  <p className="font-medium text-[#1C3A2E]">{ct.course.title}</p>
                  <p className="text-sm text-gray-500">
                    {ct.course._count.enrollments} студентів
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/teacher/courses/${ct.course.id}/students`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1C3A2E] text-white text-xs rounded-lg hover:bg-[#1C3A2E]/80 transition-colors"
                  >
                    <FaUsers className="text-xs" /> Студенти
                  </Link>
                  <Link
                    href={`/dashboard/teacher/messages`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#D4A843] text-white text-xs rounded-lg hover:bg-[#D4A843]/80 transition-colors"
                  >
                    <FaEnvelope className="text-xs" /> Повідомлення
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
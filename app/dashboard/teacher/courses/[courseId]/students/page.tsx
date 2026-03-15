import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { FaArrowLeft, FaUsers } from "react-icons/fa";

export default async function TeacherCourseStudents({
  params,
}: {
  params: { courseId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "TEACHER") redirect("/");

  const teacherId = session.user.id;

  const courseTeacher = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId: params.courseId, userId: teacherId } },
  });
  if (!courseTeacher) redirect("/dashboard/teacher");

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: {
      enrollments: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      modules: {
        include: { lessons: true },
      },
    },
  });

  if (!course) redirect("/dashboard/teacher");

  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.length, 0
  );

  const studentIds = course.enrollments.map((e) => e.user.id);

  const progressData = await prisma.courseProgress.findMany({
    where: {
      courseId: params.courseId,
      userId: { in: studentIds },
    },
  });

  const progressMap = new Map(progressData.map((p) => [p.userId, p]));

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/dashboard/teacher"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors"
      >
        <FaArrowLeft /> Назад до кабінету
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-1">{course.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        Студенти курсу — всього {course.enrollments.length}
      </p>

      {course.enrollments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaUsers className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Студентів ще немає</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Студент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Прогрес</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Уроків переглянуто</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Написати</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {course.enrollments.map((enrollment) => {
                const progress = progressMap.get(enrollment.user.id);
                const percent = progress?.progressPercent || 0;
                const completed = !!progress?.completedAt;

                return (
                  <tr key={enrollment.user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {enrollment.user.image ? (
                          <img src={enrollment.user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-[#1C3A2E]/10 rounded-full flex items-center justify-center text-[#1C3A2E] font-bold text-sm">
                            {(enrollment.user.name || enrollment.user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {enrollment.user.name || "Без імені"}
                          </p>
                          <p className="text-xs text-gray-400">{enrollment.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1C3A2E] rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {totalLessons > 0
                        ? `${Math.round((percent / 100) * totalLessons)} / ${totalLessons}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {completed ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          ✅ Завершив
                        </span>
                      ) : percent > 0 ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          🔄 В процесі
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                          ⏳ Не почав
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/teacher/messages?studentId=${enrollment.user.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#D4A843] text-white text-xs rounded-lg hover:bg-[#D4A843]/80 transition-colors"
                      >
                        ✉️ Написати
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default function MyCourses() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-4">Мої курси</h1>
      <p className="text-gray-600">Тут буде список ваших курсів</p>
    </div>import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaBook, FaCheckCircle, FaClock } from 'react-icons/fa';

export default async function MyCoursesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: (session.user as any).id },
    include: {
      course: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const progressData = await prisma.courseProgress.findMany({
    where: { userId: (session.user as any).id },
  });

  const progressMap = new Map(progressData.map(p => [p.courseId, p]));

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Мої курси</h1>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaBook className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">У вас ще немає курсів</p>
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
            const isCompleted = percent === 100;

            return (
              <div key={course.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                {course.imageUrl && (
                  <img
                    src={course.imageUrl}
                    alt={course.title}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg text-[#1C3A2E]">{course.title}</h3>
                  {isCompleted ? (
                    <FaCheckCircle className="text-green-500 text-xl flex-shrink-0 ml-2" />
                  ) : (
                    <FaClock className="text-[#D4A017] text-xl flex-shrink-0 ml-2" />
                  )}
                </div>

                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{course.description}</p>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Прогрес</span>
                    <span className="font-medium">{percent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#D4A017] h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <Link
                  href={`/courses/${course.id}`}
                  className="block text-center bg-[#1C3A2E] text-white font-medium py-2 px-4 rounded-lg hover:bg-[#2a5242] transition-colors text-sm"
                >
                  {isCompleted ? 'Переглянути' : 'Продовжити'}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
  );
}
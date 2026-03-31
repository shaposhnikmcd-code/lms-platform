import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaBook, FaUsers, FaEye, FaEyeSlash, FaChalkboardTeacher, FaPlus } from 'react-icons/fa';

export default async function AdminCourses() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { enrollments: true, modules: true },
      },
      courseTeachers: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        ← Назад до адмін-панелі
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1C3A2E]">Курси</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FaBook />
            <span>Всього: {courses.length}</span>
          </div>
          <Link
            href="/dashboard/admin/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C3A2E] text-white text-sm rounded-lg hover:bg-[#1C3A2E]/80 transition-colors"
          >
            <FaPlus /> Створити курс
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaBook className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Курсів ще немає</p>
          <Link
            href="/dashboard/admin/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C3A2E] text-white text-sm rounded-lg hover:bg-[#1C3A2E]/80 transition-colors"
          >
            <FaPlus /> Створити перший курс
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Курс</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ціна</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Студентів</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Модулів</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Викладачі</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {course.imageUrl ? (
                          <img src={course.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-[#1C3A2E]/10 rounded-lg flex items-center justify-center">
                            <FaBook className="text-[#1C3A2E] text-sm" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{course.title}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{course.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#D4A017]">
                      {course.price.toLocaleString()} UAH
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <FaUsers className="text-xs" />
                        {course._count.enrollments}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {course._count.modules}
                    </td>
                    <td className="px-4 py-3">
                      {course.courseTeachers.length === 0 ? (
                        <span className="text-xs text-gray-400">Не призначено</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {course.courseTeachers.map((ct) => (
                            <span key={ct.user.id} className="flex items-center gap-1 text-xs text-[#1C3A2E] bg-[#E8F5E0] px-2 py-0.5 rounded-full w-fit">
                              <FaChalkboardTeacher className="text-xs" />
                              {ct.user.name || ct.user.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {course.published ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium w-fit">
                          <FaEye className="text-xs" /> Опубліковано
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium w-fit">
                          <FaEyeSlash className="text-xs" /> Чернетка
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(course.createdAt).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/admin/courses/${course.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1C3A2E] text-white text-xs rounded-lg hover:bg-[#1C3A2E]/80 transition-colors"
                      >
                        Керувати
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
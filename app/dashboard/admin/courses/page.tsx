import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaBook, FaUsers, FaEye, FaEyeSlash } from 'react-icons/fa';

export default async function AdminCourses() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { enrollments: true, modules: true },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1C3A2E]">Курси</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FaBook />
          <span>Всього: {courses.length}</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaBook className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Курсів ще немає</p>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
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
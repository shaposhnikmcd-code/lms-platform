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
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Курси</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70">
            <FaBook className="text-slate-400" />
            <span>Всього: <span className="font-semibold text-slate-700 tabular-nums">{courses.length}</span></span>
          </div>
          <Link
            href="/dashboard/admin/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-colors"
          >
            <FaPlus /> Створити курс
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <FaBook className="text-5xl text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-5">Курсів ще немає</p>
          <Link
            href="/dashboard/admin/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <FaPlus /> Створити перший курс
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Курс</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ціна</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Студентів</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Модулів</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Викладачі</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {course.imageUrl ? (
                          <img src={course.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-indigo-50 ring-1 ring-indigo-100 rounded-lg flex items-center justify-center">
                            <FaBook className="text-indigo-600 text-sm" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{course.title}</p>
                          <p className="text-xs text-slate-400 line-clamp-1">{course.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-amber-600 tabular-nums">
                      {course.price.toLocaleString()} ₴
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 tabular-nums">
                        <FaUsers className="text-xs text-slate-400" />
                        {course._count.enrollments}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 tabular-nums">
                      {course._count.modules}
                    </td>
                    <td className="px-5 py-3">
                      {course.courseTeachers.length === 0 ? (
                        <span className="text-xs text-slate-400">Не призначено</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {course.courseTeachers.map((ct) => (
                            <span key={ct.user.id} className="flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 ring-1 ring-indigo-100 px-2 py-0.5 rounded-full w-fit">
                              <FaChalkboardTeacher className="text-xs" />
                              {ct.user.name || ct.user.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {course.published ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 rounded-full text-xs font-medium w-fit">
                          <FaEye className="text-xs" /> Опубліковано
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium w-fit">
                          <FaEyeSlash className="text-xs" /> Чернетка
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {new Date(course.createdAt).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/admin/courses/${course.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 transition-colors"
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
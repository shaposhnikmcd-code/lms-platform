import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaPlus, FaEye, FaEyeSlash } from 'react-icons/fa';
import { HiOutlineBookOpen } from 'react-icons/hi2';

const COURSE_TITLES: Record<string, string> = {
  'psychology-basics': 'Основи психології',
  'psychiatry-basics': 'Основи психіатрії',
  'mentorship': 'Основи душеопікунства',
  'psychotherapy-of-biblical-heroes': 'Психотерапія біблійних героїв',
  'sex-education': 'Статеве виховання',
  'military-psychology': 'Військова психологія',
  'emotional-intelligence': 'Емоційний інтелект',
};

export default async function AdminBundles() {
  const bundles = await prisma.bundle.findMany({
    orderBy: { createdAt: 'desc' },
    include: { courses: true },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Пакети курсів</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70">
            <HiOutlineBookOpen className="text-slate-400" />
            <span>Всього: <span className="font-semibold text-slate-700 tabular-nums">{bundles.length}</span></span>
          </div>
          <Link
            href="/dashboard/admin/bundles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 shadow-sm shadow-violet-500/20 transition-colors"
          >
            <FaPlus /> Створити пакет
          </Link>
        </div>
      </div>

      {bundles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <HiOutlineBookOpen className="text-5xl text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-5">Пакетів ще немає</p>
          <Link
            href="/dashboard/admin/bundles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors"
          >
            <FaPlus /> Створити перший пакет
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Пакет</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Курси</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ціна</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bundles.map((bundle) => (
                  <tr key={bundle.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{bundle.title}</p>
                        <p className="text-xs text-slate-400">{bundle.slug}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        {bundle.courses.map((bc) => (
                          <span key={bc.id} className="text-xs text-violet-700 bg-violet-50 ring-1 ring-violet-100 px-2 py-0.5 rounded-full w-fit">
                            {COURSE_TITLES[bc.courseSlug] || bc.courseSlug}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-amber-600 tabular-nums">
                      {bundle.price.toLocaleString()} ₴
                    </td>
                    <td className="px-5 py-3">
                      {bundle.published ? (
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
                      {new Date(bundle.createdAt).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/admin/bundles/${bundle.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 transition-colors"
                      >
                        Редагувати
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

import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaPlus, FaEye, FaEyeSlash, FaPause } from 'react-icons/fa';
import { HiOutlineBookOpen } from 'react-icons/hi2';
import SuspendButton from './_components/SuspendButton';
import CoursesPopupButton from './_components/CoursesPopupButton';
import { syncCatalogCourses } from '@/lib/syncCatalogCourses';

export default async function AdminBundles() {
  await syncCatalogCourses();

  const [bundles, courses] = await Promise.all([
    prisma.bundle.findMany({
      orderBy: { createdAt: 'desc' },
      include: { courses: true },
    }),
    prisma.course.findMany({
      select: { id: true, slug: true, title: true, price: true },
    }),
  ]);

  const COURSE_TITLES: Record<string, string> = {};
  const COURSE_PRICES: Record<string, number> = {};
  for (const c of courses) {
    const key = c.slug ?? c.id;
    COURSE_TITLES[key] = c.title;
    COURSE_PRICES[key] = c.price;
  }

  return (
    <div className="mx-auto px-6 py-10" style={{ maxWidth: 1200, transform: 'translateX(-30px)' }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Пакети курсів</h1>
        <div className="flex items-center gap-3">
          <CoursesPopupButton
            courses={courses.map((c) => ({ slug: c.slug ?? c.id, title: c.title, price: c.price }))}
          />
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
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden" style={{ width: 'fit-content' }}>
          <div>
            <table>
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '12px 10px' }}>Пакет</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '12px 10px' }}>Курси</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '10px 10px', lineHeight: 1.4 }}>Дата<br/>публікації</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '10px 10px', lineHeight: 1.4 }}>Ціна<br/>пакету</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '10px 10px', lineHeight: 1.4 }}>Повна<br/>ціна</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '10px 10px', lineHeight: 1.4 }}>%<br/>знижки</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '12px 10px' }}>Різниця</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200/50" style={{ padding: '12px 10px' }}>Статус</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ padding: '12px 10px' }}>Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bundles.map((bundle, index) => {
                  const isSuspended = !!bundle.suspendedAt;
                  const fullPrice = bundle.courses.reduce((sum, bc) => sum + (COURSE_PRICES[bc.courseSlug] || 0), 0);
                  const difference = fullPrice - bundle.price;
                  return (
                    <tr key={bundle.id} className={`group hover:bg-slate-50/60 transition-colors ${isSuspended ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-3 border-r border-slate-100" style={{ padding: '12px 8px' }}>
                        <div className="flex items-start gap-2.5">
                          <span
                            aria-hidden
                            className={`relative inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-[13px] font-bold tabular-nums shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md ${
                              isSuspended
                                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-500/30 group-hover:shadow-amber-500/50'
                                : 'bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/30 group-hover:shadow-violet-500/50'
                            }`}
                          >
                            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
                            <span className="relative">{index + 1}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${isSuspended ? 'text-slate-500' : 'text-slate-800'}`}>
                            {(() => {
                              const courseNames = Object.values(COURSE_TITLES);
                              let title = bundle.title;
                              const parts: string[] = [];
                              while (title.length > 0) {
                                let earliest = -1;
                                let matched = '';
                                for (const name of courseNames) {
                                  const idx = title.indexOf(name, parts.length === 0 ? 0 : 1);
                                  if (idx > 0 && (earliest === -1 || idx < earliest)) {
                                    earliest = idx;
                                    matched = name;
                                  }
                                }
                                if (earliest > 0) {
                                  parts.push(title.slice(0, earliest).trim());
                                  title = title.slice(earliest);
                                } else {
                                  parts.push(title.trim());
                                  break;
                                }
                              }
                              return parts.map((part, i) => (
                                <span key={i}>{i > 0 && <br />}{part}</span>
                              ));
                            })()}
                          </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 border-r border-slate-100" style={{ padding: '12px 10px' }}>
                        <div className="flex flex-col gap-1">
                          {bundle.courses.map((bc) => (
                            <span key={bc.id} className="text-xs text-violet-700 bg-violet-50 ring-1 ring-violet-100 px-2 py-0.5 rounded-full w-fit">
                              {COURSE_TITLES[bc.courseSlug] || bc.courseSlug}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {new Date(bundle.createdAt).toLocaleDateString('uk-UA')}
                      </td>
                      <td className="py-3 text-sm font-semibold text-amber-600 tabular-nums whitespace-nowrap border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {bundle.price.toLocaleString()} ₴
                      </td>
                      <td className="py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {fullPrice.toLocaleString()} ₴
                      </td>
                      <td className="py-3 text-sm font-semibold tabular-nums whitespace-nowrap border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {difference > 0 && fullPrice > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                            −{Math.round((difference / fullPrice) * 100)}%
                          </span>
                        ) : (
                          <span className="text-slate-400">0%</span>
                        )}
                      </td>
                      <td className="py-3 text-sm font-medium tabular-nums whitespace-nowrap border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {difference > 0 ? (
                          <span className="text-emerald-600">−{difference.toLocaleString()} ₴</span>
                        ) : (
                          <span className="text-slate-400">0 ₴</span>
                        )}
                      </td>
                      <td className="py-3 border-r border-slate-100 text-center" style={{ padding: '12px 10px' }}>
                        {isSuspended ? (
                          <div>
                            <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded-full text-xs font-medium w-fit mx-auto">
                              <FaPause className="text-[10px]" /> Призупинено
                            </span>
                            {bundle.resumeAt && (
                              <p className="text-[10px] text-amber-600 mt-1">
                                Повернеться {new Date(bundle.resumeAt).toLocaleDateString('uk-UA')}
                              </p>
                            )}
                          </div>
                        ) : bundle.published ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 rounded-full text-xs font-medium w-fit mx-auto">
                            <FaEye className="text-xs" /> Опубліковано
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium w-fit mx-auto">
                            <FaEyeSlash className="text-xs" /> Чернетка
                          </span>
                        )}
                      </td>
                      <td className="py-3" style={{ padding: '12px 10px' }}>
                        <div className="flex flex-col gap-2 items-center">
                          <Link
                            href={`/dashboard/admin/bundles/${bundle.id}`}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 transition-colors w-full"
                          >
                            Редагувати
                          </Link>
                          {bundle.published && (
                            <SuspendButton
                              bundleId={bundle.id}
                              suspendedAt={bundle.suspendedAt?.toISOString() ?? null}
                              resumeAt={bundle.resumeAt?.toISOString() ?? null}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

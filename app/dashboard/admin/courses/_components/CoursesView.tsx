'use client';

import { HiOutlineBookOpen } from 'react-icons/hi2';
import { useAdminTheme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import CourseRow, { type CourseRowData } from './CourseRow';

export default function CoursesView({ rows }: { rows: CourseRowData[] }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const overridesCount = rows.filter(r => r.overridePrice !== null || r.overrideOldPrice !== null).length;

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Курси"
      title="Курси — ціни"
      subtitle="Керуй цінами курсів. Зміни одразу зʼявляються на «Освітні проєкти» та на сторінках курсів."
      rightSlot={
        <div
          className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-300'
              : 'bg-white/70 border-stone-300/60 text-stone-700'
          }`}
        >
          <HiOutlineBookOpen className="text-sm" />
          <span className="tabular-nums">{rows.length} курсів</span>
          {overridesCount > 0 && (
            <span
              className={`ml-1 tabular-nums ${
                dark ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              · {overridesCount} override
            </span>
          )}
        </div>
      }
    >
      <AdminPanel theme={theme} padding="p-0" className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead
              className={`border-b ${
                dark
                  ? 'bg-white/[0.02] border-white/[0.06]'
                  : 'bg-stone-50/60 border-stone-300/50'
              }`}
            >
              <tr>
                <Th theme={theme} width={280}>Курс</Th>
                <Th theme={theme} width={160}>Ціна, ₴</Th>
                <Th theme={theme} width={180}>Стара ціна</Th>
                <Th theme={theme} width={130}>Дефолт</Th>
                <Th theme={theme} width={170} align="center">Дії</Th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
              {rows.map(row => (
                <CourseRow key={row.slug} row={row} theme={theme} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={`md:hidden divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
          {rows.map(row => (
            <CourseRow key={row.slug} row={row} theme={theme} mobile />
          ))}
        </div>
      </AdminPanel>

      <div
        className={`mt-6 rounded-2xl p-5 border text-[12px] leading-relaxed ${
          dark
            ? 'bg-amber-500/[0.06] border-amber-500/15 text-amber-200/90'
            : 'bg-amber-200/25 border-amber-500/30 text-amber-950'
        }`}
      >
        <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
          Як це працює
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Список формується з коду (<code className={`px-1 py-0.5 rounded ${dark ? 'bg-white/[0.05]' : 'bg-white/60'}`}>lib/coursesCatalog.ts</code>). Додавання нового — через розробника.</li>
          <li>«Ціна» — значення, яке зараз бачать відвідувачі сайту.</li>
          <li>«Стара ціна» — якщо заповнена, на сторінці курсу зʼявиться перекреслена. На «Освітніх проєктах» — лише актуальна.</li>
          <li>«Дефолт» — оригінальна ціна з коду. Збігається — override не зберігається.</li>
          <li>«Скинути» — повертає і ціну, і стару ціну до дефолтних.</li>
          <li>Зміна ціни курсу НЕ перераховує пакети автоматично — редагуй в розділі «Пакети».</li>
        </ul>
      </div>
    </AdminShell>
  );
}

function Th({
  theme,
  children,
  width,
  align = 'left',
}: {
  theme: 'dark' | 'light';
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={width ? { minWidth: width } : undefined}
    >
      {children}
    </th>
  );
}

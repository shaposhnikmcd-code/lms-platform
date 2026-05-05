'use client';

import Link from 'next/link';
import { HiOutlineClock } from 'react-icons/hi2';
import { useAdminTheme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import CourseRow, { type CourseRowData } from './CourseRow';
import CategoryRow, { type CategoryRowData } from './CategoryRow';

export default function CoursesView({
  rows,
  categoryRows,
}: {
  rows: CourseRowData[];
  categoryRows: CategoryRowData[];
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';


  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      maxWidth="max-w-[1300px]"
      eyebrow="Admin · Курси"
      title="Курси — ціни"
      subtitle="Керуй цінами курсів. Зміни одразу зʼявляються на «Освітні проєкти» та на сторінках курсів."
      rightSlot={
        <div className="hidden sm:inline-flex items-center gap-2">
          <Link
            href="/dashboard/admin/courses/history"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08] hover:text-white'
                : 'bg-white/70 border-stone-300/60 text-stone-800 hover:bg-white hover:text-stone-900'
            }`}
          >
            <HiOutlineClock className="text-sm" />
            Історія змін
          </Link>
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
                <Th theme={theme} width={260}>Курс</Th>
                <Th theme={theme} width={78} align="center">Ціна, ₴</Th>
                <Th theme={theme} width={78} align="center">Стара ціна</Th>
                <Th theme={theme} width={94} align="center">SP ID</Th>
                <Th theme={theme} width={86} align="center">Дефолт</Th>
                <Th theme={theme} width={143} align="center">Промокод 1</Th>
                <Th theme={theme} width={66} align="center">Ціна 1, ₴</Th>
                <Th theme={theme} width={143} align="center">Промокод 2</Th>
                <Th theme={theme} width={66} align="center">Ціна 2, ₴</Th>
                <Th theme={theme} width={125} align="center">Дії</Th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
              {rows.map(row => (
                <CourseRow key={row.slug} row={row} theme={theme} />
              ))}
              {categoryRows.map(row => (
                <CategoryRow key={row.category} row={row} theme={theme} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={`md:hidden divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
          {rows.map(row => (
            <CourseRow key={row.slug} row={row} theme={theme} mobile />
          ))}
          {categoryRows.map(row => (
            <CategoryRow key={row.category} row={row} theme={theme} mobile />
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
          <li>«Промокод 1/2» — до двох промокодів на курс. Якщо клієнт введе цей код у формі оплати — отримає вказану «Ціну 1/2» замість поточної. Один код можна використати на різних курсах: на кожному курсі ціна буде своя. Заповнюй пару «код + ціна» разом — або обидва, або жодного.</li>
          <li>Іконка-годинник <span className="inline-block align-middle mx-0.5">🕒</span> біля коду — таймер дії: задай «Активний з» / «Активний до» (одну дату або обидві). Колір сигналізує стан: <span className={`font-semibold ${dark ? 'text-amber-300' : 'text-amber-700'}`}>амбер</span> — діє зараз, <span className={`font-semibold ${dark ? 'text-sky-300' : 'text-sky-700'}`}>блакитний</span> — ще не активний (стартує пізніше), <span className={`font-semibold ${dark ? 'text-rose-300' : 'text-rose-700'}`}>червоний</span> — прострочений. Без таймера — діє завжди.</li>
          <li>«Скинути» — повертає всі поля (ціну, стару ціну, обидва промокоди) до дефолтних.</li>
          <li>«SP course ID» — числовий ID курсу в SendPulse Education (Автоматизація → Онлайн-курси → URL). Без нього cron не видаватиме сертифікати автоматично — лише ручна видача через розділ «Сертифікати».</li>
          <li>Зміна ціни курсу НЕ перераховує пакети автоматично — редагуй в розділі «Пакети».</li>
          <li>Усі зміни на цій сторінці записуються в журнал «Історія змін» (хто, коли, що змінив).</li>
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
      className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={width ? { minWidth: width } : undefined}
    >
      {children}
    </th>
  );
}

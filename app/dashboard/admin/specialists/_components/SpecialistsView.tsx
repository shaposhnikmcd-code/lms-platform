'use client';

import { HiOutlineUsers } from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import SpecialistRow, { type SpecialistRowData } from './SpecialistRow';

export default function SpecialistsView({ rows }: { rows: SpecialistRowData[] }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const overridesCount = rows.filter(r => {
    const o = r.override;
    return (
      !!o &&
      (o.price !== null ||
        o.duration !== null ||
        o.btnLabel !== null ||
        o.btnUrl !== null ||
        o.hidden === true)
    );
  }).length;
  const hiddenCount = rows.filter(r => r.override?.hidden === true).length;

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Спеціалісти"
      title="Спеціалісти"
      subtitle="Редагуй ціну, тривалість і посилання на запис. Описи, освіта й сертифікати — під контролем розробника."
      maxWidth="max-w-[1280px]"
      rightSlot={
        <div
          className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-300'
              : 'bg-white/70 border-stone-300/60 text-stone-700'
          }`}
        >
          <HiOutlineUsers className="text-sm" />
          <span className="tabular-nums">{rows.length} спеціалістів</span>
          {overridesCount > 0 && (
            <span className={`ml-1 tabular-nums ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
              · {overridesCount} override
            </span>
          )}
          {hiddenCount > 0 && (
            <span className={`ml-1 tabular-nums ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              · {hiddenCount} сховано
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
                dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-stone-50/60 border-stone-300/50'
              }`}
            >
              <tr>
                <Th theme={theme} minWidth={200}>Спеціаліст</Th>
                <Th theme={theme} minWidth={120}>Вартість</Th>
                <Th theme={theme} minWidth={120}>Тривалість</Th>
                <Th theme={theme} minWidth={170}>Текст кнопки</Th>
                <Th theme={theme} minWidth={240}>Посилання на запис</Th>
                <Th theme={theme} minWidth={90} align="center">Показ</Th>
                <Th theme={theme} minWidth={150} align="center">Дії</Th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
              {rows.map(row => (
                <SpecialistRow key={row.slug} row={row} theme={theme} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={`md:hidden divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
          {rows.map(row => (
            <SpecialistRow key={row.slug} row={row} theme={theme} mobile />
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
        <p
          className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 ${
            dark ? 'text-amber-300' : 'text-amber-800'
          }`}
        >
          Як це працює
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Список спеціалістів формується з коду. Додавання нового — через розробника.</li>
          <li>Порожнє поле = значення за замовчуванням (показується блідим плейсхолдером).</li>
          <li>«Скинути» — повертає всі поля спеціаліста до дефолтних.</li>
          <li>
            «Сховати» — спеціаліст тимчасово не показується на сторінці{' '}
            <code className={`px-1 py-0.5 rounded ${dark ? 'bg-white/[0.05]' : 'bg-white/60'}`}>
              /consultations
            </code>.
          </li>
        </ul>
      </div>
    </AdminShell>
  );
}

function Th({
  theme,
  children,
  minWidth,
  align = 'left',
}: {
  theme: Theme;
  children: React.ReactNode;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={minWidth ? { minWidth } : undefined}
    >
      {children}
    </th>
  );
}

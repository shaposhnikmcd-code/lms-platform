'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../../_components/adminTheme';

/// Інформаційна модалка — пояснює, як працює cohort-система: запуски, дати, розсилка,
/// розрахунок доступу для разової/автоматичної підписки, перенесення між запусками.
export default function CohortInfoModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  if (!mounted) return null;

  const sections: { title: string; bullets: { strong?: string; text: string }[] }[] = [
    {
      title: 'Що таке "Запуск" програми',
      bullets: [
        { strong: 'Запуск (cohort) ', text: '— це навчальна когорта з фіксованими датами старту й завершення. Наприклад, "Річна програма 2026" зі стартом 01.09.2026 і кінцем 31.05.2027.' },
        { strong: 'Поточний запуск ', text: '— той, у який автоматично потрапляють усі нові оплати. Тільки один запуск може бути поточним.' },
        { text: 'Створюючи новий запуск, можна автоматично зробити його поточним — попередній перестане приймати нові оплати.' },
      ],
    },
    {
      title: '🚀 Кнопка "Запустити програму"',
      bullets: [
        { text: 'Виконує одразу 3 дії:' },
        { strong: '1. ', text: 'Відкриває доступ у SendPulse усім підписникам цього запуску, що оплатили.' },
        { strong: '2. ', text: 'Перераховує "Доступ до" для кожної підписки за новою логікою (від дати запуску, а не оплати).' },
        { strong: '3. ', text: 'Фіксує дату фактичного запуску. Після цього вже не можна додавати нових підписників і переносити їх в інший запуск.' },
        { text: 'Welcome-розсилка тут НЕ відправляється — це окрема кнопка "Запустити розсилку".' },
      ],
    },
    {
      title: '✉️ Кнопка "Запустити розсилку"',
      bullets: [
        { text: 'Welcome-листи для всіх підписників запуску. Можна:' },
        { strong: 'Зараз ', text: '— миттєва послідовна відправка через Resend.' },
        { strong: 'Запланувати ', text: '— вибираєш дату+час, cron перевіряє щодоби о 04:00 UTC й відправляє листи.' },
        { text: 'Дублі виключені — повторне натискання не надішле тим, хто вже отримав. Розсилку можна виконати незалежно від запуску — навіть до натискання "Запустити програму".' },
      ],
    },
    {
      title: '📧 Кнопка "E-mail запуску"',
      bullets: [
        { text: 'Редактор шаблона welcome-листа (subject + HTML body). Зберігається на cohort-і.' },
        { strong: 'Плейсхолдери: ', text: '{{name}}, {{email}}, {{startDate}}, {{endDate}}, {{cohortName}} — підставляються при відправці.' },
        { text: 'Попередній перегляд показує лист з прикладовими даними. Тестова відправка дозволяє надіслати лист на ваш email перед справжньою розсилкою.' },
      ],
    },
    {
      title: 'Як рахується "Доступ до"',
      bullets: [
        { strong: 'Річний план: ', text: 'доступ завжди = дата завершення запуску, незалежно від часу оплати.' },
        { strong: 'Місячний автоплатіж до старту запуску: ', text: 'доступ = дата старту + N×30 днів, де N — кількість успішних списань (max 9).' },
        { strong: 'Місячний автоплатіж після старту запуску: ', text: 'доступ = дата першої оплати + N×30 днів. WFP-регулярка обмежена так, щоб останнє списання припало на останній повний місяць до завершення запуску. Залишок днів вирішується з менеджером напряму.' },
        { strong: 'Місячний разовий: ', text: 'доступ = дата оплати + 30 днів (стандартна логіка).' },
      ],
    },
    {
      title: 'Перенесення підписки в інший запуск',
      bullets: [
        { text: 'У розкритому рядку підписки є кнопка "Перенести в наступний запуск". Доступно тільки до моменту натискання "Запустити програму" — після запуску підписка вже прив\'язана до доступу в SendPulse, перенос не безпечний.' },
        { text: 'При перенесенні "Доступ до" автоматично перераховується для нового запуску.' },
      ],
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-3xl w-full max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
          <h3 className="text-base font-bold">Як працює система запусків</h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {sections.map((s) => (
            <section key={s.title}>
              <h4 className={`text-[12px] uppercase tracking-wider font-semibold mb-2 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>{s.title}</h4>
              <ul className="space-y-1.5">
                {s.bullets.map((b, i) => (
                  <li key={i} className={`text-[13px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                    {b.strong && <strong className={dark ? 'text-slate-100' : 'text-stone-900'}>{b.strong}</strong>}
                    {b.text}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

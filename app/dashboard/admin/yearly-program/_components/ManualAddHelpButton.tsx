'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineInformationCircle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';

/// Маленька «i»-кнопка поряд з «➕ Додати студента вручну», що відкриває модалку
/// з покроковою інструкцією повного флоу (додавання → оплата → доступ у SendPulse → Telegram).
export default function ManualAddHelpButton({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Як працює ручне додавання"
        title="Як працює ручне додавання — покрокова інструкція"
        className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors ${
          dark
            ? 'text-sky-300 border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25'
            : 'text-sky-800 border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25'
        }`}
      >
        <HiOutlineInformationCircle className="text-[15px]" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div
            className={`relative w-full max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
              dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
            }`}
            style={{ maxWidth: 'min(620px, 96vw)' }}
          >
            {/* HEADER */}
            <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${
              dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
                  dark ? 'bg-sky-400/15 text-sky-300 border border-sky-400/30' : 'bg-sky-100 text-sky-800 border border-sky-300/60'
                }`}>
                  <HiOutlineInformationCircle />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold leading-tight">Як додати студента вручну</h3>
                  <p className={`text-[11.5px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                    Покрокова інструкція: від додавання до доступу
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрити"
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
                  dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
                }`}
              >✕</button>
            </header>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-6 py-5 space-y-4">
              <Step theme={theme} n={1} title="Додати студента">
                Натисни <b>«➕ Додати студента вручну»</b> → заповни <b>email</b> (обовʼязково), імʼя,
                план (Річний / Місячний), запуск і Telegram-нік. Якщо студента ще немає в системі —
                лиши галку <b>«Створити акаунт і надіслати лист для пароля»</b>.
                <Note theme={theme}>
                  Студент зʼявиться у списку зі статусом <Pill theme={theme} tone="amber">Очікує</Pill> —
                  доступу ще немає, «Дохід» не змінюється.
                </Note>
              </Step>

              <Step theme={theme} n={2} title="Підтвердити оплату">
                На рядку студента натисни стрілочку ліворуч (розкрити деталі) → <b>💵 «Підтвердити оплату
                вручну»</b> → вкажи суму та спосіб (готівка / переказ / напряму) → «Підтвердити».
                <Note theme={theme}>
                  Статус стане <Pill theme={theme} tone="emerald">Активний</Pill>, сума потрапить у «Дохід»
                  та історію платежів. Це обовʼязковий крок — без зафіксованої оплати доступ у SendPulse
                  не відкривається.
                </Note>
              </Step>

              <Step theme={theme} n={3} title="Доступ до програми (SendPulse)">
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <b>Якщо Річну ще не запущено</b> → доступ відкриється автоматично на загальному
                    запуску <b>«🚀 Запустити програму»</b>, разом з усіма студентами. Тоді ж піде welcome-лист.
                  </li>
                  <li>
                    <b>Якщо Річну вже запущено</b> → доступ у SendPulse відкриється <b>одразу після кроку 2</b>
                    {' '}(💵), плюс автоматично піде welcome-лист. Нічого більше тиснути не треба.
                  </li>
                </ul>
              </Step>

              <Step theme={theme} n={4} title="Telegram-канал (за потреби)" last>
                Кнопка <b>📨 «Надіслати Welcome E-mail з запрошенням в Telegram»</b> шле студенту лист
                із посиланням на Telegram-канал.
                <Note theme={theme}>
                  Це лише для каналу — на доступ до курсу <b>не впливає</b>. Зазвичай welcome-лист із
                  Telegram-запрошенням іде автоматично на кроці 3; ця кнопка — для повторної відправки.
                </Note>
              </Step>
            </div>

            {/* FOOTER */}
            <footer className={`shrink-0 flex items-center justify-end px-6 py-4 border-t ${
              dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
            }`}>
              <button
                onClick={() => setOpen(false)}
                className={`px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors ${
                  dark
                    ? 'bg-sky-500/15 text-sky-200 border-sky-400/30 hover:bg-sky-500/25'
                    : 'bg-sky-50 text-sky-900 border-sky-300/60 hover:bg-sky-100'
                }`}
              >
                Зрозуміло
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Step({
  theme, n, title, last, children,
}: { theme: Theme; n: number; title: string; last?: boolean; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
          dark ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40' : 'bg-sky-100 text-sky-800 border border-sky-300/70'
        }`}>
          {n}
        </span>
        {!last && <span className={`flex-1 w-px mt-1 ${dark ? 'bg-white/10' : 'bg-stone-300/70'}`} />}
      </div>
      <div className="min-w-0 pb-1">
        <div className={`text-[13.5px] font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{title}</div>
        <div className={`text-[12.5px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{children}</div>
      </div>
    </div>
  );
}

function Note({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <div className={`mt-2 px-3 py-2 rounded-lg text-[12px] leading-relaxed ${
      dark ? 'bg-white/[0.04] text-slate-300' : 'bg-white/70 text-stone-600 border border-stone-200/70'
    }`}>
      {children}
    </div>
  );
}

function Pill({ theme, tone, children }: { theme: Theme; tone: 'amber' | 'emerald'; children: React.ReactNode }) {
  const dark = theme === 'dark';
  const cls = tone === 'amber'
    ? (dark ? 'bg-amber-500/15 text-amber-200 border-amber-400/30' : 'bg-amber-100 text-amber-900 border-amber-300/60')
    : (dark ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-emerald-100 text-emerald-900 border-emerald-300/60');
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${cls}`}>
      {children}
    </span>
  );
}

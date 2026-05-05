'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineChevronDown } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';

/// Модалка "Флоу роботи Річної програми" — візуальна схема всіх етапів від оплати
/// до закриття доступу + бічні гілки (late payer / cancel / retry) + ключові деталі
/// розрахунку доступу і перенесення підписки.

type Step = {
  icon: string;
  title: string;
  desc: string;
};

type Phase = {
  num: number;
  label: string;
  title: string;
  subtitle: string;
  /// Назви Tailwind-класів для accent-кольору фази (light і dark варіанти).
  accent: {
    badgeLight: string;
    badgeDark: string;
    headerLight: string;
    headerDark: string;
    rimLight: string;
    rimDark: string;
  };
  steps: Step[];
};

const PHASES: Phase[] = [
  {
    num: 1,
    label: 'Оплата',
    title: 'Студент платить — підписка створюється',
    subtitle: 'Автоматично, без участі адміна.',
    accent: {
      badgeLight: 'bg-sky-100 text-sky-900 border-sky-300/60',
      badgeDark: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
      headerLight: 'text-sky-900',
      headerDark: 'text-sky-200',
      rimLight: 'border-sky-200/70 bg-sky-50/40',
      rimDark: 'border-sky-400/20 bg-sky-500/[0.04]',
    },
    steps: [
      { icon: '💳', title: 'Оплата через WayForPay', desc: 'YEARLY (15000 грн разово) або MONTHLY (2200 грн × до 9 списань).' },
      { icon: '📦', title: 'Створюється підписка', desc: 'YearlyProgramSubscription у статусі PENDING. Лінкується з Payment.' },
      { icon: '📌', title: 'Прив\'язка до поточного запуску', desc: 'Підписка автоматично потрапляє в той cohort, що позначений як "Поточний".' },
    ],
  },
  {
    num: 2,
    label: 'Запуск',
    title: 'Адмін запускає cohort',
    subtitle: 'Дві дії менеджера. Одна одну не блокує.',
    accent: {
      badgeLight: 'bg-amber-100 text-amber-900 border-amber-300/60',
      badgeDark: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
      headerLight: 'text-amber-900',
      headerDark: 'text-amber-200',
      rimLight: 'border-amber-200/70 bg-amber-50/50',
      rimDark: 'border-amber-400/25 bg-amber-500/[0.05]',
    },
    steps: [
      { icon: '🚀', title: 'Запустити програму', desc: 'Відкриває доступ у SendPulse усім, хто оплатив. Перераховує "Доступ до" від дати запуску. Фіксує дату фактичного запуску.' },
      { icon: '✉️', title: 'Запустити розсилку', desc: 'Welcome-листи всім підписникам через Resend. Можна одразу або запланувати на дату — cron щодоби о 04:00 UTC. Дублі виключено.' },
      { icon: '📧', title: 'E-mail запуску', desc: 'Редактор шаблону welcome-листа на cohort-і. Плейсхолдери: {{name}}, {{startDate}}, {{endDate}}, {{cohortName}}.' },
    ],
  },
  {
    num: 3,
    label: 'Навчання',
    title: 'Активне навчання',
    subtitle: 'Студент в SendPulse. Платформа автоматично продовжує доступ.',
    accent: {
      badgeLight: 'bg-emerald-100 text-emerald-900 border-emerald-300/60',
      badgeDark: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
      headerLight: 'text-emerald-900',
      headerDark: 'text-emerald-200',
      rimLight: 'border-emerald-200/70 bg-emerald-50/40',
      rimDark: 'border-emerald-400/20 bg-emerald-500/[0.04]',
    },
    steps: [
      { icon: '✅', title: 'Доступ у SendPulse', desc: 'Підписка ACTIVE. Студент проходить курс на платформі SendPulse Education.' },
      { icon: '🔄', title: 'Monthly autopay', desc: 'WFP списує по 2200 грн щомісяця. Кожне успішне списання продовжує "Доступ до" на 30 днів (max 9 циклів).' },
      { icon: '📨', title: 'Нагадування cron-ом', desc: 'За 3 і за 1 день до закінчення доступу cron надсилає e-mail про близьке завершення.' },
    ],
  },
  {
    num: 4,
    label: 'Завершення',
    title: 'Доступ закривається',
    subtitle: 'Cron щодоби о 04:00 UTC переводить статуси й закриває доступ у SendPulse.',
    accent: {
      badgeLight: 'bg-stone-200 text-stone-800 border-stone-300/70',
      badgeDark: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
      headerLight: 'text-stone-800',
      headerDark: 'text-slate-200',
      rimLight: 'border-stone-300/60 bg-stone-100/40',
      rimDark: 'border-slate-400/20 bg-slate-500/[0.04]',
    },
    steps: [
      { icon: '🟡', title: 'Grace 7 днів', desc: 'Після expiresAt підписка переходить ACTIVE → GRACE. Сім днів буфера: студент ще має доступ.' },
      { icon: '🔒', title: 'EXPIRED', desc: 'Через 7 днів cron закриває доступ у SendPulse (DELETE /students/{id}/{courseId}) і шле e-mail про закриття. Статус — "Доступ закрито".' },
      { icon: '📜', title: 'Подія в логах', desc: 'Усі переходи фіксуються в YearlyProgramSubscriptionEvent — видно в адмінці у розкритому рядку підписки на вкладці "Події".' },
    ],
  },
];

type Branch = {
  emoji: string;
  title: string;
  desc: string;
  accentLight: string;
  accentDark: string;
};

const BRANCHES: Branch[] = [
  {
    emoji: '🎯',
    title: 'Late payer — Екстра Запуск',
    desc: 'Якщо студент оплатив ПІСЛЯ того, як cohort вже запущено. Платформа сама запустить для нього доступ + welcome-лист, як тільки прийде callback від WFP.',
    accentLight: 'border-sky-300/60 bg-sky-50/50 text-sky-900',
    accentDark: 'border-sky-400/30 bg-sky-500/[0.06] text-sky-100',
  },
  {
    emoji: '❌',
    title: 'Скасування підписки',
    desc: 'Адмін або сам студент може скасувати — статус CANCELLED, autopay у WFP вимикається через regularApi REMOVE. Доступ зберігається до кінця сплаченого періоду.',
    accentLight: 'border-rose-300/60 bg-rose-50/50 text-rose-900',
    accentDark: 'border-rose-400/30 bg-rose-500/[0.06] text-rose-100',
  },
  {
    emoji: '🔁',
    title: 'Помилка запуску — Повторити',
    desc: 'Якщо для частини підписок не вдалося відкрити доступ (rate-limit / мережа) — біля "Запустити програму" з\'явиться "Повторити запуск (N)". Idempotent — кому вже відкрито, того пропустить.',
    accentLight: 'border-amber-300/60 bg-amber-50/50 text-amber-900',
    accentDark: 'border-amber-400/30 bg-amber-500/[0.06] text-amber-100',
  },
];

const ACCESS_RULES: { strong: string; text: string }[] = [
  { strong: 'Річний план: ', text: '"Доступ до" = дата завершення запуску, незалежно від часу оплати.' },
  { strong: 'Місячний автоплатіж до старту запуску: ', text: 'дата старту + N×30 днів, де N — кількість успішних списань (max 9).' },
  { strong: 'Місячний автоплатіж після старту запуску: ', text: 'дата першої оплати + N×30 днів. WFP-регулярка обмежена так, щоб останнє списання припало на останній повний місяць до завершення запуску.' },
  { strong: 'Місячний разовий: ', text: 'дата оплати + 30 днів (стандартна логіка).' },
];

export default function WorkflowModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-800 border border-amber-300/60'
            }`}>🗓️</div>
            <div>
              <h3 className="text-[16px] font-bold leading-tight">Флоу роботи Річної програми</h3>
              <p className={`text-[12px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Від оплати студента до закриття доступу</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
            }`}
          >✕</button>
        </div>

        <div className="px-6 py-6 space-y-7">
          {/* Hero opener */}
          <div className={`rounded-xl border px-5 py-4 ${dark ? 'bg-amber-500/[0.05] border-amber-400/20' : 'bg-amber-50/60 border-amber-200/70'}`}>
            <p className={`text-[13px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
              Усе крутиться навколо <strong className={dark ? 'text-amber-200' : 'text-amber-900'}>запуску (cohort)</strong> — це навчальна когорта з фіксованими датами старту й завершення. Тільки один cohort одночасно "поточний" — у нього потрапляють усі нові оплати. Створюючи новий, можна автоматично передати йому статус поточного — попередній припинить приймати нові підписки.
            </p>
          </div>

          {/* Vertical phase timeline */}
          <div>
            <h4 className={`text-[11px] uppercase tracking-[0.2em] font-semibold mb-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Основний потік
            </h4>

            <div className="space-y-0">
              {PHASES.map((p, idx) => (
                <div key={p.num}>
                  <PhaseCard phase={p} dark={dark} />
                  {idx < PHASES.length - 1 && (
                    <div className="flex justify-center py-2.5">
                      <HiOutlineChevronDown className={`text-2xl ${dark ? 'text-slate-600' : 'text-stone-400'}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Side branches */}
          <div>
            <h4 className={`text-[11px] uppercase tracking-[0.2em] font-semibold mb-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Окремі гілки
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BRANCHES.map((b) => (
                <div
                  key={b.title}
                  className={`rounded-xl border px-4 py-3.5 ${dark ? b.accentDark : b.accentLight}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[18px] leading-none">{b.emoji}</span>
                    <h5 className="text-[13px] font-bold leading-tight">{b.title}</h5>
                  </div>
                  <p className={`text-[12px] leading-relaxed ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Access rules */}
          <div className={`rounded-xl border px-5 py-4 ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-stone-50/60 border-stone-200'}`}>
            <h4 className={`text-[11px] uppercase tracking-[0.2em] font-semibold mb-3 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Як рахується "Доступ до"
            </h4>
            <ul className="space-y-2">
              {ACCESS_RULES.map((r, i) => (
                <li key={i} className={`text-[12.5px] leading-relaxed flex gap-2 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                  <span className={`mt-[7px] flex-shrink-0 w-1 h-1 rounded-full ${dark ? 'bg-amber-400' : 'bg-amber-700'}`} />
                  <span><strong className={dark ? 'text-slate-100' : 'text-stone-900'}>{r.strong}</strong>{r.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer note */}
          <div className={`rounded-lg border-l-4 px-4 py-3 ${dark ? 'bg-white/[0.02] border-amber-400/40' : 'bg-amber-50/40 border-amber-400'}`}>
            <p className={`text-[12px] leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              <strong className={dark ? 'text-slate-200' : 'text-stone-900'}>Перенесення підписки:</strong> у розкритому рядку є кнопка "Перенести в наступний запуск". Доступно тільки <em>до</em> натискання "🚀 Запустити програму" — після запуску підписка вже прив'язана до доступу в SendPulse, перенос не безпечний.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhaseCard({ phase, dark }: { phase: Phase; dark: boolean }) {
  const a = phase.accent;
  return (
    <div className={`rounded-xl border ${dark ? a.rimDark : a.rimLight} overflow-hidden`}>
      {/* Phase header strip */}
      <div className={`px-5 py-3 border-b ${dark ? 'border-white/[0.06]' : 'border-stone-200/60'} flex items-center gap-3`}>
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold border ${dark ? a.badgeDark : a.badgeLight}`}>
          {phase.num}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${dark ? a.headerDark : a.headerLight}`}>
            {phase.label}
          </div>
          <h5 className={`text-[14px] font-bold leading-tight ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {phase.title}
          </h5>
        </div>
      </div>

      {/* Phase body */}
      <div className="px-5 py-4">
        <p className={`text-[12px] mb-3 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{phase.subtitle}</p>
        <ul className="space-y-2.5">
          {phase.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[14px] ${
                dark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-white border border-stone-200'
              }`}>{s.icon}</span>
              <div className="min-w-0">
                <div className={`text-[13px] font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{s.title}</div>
                <div className={`text-[12px] leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{s.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

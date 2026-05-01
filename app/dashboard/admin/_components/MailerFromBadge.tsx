'use client';

import { useEffect, useState } from 'react';
import { HiOutlineEnvelope, HiOutlineExclamationTriangle, HiOutlineInformationCircle } from 'react-icons/hi2';
import type { Theme } from './adminTheme';

/// Універсальний бейдж "Адреса відправлення" для адмінок, які запускають розсилки
/// (Річна програма, Сертифікати, контакт-форма). Підтягує From-адресу з
/// `/api/admin/mailer-config` і показує її разом з warning-ом, якщо `RESEND_API_KEY`
/// не налаштовано (dev-режим — листи лише в консолі).
///
/// Дизайн: компактна pill-плашка з конвертом і monospace-email; tooltip-icon
/// розкриває коротке пояснення при ховері. Адаптується під light/dark теми.
export default function MailerFromBadge({
  theme,
  variant = 'default',
}: {
  theme: Theme;
  /// `default` — повна плашка з підписом "Адреса відправлення".
  /// `compact` — без підпису, тільки конверт + email (для тісних місць).
  variant?: 'default' | 'compact';
}) {
  const dark = theme === 'dark';
  const [config, setConfig] = useState<{ fromEmail: string; resendConfigured: boolean } | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/mailer-config')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!config) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] animate-pulse ${
        dark ? 'bg-white/[0.02] border-white/[0.06] text-slate-500' : 'bg-stone-50 border-stone-200 text-stone-400'
      }`}>
        <HiOutlineEnvelope className="text-base" />
        <span>Завантажую…</span>
      </div>
    );
  }

  // Парсимо "Display Name <email@domain>" формат для красивого показу.
  const match = /^(.+?)\s*<([^>]+)>$/.exec(config.fromEmail);
  const displayName = match?.[1] ?? null;
  const justEmail = match?.[2] ?? config.fromEmail;

  const ok = config.resendConfigured;

  return (
    <div className="relative inline-flex items-stretch">
      <div className={`inline-flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 rounded-lg border text-[12px] transition-colors ${
        ok
          ? dark
            ? 'bg-amber-400/[0.08] border-amber-400/20 text-amber-100'
            : 'bg-amber-50 border-amber-300/50 text-amber-900'
          : dark
            ? 'bg-rose-500/[0.08] border-rose-400/20 text-rose-200'
            : 'bg-rose-50 border-rose-300/50 text-rose-900'
      }`}>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${
          ok
            ? dark ? 'bg-amber-400/15 text-amber-300' : 'bg-amber-200/60 text-amber-700'
            : dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-200/60 text-rose-700'
        }`}>
          {ok ? <HiOutlineEnvelope className="text-sm" /> : <HiOutlineExclamationTriangle className="text-sm" />}
        </span>

        {variant === 'default' && (
          <span className={`text-[10px] uppercase tracking-[0.18em] font-medium leading-none ${
            ok
              ? dark ? 'text-amber-300/80' : 'text-amber-700/80'
              : dark ? 'text-rose-300/80' : 'text-rose-700/80'
          }`}>
            Відправляємо з
          </span>
        )}

        <span className="flex flex-col leading-tight">
          {displayName && variant === 'default' && (
            <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{displayName}</span>
          )}
          <span className={`font-mono text-[12px] tabular-nums ${
            ok
              ? dark ? 'text-amber-100' : 'text-amber-900'
              : dark ? 'text-rose-100' : 'text-rose-900'
          }`}>
            {justEmail}
          </span>
        </span>

        <button
          type="button"
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          aria-label="Що це за адреса"
          className={`ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
            ok
              ? dark ? 'text-amber-300/60 hover:text-amber-300 hover:bg-amber-400/10' : 'text-amber-700/60 hover:text-amber-800 hover:bg-amber-200/60'
              : dark ? 'text-rose-300/60 hover:text-rose-300 hover:bg-rose-400/10' : 'text-rose-700/60 hover:text-rose-800 hover:bg-rose-200/60'
          }`}
        >
          <HiOutlineInformationCircle className="text-sm" />
        </button>
      </div>

      {tooltipOpen && (
        <div
          role="tooltip"
          className={`absolute top-full left-0 mt-1.5 w-[300px] z-30 rounded-lg shadow-xl px-3 py-2 text-[11px] leading-relaxed pointer-events-none ${
            dark ? 'bg-zinc-800 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-700'
          }`}
        >
          {ok ? (
            <>
              Це адреса, з якої ваші учасники побачать вхідний лист (поле <code className="opacity-75">From</code>).
              Усі масові розсилки, сертифікати та системні сповіщення інституту йдуть саме з неї.
              <div className={`mt-1.5 pt-1.5 border-t text-[10px] ${dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-200 text-stone-500'}`}>
                Налаштовується через <code>RESEND_FROM_EMAIL</code> у env.
              </div>
            </>
          ) : (
            <>
              <strong>RESEND_API_KEY не сконфігуровано.</strong> Листи не йдуть нікуди — лише логуються в консоль сервера.
              Це нормально для локальної розробки. На pre-production / prod має бути виставлено.
            </>
          )}
        </div>
      )}
    </div>
  );
}

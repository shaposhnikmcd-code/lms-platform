'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { SUPPORT_TG } from '@/lib/emailTemplates/reminderTemplates';
import { RENEW_ANCHOR, RENEW_ENTRY_ANCHOR, RENEW_EXPIRED_FLAG } from '@/lib/yearlyProgramRenew';
import { renewBlockCopy, renewDeadLinkCopy, renewStopsAutopayCopy, type RenewTranslator } from '@/lib/yearlyProgramRenewCopy';
import type { RenewState } from '@/lib/yearlyProgramRenewState';
import { YEARLY_PROGRAM } from '../config';

/// Блок «Оплата наступного модуля» одразу під hero сторінки. Показується лише тому, хто прийшов
/// за персональним посиланням із листа: токен лежить у httpOnly-cookie, яку поставив
/// `/yearly-program/renew/<token>`, а стан приходить з `/api/yearly-program/renew-state`.
///
/// Чому компонент клієнтський, хоч дані серверні: сама сторінка /yearly-program статична
/// (ISR), і читати персональний стан на сервері означало б або зламати кеш, або віддавати
/// одному студенту сторінку, закешовану для іншого. Тому персональна частина довантажується
/// окремим запитом, який кешу не має взагалі.
///
/// Тексти — з `messages/*.json` (простір `RenewPanel`): рядок «Оплатити наступний модуль»
/// під карткою тарифу на /en і /pl уже перекладений, і панель, яка веде в ту саму оплату,
/// не має обривати сторінку українським блоком.

/// `useTranslations` типізований під конкретні ключі; адаптер у `lib/yearlyProgramRenewCopy`
/// будує ключі динамічно (`blocks.<reason>.title`), тож звужуємо до простого підпису.
function useRenewT(): RenewTranslator {
  const t = useTranslations('RenewPanel');
  return (key, values) => t(key as never, values as never);
}

/// Назва місяця модуля мовою сторінки. Для uk — готовий `monthLabel` з сервера (він і
/// так український); для інших локалей — з `startsAt` тим самим форматом (UTC, як сітка).
function monthLabelFor(locale: string, module: { monthLabel: string; startsAt: Date | string }): string {
  if (locale === 'uk') return module.monthLabel;
  const tag = locale === 'pl' ? 'pl-PL' : 'en-GB';
  return new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(module.startsAt));
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section id={RENEW_ANCHOR} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-2 scroll-mt-24">
      <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/45 via-[#D4A017]/12 to-transparent">
        <div className="rounded-2xl bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] overflow-hidden">
          <div className="px-5 sm:px-8 py-6 sm:py-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Who({ name, email }: { name: string | null; email: string }) {
  return (
    <div className="text-white/70 text-[13px] mt-1">
      {name ? <span className="text-white font-semibold">{name}</span> : null}
      {name ? ' · ' : null}
      <span className="break-all">{email}</span>
    </div>
  );
}

function SupportLine({ text }: { text: string }) {
  const t = useTranslations('RenewPanel');
  return (
    <p className="text-white/70 text-[13px] leading-relaxed mt-3">
      {text}{' '}
      <a
        href={SUPPORT_TG}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#D4A017] font-semibold underline underline-offset-2 cursor-pointer whitespace-nowrap"
      >
        {t('managerLink')}
      </a>
      .
    </p>
  );
}

/// Мертве посилання. Два входи, один текст: `?renew=expired` — редирект route handler-а
/// по зіпсованому/простроченому токену (до бази ми взагалі не ходили), `kind: 'invalid'` —
/// підпис живий, але підписка вже не та, для якої посилання видали.
///
/// Порожнього рендера тут бути не може: людина прийшла за посиланням з листа про гроші,
/// і мовчазна сторінка читається як поламаний сайт. Тому кажемо і що сталося, і два
/// робочі виходи — оплатити нижче або взяти нове посилання в менеджера.
function DeadLinkNotice() {
  const copy = renewDeadLinkCopy(useRenewT());
  return (
    <Frame>
      <h2 className="text-xl sm:text-2xl font-bold text-white">{copy.title}</h2>
      <p className="text-white/80 text-[14px] leading-relaxed mt-4 max-w-2xl">{copy.body}</p>
      <a
        href={`#${RENEW_ENTRY_ANCHOR}`}
        className="inline-flex items-center justify-center min-h-[44px] mt-4 px-5 py-2.5 rounded-xl bg-[#D4A017] hover:bg-[#c29214] text-white text-[14px] font-semibold cursor-pointer transition-colors"
      >
        {copy.action}
      </a>
      <SupportLine text={copy.support} />
    </Frame>
  );
}

export default function RenewPanel() {
  const rt = useRenewT();
  const t = useTranslations('RenewPanel');
  const locale = useLocale();
  const [state, setState] = useState<RenewState | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('renew') === RENEW_EXPIRED_FLAG) {
      setExpired(true);
      return;
    }
    const ctrl = new AbortController();
    fetch('/api/yearly-program/renew-state', { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.status === 204 ? null : r.json()))
      .then((data) => { if (data) setState(data as RenewState); })
      // Мережева помилка — просто не показуємо блок. Картки тарифів нижче лишаються
      // повноцінним шляхом оплати, тож глухого кута немає.
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Скрол до блоку робимо САМІ: браузер відпрацював `#renew` ще до того, як панель
  // зʼявилась у DOM, тож нативний якір нікуди не привів.
  //
  // Мертве посилання скролимо ЗАВЖДИ, незалежно від якоря: редирект `?renew=expired`
  // якоря не має, а панель стоїть під hero на весь екран — без скролу людина з листа
  // бачила звичайний лендінг і не дізнавалась, що посилання не спрацювало.
  const dead = expired || state?.kind === 'invalid';
  useEffect(() => {
    if (!state && !expired) return;
    if (!dead && window.location.hash !== `#${RENEW_ANCHOR}`) return;
    document.getElementById(RENEW_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, [state, expired, dead]);

  if (expired) return <DeadLinkNotice />;
  if (!state) return null;
  if (state.kind === 'invalid') return <DeadLinkNotice />;

  if (state.kind === 'blocked') {
    const copy = renewBlockCopy(rt, state.reason, state.missedModules ?? 0);
    return (
      <Frame>
        <h2 className="text-xl sm:text-2xl font-bold text-white">{copy.title}</h2>
        <Who name={state.name} email={state.email} />
        <p className="text-white/80 text-[14px] leading-relaxed mt-4 max-w-2xl">{copy.body}</p>
        <SupportLine text={copy.support} />
      </Frame>
    );
  }

  const nextModule = state.module;
  return (
    <Frame>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-block px-3 py-1 bg-[#D4A017] text-white rounded-full text-[11px] font-semibold tracking-wide mb-3">
            {t('badge')}
          </div>
          <Who name={state.name} email={state.email} />
          <div className="mt-4 text-white text-lg sm:text-xl font-bold">
            {t('moduleOf', { number: nextModule.number, total: nextModule.total })}
            <span className="text-[#D4A017] font-semibold"> · {monthLabelFor(locale, nextModule)}</span>
          </div>
          <p className="text-white/60 text-[13px] mt-2 max-w-md leading-relaxed">
            {t('oneModuleNote')}
          </p>
          {state.stopsAutopay && state.stopsAutopayReason ? (
            <p className="text-white/80 text-[13px] mt-2 max-w-md leading-relaxed">
              {renewStopsAutopayCopy(rt, state.stopsAutopayReason)}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 md:text-right">
          <div className="flex items-baseline gap-1.5 md:justify-end mb-3">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
              {state.price}
            </span>
            <span className="text-white/50 text-sm font-medium">{t('currency')}</span>
          </div>
          <CoursePurchaseModal
            courseName={t('courseName')}
            price={state.price}
            courseId={YEARLY_PROGRAM.monthlyCourseId}
            currency={t('currency')}
            buttonLabel={t('payButton')}
            renewFlow
            lockRecurring
            invitePrefill={{
              email: state.email,
              name: state.name,
              plan: 'MONTHLY',
              autoRenew: false,
              phone: state.prefill.phone,
              country: state.prefill.country,
              telegram: state.prefill.telegram,
            }}
          />
        </div>
      </div>
    </Frame>
  );
}

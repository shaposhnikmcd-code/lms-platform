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

/// «30 листопада 2026» мовою сторінки. Дати модулів і кінець набору — UTC (як сітка).
function dayLabelFor(locale: string, date: Date | string): string {
  const tag = locale === 'pl' ? 'pl-PL' : locale === 'en' ? 'en-GB' : 'uk-UA';
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(date))
    .replace(/\s*р\.$/, '');
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

  return <PayableRenew state={state} />;
}

type PayableState = Extract<RenewState, { kind: 'payable' }>;

/// Оплата за посиланням: скільки модулів одним платежем (1…залишок) або автоплатіж.
/// Обидва режими взаємовиключні — так само, як у `/api/wayforpay` (400
/// `modules_with_autopay`): автоплатіж оплачує один модуль зараз, решту WFP спише сам.
function PayableRenew({ state }: { state: PayableState }) {
  const rt = useRenewT();
  const t = useTranslations('RenewPanel');
  const locale = useLocale();
  const [modules, setModules] = useState(1);
  const [autopay, setAutopay] = useState(false);

  const nextModule = state.module;
  // Старий сервер (кеш під час деплою) нових полів не віддасть — тоді поводимось як
  // раніше: один модуль, без автоплатежу.
  const maxModules = Math.max(1, state.maxModules ?? 1);
  const options = state.options ?? [];
  const n = autopay ? 1 : Math.min(modules, maxModules);
  const option = options.find((o) => o.modules === n) ?? null;
  const offer = state.autopay ?? null;
  const amount = state.price * n;

  const firstMonth = monthLabelFor(locale, nextModule);
  // Місяць останнього модуля діапазону мовою сторінки: модулі сітки = сусідні місяці.
  const lastStartsAt = (() => {
    const d = new Date(nextModule.startsAt);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n - 1, d.getUTCDate()));
  })();
  const lastMonth = locale === 'uk' && option
    ? option.last.monthLabel
    : monthLabelFor(locale, { monthLabel: option?.last.monthLabel ?? '', startsAt: lastStartsAt });

  const note = autopay ? null : n === 1 ? t('oneModuleNote') : t('manyModulesNote', { count: n });
  const paidThroughLine = option && !autopay
    ? t(option.coversAll ? 'coversAll' : 'paidThrough', { date: dayLabelFor(locale, option.paidThrough) })
    : null;

  const stepBtn = 'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-xl font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
  const courseName = n === 1 ? t('courseName') : t('courseNameMany', { count: n });
  const payLabel = autopay ? t('payButtonAutopay') : n === 1 ? t('payButton') : t('payButtonMany', { count: n });

  return (
    <Frame>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-block px-3 py-1 bg-[#D4A017] text-white rounded-full text-[11px] font-semibold tracking-wide mb-3">
            {t('badge')}
          </div>
          <Who name={state.name} email={state.email} />
          <div className="mt-4 text-white text-lg sm:text-xl font-bold">
            {n === 1
              ? t('moduleOf', { number: nextModule.number, total: nextModule.total })
              : t('modulesRange', { from: nextModule.number, to: option?.last.number ?? nextModule.number + n - 1, total: nextModule.total })}
            <span className="text-[#D4A017] font-semibold">
              {' · '}{n === 1 ? firstMonth : `${firstMonth} – ${lastMonth}`}
            </span>
          </div>
          {note ? <p className="text-white/60 text-[13px] mt-2 max-w-md leading-relaxed">{note}</p> : null}
          {paidThroughLine ? <p className="text-white/80 text-[13px] mt-1 max-w-md leading-relaxed">{paidThroughLine}</p> : null}

          {maxModules > 1 ? (
            <div className="mt-4">
              <div id="renew-modules-label" className="text-white/80 text-[13px] font-semibold mb-2">{t('howMany')}</div>
              <div className="flex flex-wrap items-center gap-3" role="group" aria-labelledby="renew-modules-label">
                <button
                  type="button"
                  className={stepBtn}
                  onClick={() => setModules((m) => Math.max(1, m - 1))}
                  disabled={autopay || n <= 1}
                  aria-label={t('fewer')}
                >
                  −
                </button>
                <span className="min-w-[2.5ch] text-center text-white text-2xl font-black tabular-nums" aria-live="polite">{n}</span>
                <button
                  type="button"
                  className={stepBtn}
                  onClick={() => setModules((m) => Math.min(maxModules, m + 1))}
                  disabled={autopay || n >= maxModules}
                  aria-label={t('more')}
                >
                  +
                </button>
                <button
                  type="button"
                  className="min-h-[44px] px-3 rounded-xl text-[13px] font-semibold text-[#D4A017] underline underline-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setModules(maxModules)}
                  disabled={autopay || n >= maxModules}
                >
                  {t('allRemaining', { count: maxModules })}
                </button>
              </div>
            </div>
          ) : null}

          {offer ? (
            <label className="mt-4 flex items-start gap-3 max-w-md cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={autopay}
                onChange={(e) => setAutopay(e.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0 accent-[#D4A017] cursor-pointer"
              />
              <span className="text-[13px] leading-relaxed">
                <span className="block text-white font-semibold">{t('autopayLabel')}</span>
                <span className="block text-white/70 mt-0.5">
                  {autopay
                    ? t('autopayOn', {
                        price: state.price,
                        number: nextModule.number,
                        first: dayLabelFor(locale, offer.nextChargeAt),
                        last: dayLabelFor(locale, offer.lastChargeAt),
                        count: offer.charges,
                      })
                    : t('autopayOff')}
                </span>
              </span>
            </label>
          ) : null}

          {state.stopsAutopay && state.stopsAutopayReason ? (
            <p className="text-white/80 text-[13px] mt-3 max-w-md leading-relaxed">
              {autopay ? t('autopayReplaces') : renewStopsAutopayCopy(rt, state.stopsAutopayReason)}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 md:text-right">
          <div className="flex items-baseline gap-1.5 md:justify-end mb-1">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
              {amount}
            </span>
            <span className="text-white/50 text-sm font-medium">{t('currency')}</span>
          </div>
          <div className="text-white/50 text-[12px] mb-3 min-h-[1.25em]">
            {n > 1 ? t('perModule', { count: n, price: state.price }) : autopay ? t('nowThenMonthly') : null}
          </div>
          <CoursePurchaseModal
            // Новий екземпляр на зміну N/автоплатежу: форма тримає ціну у своєму стані.
            key={`${n}-${autopay ? 'a' : 'o'}`}
            courseName={courseName}
            price={state.price}
            courseId={YEARLY_PROGRAM.monthlyCourseId}
            currency={t('currency')}
            buttonLabel={payLabel}
            triggerClassName="min-h-[44px] w-full md:w-auto"
            renewFlow
            lockRecurring
            moduleCount={n}
            lockedAutopay={autopay}
            moduleBox={autopay
              ? { title: t('boxAutopayTitle'), text: t('boxAutopayText') }
              : n > 1 ? { title: t('boxManyTitle', { count: n }), text: t('boxManyText', { count: n }) } : undefined}
            payLabel={n === 1 && !autopay ? undefined : payLabel}
            invitePrefill={{
              email: state.email,
              name: state.name,
              plan: 'MONTHLY',
              autoRenew: autopay,
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

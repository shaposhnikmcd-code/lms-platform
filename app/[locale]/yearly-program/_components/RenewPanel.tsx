import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { SUPPORT_TG } from '@/lib/emailTemplates/reminderTemplates';
import { RENEW_ANCHOR } from '@/lib/yearlyProgramRenew';
import type { RenewState } from '@/lib/yearlyProgramRenewState';
import { YEARLY_PROGRAM } from '../config';

/// Блок «Оплата наступного модуля» над секцією тарифів. Показується лише власнику
/// персонального посилання з листа-нагадування. Тарифів не пропонує і вибору не дає:
/// студент уже в програмі, йому лишилось закрити рівно один наступний модуль.
///
/// Мова блоку — українська на всіх локалях, як і `InviteBanner`: посилання приходить
/// з українського листа конкретній людині, і перекладати шматок її персональної
/// переписки в англомовну версію сторінки не було б послідовно.

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
  return (
    <p className="text-white/70 text-[13px] leading-relaxed mt-3">
      {text}{' '}
      <a
        href={SUPPORT_TG}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#D4A017] font-semibold underline underline-offset-2 cursor-pointer whitespace-nowrap"
      >
        напишіть менеджеру
      </a>
      .
    </p>
  );
}

/// Тексти блокувань дзеркалять 409-і з `/api/wayforpay` — сенс той самий, слова людські.
function blockedText(state: Extract<RenewState, { kind: 'blocked' }>): { title: string; body: string; support: string } {
  switch (state.reason) {
    case 'autopay':
      return {
        title: 'У вас підключене автосписання',
        body: 'Наступний модуль спишеться з картки автоматично в перший день модуля — оплачувати вручну не треба. Якщо списання не пройшло і ви хочете закрити модуль самостійно, спочатку треба вимкнути автосписання.',
        support: 'Щоб перейти на ручну оплату —',
      };
    case 'yearly_active':
      return {
        title: 'У вас діє Річна підписка',
        body: 'Програму оплачено одним платежем на весь рік — окремі модулі докуповувати не потрібно.',
        support: 'Якщо це помилка —',
      };
    case 'fully_paid':
      return {
        title: 'Усі ваші модулі вже оплачені',
        body: 'Програму сплачено повністю — доступ відкритий до кінця набору. Платити більше нема за що.',
        support: 'Якщо бачите це помилково —',
      };
    case 'no_schedule':
      return {
        title: 'Графік модулів потребує уточнення',
        body: 'Ваша підписка не лягає на сітку модулів цього набору — оплату модуля через сайт зараз оформити не можна.',
        support: 'Щоб узгодити оплату —',
      };
    case 'debt': {
      const n = state.missedModules ?? 0;
      const word = n % 10 === 1 && n % 100 !== 11
        ? 'модуль'
        : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'модулі' : 'модулів');
      return {
        title: 'Є пропущені модулі',
        body: `За графіком набору пропущено ${n} ${word}. Оплата через сайт закрила б лише найближчий модуль і не вирівняла б графік, тому пропущене менеджер закриває вручну.`,
        support: 'Щоб домовитись про оплату —',
      };
    }
    case 'registration_closed':
      return {
        title: 'Оплата через сайт тимчасово закрита',
        body: 'Прийом оплат на сторінці програми зараз призупинено. Ваш доступ це не змінює — модуль можна закрити через менеджера.',
        support: 'Щоб оплатити модуль —',
      };
  }
}

export default function RenewPanel({ state }: { state: RenewState }) {
  if (state.kind === 'invalid') {
    return (
      <section id={RENEW_ANCHOR} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-0 scroll-mt-24">
        <div className="rounded-xl border border-[#1C3A2E]/12 bg-[#FDFBF4] px-4 sm:px-5 py-4 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5" aria-hidden>⌛</span>
          <p className="text-[13px] text-[#1C3A2E]/80 leading-relaxed">
            <span className="font-semibold text-[#1C3A2E]">Посилання застаріло.</span>{' '}
            Оплатити наступний модуль можна нижче — у картці «Щомісячна оплата» оберіть
            «РАЗОВА» і вкажіть той самий email, з яким ви оформлювали програму.
          </p>
        </div>
      </section>
    );
  }

  if (state.kind === 'blocked') {
    const t = blockedText(state);
    return (
      <Frame>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.title}</h2>
        </div>
        <Who name={state.name} email={state.email} />
        <p className="text-white/80 text-[14px] leading-relaxed mt-4 max-w-2xl">{t.body}</p>
        <SupportLine text={t.support} />
      </Frame>
    );
  }

  const nextModule = state.module;
  return (
    <Frame>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-block px-3 py-1 bg-[#D4A017] text-white rounded-full text-[11px] font-semibold tracking-wide mb-3">
            ОПЛАТА НАСТУПНОГО МОДУЛЯ
          </div>
          <Who name={state.name} email={state.email} />
          <div className="mt-4 text-white text-lg sm:text-xl font-bold">
            Модуль {nextModule.number} з {nextModule.total}
            <span className="text-[#D4A017] font-semibold"> · {nextModule.monthLabel}</span>
          </div>
          <p className="text-white/60 text-[13px] mt-2 max-w-md leading-relaxed">
            Один платіж за цей модуль. Дані підставлені з вашої підписки — вибирати тариф не треба.
          </p>
        </div>

        <div className="shrink-0 md:text-right">
          <div className="flex items-baseline gap-1.5 md:justify-end mb-3">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
              {state.price}
            </span>
            <span className="text-white/50 text-sm font-medium">грн</span>
          </div>
          <CoursePurchaseModal
            courseName="Річна програма — 1 модуль"
            price={state.price}
            courseId={YEARLY_PROGRAM.monthlyCourseId}
            currency="грн"
            buttonLabel="Оплатити модуль"
            renewToken={state.token}
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

import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { YEARLY_PROGRAM } from '../config';

type Props = {
  t: {
    title: string;
    subtitle?: string;
    badge: string;
    yearTitle: string;
    yearSubtitle: string;
    currency: string;
    yearOneTime?: string;
    yearBenefit1?: string;
    yearBenefitSavings?: string;
    btnYear: string;
    courseNameYear: string;
    monthTitle: string;
    monthSubtitle: string;
    monthInstallment?: string;
    currencyMonth: string;
    monthCalc?: string;
    /// Форми множини для слова «платіж» у monthCalc (CLDR-категорії локалі).
    paymentsWord?: Record<string, string>;
    /// Підпис, коли платити лишилось за один модуль (розстрочки вже немає).
    monthLastModule?: string;
    monthsCalc: string;
    promoText: string;
    btnMonth: string;
    courseNameMonth: string;
    /// Запасний вхід для тих, хто вже вчиться помісячно і загубив персональне
    /// посилання з листа. Веде в ту саму разову оплату модуля, але email вводиться
    /// вручну — підписку сервер знайде саме за ним.
    renewPrompt?: string;
    renewLink?: string;
    renewEmailHint?: string;
    renewCourseName?: string;
  };
  yearlyPrice: number;
  yearlyOldPrice?: number | null;
  monthlyPrice: number;
  monthlyOldPrice?: number | null;
  registrationOpen: boolean;
  /// Скільки місячних платежів реально лишилось у наборі (модулів попереду). Рахує
  /// серверна сторінка за сіткою модулів: у вересні це 9, у жовтні вже 8. Від нього —
  /// і підпис «N платежів × 2200», і сума, і тексти в модалці оплати.
  recurringCount: number;
  /// Локаль сторінки — потрібна для правильної форми множини «платіж/платежі/платежів».
  locale: string;
  /// Invite-flow: якщо передано — обидві карточки активні, email pre-filled у формі.
  /// Студент сам обирає Yearly / Monthly Autopay / Monthly One-time на цьому екрані.
  /// Token + prefill пересилаються в CoursePurchaseModal.
  invite?: {
    token: string;
    email: string;
    name: string | null;
  } | null;
};

/// Форма слова «платіж» за CLDR-категорією локалі: 1 платіж / 2 платежі / 5 платежів,
/// 1 payment / 2 payments, 1 płatność / 2 płatności. Без цього підпис показував би
/// «2 платежів» — те саме число, що й у сумі, але неписьменно.
function pluralizePayments(locale: string, count: number, forms?: Record<string, string>): string {
  const fallback: Record<string, string> = { one: 'платіж', few: 'платежі', many: 'платежів', other: 'платежів' };
  const table = forms ?? fallback;
  const category = new Intl.PluralRules(locale).select(count);
  return table[category] ?? table.other ?? '';
}

function DisabledButton({ label, variant }: { label: string; variant: 'light' | 'dark' }) {
  const base =
    'w-full inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-sm cursor-not-allowed select-none';
  const theme =
    variant === 'dark'
      ? 'bg-white/10 text-white/70 border border-white/20'
      : 'bg-gray-100 text-gray-500 border border-gray-200';
  return (
    <button type="button" disabled className={`${base} ${theme}`}>
      {label}
    </button>
  );
}

export default function PricingSection({ t, yearlyPrice, yearlyOldPrice, monthlyPrice, monthlyOldPrice, registrationOpen, recurringCount, locale, invite }: Props) {
  const open = registrationOpen;
  // Модуль лишився один — розстрочки не існує: автоплатіж не пропонуємо взагалі.
  // Інакше сторінка малювала б «АВТОПЛАТІЖ · 1 МІС.» і «1 платежів», а роут усе одно
  // мовчки робив би покупку разовою (регулярні прапори чіпляються лише коли списань > 1).
  const installmentsAvailable = recurringCount > 1;
  const totalMonthly = monthlyPrice * recurringCount;
  // Ближче до кінця набору помісячно виходить ДЕШЕВШЕ за річну (модулів лишилось мало),
  // і рядок «Економія» показав би від'ємне число. Тоді просто не показуємо його.
  const premium = totalMonthly - yearlyPrice;
  const yearlyAvailable = open;
  const monthlyAvailable = open;

  return (
    <section id="price" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E]">{t.title}</h2>
        <p className="text-sm text-gray-500 mt-2">{t.subtitle ?? 'Оберіть зручний варіант оплати — одноразово на рік або автосписання щомісяця'}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Full year — одноразова оплата */}
        <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/40 via-[#D4A017]/10 to-transparent">
          <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-32 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />
            <div className="relative px-6 py-8 text-center flex flex-col h-full">
              <div className="inline-block mx-auto px-3 py-1 bg-[#D4A017] text-white rounded-full text-xs font-semibold mb-4">
                {t.badge}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t.yearTitle}</h3>
              <p className="text-white/40 text-sm mb-5">{t.yearSubtitle}</p>

              <div className="flex items-baseline justify-center gap-1.5 mb-2">
                {yearlyOldPrice != null && (
                  <span className="text-white/35 text-xl font-medium line-through mr-1">{yearlyOldPrice}</span>
                )}
                <span className="text-5xl font-black text-white tracking-tight">{yearlyPrice}</span>
                <span className="text-white/50 text-sm font-medium">{t.currency}</span>
              </div>
              <p className="text-white/60 text-xs mb-5">{t.yearOneTime ?? 'Одноразовий платіж · Доступ на весь час програми'}</p>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-5" />

              {/* Benefits */}
              <ul className="text-left text-white/80 text-[13px] space-y-2 mb-6 max-w-[280px] mx-auto">
                <li className="flex items-start gap-2">
                  <span className="text-[#D4A017] mt-0.5">✓</span>
                  <span>{t.yearBenefit1 ?? 'Одна оплата — весь курс на 9 місяців'}</span>
                </li>
                {premium > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-[#D4A017] mt-0.5">✓</span>
                    <span>{(t.yearBenefitSavings ?? 'Економія {amount} грн').replace('{amount}', premium.toLocaleString('uk-UA'))}</span>
                  </li>
                )}
              </ul>

              <div className="mt-auto">
                {yearlyAvailable ? (
                  <CoursePurchaseModal
                    courseName={t.courseNameYear}
                    price={yearlyPrice}
                    courseId={YEARLY_PROGRAM.courseId}
                    currency={t.currency}
                    buttonLabel={t.btnYear}
                    inviteToken={invite?.token}
                    invitePrefill={invite ? {
                      email: invite.email,
                      name: invite.name,
                      plan: 'YEARLY',
                      autoRenew: false,
                    } : undefined}
                  />
                ) : (
                  <DisabledButton label={t.btnYear} variant="dark" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly — автосписання */}
        <div className="relative rounded-2xl border border-[#1C3A2E]/10 bg-white overflow-hidden h-full">
          <div className="px-6 py-8 text-center flex flex-col h-full">
            <h3 className="text-lg font-bold text-[#1C3A2E] mb-1 mt-4">{t.monthTitle}</h3>
            <p className="text-gray-400 text-sm mb-5">{t.monthInstallment ?? 'Розсрочка на 9 місяців програми'}</p>

            <div className="flex items-baseline justify-center gap-1.5 mb-2">
              {monthlyOldPrice != null && (
                <span className="text-gray-400 text-xl font-medium line-through mr-1">{monthlyOldPrice}</span>
              )}
              <span className="text-5xl font-black text-[#1C3A2E] tracking-tight">{monthlyPrice}</span>
              <span className="text-gray-400 text-sm font-medium">{t.currencyMonth}</span>
            </div>
            <p className="text-gray-400 text-xs mb-5">
              {installmentsAvailable
                ? (t.monthCalc ?? '{count} {paymentsWord} × {price} грн = {total} грн')
                  .replace('{count}', String(recurringCount))
                  .replace('{paymentsWord}', pluralizePayments(locale, recurringCount, t.paymentsWord))
                  .replace('{price}', String(monthlyPrice))
                  .replace('{total}', totalMonthly.toLocaleString('uk-UA'))
                : (t.monthLastModule ?? 'Оплата одного модуля · це останній модуль програми')}
            </p>

            <div className="w-16 h-px bg-gray-200 mx-auto mb-5" />

            <div className="mt-auto">
              {monthlyAvailable ? (
                <CoursePurchaseModal
                  courseName={t.courseNameMonth}
                  price={monthlyPrice}
                  courseId={YEARLY_PROGRAM.monthlyCourseId}
                  currency={t.currency}
                  buttonLabel={t.btnMonth}
                  allowRecurringChoice={installmentsAvailable}
                  recurringCount={recurringCount}
                  inviteToken={invite?.token}
                  invitePrefill={invite ? {
                    email: invite.email,
                    name: invite.name,
                    plan: 'MONTHLY',
                    autoRenew: true,
                  } : undefined}
                />
              ) : (
                <DisabledButton label={t.btnMonth} variant="light" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Під місячною карткою: вхід для чинного студента на помісячній оплаті. Тільки
          коли місячна взагалі продається — інакше рядок обіцяв би оплату, якої нема. */}
      {monthlyAvailable && (
        <div className="grid md:grid-cols-2 gap-5 mt-4">
          <div className="hidden md:block" aria-hidden />
          <div className="px-6 text-center md:text-left">
            <p className="text-[13px] text-gray-500 mb-1.5">
              {t.renewPrompt ?? 'Уже навчаєтесь за місячною оплатою?'}
            </p>
            <CoursePurchaseModal
              courseName={t.renewCourseName ?? t.courseNameMonth}
              price={monthlyPrice}
              courseId={YEARLY_PROGRAM.monthlyCourseId}
              currency={t.currency}
              variant="link"
              lockRecurring
              buttonLabel={t.renewLink ?? 'Оплатити наступний модуль'}
              emailHint={t.renewEmailHint ?? 'Вкажіть той самий email, що при першій оплаті — платіж зарахується у вашу підписку.'}
            />
          </div>
        </div>
      )}
    </section>
  );
}

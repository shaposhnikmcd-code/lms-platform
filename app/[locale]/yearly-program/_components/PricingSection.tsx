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
    monthsCalc: string;
    promoText: string;
    btnMonth: string;
    courseNameMonth: string;
  };
};

const TOTAL_MONTHLY_PAYMENTS = 9;

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

export default function PricingSection({ t }: Props) {
  const open = YEARLY_PROGRAM.registrationOpen;
  const monthlyPrice = Number(YEARLY_PROGRAM.monthlyPrice);
  const totalMonthly = monthlyPrice * TOTAL_MONTHLY_PAYMENTS;
  const premium = totalMonthly - Number(YEARLY_PROGRAM.price);

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
                <span className="text-5xl font-black text-white tracking-tight">{YEARLY_PROGRAM.price}</span>
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
                <li className="flex items-start gap-2">
                  <span className="text-[#D4A017] mt-0.5">✓</span>
                  <span>{(t.yearBenefitSavings ?? 'Економія {amount} грн').replace('{amount}', premium.toLocaleString('uk-UA'))}</span>
                </li>
              </ul>

              <div className="mt-auto">
                {open ? (
                  <CoursePurchaseModal
                    courseName={t.courseNameYear}
                    price={Number(YEARLY_PROGRAM.price)}
                    courseId={YEARLY_PROGRAM.courseId}
                    buttonLabel={t.btnYear}
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
              <span className="text-5xl font-black text-[#1C3A2E] tracking-tight">{YEARLY_PROGRAM.monthlyPrice}</span>
              <span className="text-gray-400 text-sm font-medium">{t.currencyMonth}</span>
            </div>
            <p className="text-gray-400 text-xs mb-5">
              {(t.monthCalc ?? '{count} платежів × {price} грн = {total} грн')
                .replace('{count}', String(TOTAL_MONTHLY_PAYMENTS))
                .replace('{price}', String(YEARLY_PROGRAM.monthlyPrice))
                .replace('{total}', totalMonthly.toLocaleString('uk-UA'))}
            </p>

            <div className="w-16 h-px bg-gray-200 mx-auto mb-5" />

            <div className="mt-auto">
              {open ? (
                <CoursePurchaseModal
                  courseName={t.courseNameMonth}
                  price={monthlyPrice}
                  courseId={YEARLY_PROGRAM.monthlyCourseId}
                  buttonLabel={t.btnMonth}
                  allowRecurringChoice
                />
              ) : (
                <DisabledButton label={t.btnMonth} variant="light" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

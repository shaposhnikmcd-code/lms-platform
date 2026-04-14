import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { YEARLY_PROGRAM } from '../config';

type Props = {
  t: {
    title: string;
    badge: string;
    yearTitle: string;
    yearSubtitle: string;
    currency: string;
    btnYear: string;
    courseNameYear: string;
    monthTitle: string;
    monthSubtitle: string;
    currencyMonth: string;
    monthsCalc: string;
    promoText: string;
    btnMonth: string;
    courseNameMonth: string;
  };
};

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

  return (
    <section id="price" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E]">{t.title}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Full year */}
        <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/40 via-[#D4A017]/10 to-transparent">
          <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-32 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />
            <div className="relative px-6 py-8 text-center flex flex-col h-full">
              <div className="inline-block mx-auto px-3 py-1 bg-[#D4A017] text-white rounded-full text-xs font-semibold mb-4">{t.badge}</div>
              <h3 className="text-lg font-bold text-white mb-1">{t.yearTitle}</h3>
              <p className="text-white/40 text-sm mb-5">{t.yearSubtitle}</p>

              <div className="flex items-baseline justify-center gap-1.5 mb-4">
                <span className="text-5xl font-black text-white tracking-tight">{YEARLY_PROGRAM.price}</span>
                <span className="text-white/50 text-sm font-medium">{t.currency}</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-6" />

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

        {/* Monthly */}
        <div className="relative rounded-2xl border border-[#1C3A2E]/10 bg-white overflow-hidden h-full">
          <div className="px-6 py-8 text-center flex flex-col h-full">
            <h3 className="text-lg font-bold text-[#1C3A2E] mb-1">{t.monthTitle}</h3>
            <p className="text-gray-400 text-sm mb-5">{t.monthSubtitle}</p>

            <div className="flex items-baseline justify-center gap-1.5 mb-1">
              <span className="text-5xl font-black text-[#1C3A2E] tracking-tight">{YEARLY_PROGRAM.monthlyPrice}</span>
              <span className="text-gray-400 text-sm font-medium">{t.currencyMonth}</span>
            </div>
            <p className="text-gray-300 text-xs mb-5">{t.monthsCalc}</p>

            <div className="w-16 h-px bg-gray-200 mx-auto mb-4" />

            <div className="bg-[#FDF2EB] rounded-lg px-4 py-3 mb-6">
              <p className="text-[#1C3A2E] text-sm">
                {t.promoText}
              </p>
              <p className="font-mono font-bold text-[#D4A017] text-lg tracking-wider">{YEARLY_PROGRAM.monthlyPromoCode}</p>
            </div>

            <div className="mt-auto">
              {open ? (
                <CoursePurchaseModal
                  courseName={t.courseNameMonth}
                  price={Number(YEARLY_PROGRAM.monthlyPrice)}
                  courseId={YEARLY_PROGRAM.monthlyCourseId}
                  buttonLabel={t.btnMonth}
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

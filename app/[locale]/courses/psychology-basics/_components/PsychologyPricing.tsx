import { FaCheck } from 'react-icons/fa';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { PSYCHOLOGY_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'psychology-basics-page');

export default async function PsychologyPricing({ locale }: { locale: string }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <section id="price" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/40 via-[#D4A017]/10 to-transparent">
        <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />

          <div className="relative px-6 py-8 md:px-10">
            <div className="text-center">
              <p className="text-[#D4A017] text-xs font-semibold uppercase tracking-widest mb-2">{c.pricing.badge}</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{c.pricing.title}</h2>
              <p className="text-white/50 text-sm mb-5">{c.pricing.subtitle}</p>

              <div className="flex items-baseline justify-center gap-1.5 mb-4">
                <span className="text-5xl font-black text-white tracking-tight">3500</span>
                <span className="text-white/50 text-sm font-medium">{currency}</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-4" />

              <div className="space-y-2 mb-6">
                {(c.pricing.features as string[]).map((feature, i) => (
                  <p key={i} className="flex items-center justify-center gap-2.5 text-white/60 text-sm">
                    <FaCheck className="text-[#D4A017] text-[10px] flex-shrink-0" />{feature}
                  </p>
                ))}
              </div>

              <CoursePurchaseModal
                courseName="Основи психології"
                price={Number(PSYCHOLOGY_COURSE.price)}
                courseId={PSYCHOLOGY_COURSE.courseId}
                currency={currency}
                buttonLabel={c.pricing.btnBuy}
              />

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { MENTORSHIP_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'mentorship-page');

export default async function MentorshipPricing({ locale }: { locale: string }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <section id="price" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/40 via-[#D4A017]/10 to-transparent">
        <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />

          <div className="relative px-6 py-8 md:px-10">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{c.pricing.title}</h2>
              <p className="text-white/50 text-sm mb-5">{c.pricing.subtitle}</p>

              <div className="flex items-baseline justify-center gap-1.5 mb-4">
                <span className="text-5xl font-black text-white tracking-tight">{MENTORSHIP_COURSE.price}</span>
                <span className="text-white/50 text-sm font-medium">{currency}</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-6" />

              <CoursePurchaseModal
                courseName="Менторство"
                price={Number(MENTORSHIP_COURSE.price)}
                courseId={MENTORSHIP_COURSE.courseId}
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

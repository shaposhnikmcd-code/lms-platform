import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { PSYCHIATRY_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'psychiatry-basics-page');

export default async function PsychiatryPricing({ locale }: { locale: string }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{c.pricing.title}</h2>
        <p className="text-white/80 text-sm mb-6 max-w-xl mx-auto">{c.pricing.subtitle}</p>
        <div className="max-w-sm mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="text-3xl font-black text-white mb-3">{PSYCHIATRY_COURSE.price} {currency}</div>
          <p className="text-white/60 text-xs mb-4">{c.pricing.access}</p>
          <CoursePurchaseModal
            courseName="Основи психіатрії"
            price={Number(PSYCHIATRY_COURSE.price)}
            courseId={PSYCHIATRY_COURSE.courseId}
            currency={currency}
            buttonLabel={c.pricing.btnBuy}
          />
        </div>
      </div>
    </section>
  );
}
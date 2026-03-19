import { FaCheck } from 'react-icons/fa';
import SendPulseButton from '@/components/SendPulseButton';
import { SEX_EDUCATION_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'sex-education-page');

export default async function SexEducationPricing({ locale }: { locale: string }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative p-12 md:p-16">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-[#D4A017] text-white rounded-full text-sm mb-6">{c.pricing.badge}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{c.pricing.title}</h2>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">{c.pricing.subtitle}</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border-2 border-[#D4A017]/30 hover:border-[#D4A017] transition-all">
              <div className="text-sm text-[#D4A017] font-semibold mb-4">{c.pricing.access}</div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-6xl font-black text-white">{"4300"}</span>
                <span className="text-white/60">{currency}</span>
              </div>
              <div className="space-y-3 mb-8 text-white/80">
                {(c.pricing.features as string[]).map((feature, i) => (
                  <p key={i} className="flex items-center justify-center gap-2">
                    <FaCheck className="text-[#D4A017]" />{feature}
                  </p>
                ))}
              </div>
              <SendPulseButton url={SEX_EDUCATION_COURSE.sendpulseUrl} label={c.pricing.btnBuy} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
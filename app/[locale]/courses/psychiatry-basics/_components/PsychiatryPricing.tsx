import Image from 'next/image';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { getQrLabel } from '@/lib/qrLabel';
import { PSYCHIATRY_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'psychiatry-basics-page', {
  en: () => import('../_content/en').then(m => m.default),
  pl: () => import('../_content/pl').then(m => m.default),
});

export default async function PsychiatryPricing({ locale, price, oldPrice }: { locale: string; price: number; oldPrice: number | null }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);
  const qrLabel = getQrLabel(locale);

  return (
    <section id="price" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="group relative rounded-2xl will-change-transform transition-[transform,box-shadow] duration-500 ease-out hover:[transform:translate3d(0,-1px,0)] hover:shadow-[0_22px_50px_-20px_rgba(212,160,23,0.5)]">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-[#D4A017]/0 via-[#D4A017]/0 to-[#D4A017]/0 group-hover:from-[#D4A017]/20 group-hover:via-[#D4A017]/5 group-hover:to-[#D4A017]/0 transition-opacity duration-[900ms] blur-md opacity-0 group-hover:opacity-100" />
        <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden ring-1 ring-white/5 group-hover:ring-[#D4A017]/30 transition-[box-shadow,border-color] duration-[900ms]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />

          <div className="relative px-6 py-8 md:px-10 grid md:grid-cols-[1fr_auto] gap-8 md:gap-10 items-center">
            <div className="text-center md:border-r md:border-white/10 md:pr-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{c.pricing.title}</h2>
              <p className="text-white/50 text-sm mb-5">{c.pricing.subtitle}</p>

              {oldPrice !== null && (
                <p className="text-white/30 line-through text-sm mb-1">{oldPrice} {currency}</p>
              )}
              <div className="flex items-baseline justify-center gap-1.5 mb-4">
                <span className="text-5xl font-black text-white tracking-tight">{price}</span>
                <span className="text-white/50 text-sm font-medium">{currency}</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-6" />

              <CoursePurchaseModal
                courseName={`${c.title1} ${c.title2}`}
                price={price}
                courseId={PSYCHIATRY_COURSE.courseId}
                currency={currency}
                buttonLabel={c.pricing.btnBuy}
              />
            </div>

            <div className="flex flex-col items-center gap-3 mx-auto">
              <div className="bg-white rounded-xl p-3 shadow-lg ring-1 ring-[#D4A017]/30">
                <Image src="/courses/psychiatry-basics/qr.png" alt="QR" width={150} height={150} className="block" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-white/50 text-center max-w-[150px] leading-relaxed">
                {qrLabel.line1}<br />{qrLabel.line2}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import SendPulseButton from '@/components/SendPulseButton';
import { MILITARY_PSYCHOLOGY_COURSE } from '../config';
import { getTranslatedContent } from '@/lib/translate';
import { getCurrency } from '@/lib/currency';
import { content } from '../_content/uk';

const getContent = getTranslatedContent(content, 'military-psychology-page');

export default async function MilitaryPsychologyPricing({ locale }: { locale: string }) {
  const c = await getContent(locale);
  const currency = getCurrency(locale);

  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-center">
        <div className="w-full max-w-2xl bg-[#112b1d] rounded-2xl px-10 py-8">

          {/* top row: label + deadline */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D4A017]">
              {c.pricing.title}
            </span>
            <span className="text-[11px] text-white/35 border border-white/10 rounded-full px-3 py-1">
              до {MILITARY_PSYCHOLOGY_COURSE.deadline}
            </span>
          </div>

          {/* main row: price | divider | features + button */}
          <div className="flex gap-8 items-stretch">

            {/* price */}
            <div className="flex flex-col justify-center gap-2 min-w-fit">
              <span className="text-white/30 line-through text-sm">
                {MILITARY_PSYCHOLOGY_COURSE.priceOld} {currency}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[56px] font-black text-white leading-none tracking-tight">
                  {MILITARY_PSYCHOLOGY_COURSE.price}
                </span>
                <span className="text-white/40 text-sm pb-1">{currency}</span>
              </div>
              <span className="text-white/30 text-xs">{c.pricing.access}</span>
            </div>

            {/* divider */}
            <div className="w-px bg-white/10 self-stretch" />

            {/* right: features + button */}
            <div className="flex flex-col justify-between flex-1 gap-5">
              <ul className="space-y-2">
                {(c.pricing.features as string[]).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-white/55 text-sm">
                    <span className="w-1 h-1 rounded-full bg-[#D4A017] shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <SendPulseButton url={MILITARY_PSYCHOLOGY_COURSE.sendpulseUrl} label={c.pricing.btnBuy} />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

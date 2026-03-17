'use client';

import SendPulseButton from '@/components/SendPulseButton';

const tiers = [
  {
    title: 'Для нових учасників',
    price: 4200,
    description: 'Доступ до лекцій для тих, хто приєднується вперше',
    highlight: true,
  },
  {
    title: 'Для учасників інших курсів',
    price: 3700,
    description: 'Для тих, хто проходив будь-який наш курс раніше',
    highlight: false,
  },
];

const features = [
  'Всі лекції в записі',
  'Практичні заняття',
  'Лист з доступом на email',
];

const SENDPULSE_URL = 'https://uimp-edu.sendpulse.online/bible-therapy_3_0';

export default function CoursePricingTiers() {
  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <span className="text-[#D4A017] font-semibold text-sm uppercase tracking-wider">
          {"Вартість"}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E] mt-2">
          {"Оберіть свій тариф"}
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.title}
            className={`bg-white rounded-2xl shadow-xl overflow-hidden border-2 ${
              tier.highlight ? 'border-[#D4A017]' : 'border-gray-200'
            }`}
          >
            <div
              className={`p-4 text-center text-white ${
                tier.highlight ? 'bg-[#D4A017]' : 'bg-[#1C3A2E]'
              }`}
            >
              <h3 className="text-xl font-bold">{tier.title}</h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-black text-[#1C3A2E] mb-2">
                {tier.price.toLocaleString()} {"грн"}
              </div>
              <p className="text-gray-500 text-sm mb-4">{tier.description}</p>
              <ul className="space-y-2 mb-6">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-[#D4A017] rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <SendPulseButton url={SENDPULSE_URL} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
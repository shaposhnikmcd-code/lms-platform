import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { YEARLY_PROGRAM } from '../config';

export default function PricingSection() {
  return (
    <section id="price" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1C3A2E]">Вартість програми</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Full year */}
        <div className="relative rounded-2xl p-px bg-gradient-to-b from-[#D4A017]/40 via-[#D4A017]/10 to-transparent">
          <div className="relative bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] rounded-2xl overflow-hidden h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-32 bg-[#D4A017]/[0.07] rounded-full blur-3xl" />
            <div className="relative px-6 py-8 text-center flex flex-col h-full">
              <div className="inline-block mx-auto px-3 py-1 bg-[#D4A017] text-white rounded-full text-xs font-semibold mb-4">Вигідно</div>
              <h3 className="text-lg font-bold text-white mb-1">Оплата за рік</h3>
              <p className="text-white/40 text-sm mb-5">Повний доступ до всіх 9 модулів</p>

              <div className="flex items-baseline justify-center gap-1.5 mb-4">
                <span className="text-5xl font-black text-white tracking-tight">{YEARLY_PROGRAM.price}</span>
                <span className="text-white/50 text-sm font-medium">грн</span>
              </div>

              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent mx-auto mb-6" />

              <div className="mt-auto">
                <CoursePurchaseModal
                  courseName="Біблійна терапія — річна програма"
                  price={Number(YEARLY_PROGRAM.price)}
                  courseId={YEARLY_PROGRAM.courseId}
                  buttonLabel="Оплатити за рік"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly */}
        <div className="relative rounded-2xl border border-[#1C3A2E]/10 bg-white overflow-hidden h-full">
          <div className="px-6 py-8 text-center flex flex-col h-full">
            <h3 className="text-lg font-bold text-[#1C3A2E] mb-1">Щомісячна оплата</h3>
            <p className="text-gray-400 text-sm mb-5">Платіть помісячно протягом навчання</p>

            <div className="flex items-baseline justify-center gap-1.5 mb-1">
              <span className="text-5xl font-black text-[#1C3A2E] tracking-tight">{YEARLY_PROGRAM.monthlyPrice}</span>
              <span className="text-gray-400 text-sm font-medium">грн / міс</span>
            </div>
            <p className="text-gray-300 text-xs mb-5">× 9 місяців = 9 000 грн</p>

            <div className="w-16 h-px bg-gray-200 mx-auto mb-4" />

            <div className="bg-[#FDF2EB] rounded-lg px-4 py-3 mb-6">
              <p className="text-[#1C3A2E] text-sm">
                Для оплати одного місяця скористайтеся промокодом:
              </p>
              <p className="font-mono font-bold text-[#D4A017] text-lg tracking-wider">{YEARLY_PROGRAM.monthlyPromoCode}</p>
            </div>

            <div className="mt-auto">
              <CoursePurchaseModal
                courseName="Біблійна терапія — 1 місяць"
                price={Number(YEARLY_PROGRAM.monthlyPrice)}
                courseId={YEARLY_PROGRAM.monthlyCourseId}
                buttonLabel="Оплатити місяць"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

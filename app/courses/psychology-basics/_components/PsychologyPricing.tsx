'use client';

import { FaCheck } from 'react-icons/fa';
import WayForPayButton from '@/components/WayForPayButton';

export default function PsychologyPricing() {
  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative p-12 md:p-16">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-[#D4A017] text-white rounded-full text-sm mb-6">
              {"🎓 Інвестиція в себе"}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{"Вартість курсу"}</h2>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">{"Оберіть найкращий варіант для свого розвитку"}</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border-2 border-[#D4A017]/30 hover:border-[#D4A017] transition-all">
              <div className="text-sm text-[#D4A017] font-semibold mb-4">{"Повний доступ"}</div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-3xl text-white/60 line-through">{"4900 грн"}</span>
                <span className="text-6xl font-black text-white">{"3500"}</span>
                <span className="text-white/60">{"грн"}</span>
              </div>
              <div className="space-y-3 mb-8 text-white/80">
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" />{"Всі 15 лекцій"}
                </p>
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" />{"Доступ 6 місяців"}
                </p>
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" />{"Додаткові матеріали"}
                </p>
              </div>
              <WayForPayButton
                courseName="Основи психології"
                price={3500}
                courseId="psychology-basics"
              />
              <p className="text-white/50 text-sm mt-4">{"100% гарантія повернення коштів"}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
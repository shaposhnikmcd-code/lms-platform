'use client';

import WayForPayButton from '@/components/WayForPayButton';

export default function BiblicalHeroesPricing() {
  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-2xl p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {"Розпочніть навчання прямо зараз!"}
        </h2>
        <p className="text-white/80 text-sm mb-6 max-w-xl mx-auto">
          {"5 уроків в записі, доступ до всіх матеріалів"}
        </p>
        <div className="max-w-sm mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="text-3xl font-black text-white mb-3">{"1400 грн"}</div>
          <p className="text-white/60 text-xs mb-4">{"Повний доступ на 6 місяців"}</p>
          <WayForPayButton
            courseName="Психотерапія біблійних героїв"
            price={1400}
            courseId="psychotherapy-of-biblical-heroes"
          />
        </div>
      </div>
    </section>
  );
}
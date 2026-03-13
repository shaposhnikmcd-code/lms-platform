// components/home/CTA.tsx
import Link from 'next/link';
import SocialDropdown from './SocialDropdown';

export default function CTA() {
  return (
    <section className="bg-[#D4A017] py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Готові розпочати?
        </h2>
        <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
          Приєднуйтесь до нашої спільноти та отримуйте актуальні новини про курси та події
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/courses"
            className="bg-[#1C3A2E] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#2a4f3f] transition-all"
          >
            Перейти до курсів
          </Link>
          
          {/* Замість посилання на /links - випадаючий список */}
          <SocialDropdown />
        </div>
      </div>
    </section>
  );
}
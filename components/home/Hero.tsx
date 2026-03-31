'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';

interface Props {
  content: {
    title1: string;
    title2: string;
    links: string[];
    btnCourses: string;
    btnRegister: string;
  };
}

export default function Hero({ content }: Props) {
  return (
    <section
      className="relative text-white py-12 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)', position: 'relative', zIndex: 2 }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 bg-[#D4A843]/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-12 md:px-16 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-8">

          <div className="flex-1 flex justify-center order-1 md:order-2">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #D4A843, #1C3A2E)' }} />
              <div className="relative w-52 h-52 md:w-64 md:h-64">
                <Image src="/logo.jpg" alt="UIMP Logo" fill sizes="(max-width: 768px) 208px, 256px" className="object-contain drop-shadow-2xl" priority />
              </div>
            </div>
          </div>

          <div className="flex-1 order-2 md:order-1">
            <div className="inline-flex items-center gap-2 border text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase mb-14" style={{ background: 'rgba(212,168,67,0.12)', borderColor: 'rgba(212,168,67,0.25)', color: '#D4A843' }}>
              {"UIMP"}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight tracking-tight">
              {content.title1}{" "}
              <span style={{ color: '#D4A843' }}>{content.title2}</span>
            </h1>
            <p className="text-base mb-7" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '480px', lineHeight: 1.75 }}>
              {"Простір, де терапія охоплює людину цілісно (дух, душа, тіло)."}<br />
              {"Ми переконані, що психологія в її первинному вигляді"}
              <br />{"містить духовність."}
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-3 font-bold text-base px-7 py-3 rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: '#D4A843', color: '#1C3A2E' }}
            >
              {content.btnCourses}
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
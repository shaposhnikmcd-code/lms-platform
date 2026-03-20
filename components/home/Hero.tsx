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

const DIVIDER = (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)',
      opacity: 0.45,
      zIndex: 3,
    }}
  />
);

export default function Hero({ content }: Props) {
  return (
    <section
      className="relative text-white py-24 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Top divider */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />
      {/* Bottom divider */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 bg-[#D4A843]/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, rgba(212,168,67,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 border text-xs font-bold px-4 py-2 rounded-full tracking-widest uppercase mb-8" style={{ background: 'rgba(212,168,67,0.12)', borderColor: 'rgba(212,168,67,0.25)', color: '#D4A843' }}>
              {"◆ UIMP"}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight">
              {content.title1}{" "}
              <span style={{ color: '#D4A843' }}>{content.title2}</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-px" style={{ background: 'rgba(212,168,67,0.4)' }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4A843' }} />
              <div className="w-10 h-px" style={{ background: 'rgba(212,168,67,0.4)' }} />
            </div>
            <div className="flex flex-col gap-2.5 mb-10">
              {content.links.map((item, i) => (
                <div key={i} className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ color: '#D4A843', fontSize: '14px' }}>{"●"}</span>
                  <span className="text-base">{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-3 font-bold text-base px-8 py-4 rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: '#D4A843', color: '#1C3A2E' }}
            >
              {content.btnCourses}
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #D4A843, #1C3A2E)' }} />
              <div className="relative w-64 h-64 md:w-72 md:h-72">
                <Image src="/logo.jpg" alt="UIMP Logo" fill sizes="(max-width: 768px) 256px, 288px" className="object-contain drop-shadow-2xl" priority />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
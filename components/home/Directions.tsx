'use client';

import { Link } from '@/i18n/navigation';
import { useRef, useEffect, useState } from 'react';

interface Props {
  content: {
    title: string;
    subtitle: string;
    btnAll: string;
    items: { title: string; description: string; icon: string; price: string; duration: string; link: string; }[];
  };
}

const cardStyles = [
  { bg: 'from-[#1C3A2E] to-[#0f2219]', accent: '#D4A843', textColor: 'text-white', subtextColor: 'text-[#a8c4b0]', borderColor: 'border-[#2d5040]', priceColor: 'text-[#D4A843]', iconBg: 'bg-[#D4A843]/10' },
  { bg: 'from-[#D4A843] to-[#b88a2a]', accent: '#1C3A2E', textColor: 'text-[#1C3A2E]', subtextColor: 'text-[#3a5a48]', borderColor: 'border-[#c49a38]', priceColor: 'text-[#1C3A2E]', iconBg: 'bg-[#1C3A2E]/10' },
  { bg: 'from-[#f8fffe] to-[#e8f5e0]', accent: '#1C3A2E', textColor: 'text-[#1C3A2E]', subtextColor: 'text-[#4a6a58]', borderColor: 'border-[#c8e8c0]', priceColor: 'text-[#1C3A2E]', iconBg: 'bg-[#1C3A2E]/8' },
  { bg: 'from-[#1a1a2e] to-[#16213e]', accent: '#D4A843', textColor: 'text-white', subtextColor: 'text-[#9090b0]', borderColor: 'border-[#2a2a4e]', priceColor: 'text-[#D4A843]', iconBg: 'bg-[#D4A843]/10' },
];

const icons = [
  <svg key="edu" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
    <rect x="6" y="8" width="28" height="36" rx="3" fill="currentColor" opacity="0.15"/>
    <rect x="10" y="4" width="28" height="36" rx="3" fill="currentColor" opacity="0.3"/>
    <rect x="14" y="8" width="20" height="2" rx="1" fill="currentColor"/>
    <rect x="14" y="13" width="14" height="2" rx="1" fill="currentColor"/>
    <polygon points="24,20 25.8,25.5 31.6,25.5 26.9,28.8 28.7,34.3 24,31 19.3,34.3 21.1,28.8 16.4,25.5 22.2,25.5" fill="currentColor"/>
  </svg>,
  <svg key="charity" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
    <path d="M24 38 C24 38 8 28 8 18 C8 13 12 9 17 9 C20 9 22.5 10.5 24 13 C25.5 10.5 28 9 31 9 C36 9 40 13 40 18 C40 28 24 38 24 38Z" fill="currentColor" opacity="0.3"/>
    <path d="M24 34 C24 34 10 25 10 17 C10 13 13.5 10 18 10 C20.5 10 22.5 11.5 24 14 C25.5 11.5 27.5 10 30 10 C34.5 10 38 13 38 17 C38 25 24 34 24 34Z" fill="currentColor"/>
  </svg>,
  <svg key="spec" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
    <circle cx="18" cy="14" r="7" fill="currentColor" opacity="0.3"/>
    <circle cx="18" cy="14" r="5" fill="currentColor"/>
    <path d="M6 38 C6 30 11 25 18 25 C22 25 25.5 26.8 28 29.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6"/>
    <circle cx="36" cy="34" r="8" fill="currentColor" opacity="0.2"/>
    <path d="M31 34 L34.5 37.5 L41 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  <svg key="games" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
    <rect x="8" y="18" width="12" height="12" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="28" y="8" width="12" height="12" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="28" y="28" width="12" height="12" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor"/>
  </svg>,
];

export default function Directions({ content }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="py-16 relative overflow-hidden"
      style={{ background: '#f4f9f4', boxShadow: '0 6px 24px rgba(0,0,0,0.07)', position: 'relative', zIndex: 1 }}
    >
      {/* Top divider */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />
      {/* Bottom divider */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.45, zIndex: 3 }} />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4A843]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#1C3A2E]/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, #1C3A2E 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="container mx-auto px-20 relative z-10">
        <div className="text-center mb-12 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}>
          <div className="inline-flex items-center gap-2 text-[#1C3A2E] text-xs font-semibold px-4 py-2 rounded-full mb-5 tracking-wide uppercase" style={{ background: 'rgba(28,58,46,0.08)' }}>
            <span style={{ color: '#D4A843' }}>{"◆"}</span> {"UIMP"}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mb-3 tracking-tight">{content.title}</h2>
          <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">{content.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {content.items.map((item, i) => {
            const style = cardStyles[i];
            return (
              <Link
                key={i}
                href={item.link}
                className={`group relative bg-gradient-to-br ${style.bg} rounded-2xl pt-6 px-7 pb-4 min-h-[280px] border ${style.borderColor} overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl flex flex-col`}
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s, box-shadow 0.3s ease, translate 0.3s ease` }}
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 transition-all duration-500 group-hover:opacity-20 group-hover:scale-125" style={{ backgroundColor: style.accent }} />
                <div className={`${style.iconBg} w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`} style={{ color: style.accent }}>
                  {icons[i]}
                </div>
                <h3 className={`text-xl font-bold ${style.textColor} mb-2 leading-tight`}>{item.title}</h3>
                <div className="flex-1" />
                <div className="flex justify-between items-center border-t pt-3 mt-3" style={{ borderColor: style.accent + '30' }}>
                  <span className={`font-bold text-lg ${style.priceColor}`}>{item.price}</span>
                  {item.duration && <span className={`text-xs ${style.subtextColor} whitespace-nowrap`}>{item.duration}</span>}
                </div>
                <div className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0" style={{ backgroundColor: style.accent }}>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" style={{ color: i === 1 ? '#fff' : '#1C3A2E' }}>
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-10 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transitionDelay: '0.5s' }}>
          <Link href="/courses" className="group inline-flex items-center gap-3 bg-[#1C3A2E] text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-[#D4A843] hover:text-[#1C3A2E] transition-all duration-300 shadow-lg hover:shadow-xl">
            {content.btnAll}
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
'use client';

import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { FaArrowRight } from 'react-icons/fa';

type Stat = { value: string; label: string };

type Props = {
  badge: string;
  title1: string;
  title2: string;
  description: string;
  btnEnroll: string;
  btnProgram: string;
  monthlyPayment: string;
  priceNote: string;
  durationLabel: string;
  duration: string;
  enrollNow: string;
  stats: Stat[];
};

export default function HeroSection({ badge, title1, title2, description, btnEnroll, btnProgram, monthlyPayment, priceNote, durationLabel, duration, enrollNow, stats }: Props) {
  return (
    <section style={{ background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)' }} className="relative overflow-hidden text-white">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
      </div>
      <div className="container mx-auto px-12 md:px-16 relative z-10 py-4 md:py-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm">{badge}</div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05]">
              {title1}<br /><span className="text-[#D4A017]">{title2}</span>
            </h1>
            <p className="text-white/80 text-lg leading-relaxed max-w-xl">{description}</p>
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-center">
              <a href="#price"
                className="group inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-10 py-4 rounded-lg hover:bg-[#b88913] transition-all text-lg">
                <span>{btnEnroll}</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </a>
              <Link href="#modules"
                className="inline-flex items-center justify-center px-8 py-4 border border-white/30 rounded-lg hover:bg-white/10 transition-all font-medium">
                {btnProgram}
              </Link>
            </div>
            <div className="flex items-start gap-8 pt-2 border-t border-white/10">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl font-black text-[#D4A017]">{s.value}</div>
                  <div className="text-white/60 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ maxWidth: '480px', marginLeft: 'auto', width: '100%' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4A017] to-[#b88913] rounded-2xl rotate-3 opacity-20" />
              <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20 space-y-4">
                <div className="relative h-44" style={{ overflow: 'hidden', borderRadius: '8px' }}>
                  <Image
                    src="/courses/psychology-basics/uimp_wide-logo.webp"
                    alt="UIMP Logo"
                    fill
                    unoptimized
                    style={{ objectFit: 'cover', objectPosition: 'center' }}
                    priority
                  />
                </div>
                <div className="border-t border-white/20 pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/70 text-sm">{monthlyPayment}</span>
                    <span className="text-white/50 text-sm italic">{priceNote}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-sm">{durationLabel}</span>
                    <span className="text-white font-semibold">{duration}</span>
                  </div>
                  <a href="#price"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#D4A017] text-white font-bold px-6 py-3 rounded-lg hover:bg-[#b88913] transition-all text-sm text-center">
                    {enrollNow}<FaArrowRight />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
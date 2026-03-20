'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const tgSupportUrl = "https://t.me/uimp_support";
const emailUrl = "mailto:uimp.edu@gmail.com";
const linkClass = "text-white/40 hover:text-[#D4A843] transition-colors text-xs";

export default function Footer() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');
  const t = useTranslations('Footer');

  if (isDashboard) {
    return (
      <footer className="bg-[#1C3A2E] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <p>{"© 2025 Ukrainian Institute of Psychotherapy"}</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">{t('privacyShort')}</Link>
            <Link href="/terms" className="hover:text-white transition-colors">{t('termsShort')}</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto" style={{ background: '#111f18', position: 'relative', zIndex: 0 }}>
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[#D4A843] font-bold text-sm tracking-widest uppercase">{"UIMP"}</span>
          <span className="text-white/20 hidden md:block">{"·"}</span>
          <span className="text-white/30 text-xs hidden md:block">{t('institute')}</span>
        </div>
        <div className="flex items-start gap-10">
          <div className="flex flex-col gap-1.5">
            <Link href="/privacy" className={linkClass}>{t('privacy')}</Link>
            <Link href="/terms" className={linkClass}>{t('terms')}</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <a href={emailUrl} className={linkClass}>{t('email')}</a>
            <a href={tgSupportUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{t('techSupport')}</a>
          </div>
        </div>
        <p className="text-white/20 text-xs flex-shrink-0">{t('copyright')}</p>
      </div>
    </footer>
  );
}
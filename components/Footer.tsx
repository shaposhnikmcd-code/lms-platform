'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FaTelegram, FaInstagram, FaYoutube } from 'react-icons/fa';

const tgSupportUrl = "https://t.me/uimp_support";
const emailUrl = "mailto:uimp.edu@gmail.com";
const emailDisplay = "uimp.edu@gmail.com";
const tgUrl = "https://t.me/shaposhnykpsy";
const igUrl = "https://www.instagram.com/uimp_psychotherapy";
const ytUrl = "https://www.youtube.com/@bible_psychotherapy";
const linkClass = "text-white/70 hover:text-[#D4A843] transition-colors text-xs";

export default function Footer() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');
  const t = useTranslations('Footer');
  const currentYear = new Date().getFullYear();

  if (isDashboard) {
    return (
      <footer className="bg-[#1C3A2E] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <p>{`© ${currentYear} Ukrainian Institute of Ministry and Psychotherapy`}</p>
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

      {/* Соцмережі */}
      <div style={{ background: '#1C3A2E', padding: '16px 24px' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6">
          <span className="text-xs tracking-widest uppercase" style={{ color: '#D4A843' }}>{t('social')}</span>
          <div className="flex items-center gap-5">
            <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-[#26A5E4] transition-colors text-xs">
              <FaTelegram size={18} /> {"Telegram"}
            </a>
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-[#d6249f] transition-colors text-xs">
              <FaInstagram size={18} /> {"Instagram"}
            </a>
            <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-[#FF0000] transition-colors text-xs">
              <FaYoutube size={18} /> {"YouTube"}
            </a>
          </div>
        </div>
      </div>

      {/* Основний рядок */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[#D4A843] font-bold text-sm tracking-widest uppercase">{"UIMP"}</span>
          <span className="text-white/40 hidden md:block">{"·"}</span>
          <span className="text-white/60 text-xs hidden md:block">{t('institute')}</span>
        </div>
        <div className="flex items-start gap-10">
          <div className="flex flex-col gap-1.5">
            <Link href="/privacy" className={linkClass}>{t('privacy')}</Link>
            <Link href="/terms" className={linkClass}>{t('terms')}</Link>
            <Link href="/accessibility" className={linkClass}>{t('accessibility')}</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <a href={tgSupportUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{t('techSupport')}</a>
            <a href={emailUrl} className={linkClass}>{emailDisplay}</a>
          </div>
        </div>
        <p className="text-white/50 text-xs flex-shrink-0">{`© ${currentYear} Ukrainian Institute of Ministry and Psychotherapy. `}{t('allRightsReserved')}</p>
      </div>
    </footer>
  );
}
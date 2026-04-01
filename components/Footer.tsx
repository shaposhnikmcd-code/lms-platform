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
      <div style={{ background: 'linear-gradient(to right, #162e22, #1C3A2E, #162e22)', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '16px 24px' }}>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">

          {/* Заголовок з декором */}
          <div className="flex items-center gap-4 w-full justify-center">
            <div style={{ flex: 1, maxWidth: 120, height: '1px', background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.5))' }} />
            <div className="flex items-center gap-2">
              <span style={{ color: '#D4A843', fontSize: 9 }}>✦</span>
              <span className="text-xs tracking-[0.25em] uppercase font-bold" style={{ color: '#D4A843' }}>{t('social')}</span>
              <span style={{ color: '#D4A843', fontSize: 9 }}>✦</span>
            </div>
            <div style={{ flex: 1, maxWidth: 120, height: '1px', background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.5))' }} />
          </div>

          {/* Кнопки */}
          <div className="flex items-center justify-center gap-10 flex-wrap">
            <a href={tgUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
                style={{ background: 'rgba(38,165,228,0.12)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(38,165,228,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(38,165,228,0.55), 0 0 8px rgba(38,165,228,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(38,165,228,0.12)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
              >
                <FaTelegram size={24} style={{ color: '#26A5E4' }} />
              </div>
              <span className="text-[14px] tracking-wide text-white/40 group-hover:text-white/80 transition-colors duration-300">{"Telegram"}</span>
            </a>
            <a href={igUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
                style={{ background: 'rgba(214,36,159,0.12)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(214,36,159,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(214,36,159,0.55), 0 0 8px rgba(214,36,159,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(214,36,159,0.12)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
              >
                <FaInstagram size={24} style={{ color: '#d6249f' }} />
              </div>
              <span className="text-[14px] tracking-wide text-white/40 group-hover:text-white/80 transition-colors duration-300">{"Instagram"}</span>
            </a>
            <a href={ytUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
              style={{ textDecoration: 'none' }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
                style={{ background: 'rgba(255,0,0,0.12)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,0,0,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(255,0,0,0.55), 0 0 8px rgba(255,0,0,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,0,0,0.12)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; }}
              >
                <FaYoutube size={24} style={{ color: '#FF0000' }} />
              </div>
              <span className="text-[14px] tracking-wide text-white/40 group-hover:text-white/80 transition-colors duration-300">{"YouTube"}</span>
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
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <p>{`© ${currentYear} Ukrainian Institute of Ministry and Psychotherapy`}</p>
          <div className="flex gap-4">
            <Link href="/privacy" prefetch={false} className="hover:text-white transition-colors">{t('privacyShort')}</Link>
            <Link href="/terms" prefetch={false} className="hover:text-white transition-colors">{t('termsShort')}</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto" style={{ background: '#111f18', position: 'relative', zIndex: 0 }}>

      {/* Соцмережі */}
      <div style={{ background: 'linear-gradient(to right, #162e22, #1C3A2E, #162e22)', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '6px 24px 2px' }}>
        <div className="max-w-5xl mx-auto" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: 68 }}>

          {/* Заголовок зліва — абсолютно */}
          <div className="hidden sm:flex" style={{ position: 'absolute', left: -80, bottom: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,168,67,0.5)', fontWeight: 700 }}>{"UIMP"}</span>
            <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: '#D4A843' }}>{t('social')}</span>
            <div style={{ height: 1, width: '100%', background: 'linear-gradient(to right, #D4A843, transparent)' }} />
          </div>

          {/* Кнопки — по центру сторінки */}
          <div className="flex items-center justify-center gap-8 flex-wrap" style={{ transform: 'translateY(-6px)' }}>
            {[
              { href: tgUrl, icon: <FaTelegram size={29} />, label: 'Telegram', color: '#26A5E4', glow: 'rgba(38,165,228,0.9)' },
              { href: igUrl, icon: <FaInstagram size={29} />, label: 'Instagram', color: '#d6249f', glow: 'rgba(214,36,159,0.9)' },
              { href: ytUrl, icon: <FaYoutube size={29} />, label: 'YouTube', color: '#FF0000', glow: 'rgba(255,0,0,0.9)' },
            ].map(({ href, icon, label, color, glow }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1"
                style={{ textDecoration: 'none' }}
                onMouseEnter={e => {
                  const span = e.currentTarget.querySelector('span.icon') as HTMLElement;
                  const text = e.currentTarget.querySelector('span.label') as HTMLElement;
                  if (span) { span.style.transform = 'translateY(-4px) scale(1.15)'; span.style.filter = `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 14px ${glow.replace('0.9', '0.4')})`; }
                  if (text) text.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={e => {
                  const span = e.currentTarget.querySelector('span.icon') as HTMLElement;
                  const text = e.currentTarget.querySelector('span.label') as HTMLElement;
                  if (span) { span.style.transform = 'translateY(0) scale(1)'; span.style.filter = 'none'; }
                  if (text) text.style.color = 'rgba(255,255,255,0.4)';
                }}
              >
                <span className="icon" style={{ color, display: 'flex', transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), filter 0.35s ease' }}>
                  {icon}
                </span>
                <span className="label" style={{ fontSize: 13, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', transition: 'color 0.3s ease' }}>{label}</span>
              </a>
            ))}
          </div>

        </div>
      </div>

      {/* Основний рядок */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[#D4A843] font-bold text-sm tracking-widest uppercase">{"UIMP"}</span>
          <span className="text-white/60 text-xs hidden md:block">{t('institute')}</span>
        </div>
        <div className="flex items-start gap-10">
          <div className="flex flex-col gap-1.5">
            <Link href="/privacy" prefetch={false} className={linkClass}>{t('privacy')}</Link>
            <Link href="/terms" prefetch={false} className={linkClass}>{t('terms')}</Link>
            <Link href="/accessibility" prefetch={false} className={linkClass}>{t('accessibility')}</Link>
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
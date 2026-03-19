'use client';

import Link from 'next/link';
import { FaTelegram, FaInstagram, FaYoutube } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
    <footer className="mt-auto">
      <style>{`
        .social-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          transition: transform 0.3s;
        }
        .social-tg:hover .social-btn,
        .social-yt:hover .social-btn,
        .social-ig:hover .social-btn {
          transform: scale(1.08);
        }
      `}</style>

      {/* Блок соцмереж */}
      <div style={{ background: 'linear-gradient(135deg, #142d22 0%, #1C3A2E 50%, #142d22 100%)', borderTop: '1px solid rgba(212,168,67,0.2)' }}>
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col items-center gap-5">

          <div className="text-center">
            <h4 className="text-[#D4A843] font-bold text-xl uppercase tracking-[0.2em] mb-1">{t('social')}</h4>
            <p className="text-white/30 text-xs tracking-wider">{"@uimp_psychotherapy"}</p>
          </div>

          <div className="w-48 h-px"
            style={{ background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.5), transparent)' }} />

          <div className="flex gap-4">
            <Link href="https://t.me/shaposhnykpsy" target="_blank"
              className="social-tg group flex flex-col items-center gap-2">
              <div className="social-btn w-14 h-14 rounded-2xl flex items-center justify-center">
                <FaTelegram style={{ color: '#26A5E4', fontSize: '1.875rem' }} />
              </div>
              <span className="text-white/30 text-[11px] tracking-wide group-hover:text-white/70 transition-colors">{"Telegram"}</span>
            </Link>

            <Link href="https://www.instagram.com/uimp_psychotherapy" target="_blank"
              className="social-ig group flex flex-col items-center gap-2">
              <div className="social-btn w-14 h-14 rounded-2xl flex items-center justify-center">
                <FaInstagram style={{ color: '#d6249f', fontSize: '1.875rem' }} />
              </div>
              <span className="text-white/30 text-[11px] tracking-wide group-hover:text-white/70 transition-colors">{"Instagram"}</span>
            </Link>

            <Link href="https://www.youtube.com/@bible_psychotherapy" target="_blank"
              className="social-yt group flex flex-col items-center gap-2">
              <div className="social-btn w-14 h-14 rounded-2xl flex items-center justify-center">
                <FaYoutube style={{ color: '#FF0000', fontSize: '1.875rem' }} />
              </div>
              <span className="text-white/30 text-[11px] tracking-wide group-hover:text-white/70 transition-colors">{"YouTube"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Інформаційний блок */}
      <div className="bg-[#111f18] text-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[#D4A843] font-bold text-sm tracking-widest uppercase">{"UIMP"}</span>
            <span className="text-white/20 hidden md:block">{"·"}</span>
            <span className="text-white/30 text-xs hidden md:block">{t('description')}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/40">
            <Link href="/privacy" className="hover:text-[#D4A843] transition-colors">{t('privacy')}</Link>
            <span className="text-white/20">{"·"}</span>
            <Link href="/terms" className="hover:text-[#D4A843] transition-colors">{t('terms')}</Link>
            <span className="text-white/20">{"·"}</span>
            <Link href="/contacts" className="hover:text-[#D4A843] transition-colors">{t('contacts')}</Link>
          </div>
          <p className="text-white/20 text-xs">{t('copyright')}</p>
        </div>
      </div>

    </footer>
  );
}
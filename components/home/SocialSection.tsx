"use client";

import { FaTelegram, FaInstagram, FaYoutube } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

const tgUrl = "https://t.me/shaposhnykpsy";
const igUrl = "https://www.instagram.com/uimp_psychotherapy";
const ytUrl = "https://www.youtube.com/@bible_psychotherapy";

export default function SocialSection() {
  const t = useTranslations('Footer');

  return (
    <section style={{ background: '#E8D5B7', position: 'relative', overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.1)', zIndex: 1 }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 flex flex-col items-center gap-5">
        <div className="text-center">
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 400, color: '#1C3A2E', margin: '0 0 4px' }}>{t('social')}</h3>
          <p style={{ fontSize: 12, color: 'rgba(28,58,46,0.45)', fontWeight: 300 }}>{"@uimp_psychotherapy"}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 160 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(212,168,67,0.4)' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D4A843', opacity: 0.6 }} />
          <div style={{ flex: 1, height: 1, background: 'rgba(212,168,67,0.4)' }} />
        </div>

        <div className="flex gap-5">
          <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md" style={{ background: 'white', border: '1px solid rgba(28,58,46,0.1)', boxShadow: '0 2px 8px rgba(28,58,46,0.08)' }}>
              <FaTelegram style={{ color: '#26A5E4', fontSize: '1.4rem' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(28,58,46,0.5)', letterSpacing: '0.05em' }}>{"Telegram"}</span>
          </a>
          <a href={igUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md" style={{ background: 'white', border: '1px solid rgba(28,58,46,0.1)', boxShadow: '0 2px 8px rgba(28,58,46,0.08)' }}>
              <FaInstagram style={{ color: '#d6249f', fontSize: '1.4rem' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(28,58,46,0.5)', letterSpacing: '0.05em' }}>{"Instagram"}</span>
          </a>
          <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md" style={{ background: 'white', border: '1px solid rgba(28,58,46,0.1)', boxShadow: '0 2px 8px rgba(28,58,46,0.08)' }}>
              <FaYoutube style={{ color: '#FF0000', fontSize: '1.4rem' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(28,58,46,0.5)', letterSpacing: '0.05em' }}>{"YouTube"}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
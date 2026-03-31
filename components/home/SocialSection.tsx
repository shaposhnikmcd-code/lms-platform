"use client";

import { FaTelegram, FaInstagram, FaYoutube } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const tgUrl = "https://t.me/shaposhnykpsy";
const igUrl = "https://www.instagram.com/uimp_psychotherapy";
const ytUrl = "https://www.youtube.com/@bible_psychotherapy";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const sectionStyle: React.CSSProperties = { background: '#E8D5B7', position: 'relative', overflow: 'hidden', zIndex: 1 };
const divTop: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 };
const divBottom: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, #D4A843 20%, #D4A843 80%, transparent 100%)', opacity: 0.5 };
const dots: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.035) 1px, transparent 1px)', backgroundSize: '28px 28px' };

const cardDefault: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: '48px 24px 44px',
  borderRadius: 24,
  textDecoration: 'none',
  border: '1px solid rgba(28,58,46,0.12)',
  background: 'rgba(255,255,255,0.4)',
  position: 'relative' as const,
  overflow: 'hidden' as const,
  transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1), box-shadow 0.6s ease, background 0.6s ease, border-color 0.6s ease',
};

const shimmer: React.CSSProperties = {
  position: 'absolute' as const,
  top: -60,
  left: -60,
  width: 160,
  height: 160,
  borderRadius: '50%',
  pointerEvents: 'none' as const,
  transition: 'opacity 0.6s ease, transform 0.6s ease',
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  fontFamily: sysFont,
  color: '#1C3A2E',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  transition: 'letter-spacing 0.6s ease, opacity 0.6s ease',
};

export default function SocialSection() {
  const t = useTranslations('Footer');
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hTg, setHTg] = useState(false);
  const [hIg, setHIg] = useState(false);
  const [hYt, setHYt] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const headerAnim: React.CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.8s ease, transform 0.8s ease' };
  const c1Anim: React.CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s' };
  const c2Anim: React.CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity 0.7s ease 0.2s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s' };
  const c3Anim: React.CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity 0.7s ease 0.3s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s' };

  const tgCard: React.CSSProperties = { ...cardDefault, ...c1Anim, background: hTg ? 'rgba(210,230,240,0.65)' : 'rgba(255,255,255,0.4)', borderColor: hTg ? 'rgba(38,165,228,0.3)' : 'rgba(28,58,46,0.12)', transform: hTg ? 'translateY(-7px) scale(1.02)' : 'translateY(0) scale(1)', boxShadow: hTg ? '0 24px 60px rgba(38,165,228,0.12), 0 8px 24px rgba(28,58,46,0.08)' : '0 2px 12px rgba(28,58,46,0.06)' };
  const igCard: React.CSSProperties = { ...cardDefault, ...c2Anim, background: hIg ? 'rgba(235,215,228,0.65)' : 'rgba(255,255,255,0.4)', borderColor: hIg ? 'rgba(214,36,159,0.25)' : 'rgba(28,58,46,0.12)', transform: hIg ? 'translateY(-7px) scale(1.02)' : 'translateY(0) scale(1)', boxShadow: hIg ? '0 24px 60px rgba(214,36,159,0.1), 0 8px 24px rgba(28,58,46,0.08)' : '0 2px 12px rgba(28,58,46,0.06)' };
  const ytCard: React.CSSProperties = { ...cardDefault, ...c3Anim, background: hYt ? 'rgba(240,218,215,0.65)' : 'rgba(255,255,255,0.4)', borderColor: hYt ? 'rgba(255,0,0,0.2)' : 'rgba(28,58,46,0.12)', transform: hYt ? 'translateY(-7px) scale(1.02)' : 'translateY(0) scale(1)', boxShadow: hYt ? '0 24px 60px rgba(255,0,0,0.08), 0 8px 24px rgba(28,58,46,0.08)' : '0 2px 12px rgba(28,58,46,0.06)' };

  const tgShimmer: React.CSSProperties = { ...shimmer, background: 'radial-gradient(circle, rgba(38,165,228,0.18) 0%, transparent 70%)', opacity: hTg ? 1 : 0, transform: hTg ? 'scale(1.5) translate(10px, 10px)' : 'scale(0.8)' };
  const igShimmer: React.CSSProperties = { ...shimmer, background: 'radial-gradient(circle, rgba(214,36,159,0.15) 0%, transparent 70%)', opacity: hIg ? 1 : 0, transform: hIg ? 'scale(1.5) translate(10px, 10px)' : 'scale(0.8)' };
  const ytShimmer: React.CSSProperties = { ...shimmer, background: 'radial-gradient(circle, rgba(255,80,80,0.12) 0%, transparent 70%)', opacity: hYt ? 1 : 0, transform: hYt ? 'scale(1.5) translate(10px, 10px)' : 'scale(0.8)' };

  return (
    <section ref={sectionRef} style={sectionStyle}>
      <div style={divTop} />
      <div style={divBottom} />
      <div style={dots} />

      <div className="relative z-10 max-w-3xl mx-auto px-8 py-16">

        <div className="text-center mb-12" style={headerAnim}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '4px', textTransform: 'uppercase' as const, color: '#D4A843', marginBottom: 10, display: 'block' }}>
            {"◆ UIMP"}
          </span>
          <h3 style={{ fontFamily: sysFont, fontSize: 'clamp(14px, 2vw, 18px)', fontWeight: 600, color: 'rgba(28,58,46,0.5)', margin: 0, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
            {t('social')}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

          <a href={tgUrl} target="_blank" rel="noopener noreferrer"
            style={tgCard}
            onMouseEnter={() => setHTg(true)}
            onMouseLeave={() => setHTg(false)}>
            <div style={tgShimmer} />
            <FaTelegram style={{ fontSize: '2.6rem', color: '#26A5E4', transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)', transform: hTg ? 'scale(1.18) rotate(-6deg)' : 'scale(1) rotate(0deg)', position: 'relative', zIndex: 1 }} />
            <div style={{ ...labelStyle, letterSpacing: hTg ? '0.18em' : '0.1em', opacity: hTg ? 1 : 0.7 }}>{"Telegram"}</div>
          </a>

          <a href={igUrl} target="_blank" rel="noopener noreferrer"
            style={igCard}
            onMouseEnter={() => setHIg(true)}
            onMouseLeave={() => setHIg(false)}>
            <div style={igShimmer} />
            <FaInstagram style={{ fontSize: '2.6rem', color: '#d6249f', transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)', transform: hIg ? 'scale(1.18) rotate(-6deg)' : 'scale(1) rotate(0deg)', position: 'relative', zIndex: 1 }} />
            <div style={{ ...labelStyle, letterSpacing: hIg ? '0.18em' : '0.1em', opacity: hIg ? 1 : 0.7 }}>{"Instagram"}</div>
          </a>

          <a href={ytUrl} target="_blank" rel="noopener noreferrer"
            style={ytCard}
            onMouseEnter={() => setHYt(true)}
            onMouseLeave={() => setHYt(false)}>
            <div style={ytShimmer} />
            <FaYoutube style={{ fontSize: '2.6rem', color: '#FF0000', transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)', transform: hYt ? 'scale(1.18) rotate(-6deg)' : 'scale(1) rotate(0deg)', position: 'relative', zIndex: 1 }} />
            <div style={{ ...labelStyle, letterSpacing: hYt ? '0.18em' : '0.1em', opacity: hYt ? 1 : 0.7 }}>{"YouTube"}</div>
          </a>

        </div>
      </div>
    </section>
  );
}
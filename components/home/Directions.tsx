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

const ICONS = [
  <svg key="edu" viewBox="0 0 40 40" fill="none" width="36" height="36">
    <path d="M6 8h20v26H6z" fill="currentColor" opacity="0.12"/>
    <path d="M9 5h20v26H9z" fill="currentColor" opacity="0.22"/>
    <path d="M13 11h12M13 16h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M20 23l1.5 4.5 4.5.5-3.3 2.7 1.2 4.8L20 33l-3.9 2.5 1.2-4.8L14 28.5l4.5-.5z" fill="currentColor" opacity="0.7"/>
  </svg>,
  <svg key="heart" viewBox="0 0 40 40" fill="none" width="36" height="36">
    <path d="M20 33S6 24 6 14.5A8 8 0 0 1 20 10a8 8 0 0 1 14 4.5C34 24 20 33 20 33z" fill="currentColor" opacity="0.18"/>
    <path d="M20 29S8 21 8 13.5A6 6 0 0 1 20 9a6 6 0 0 1 12 4.5C32 21 20 29 20 29z" fill="currentColor"/>
  </svg>,
  <svg key="people" viewBox="0 0 40 40" fill="none" width="36" height="36">
    <circle cx="15" cy="13" r="5" fill="currentColor" opacity="0.22"/>
    <circle cx="15" cy="13" r="4" fill="currentColor"/>
    <path d="M5 33c0-6 4.5-10 10-10s10 4 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
    <circle cx="29" cy="15" r="3.5" fill="currentColor" opacity="0.35"/>
    <path d="M26 33c0-4 2.3-7.5 6-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3"/>
  </svg>,
  <svg key="game" viewBox="0 0 40 40" fill="none" width="36" height="36">
    <rect x="5" y="15" width="11" height="11" rx="2.5" fill="currentColor" opacity="0.18"/>
    <rect x="24" y="6" width="11" height="11" rx="2.5" fill="currentColor" opacity="0.18"/>
    <rect x="24" y="23" width="11" height="11" rx="2.5" fill="currentColor" opacity="0.18"/>
    <rect x="5" y="6" width="11" height="11" rx="2.5" fill="currentColor"/>
  </svg>,
];

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function Directions({ content }: Props) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.06 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const items = content.items;

  return (
    <section ref={ref} style={{ background: '#F7F3EE', padding: '80px 0 40px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.025) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
          <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#1C3A2E', lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
            {content.title}
          </h2>
          <div style={{ height: 1, width: 320, margin: '0 auto 14px', background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,67,0.15) 20%, #D4A843 50%, rgba(212,168,67,0.15) 80%, transparent 100%)' }} />
          <p style={{ fontSize: 14, color: 'rgba(28,58,46,0.5)', lineHeight: 1.65, fontFamily: sysFont, margin: '0 auto', maxWidth: 480 }}>
            {content.subtitle}
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14, alignItems: 'stretch' }}>

          {/* Featured card */}
          <Link
            href={items[0].link}
            onMouseEnter={() => setHovered(0)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: hovered === 0 ? '#234d3c' : '#1C3A2E',
              borderRadius: 20,
              padding: '44px 40px',
              border: '1px solid rgba(212,168,67,0.2)',
              textDecoration: 'none',
              position: 'relative',
              overflow: 'hidden',
              opacity: visible ? 1 : 0,
              transform: visible ? hovered === 0 ? 'translateY(-6px) scale(1.012)' : 'translateY(0)' : 'translateY(32px)',
              transition: visible ? 'transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease, background 0.25s ease' : 'opacity 0.6s ease, transform 0.6s ease',
              boxShadow: hovered === 0 ? '0 32px 64px rgba(28,58,46,0.5)' : '0 4px 20px rgba(0,0,0,0.1)',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'absolute', bottom: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.12) 0%, transparent 70%)', transition: 'opacity 0.4s ease', opacity: hovered === 0 ? 1 : 0.5, pointerEvents: 'none' }} />

            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4A843', marginBottom: 32, transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)', transform: hovered === 0 ? 'scale(1.12) rotate(-5deg)' : 'scale(1)' }}>
              {ICONS[0]}
            </div>

            <h3 style={{ fontFamily: sysFont, fontSize: 28, fontWeight: 700, color: '#F5EDD6', lineHeight: 1.2, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
              {items[0].title}
            </h3>

            <p style={{ fontFamily: sysFont, fontSize: 14, color: 'rgba(245,237,214,0.55)', lineHeight: 1.7, margin: '0 0 auto', maxWidth: 280 }}>
              {items[0].description}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(212,168,67,0.2)' }}>
              <span style={{ fontFamily: sysFont, fontSize: 16, fontWeight: 700, color: '#D4A843', letterSpacing: '0.01em' }}>
                {items[0].price}
              </span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s ease', transform: hovered === 0 ? 'translateX(4px)' : 'translateX(0)' }}>
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Link>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { meta: { bg: '#D4A843', hoverBg: '#e0b54e', accent: '#1C3A2E', text: '#1C3A2E', price: '#1C3A2E', border: 'rgba(28,58,46,0.15)', shadow: '0 24px 48px rgba(212,168,67,0.4)' }, idx: 1 },
              { meta: { bg: '#FAF6F0', hoverBg: '#f0ebe2', accent: '#1C3A2E', text: '#1C3A2E', price: '#1C3A2E', border: 'rgba(28,58,46,0.1)', shadow: '0 24px 48px rgba(28,58,46,0.15)' }, idx: 2 },
              { meta: { bg: '#0d1f16', hoverBg: '#132b1e', accent: '#D4A843', text: '#F5EDD6', price: '#D4A843', border: 'rgba(212,168,67,0.15)', shadow: '0 24px 48px rgba(0,0,0,0.45)' }, idx: 3 },
            ].map(({ meta, idx }) => (
              <Link
                key={idx}
                href={items[idx].link}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  background: hovered === idx ? meta.hoverBg : meta.bg,
                  borderRadius: 18,
                  padding: '22px 28px',
                  border: `1px solid ${meta.border}`,
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  flex: 1,
                  opacity: visible ? 1 : 0,
                  transform: visible ? hovered === idx ? 'translateY(-5px) scale(1.012)' : 'translateY(0)' : 'translateY(32px)',
                  transition: visible ? 'transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease, background 0.25s ease' : `opacity 0.6s ease ${idx * 0.1}s, transform 0.6s ease ${idx * 0.1}s`,
                  boxShadow: hovered === idx ? meta.shadow : '0 2px 12px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${meta.accent}18 0%, transparent 70%)`, opacity: hovered === idx ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: 'none' }} />

                <div style={{ width: 48, height: 48, borderRadius: 13, background: `${meta.accent}18`, border: `1px solid ${meta.accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.accent, flexShrink: 0, transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)', transform: hovered === idx ? 'scale(1.12) rotate(-5deg)' : 'scale(1)' }}>
                  {ICONS[idx]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: sysFont, fontSize: 18, fontWeight: 700, color: meta.text, lineHeight: 1.25, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    {items[idx].title}
                  </h3>
                  {items[idx].price && (
                    <span style={{ fontFamily: sysFont, fontSize: 12, fontWeight: 700, color: meta.price, opacity: 0.75, letterSpacing: '0.02em' }}>
                      {items[idx].price}
                    </span>
                  )}
                </div>

                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${meta.accent}15`, border: `1px solid ${meta.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.3s ease', transform: hovered === idx ? 'translateX(4px)' : 'translateX(0)' }}>
                  <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke={meta.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
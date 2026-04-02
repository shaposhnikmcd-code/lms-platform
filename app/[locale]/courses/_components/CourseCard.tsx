'use client';

import { Link } from "@/i18n/navigation";
import { useState } from "react";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  href: string;
  accent: string;
  accentRgb: string;
  tag: string;
  icon: string;
  title: string;
  description: string;
  price: string | number;
  duration: string;
  currency: string;
  priceLabel: string;
  index: number;
  benefits: { icon: string; title: string }[];
  dark?: boolean;
};

const CARD_BG = '#1e3d2e';
const CARD_BG_HOVER = '#244838';
const STRIP_BORDER = 'rgba(255,255,255,0.06)';

export default function CourseCard({ href, accentRgb, tag, icon, title, description, price, duration, currency, priceLabel, index, benefits }: Props) {
  const [hovered, setHovered] = useState(false);
  const tagColor = index % 2 === 0 ? '#D4A843' : '#C4919A';

  return (
    <Link href={href} style={{ display: 'block', textDecoration: 'none', marginBottom: 14 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto]"
        style={{
          background: hovered ? CARD_BG_HOVER : CARD_BG,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: hovered ? '0 28px 56px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.1)',
          transform: hovered ? 'translateY(-4px) scale(1.008)' : 'translateY(0) scale(1)',
          transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '28px 32px 24px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `rgba(${accentRgb},0.18)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
                transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
                transform: hovered ? 'scale(1.12) rotate(-5deg)' : 'scale(1)',
              }}>
                {icon}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
                {tag}
              </span>
            </div>

            <h2 style={{ fontFamily: sysFont, fontSize: 'clamp(19px, 2vw, 24px)', fontWeight: 700, color: '#F5EDD6', lineHeight: 1.25, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              {title}
            </h2>

            <div style={{ width: 32, height: 2, background: tagColor, borderRadius: 2, marginBottom: 12, opacity: 0.5 }} />

            <p style={{ fontSize: 13.5, color: 'rgba(245,237,214,0.6)', lineHeight: 1.8, margin: 0, fontFamily: sysFont }}>
              {description}
            </p>
          </div>

          <div className="hidden sm:flex" style={{ borderTop: `1px solid ${STRIP_BORDER}`, background: 'rgba(255,255,255,0.03)' }}>
            {benefits.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRight: i < benefits.length - 1 ? `1px solid ${STRIP_BORDER}` : 'none' }}>
                <span style={{ fontSize: 12 }}>{b.icon}</span>
                <span style={{ fontSize: 11, color: 'rgba(245,237,214,0.35)', fontFamily: sysFont, fontWeight: 500, whiteSpace: 'nowrap' as const }}>
                  {b.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — price */}
        <div style={{ background: '#D4A843', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 32px', gap: 16, minWidth: 160, position: 'relative', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: 'rgba(28,58,46,0.5)', margin: '0 0 6px', fontFamily: sysFont }}>
              {priceLabel}
            </p>
            <p style={{ fontFamily: sysFont, fontSize: 36, fontWeight: 700, color: '#1C3A2E', margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {price}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(28,58,46,0.5)', margin: '4px 0 0', fontFamily: sysFont }}>
              {currency}
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1C3A2E', color: '#D4A843', padding: '10px 20px', borderRadius: 9, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', fontFamily: sysFont, whiteSpace: 'nowrap' as const, transition: 'transform 0.3s ease', transform: hovered ? 'translateX(3px)' : 'translateX(0)' }}>
            {duration}
            <svg viewBox="0 0 16 16" fill="none" width="11" height="11">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
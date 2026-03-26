'use client';

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useState } from "react";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  href: string;
  isExternal?: boolean;
  accent: string;
  accentRgb: string;
  title: string;
  description: string;
  price: string;
  duration: string;
  freeLabel: string;
  icon?: string;
  imageSrc?: string;
  index: number;
};

export default function CharityCard({ href, isExternal, accent, accentRgb, title, description, duration, freeLabel, icon, imageSrc }: Props) {
  const [hovered, setHovered] = useState(false);

  const inner = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 18,
        overflow: 'hidden',
        background: hovered ? '#244838' : '#1e3d2e',
        border: hovered ? `1px solid rgba(${accentRgb},0.4)` : '1px solid rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 24px 48px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.1)',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      <div style={{
        position: 'absolute',
        top: -8, right: -12,
        fontFamily: sysFont,
        fontSize: 80,
        fontWeight: 700,
        color: `rgba(${accentRgb},0.07)`,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        userSelect: 'none' as const,
        pointerEvents: 'none',
      }}>
        {"FREE"}
      </div>

      {hovered && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.7), transparent)`,
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ padding: '28px 28px 20px', flex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.3)`, borderRadius: 100, padding: '4px 12px', marginBottom: 24 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: accent, fontFamily: sysFont }}>
            {freeLabel}
          </span>
        </div>

        <div style={{ marginBottom: 18 }}>
          {icon && (
            <div style={{
              width: 48, height: 48, borderRadius: 13,
              background: `rgba(${accentRgb},0.12)`,
              border: `1px solid rgba(${accentRgb},0.18)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              transform: hovered ? 'scale(1.08) rotate(-4deg)' : 'scale(1)',
              transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
            }}>
              {icon}
            </div>
          )}
          {imageSrc && !icon && (
            <div style={{ width: 48, height: 48, borderRadius: 13, overflow: 'hidden', position: 'relative', border: `1px solid rgba(${accentRgb},0.18)` }}>
              <Image src={imageSrc} alt={title} fill style={{ objectFit: 'cover' }} />
            </div>
          )}
        </div>

        <h2 style={{
          fontFamily: sysFont,
          fontSize: 18,
          fontWeight: 700,
          color: '#F5EDD6',
          lineHeight: 1.3,
          margin: '0 0 10px',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h2>

        <p style={{
          fontSize: 13,
          color: 'rgba(245,237,214,0.5)',
          lineHeight: 1.75,
          margin: 0,
          fontFamily: sysFont,
        }}>
          {description}
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.12)',
      }}>
        <span style={{ fontSize: 12, color: `rgba(${accentRgb},0.55)`, fontFamily: sysFont }}>
          {duration}
        </span>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: hovered ? accent : 'rgba(255,255,255,0.08)',
          color: hovered ? '#1C3A2E' : 'rgba(245,237,214,0.7)',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          fontFamily: sysFont,
          transition: 'all 0.3s ease',
          whiteSpace: 'nowrap' as const,
        }}>
          {"Перейти до курсу"}
          <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );

  if (isExternal) return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</a>;
  return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
}
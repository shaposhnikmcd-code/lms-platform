'use client';

import React from "react";
import { useIsMobile } from "@/lib/useIsMobile";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  t: {
    label: string;
    caption: string;
    pillars: readonly { level: string; text: string }[];
  };
};

export default function SolutionSection({ t }: Props) {
  const pillars = t.pillars;
  const isMobile = useIsMobile();

  return (
    <section style={{
      backgroundColor: '#FAF6F0',
      position: 'relative',
      overflow: 'hidden',
      padding: isMobile ? '0 16px 32px' : '0 48px 48px',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* label — mirrors Story's "Ми побачили проблему" */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 24,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#D4A843', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: sysFont,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: '#1C3A2E',
            flexShrink: 0,
          }}>{t.label}</span>
          <div style={{
            height: 1, flex: 1,
            backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.5), transparent)',
          }} />
        </div>

        {/* compact dark card */}
        <div style={{
          backgroundColor: '#1C3A2E',
          borderRadius: 20,
          padding: isMobile ? '24px 20px' : '28px 40px',
          boxShadow: '0 8px 32px rgba(28,58,46,0.15)',
        }}>
          <p style={{
            fontFamily: sysFont,
            fontSize: 12,
            color: 'rgba(245,237,214,0.35)',
            fontStyle: 'italic',
            margin: '0 0 24px',
            lineHeight: 1.6,
            letterSpacing: '0.01em',
          }}>
            {t.caption}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: isMobile ? 20 : 0,
          }}>
            {pillars.map((p, i) => (
              <div key={i} style={{
                borderRight: (!isMobile && i < pillars.length - 1) ? '1px solid rgba(255,255,255,0.07)' : 'none',
                borderTop: (isMobile && i > 0) ? '1px solid rgba(255,255,255,0.07)' : 'none',
                paddingRight: (!isMobile && i < pillars.length - 1) ? 28 : 0,
                paddingLeft: (!isMobile && i > 0) ? 28 : 0,
                paddingTop: (isMobile && i > 0) ? 20 : 0,
              }}>
                <span style={{
                  fontFamily: sysFont,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: '#D4A843',
                  textTransform: 'uppercase' as const,
                  display: 'block',
                  marginBottom: 8,
                }}>{p.level}</span>
                <p style={{
                  fontFamily: sysFont,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(245,237,214,0.75)',
                  lineHeight: 1.65,
                  margin: 0,
                }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

'use client';

import React from "react";
import { useIsMobile } from "@/lib/useIsMobile";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const points = [
  "Науковий підхід + духовний аспект",
  "Душеопіка стає частиною психології і навпаки",
  "Психологія в її первинному вигляді стає допоміжним інструментом у церквах",
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#FAF6F0',
  position: 'relative',
  overflow: 'hidden',
  padding: '60px 48px 80px',
};

const dotPatternStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.06) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const innerCardStyle: React.CSSProperties = {
  backgroundColor: '#1C3A2E',
  borderRadius: 24,
  padding: '36px 48px',
  boxShadow: '0 16px 48px rgba(28,58,46,0.2)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 'clamp(20px, 2.5vw, 28px)',
  fontWeight: 700,
  color: '#F5EDD6',
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
  margin: '0 0 8px',
};

const titleAccentStyle: React.CSSProperties = {
  color: '#D4A843',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 13,
  color: 'rgba(245,237,214,0.45)',
  margin: '0 0 28px',
  lineHeight: 1.7,
  fontStyle: 'italic' as const,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.35), transparent)',
  marginBottom: 24,
};

const pointsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 0,
};

const pointStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  padding: '16px 0',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const pointLastStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  padding: '16px 0 0',
};

const checkWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 24,
  height: 24,
  borderRadius: 8,
  backgroundColor: 'rgba(212,168,67,0.12)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(212,168,67,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const checkMarkStyle: React.CSSProperties = {
  width: 8,
  height: 5,
  borderLeft: '2px solid #D4A843',
  borderBottom: '2px solid #D4A843',
  transform: 'rotate(-45deg) translateY(-1px)',
};

const pointTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 16,
  fontWeight: 600,
  color: '#F5EDD6',
  lineHeight: 1.5,
  margin: 0,
  letterSpacing: '-0.01em',
};

export default function SolutionSection() {
  const isMobile = useIsMobile();
  const sectionStyleR: React.CSSProperties = { ...sectionStyle, padding: isMobile ? '40px 16px 60px' : '60px 48px 80px' };
  const innerCardStyleR: React.CSSProperties = { ...innerCardStyle, padding: isMobile ? '24px 20px' : '36px 48px' };
  return (
    <section style={sectionStyleR}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>
        <div style={innerCardStyleR}>
          <h2 style={titleStyle}>
            {"Наше рішення — "}
            <span style={titleAccentStyle}>{"метод Біблійної терапії"}</span>
          </h2>
          <p style={subtitleStyle}>
            {"який передбачає зцілення ідентичності на трьох рівнях: дух, душа, тіло"}
          </p>
          <div style={dividerStyle} />
          <div style={pointsRowStyle}>
            {points.map((text, i) => (
              <div key={i} style={i === points.length - 1 ? pointLastStyle : pointStyle}>
                <div style={checkWrapStyle}>
                  <div style={checkMarkStyle} />
                </div>
                <p style={pointTextStyle}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
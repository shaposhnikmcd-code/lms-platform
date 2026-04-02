'use client';

import { useIsMobile } from "@/lib/useIsMobile";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const dotPatternStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.06) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
  textAlign: 'center' as const,
};

const eyebrowRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  marginBottom: 36,
};

const lineLeftStyle: React.CSSProperties = {
  height: 1,
  width: 60,
  backgroundImage: 'linear-gradient(to right, transparent, #D4A843)',
};

const lineRightStyle: React.CSSProperties = {
  height: 1,
  width: 60,
  backgroundImage: 'linear-gradient(to left, transparent, #D4A843)',
};

const diamondStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  backgroundColor: '#D4A843',
  transform: 'rotate(45deg)',
  opacity: 0.7,
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 'clamp(28px, 4vw, 44px)',
  fontWeight: 700,
  color: '#1C3A2E',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
  margin: '0 0 24px',
};

const dividerStyle: React.CSSProperties = {
  width: 48,
  height: 2,
  backgroundColor: '#D4A843',
  borderRadius: 2,
  margin: '0 auto 24px',
  opacity: 0.6,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 16,
  color: 'rgba(28,58,46,0.5)',
  lineHeight: 1.8,
  margin: 0,
  fontStyle: 'italic' as const,
};

export default function VisionSection() {
  const isMobile = useIsMobile();
  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#FAF6F0',
    padding: isMobile ? '40px 16px 60px' : '60px 48px 80px',
    position: 'relative',
    overflow: 'hidden',
  };
  return (
    <section style={sectionStyle}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>

        <div style={eyebrowRowStyle}>
          <div style={lineLeftStyle} />
          <div style={diamondStyle} />
          <div style={lineRightStyle} />
        </div>

        <h2 style={titleStyle}>
          {"Команда інституту має великі плани"}<br />
          {"та амбіційну стратегію розвитку"}
        </h2>

        <div style={dividerStyle} />

        <p style={subtitleStyle}>
          {"Віримо, що Бог надихає нас, тому рухаємося за Його вказівками!"}<br />
          {"Запрошуємо в спільну подорож"}
        </p>

      </div>
    </section>
  );
}
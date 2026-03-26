'use client';

import Image from 'next/image';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const sectionStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)',
  position: 'relative',
  overflow: 'hidden',
  padding: '72px 48px 80px',
};

const blobStyle: React.CSSProperties = {
  position: 'absolute',
  top: 40,
  left: 40,
  width: 384,
  height: 384,
  borderRadius: '50%',
  backgroundColor: 'rgba(212,168,67,0.05)',
  filter: 'blur(60px)',
  pointerEvents: 'none',
};

const innerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 64,
};

const leftStyle: React.CSSProperties = {
  flex: 1,
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid rgba(212,168,67,0.25)',
  backgroundColor: 'rgba(212,168,67,0.12)',
  borderRadius: 100,
  padding: '6px 16px',
  marginBottom: 32,
};

const badgeTextStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.28em',
  textTransform: 'uppercase' as const,
  color: '#D4A843',
  fontFamily: sysFont,
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 'clamp(32px, 4vw, 52px)',
  fontWeight: 700,
  color: 'white',
  lineHeight: 1.08,
  letterSpacing: '-0.025em',
  margin: '0 0 20px',
};

const titleAccentStyle: React.CSSProperties = {
  color: '#D4A843',
};

const descStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 15,
  color: 'rgba(255,255,255,0.65)',
  lineHeight: 1.8,
  margin: '0 0 0',
  maxWidth: 460,
};

const rightStyle: React.CSSProperties = {
  flexShrink: 0,
};

const logoCardStyle: React.CSSProperties = {
  width: 220,
  height: 220,
  borderRadius: 20,
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(212,168,67,0.15)',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const logoGlowStyle: React.CSSProperties = {
  position: 'absolute',
  inset: -20,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(212,168,67,0.15), transparent 70%)',
  pointerEvents: 'none',
};

export default function HeroSection() {
  return (
    <section style={sectionStyle}>
      <div style={blobStyle} />

      <div style={innerStyle}>
        {/* LEFT — текст */}
        <div style={leftStyle}>
          <div style={badgeStyle}>
            <span style={badgeTextStyle}>{"UIMP"}</span>
          </div>
          <h1 style={titleStyle}>
            {"Український інститут"}<br />
            {"Душеопіки та "}
            <span style={titleAccentStyle}>{"Психотерапії (UIMP)"}</span>
          </h1>
          <p style={descStyle}>
            {"Простір, де терапія охоплює людину цілісно (дух, душа, тіло)."}<br />
            {"Ми переконані, що психологія в її первинному вигляді містить духовність."}
          </p>
        </div>

        {/* RIGHT — логотип */}
        <div style={rightStyle}>
          <div style={logoCardStyle}>
            <div style={logoGlowStyle} />
            <Image
              src="/about-us/logo.jpg"
              alt="UIMP Logo"
              fill
              style={{ objectFit: 'contain', padding: '20px' }}
              sizes="220px"
              quality={100}
              unoptimized
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
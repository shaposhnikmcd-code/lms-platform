'use client';

import Image from 'next/image';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const sectionStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1C3A2E 0%, #1a3828 50%, #0f2219 100%)',
  position: 'relative',
  overflow: 'hidden',
  padding: '72px 0 80px',
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

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
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
  margin: 0,
};

const titleAccentStyle: React.CSSProperties = {
  color: '#D4A843',
};

const logoImgWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  position: 'relative',
  width: 256,
  height: 256,
};

export default function HeroSection() {
  return (
    <section style={sectionStyle}>
      <div style={blobStyle} />
      <div className="container mx-auto px-12 md:px-16 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-8">

          <div className="flex-1 flex justify-center order-1 md:order-2">
            <div style={logoImgWrapStyle}>
              <Image
                src="/about-us/logo-yellow.webp"
                alt="UIMP Logo"
                fill
                style={{ objectFit: 'contain' }}
                sizes="256px"
                quality={100}
                unoptimized
                priority
              />
            </div>
          </div>

          <div className="flex-1 order-2 md:order-1">
            <div style={badgeStyle}>
              <span style={badgeTextStyle}>{"UIMP"}</span>
            </div>
            <h1 style={titleStyle}>
              {"Український інститут"}<br />
              {"Душеопіки та "}
              <span style={titleAccentStyle}>{"Психотерапії (UIMP)"}</span>
            </h1>
          </div>

        </div>
      </div>
    </section>
  );
}
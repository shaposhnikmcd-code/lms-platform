'use client';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const points = [
  [
    "Науковий підхід + духовний аспект",
    "Душеопіка стає частиною психології і навпаки",
  ],
  [
    "Психологія в її первинному вигляді стає допоміжним інструментом у церквах",
  ],
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#1C3A2E',
  position: 'relative',
  overflow: 'hidden',
  padding: '100px 48px',
};

const blobStyle: React.CSSProperties = {
  position: 'absolute',
  top: -80,
  right: -80,
  width: 400,
  height: 400,
  borderRadius: '50%',
  backgroundColor: 'rgba(212,168,67,0.06)',
  filter: 'blur(80px)',
  pointerEvents: 'none',
};

const blob2Style: React.CSSProperties = {
  position: 'absolute',
  bottom: -60,
  left: -40,
  width: 300,
  height: 300,
  borderRadius: '50%',
  backgroundColor: 'rgba(212,168,67,0.04)',
  filter: 'blur(60px)',
  pointerEvents: 'none',
};

const dotPatternStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(circle, rgba(212,168,67,0.07) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 16,
};

const accentBarStyle: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 10,
  width: 40,
  height: 3,
  borderRadius: 2,
  backgroundColor: '#D4A843',
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 'clamp(28px, 3.5vw, 44px)',
  fontWeight: 700,
  color: '#F5EDD6',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  margin: 0,
};

const titleAccentStyle: React.CSSProperties = {
  color: '#D4A843',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 18,
  color: 'rgba(245,237,214,0.55)',
  margin: '12px 0 0 56px',
  lineHeight: 1.6,
  fontStyle: 'italic' as const,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.4) 0%, transparent 100%)',
  margin: '56px 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1px 1fr',
  gap: '0 64px',
};

const colDividerStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, transparent, rgba(212,168,67,0.3), transparent)',
};

const colStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 24,
};

const pointStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
};

const checkWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 2,
  width: 22,
  height: 22,
  borderRadius: 6,
  backgroundColor: 'rgba(212,168,67,0.15)',
  border: '1px solid rgba(212,168,67,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const checkMarkStyle: React.CSSProperties = {
  width: 8,
  height: 5,
  borderLeft: '1.5px solid #D4A843',
  borderBottom: '1.5px solid #D4A843',
  transform: 'rotate(-45deg) translateY(-1px)',
};

const pointTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 15,
  color: 'rgba(245,237,214,0.75)',
  lineHeight: 1.7,
  margin: 0,
};

export default function SolutionSection() {
  return (
    <section style={sectionStyle}>
      <div style={dotPatternStyle} />
      <div style={blobStyle} />
      <div style={blob2Style} />

      <div style={containerStyle}>
        {/* Title */}
        <div style={topRowStyle}>
          <div style={accentBarStyle} />
          <h2 style={titleStyle}>
            {"наше рішення — "}
            <span style={titleAccentStyle}>{"метод Біблійної терапії"}</span>
          </h2>
        </div>
        <p style={subtitleStyle}>
          {"який передбачає зцілення ідентичності на трьох рівнях: дух, душа, тіло"}
        </p>

        <div style={dividerStyle} />

        {/* Points grid */}
        <div style={gridStyle}>
          <div style={colStyle}>
            {points[0].map((text, i) => (
              <div key={i} style={pointStyle}>
                <div style={checkWrapStyle}>
                  <div style={checkMarkStyle} />
                </div>
                <p style={pointTextStyle}>{text}</p>
              </div>
            ))}
          </div>

          <div style={colDividerStyle} />

          <div style={colStyle}>
            {points[1].map((text, i) => (
              <div key={i} style={pointStyle}>
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
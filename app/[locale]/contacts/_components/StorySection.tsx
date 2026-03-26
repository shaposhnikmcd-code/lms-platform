'use client';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const problems = [
  [
    "У церкві багато травмованих, залежних і зламаних людей. Вони, як говорив Христос, \"потребують лікаря\". Церква не завжди має достатньо інструментів для допомоги таким людям, особливо що стосується психічних розладів.",
    "Культурально церква працює тільки з духовним складником людини, яка не усуває проблеми повністю, бо деякі проблеми знаходяться на іншому рівні, з яким церква не працює.",
  ],
  [
    "Сучасна психологія не використовується в церкві через відсутність духовної складової. Хоча насправді вона має дієві науково обґрунтовані інструменти.",
  ],
  [
    "Первинна психологія передбачає зцілення ідентичності через віднаходження її в Бозі.",
    "Сучасна психологія у чистому її вигляді — позбавлена повноти зцілення, тому застосовуватися в душеопіку віруючих не може.",
  ],
];

const sectionStyle: React.CSSProperties = {
  padding: '100px 48px 120px',
  backgroundColor: '#FAF6F0',
  position: 'relative',
  overflow: 'hidden',
};

const dotPatternStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.06) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 80,
};

const eyebrowRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  marginBottom: 20,
};

const lineLeftStyle: React.CSSProperties = {
  height: 1,
  width: 80,
  backgroundImage: 'linear-gradient(to right, transparent, #D4A843)',
};

const lineRightStyle: React.CSSProperties = {
  height: 1,
  width: 80,
  backgroundImage: 'linear-gradient(to left, transparent, #D4A843)',
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.22em',
  color: '#D4A843',
  textTransform: 'uppercase' as const,
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 40,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: '#1C3A2E',
  margin: '0 0 16px',
  lineHeight: 1.1,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 15,
  color: 'rgba(28,58,46,0.45)',
  margin: 0,
};

const problemLabelWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 48,
};

const problemLabelLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  backgroundImage: 'linear-gradient(to right, rgba(28,58,46,0.15), transparent)',
};

const problemLabelStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'rgba(28,58,46,0.35)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 24,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: '36px 32px',
  boxShadow: '0 4px 24px rgba(28,58,46,0.07)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 20,
};

const cardNumberStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.15em',
  color: '#D4A843',
  opacity: 0.7,
  marginBottom: 4,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  alignItems: 'flex-start',
};

const bulletStyle: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 7,
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: '#D4A843',
};

const itemTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 14,
  color: '#2a3a2e',
  lineHeight: 1.8,
  margin: 0,
};

export default function StorySection() {
  return (
    <section style={sectionStyle}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>

        {/* Header */}
        <div style={headerStyle}>
          <div style={eyebrowRowStyle}>
            <div style={lineLeftStyle} />
            <span style={eyebrowStyle}>{"Наша місія"}</span>
            <div style={lineRightStyle} />
          </div>
          <h2 style={titleStyle}>{"Історія створення UIMP"}</h2>
          <p style={subtitleStyle}>{"Чому ми вирішили об'єднати психологію та духовність"}</p>
        </div>

        {/* Problem label */}
        <div style={problemLabelWrapStyle}>
          <span style={problemLabelStyle}>{"Ми побачили проблему"}</span>
          <div style={problemLabelLineStyle} />
        </div>

        {/* Cards grid */}
        <div style={gridStyle}>
          {problems.map((col, i) => (
            <div key={i} style={cardStyle}>
              <span style={cardNumberStyle}>{`0${i + 1}`}</span>
              {col.map((text, j) => (
                <div key={j} style={itemStyle}>
                  <div style={bulletStyle} />
                  <p style={itemTextStyle}>{text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
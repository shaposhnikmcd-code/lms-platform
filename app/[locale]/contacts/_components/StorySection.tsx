'use client';

import { useEffect, useRef, useState } from "react";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const problems = [
  {
    num: "01",
    text: "У церкві багато травмованих, залежних і зламаних людей. Вони, як говорив Христос, «потребують лікаря». Церква не завжди має достатньо інструментів для допомоги таким людям, особливо що стосується психічних розладів.",
  },
  {
    num: "02",
    text: "Культурально церква працює тільки з духовним складником людини, яка не усуває проблеми повністю, бо деякі проблеми знаходяться на іншому рівні, з яким церква не працює.",
  },
  {
    num: "03",
    text: "Сучасна психологія не використовується в церкві через відсутність духовної складової. Хоча насправді вона має дієві науково обґрунтовані інструменти.",
  },
  {
    num: "04",
    text: "Первинна психологія передбачає зцілення ідентичності через віднаходження її в Бозі. Сучасна психологія у чистому її вигляді — позбавлена повноти зцілення.",
  },
];

const sectionStyle: React.CSSProperties = {
  padding: '60px 48px 80px',
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
  maxWidth: 1000,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const titleRowStyle: React.CSSProperties = {
  marginBottom: 48,
};

const titleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 40,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: '#1C3A2E',
  margin: '0 0 14px',
  lineHeight: 1.1,
};

const titleOrnamentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const titleLineStyle: React.CSSProperties = {
  height: 1,
  width: 40,
  backgroundImage: 'linear-gradient(to right, #D4A843, rgba(212,168,67,0.2))',
};

const titleDiamondStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  backgroundColor: '#D4A843',
  transform: 'rotate(45deg)',
  flexShrink: 0,
};

const titleLineFadeStyle: React.CSSProperties = {
  height: 1,
  width: 24,
  backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.3), transparent)',
};

const problemLabelWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  marginBottom: 32,
};

const labelTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: '#1C3A2E',
  flexShrink: 0,
};

const labelLineStyle: React.CSSProperties = {
  height: 1,
  flex: 1,
  backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.5), transparent)',
};

const labelDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: '#D4A843',
  flexShrink: 0,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 2,
};

const cardBaseStyle: React.CSSProperties = {
  padding: '32px 36px',
  backgroundColor: 'white',
  position: 'relative',
  overflow: 'hidden',
};

const cardStyles: React.CSSProperties[] = [
  { ...cardBaseStyle, borderRadius: '20px 0 0 0' },
  { ...cardBaseStyle, borderRadius: '0 20px 0 0' },
  { ...cardBaseStyle, borderRadius: '0 0 0 20px' },
  { ...cardBaseStyle, borderRadius: '0 0 20px 0' },
];

const numBgStyle: React.CSSProperties = {
  position: 'absolute',
  top: -8,
  right: 16,
  fontFamily: sysFont,
  fontSize: 80,
  fontWeight: 900,
  color: 'rgba(28,58,46,0.04)',
  lineHeight: 1,
  letterSpacing: '-4px',
  userSelect: 'none',
  pointerEvents: 'none',
};

const cardTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 14,
  color: '#2a3a2e',
  lineHeight: 1.85,
  margin: 0,
  position: 'relative',
  zIndex: 1,
};

const cardOrnamentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 14,
  position: 'relative',
  zIndex: 1,
};

const cardLineStyle: React.CSSProperties = {
  height: 1,
  width: 20,
  backgroundImage: 'linear-gradient(to right, #D4A843, rgba(212,168,67,0.3))',
};

const cardDiamondStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  backgroundColor: '#D4A843',
  transform: 'rotate(45deg)',
  flexShrink: 0,
};

const cardLineFadeStyle: React.CSSProperties = {
  height: 1,
  width: 12,
  backgroundImage: 'linear-gradient(to right, rgba(212,168,67,0.3), transparent)',
};

export default function StorySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} style={sectionStyle}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>

        <div style={{
          ...titleRowStyle,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease',
        }}>
          <h2 style={titleStyle}>{"Історія створення UIMP"}</h2>
          <div style={titleOrnamentStyle}>
            <div style={titleLineStyle} />
            <div style={titleDiamondStyle} />
            <div style={titleLineFadeStyle} />
          </div>
        </div>

        <div style={{
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s, opacity 0.8s ease 0.1s',
        }}>
          <div style={problemLabelWrapStyle}>
            <div style={labelDotStyle} />
            <span style={labelTextStyle}>{"Ми побачили проблему"}</span>
            <div style={labelLineStyle} />
          </div>

          <div style={gridStyle}>
            {problems.map((p, i) => (
              <div key={i} style={{
                ...cardStyles[i],
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                opacity: visible ? 1 : 0,
                transition: `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.08}s, opacity 0.7s ease ${0.15 + i * 0.08}s`,
              }}>
                <span style={numBgStyle}>{p.num}</span>
                <div style={cardOrnamentStyle}>
                  <div style={cardLineStyle} />
                  <div style={cardDiamondStyle} />
                  <div style={cardLineFadeStyle} />
                </div>
                <p style={cardTextStyle}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
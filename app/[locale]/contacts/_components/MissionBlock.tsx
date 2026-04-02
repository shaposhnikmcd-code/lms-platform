'use client';

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const missionData = [
  {
    num: "01",
    title: "Біблійна основа душеопіки",
    items: [
      "Христос говорив про цілісне зцілення людини — духу, душі та тіла",
      "Церква покликана супроводжувати людей у їхніх глибинних потребах",
      "Душеопіка є невід'ємною частиною служіння громади",
    ],
  },
  {
    num: "02",
    title: "Психологія як інструмент служіння",
    items: [
      "Наукові методи психології сумісні з біблійним світоглядом",
      "Психологічна освіта допомагає пасторам і лідерам",
      "Інтеграція знань робить допомогу ефективнішою",
      "Терапія не замінює духовність — вона її підсилює",
    ],
  },
  {
    num: "03",
    title: "Зцілення ідентичності в Бозі",
    items: [
      "Первинна психологія веде людину до пізнання себе через стосунок з Богом",
      "UIMP формує фахівців, які поєднують обидва виміри",
    ],
  },
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#FAF6F0',
  padding: '60px 48px 80px',
  overflow: 'hidden',
  position: 'relative',
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
  marginBottom: 32,
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
  color: '#1C3A2E',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
  margin: '0 0 12px',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 15,
  color: 'rgba(28,58,46,0.45)',
  margin: 0,
  lineHeight: 1.7,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  alignItems: 'start',
  gap: '0 8px',
};

const numStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 48,
  fontWeight: 700,
  color: '#D4A843',
  opacity: 0.18,
  lineHeight: 1,
  marginBottom: 4,
  display: 'block',
  letterSpacing: '-2px',
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 14,
  fontWeight: 700,
  color: '#1C3A2E',
  lineHeight: 1.5,
  marginBottom: 14,
  paddingBottom: 12,
  borderBottom: '1px solid rgba(212,168,67,0.3)',
  minHeight: 56,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
};

const liStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 13,
  color: '#4A5E50',
  lineHeight: 1.55,
  fontFamily: sysFont,
};

const dotStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: '50%',
  backgroundColor: '#D4A843',
  flexShrink: 0,
  marginTop: 7,
  display: 'inline-block',
};

const dividerStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: '5%',
  height: '90%',
  width: 1,
  backgroundImage: 'linear-gradient(180deg, transparent, rgba(28,58,46,0.12) 20%, rgba(28,58,46,0.12) 80%, transparent)',
};

export default function MissionBlock() {
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const sectionStyleR: React.CSSProperties = { ...sectionStyle, padding: isMobile ? '32px 16px 32px' : '48px 48px 48px' };
  const titleStyleR: React.CSSProperties = { ...titleStyle, fontSize: isMobile ? 26 : 40 };
  const gridStyleR: React.CSSProperties = { ...gridStyle, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} style={sectionStyleR}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>
        <div style={{
          ...headerStyle,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease',
        }}>
          <div style={eyebrowRowStyle}>
            <div style={lineLeftStyle} />
            <span style={eyebrowStyle}>{"Наша місія"}</span>
            <div style={lineRightStyle} />
          </div>
          <h2 style={titleStyleR}>{"Так виникла наша місія"}</h2>
          <p style={subtitleStyle}>{"Об'єднати психологію та духовність заради цілісного зцілення людини"}</p>
        </div>
        <div style={gridStyleR}>
          {missionData.map((m, idx) => (
            <div
              key={m.num}
              style={{
                paddingLeft: isMobile ? 0 : (idx === 0 ? 0 : 36),
                paddingRight: isMobile ? 0 : (idx === 2 ? 0 : 28),
                position: 'relative',
                transform: visible ? 'translateY(0)' : 'translateY(50px)',
                opacity: visible ? 1 : 0,
                transition: `transform 0.9s cubic-bezier(0.16,1,0.3,1) ${idx * 0.15}s, opacity 0.9s ease ${idx * 0.15}s`,
              }}
            >
              {idx > 0 && !isMobile && <div style={dividerStyle} />}
              <span style={numStyle}>{m.num}</span>
              <h3 style={cardTitleStyle}>{m.title}</h3>
              <ul style={listStyle}>
                {m.items.map((item, i) => (
                  <li key={i} style={liStyle}>
                    <span style={dotStyle} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
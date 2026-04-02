'use client';

import React, { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";
import { Link } from "@/i18n/navigation";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const requests = [
  { icon: "🎓", text: "Хочу отримати якісні знання в душеопіці та надавати допомогу" },
  { icon: "🧠", text: "Хочу бути психологом" },
  { icon: "📖", text: "Хочу вивчити нові психотерапевтичні напрямки" },
  { icon: "🪞", text: "Хочу краще зрозуміти свій стан" },
  { icon: "⛪", text: "Хочу впровадити душеопіку в церкві" },
  { icon: "✝️", text: "Хочу бути християнським психологом" },
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#FAF6F0',
  padding: '60px 48px 80px',
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

const headerStyle: React.CSSProperties = {
  marginBottom: 48,
};

const eyebrowRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 16,
};

const eyebrowLineStyle: React.CSSProperties = {
  height: 1,
  width: 40,
  backgroundImage: 'linear-gradient(to right, #D4A843, transparent)',
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
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  margin: '0 0 10px',
};

const titleUnderlineStyle: React.CSSProperties = {
  height: 3,
  width: 52,
  backgroundColor: '#D4A843',
  borderRadius: 2,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 48,
};

const cardDefaultStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  backgroundColor: 'white',
  borderRadius: 16,
  padding: '20px 24px',
  boxShadow: '0 2px 12px rgba(28,58,46,0.06)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(28,58,46,0.06)',
  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
};

const cardHoveredStyle: React.CSSProperties = {
  ...cardDefaultStyle,
  boxShadow: '0 8px 32px rgba(28,58,46,0.12)',
  transform: 'translateY(-3px)',
  borderColor: 'rgba(212,168,67,0.3)',
};

const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 44,
  height: 44,
  borderRadius: 12,
  backgroundColor: 'rgba(28,58,46,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
};

const cardTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 14,
  fontWeight: 500,
  color: '#1C3A2E',
  lineHeight: 1.6,
  margin: 0,
};

const ctaWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 16,
};

const ctaDividerStyle: React.CSSProperties = {
  height: 1,
  width: '100%',
  backgroundImage: 'linear-gradient(to right, transparent, rgba(212,168,67,0.4), transparent)',
  marginBottom: 8,
};

const ctaHintStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 13,
  color: 'rgba(28,58,46,0.4)',
  letterSpacing: '0.05em',
};

const ctaLinkDefaultStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  backgroundColor: '#1C3A2E',
  color: '#F5EDD6',
  fontFamily: sysFont,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  padding: '14px 36px',
  borderRadius: 14,
  transition: 'all 0.25s ease',
  boxShadow: '0 4px 20px rgba(28,58,46,0.2)',
};

const ctaLinkHoveredStyle: React.CSSProperties = {
  ...ctaLinkDefaultStyle,
  backgroundColor: '#D4A843',
  color: '#1C3A2E',
  transform: 'translateY(-3px)',
  boxShadow: '0 12px 32px rgba(212,168,67,0.35)',
};

function RequestCard({ item }: { item: typeof requests[number] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={hovered ? cardHoveredStyle : cardDefaultStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={iconWrapStyle}>{item.icon}</div>
      <p style={cardTextStyle}>{item.text}</p>
    </div>
  );
}

function CtaButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href="/courses"
      style={hovered ? ctaLinkHoveredStyle : ctaLinkDefaultStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {"Навчальні програми"}
      <span style={{ transform: hovered ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 0.25s ease', display: 'inline-block' }}>{"→"}</span>
    </Link>
  );
}

export default function RequestsSection() {
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const sectionStyleR: React.CSSProperties = { ...sectionStyle, padding: isMobile ? '40px 16px 60px' : '60px 48px 80px' };
  const titleStyleR: React.CSSProperties = { ...titleStyle, fontSize: isMobile ? 26 : 40 };
  const gridStyleR: React.CSSProperties = { ...gridStyle, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' };

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
            <div style={eyebrowLineStyle} />
            <span style={eyebrowStyle}>{"Для кого"}</span>
          </div>
          <h2 style={titleStyleR}>{"Запити, які ми закриваємо"}</h2>
          <div style={titleUnderlineStyle} />
        </div>
        <div style={{
          ...gridStyleR,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s, opacity 0.8s ease 0.1s',
        }}>
          {requests.map((item, i) => <RequestCard key={i} item={item} />)}
        </div>
        <div style={{
          ...ctaWrapStyle,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s, opacity 0.8s ease 0.2s',
        }}>
          <div style={ctaDividerStyle} />
          <p style={ctaHintStyle}>{"Знайди свій напрямок"}</p>
          <CtaButton />
        </div>
      </div>
    </section>
  );
}
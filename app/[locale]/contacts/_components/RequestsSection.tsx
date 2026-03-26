'use client';

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const requests = [
  "Хочу отримати якісні знання в душеопіці та надавати допомогу",
  "Хочу бути психологом",
  "Хочу вивчити нові психотерапевтичні напрямки",
  "Хочу краще зрозуміти свій стан",
  "Хочу впровадити душеопіку в церкві",
  "Хочу бути християнським психологом",
];

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#1C3A2E',
  padding: '100px 48px',
  position: 'relative',
  overflow: 'hidden',
};

const dotPatternStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(circle, rgba(212,168,67,0.07) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  pointerEvents: 'none',
};

const blobStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -80,
  right: -60,
  width: 400,
  height: 400,
  borderRadius: '50%',
  backgroundColor: 'rgba(212,168,67,0.05)',
  filter: 'blur(80px)',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 64,
};

const eyebrowRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  marginBottom: 20,
};

const lineStyle: React.CSSProperties = {
  height: 1,
  width: 80,
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
  color: '#F5EDD6',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  margin: 0,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
};

const cardDefaultStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 20,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(212,168,67,0.12)',
  borderRadius: 16,
  padding: '28px 32px',
  transition: 'background 0.3s, border-color 0.3s',
};

const cardHoveredStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 20,
  backgroundColor: 'rgba(212,168,67,0.07)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(212,168,67,0.28)',
  borderRadius: 16,
  padding: '28px 32px',
  transition: 'background 0.3s, border-color 0.3s',
};

const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: 10,
  backgroundColor: 'rgba(212,168,67,0.12)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(212,168,67,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 2,
};

const checkStyle: React.CSSProperties = {
  width: 10,
  height: 6,
  borderLeft: '2px solid #D4A843',
  borderBottom: '2px solid #D4A843',
  transform: 'rotate(-45deg) translateY(-1px)',
};

const cardTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 15,
  color: 'rgba(245,237,214,0.8)',
  lineHeight: 1.65,
  margin: 0,
};

const ctaWrapStyle: React.CSSProperties = {
  marginTop: 64,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 16,
};

const ctaDividerStyle: React.CSSProperties = {
  height: 1,
  width: '100%',
  backgroundImage: 'linear-gradient(to right, transparent, rgba(212,168,67,0.25), transparent)',
  marginBottom: 16,
};

const ctaHintStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 13,
  color: 'rgba(245,237,214,0.4)',
  letterSpacing: '0.05em',
};

const ctaLinkDefaultStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  backgroundColor: '#D4A843',
  color: '#1C3A2E',
  fontFamily: sysFont,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  padding: '16px 40px',
  borderRadius: 14,
  transition: 'transform 0.25s, box-shadow 0.25s, background-color 0.25s',
  boxShadow: '0 4px 20px rgba(212,168,67,0.25)',
};

const ctaLinkHoveredStyle: React.CSSProperties = {
  ...ctaLinkDefaultStyle,
  backgroundColor: '#e0b84e',
  transform: 'translateY(-3px)',
  boxShadow: '0 12px 32px rgba(212,168,67,0.4)',
};

const arrowStyle: React.CSSProperties = {
  display: 'inline-block',
  transition: 'transform 0.25s',
};

function RequestCard({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={hovered ? cardHoveredStyle : cardDefaultStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={iconWrapStyle}>
        <div style={checkStyle} />
      </div>
      <p style={cardTextStyle}>{text}</p>
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
      <span style={{ ...arrowStyle, transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}>
        {"→"}
      </span>
    </Link>
  );
}

export default function RequestsSection() {
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
      <div style={blobStyle} />
      <div style={containerStyle}>

        <div style={{
          ...headerStyle,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease',
        }}>
          <div style={eyebrowRowStyle}>
            <div style={lineStyle} />
            <span style={eyebrowStyle}>{"Для кого"}</span>
          </div>
          <h2 style={titleStyle}>{"Запити, які ми закриваємо"}</h2>
        </div>

        <div style={{
          ...gridStyle,
          transform: visible ? 'translateY(0)' : 'translateY(50px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s, opacity 0.9s ease 0.15s',
        }}>
          {requests.map((text, i) => (
            <RequestCard key={i} text={text} />
          ))}
        </div>

        <div style={{
          ...ctaWrapStyle,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s, opacity 0.9s ease 0.3s',
        }}>
          <div style={ctaDividerStyle} />
          <p style={ctaHintStyle}>{"Знайди свій напрямок"}</p>
          <CtaButton />
        </div>

      </div>
    </section>
  );
}
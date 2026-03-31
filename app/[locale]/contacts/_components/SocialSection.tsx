'use client';

import React, { useEffect, useRef, useState } from "react";
import { FaInstagram, FaYoutube, FaTelegram } from "react-icons/fa";
import { MdSupportAgent } from "react-icons/md";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const instagramUrl = "https://www.instagram.com/uimp_psychotherapy";
const youtubeUrl = "https://www.youtube.com/@bible_psychotherapy";
const tgChannelUrl = "https://t.me/shaposhnykpsy";
const tgSupportUrl = "https://t.me/uimp_support";

const sectionStyle: React.CSSProperties = { backgroundColor: '#FAF6F0', padding: '60px 48px 80px', position: 'relative', overflow: 'hidden' };
const dotPatternStyle: React.CSSProperties = { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(28,58,46,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' };
const containerStyle: React.CSSProperties = { maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 };
const eyebrowRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 };
const lineLeftStyle: React.CSSProperties = { height: 1, width: 60, backgroundImage: 'linear-gradient(to right, transparent, #D4A843)' };
const lineRightStyle: React.CSSProperties = { height: 1, width: 60, backgroundImage: 'linear-gradient(to left, transparent, #D4A843)' };
const eyebrowStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: '#D4A843', textTransform: 'uppercase' };
const titleStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 28, fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 };
const cardTextStyle: React.CSSProperties = { textAlign: 'center' };
const labelStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 15, fontWeight: 700, color: '#1C3A2E', margin: '0 0 4px' };
const hintStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, color: 'rgba(28,58,46,0.45)', margin: 0, lineHeight: 1.5 };

const cardDefaultStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, backgroundColor: 'white', borderRadius: 24, padding: '36px 20px 28px', textDecoration: 'none', boxShadow: '0 2px 16px rgba(28,58,46,0.07)', transform: 'translateY(0)', transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(28,58,46,0.06)' };
const cardHoveredStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, backgroundColor: 'white', borderRadius: 24, padding: '36px 20px 28px', textDecoration: 'none', boxShadow: '0 20px 48px rgba(28,58,46,0.15)', transform: 'translateY(-8px)', transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(212,168,67,0.25)' };

const instaIconDefault: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundImage: 'none', backgroundColor: 'rgba(225,48,108,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease' };
const instaIconHovered: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundImage: 'linear-gradient(135deg, #f09433 0%, #e6683c 35%, #dc2743 65%, #bc1888 100%)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease', transform: 'scale(1.1) rotate(-5deg)' };

const tgIconDefault: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(0,136,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease' };
const tgIconHovered: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundColor: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease', transform: 'scale(1.1) rotate(-5deg)' };

const ytIconDefault: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease' };
const ytIconHovered: React.CSSProperties = { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.35s ease', transform: 'scale(1.1) rotate(-5deg)' };

const arrowDefaultStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', opacity: 0, transform: 'translateY(6px)', transition: 'all 0.3s ease' };
const arrowHoveredStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', opacity: 1, transform: 'translateY(0)', transition: 'all 0.3s ease' };

function InstaCard({ visible, index }: { visible: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 0.1}s, opacity 0.7s ease ${index * 0.1}s` }}>
      <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={hovered ? cardHoveredStyle : cardDefaultStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={hovered ? instaIconHovered : instaIconDefault}><FaInstagram size={28} color={hovered ? 'white' : '#E1306C'} /></div>
        <div style={cardTextStyle}><p style={labelStyle}>{"Instagram"}</p><p style={hintStyle}>{"Надихаючий контент"}</p></div>
        <span style={{ ...(hovered ? arrowHoveredStyle : arrowDefaultStyle), color: '#E1306C' }}>{"Перейти →"}</span>
      </a>
    </div>
  );
}

function SupportCard({ visible, index }: { visible: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 0.1}s, opacity 0.7s ease ${index * 0.1}s` }}>
      <a href={tgSupportUrl} target="_blank" rel="noopener noreferrer" style={hovered ? cardHoveredStyle : cardDefaultStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={hovered ? tgIconHovered : tgIconDefault}><MdSupportAgent size={28} color={hovered ? 'white' : '#0088cc'} /></div>
        <div style={cardTextStyle}><p style={labelStyle}>{"Техпідтримка"}</p><p style={hintStyle}>{"Відповімо швидко"}</p></div>
        <span style={{ ...(hovered ? arrowHoveredStyle : arrowDefaultStyle), color: '#0088cc' }}>{"Перейти →"}</span>
      </a>
    </div>
  );
}

function YouTubeCard({ visible, index }: { visible: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 0.1}s, opacity 0.7s ease ${index * 0.1}s` }}>
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" style={hovered ? cardHoveredStyle : cardDefaultStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={hovered ? ytIconHovered : ytIconDefault}><FaYoutube size={28} color={hovered ? 'white' : '#FF0000'} /></div>
        <div style={cardTextStyle}><p style={labelStyle}>{"YouTube"}</p><p style={hintStyle}>{"Відео та вебінари"}</p></div>
        <span style={{ ...(hovered ? arrowHoveredStyle : arrowDefaultStyle), color: '#FF0000' }}>{"Перейти →"}</span>
      </a>
    </div>
  );
}

function TelegramCard({ visible, index }: { visible: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ transform: visible ? 'translateY(0)' : 'translateY(40px)', opacity: visible ? 1 : 0, transition: `transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 0.1}s, opacity 0.7s ease ${index * 0.1}s` }}>
      <a href={tgChannelUrl} target="_blank" rel="noopener noreferrer" style={hovered ? cardHoveredStyle : cardDefaultStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={hovered ? tgIconHovered : tgIconDefault}><FaTelegram size={28} color={hovered ? 'white' : '#0088cc'} /></div>
        <div style={cardTextStyle}><p style={labelStyle}>{"ТГ канал"}</p><p style={hintStyle}>{"Новини та анонси"}</p></div>
        <span style={{ ...(hovered ? arrowHoveredStyle : arrowDefaultStyle), color: '#0088cc' }}>{"Перейти →"}</span>
      </a>
    </div>
  );
}

export default function SocialSection() {
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
        <div style={{ textAlign: 'center', marginBottom: 48, transform: visible ? 'translateY(0)' : 'translateY(30px)', opacity: visible ? 1 : 0, transition: 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease' }}>
          <div style={eyebrowRowStyle}>
            <div style={lineLeftStyle} />
            <span style={eyebrowStyle}>{"Ми в мережі"}</span>
            <div style={lineRightStyle} />
          </div>
          <h2 style={titleStyle}>{"Залишайтесь на зв'язку"}</h2>
        </div>
        <div style={gridStyle}>
          <InstaCard visible={visible} index={0} />
          <SupportCard visible={visible} index={1} />
          <YouTubeCard visible={visible} index={2} />
          <TelegramCard visible={visible} index={3} />
        </div>
      </div>
    </section>
  );
}
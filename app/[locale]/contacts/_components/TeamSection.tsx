'use client';

import Image from "next/image";
import { FaTelegram, FaInstagram } from "react-icons/fa";
import { useState } from "react";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const instaTetianaUrl = "https://www.instagram.com/tetiana_shaposhnyk/";
const tgTetianaUrl = "https://t.me/t_shaposhnik";
const instaLiliiaUrl = "https://www.instagram.com/lilinda_._/";
const tgLiliiaUrl = "https://t.me/lilinda4";

const team = [
  {
    name: "Тетяна Шапошник",
    role: "Президентка UIMP, психотерапевтка",
    quote: "Живу так, ніби життя — це коробка шоколадних цукерок, в якому важливо обережно розгорнути кожен досвід, розрізнивши відтінки смаку і допомогти іншим не боятися куштувати своє.",
    photo: "/about-us/Tetiana-Shaposhnyk.jpg",
    objectFit: 'cover' as const,
    objectPosition: 'center 10%',
    wrapperStyle: {} as React.CSSProperties,
    insta: instaTetianaUrl,
    tg: tgTetianaUrl,
  },
  {
    name: "Liliia Zakharevych",
    role: "Координаторка UIMP, маркетологиня",
    quote: "Я готова страждати, аби моя місія і покликання було звершено Богом. Але перед цим багато буду обурюватися.",
    photo: "/about-us/Liliia-Zakharevych.jpg",
    objectFit: 'cover' as const,
    objectPosition: 'center center',
    wrapperStyle: { transform: 'scale(1.3)', transformOrigin: 'center bottom' } as React.CSSProperties,
    insta: instaLiliiaUrl,
    tg: tgLiliiaUrl,
  },
];

const sectionStyle: React.CSSProperties = {
  padding: '100px 0 80px',
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
  padding: '0 48px',
  position: 'relative',
  zIndex: 1,
};

const headerWrapStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 72,
};

const eyebrowRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  marginBottom: 16,
};

const goldLineLeftStyle: React.CSSProperties = {
  height: 1,
  width: 80,
  backgroundImage: 'linear-gradient(to right, transparent, #D4A843)',
};

const goldLineRightStyle: React.CSSProperties = {
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
  margin: '0 0 12px',
  lineHeight: 1.1,
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
  gridTemplateColumns: '1fr 1px 1fr',
  gap: '0 56px',
  alignItems: 'flex-start',
};

const vertDividerStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, transparent 0%, #D4A843 25%, #D4A843 75%, transparent 100%)',
  position: 'relative',
  alignSelf: 'stretch',
};

const diamondWrapStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

const diamondStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  backgroundColor: '#D4A843',
  transform: 'rotate(45deg)',
  outline: '3px solid #FAF6F0',
};

const photoCardDefaultStyle: React.CSSProperties = {
  borderRadius: 24,
  overflow: 'hidden',
  height: 520,
  position: 'relative',
  backgroundColor: '#e2ddd6',
  boxShadow: '0 16px 48px rgba(28,58,46,0.15), 0 4px 12px rgba(28,58,46,0.08)',
  marginBottom: 28,
  transition: 'box-shadow 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
};

const photoCardHoveredStyle: React.CSSProperties = {
  ...photoCardDefaultStyle,
  boxShadow: '0 32px 72px rgba(28,58,46,0.22), 0 8px 24px rgba(28,58,46,0.1)',
};

const photoInnerBaseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
};

const gradientOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'linear-gradient(to top, rgba(8,20,14,0.93) 0%, rgba(8,20,14,0.35) 40%, transparent 65%)',
};

const nameOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '40px 28px 28px',
};

const nameTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 21,
  fontWeight: 700,
  color: '#F5EDD6',
  margin: '0 0 6px',
  letterSpacing: '-0.01em',
};

const roleTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(212,168,67,0.88)',
  margin: 0,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
};

const textBlockStyle: React.CSSProperties = {
  padding: '0 6px',
};

const quoteMarkStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 88,
  lineHeight: 0.75,
  color: '#D4A843',
  opacity: 0.3,
  display: 'block',
  marginBottom: 4,
  userSelect: 'none' as const,
};

const quoteTextStyle: React.CSSProperties = {
  fontFamily: sysFont,
  fontSize: 14,
  lineHeight: 1.9,
  color: '#2a3a2e',
  fontStyle: 'italic' as const,
  margin: '0 0 20px',
};

const goldDividerStyle: React.CSSProperties = {
  height: 1,
  backgroundImage: 'linear-gradient(to right, #D4A843 0%, rgba(212,168,67,0.15) 100%)',
  margin: '20px 0 24px',
};

const socialRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
};

const socialInstaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: sysFont,
  letterSpacing: '0.05em',
  textDecoration: 'none',
  color: 'white',
  backgroundImage: 'linear-gradient(135deg, #f09433 0%, #e6683c 50%, #bc1888 100%)',
};

const socialTgStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: sysFont,
  letterSpacing: '0.05em',
  textDecoration: 'none',
  color: 'white',
  backgroundColor: '#0088cc',
};

const cardDefaultOuterStyle: React.CSSProperties = {
  transform: 'translateY(0)',
  transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  cursor: 'default',
};

const cardHoveredOuterStyle: React.CSSProperties = {
  transform: 'translateY(-6px)',
  transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  cursor: 'default',
};

type TeamMember = typeof team[number];

function PersonCard({ person }: { person: TeamMember }) {
  const [hovered, setHovered] = useState(false);

  const photoInnerStyle: React.CSSProperties = {
    ...photoInnerBaseStyle,
    ...person.wrapperStyle,
  };

  return (
    <div
      style={hovered ? cardHoveredOuterStyle : cardDefaultOuterStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={hovered ? photoCardHoveredStyle : photoCardDefaultStyle}>
        <div style={photoInnerStyle}>
          <Image
            src={person.photo}
            alt={person.name}
            fill
            style={{ objectFit: person.objectFit, objectPosition: person.objectPosition }}
            sizes="(max-width: 1200px) 50vw, 560px"
            quality={100}
            unoptimized
          />
        </div>
        <div style={gradientOverlayStyle} />
        <div style={nameOverlayStyle}>
          <p style={nameTextStyle}>{person.name}</p>
          <p style={roleTextStyle}>{person.role}</p>
        </div>
      </div>

      <div style={textBlockStyle}>
        <span style={quoteMarkStyle}>{"\u201C"}</span>
        <p style={quoteTextStyle}>{person.quote}</p>
        <div style={goldDividerStyle} />
        <div style={socialRowStyle}>
          <a href={person.insta} target="_blank" rel="noopener noreferrer" style={socialInstaStyle}>
            <FaInstagram size={13} />
            {"Instagram"}
          </a>
          <a href={person.tg} target="_blank" rel="noopener noreferrer" style={socialTgStyle}>
            <FaTelegram size={13} />
            {"Telegram"}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function TeamSection() {
  return (
    <section style={sectionStyle}>
      <div style={dotPatternStyle} />
      <div style={containerStyle}>
        <div style={headerWrapStyle}>
          <div style={eyebrowRowStyle}>
            <div style={goldLineLeftStyle} />
            <span style={eyebrowStyle}>{"Наша команда"}</span>
            <div style={goldLineRightStyle} />
          </div>
          <h2 style={titleStyle}>{"Люди, які стоять за UIMP"}</h2>
          <p style={subtitleStyle}>{"Психотерапія як покликання, а не лише як робота"}</p>
        </div>
        <div style={gridStyle}>
          <PersonCard person={team[0]} />
          <div style={vertDividerStyle}>
            <div style={diamondWrapStyle}>
              <div style={diamondStyle} />
            </div>
          </div>
          <PersonCard person={team[1]} />
        </div>
      </div>
    </section>
  );
}
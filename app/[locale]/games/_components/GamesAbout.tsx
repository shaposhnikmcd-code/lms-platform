import React from 'react';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

interface Props {
  desc1: string;
  desc2: string;
  desc3: string;
}

const sectionStyle: React.CSSProperties = { background: '#FAF6F0', padding: '2.5rem 2rem 2.5rem' };
const innerStyle: React.CSSProperties = { maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' };
const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '2rem', border: '1px solid rgba(28,58,46,0.07)', boxShadow: '0 2px 12px rgba(28,58,46,0.04)' };
const numStyle: React.CSSProperties = { color: '#D4A843', fontFamily: sysFont, fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', display: 'block' };
const textStyle: React.CSSProperties = { color: '#3d4f47', fontSize: '0.88rem', lineHeight: 1.85, fontFamily: sysFont };

export default function GamesAbout({ desc1, desc2, desc3 }: Props) {
  return (
    <section style={sectionStyle}>
      <div style={innerStyle} className="games-about-grid">
        {[desc1, desc2, desc3].map((text, i) => (
          <div key={i} style={cardStyle}>
            <span style={numStyle}>{`0${i + 1}`}</span>
            <p style={textStyle}>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
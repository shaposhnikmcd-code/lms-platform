import React from 'react';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

interface Props {
  quote: string;
  comingSoon: string;
}

const quoteSectionStyle: React.CSSProperties = { background: '#FAF6F0', padding: '0 2rem 2.5rem' };
const quoteCardStyle: React.CSSProperties = { maxWidth: '720px', margin: '0 auto', background: 'linear-gradient(135deg, #0c1f16 0%, #1C3A2E 100%)', borderRadius: '24px', padding: '1.5rem 3rem 2rem', position: 'relative' as const, overflow: 'hidden' as const, boxShadow: '0 20px 60px rgba(28,58,46,0.18), 0 4px 20px rgba(28,58,46,0.1)' };
const decorTopStyle: React.CSSProperties = { position: 'absolute' as const, top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(212,168,67,0.06)', pointerEvents: 'none' as const };
const decorBottomStyle: React.CSSProperties = { position: 'absolute' as const, bottom: '-60px', left: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(212,168,67,0.04)', pointerEvents: 'none' as const };
const openingMarkStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: '2rem', color: '#D4A843', lineHeight: 1, display: 'block', marginBottom: '0.5rem', opacity: 0.7 };
const quoteTextStyle: React.CSSProperties = { color: '#e8e0cc', fontSize: '1.05rem', lineHeight: 2, fontStyle: 'italic', fontFamily: sysFont, position: 'relative' as const, zIndex: 1 };
const dividerStyle: React.CSSProperties = { width: '2.5rem', height: '2px', background: 'linear-gradient(to right, #D4A843, rgba(212,168,67,0.3))', margin: '1.25rem 0 1rem' };
const authorStyle: React.CSSProperties = { color: '#4d7a66', fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase' as const, fontFamily: sysFont, fontStyle: 'normal' as const };
const comingSoonSectionStyle: React.CSSProperties = { background: '#FAF6F0', borderTop: '1px solid rgba(28,58,46,0.08)', padding: '2.5rem 2rem', textAlign: 'center' as const };
const comingSoonTextStyle: React.CSSProperties = { color: '#8aaa96', fontSize: '0.68rem', letterSpacing: '0.28em', textTransform: 'uppercase' as const, fontFamily: sysFont };

export default function GamesQuote({ quote, comingSoon }: Props) {
  return (
    <>
      <section style={quoteSectionStyle}>
        <div style={quoteCardStyle}>
          <div style={decorTopStyle} />
          <div style={decorBottomStyle} />
          <span style={openingMarkStyle}>{"\u201C"}</span>
          <p style={quoteTextStyle}>{quote}</p>
          <div style={dividerStyle} />
          <span style={authorStyle}>{"Тетяна Шапошник · Засновниця UIMP"}</span>
        </div>
      </section>
      <section style={comingSoonSectionStyle}>
        <p style={comingSoonTextStyle}>{comingSoon}</p>
      </section>
    </>
  );
}
'use client';

import React from 'react';
import Image from 'next/image';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

interface Card {
  count: string;
  label: string;
}

interface Props {
  pageTitle: string;
  gameTitle: string;
  gameSubtitle: string;
  cards: Card[];
  price: string;
  currency: string;
  btnOrder: string;
  onOrder: () => void;
}

const heroBgStyle: React.CSSProperties = {
  background: 'linear-gradient(150deg, #060f0b 0%, #0c1f16 50%, #1C3A2E 100%)',
};

const heroInnerStyle: React.CSSProperties = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '5rem 2rem 0',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4rem',
  alignItems: 'center',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  background: 'rgba(212,168,67,0.1)',
  border: '1px solid rgba(212,168,67,0.25)',
  color: '#D4A843',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.28em',
  textTransform: 'uppercase' as const,
  padding: '0.4rem 1rem',
  borderRadius: '100px',
  fontFamily: sysFont,
  marginBottom: '1.25rem',
};

const heroTitleStyle: React.CSSProperties = {
  color: '#F5EDD6',
  fontFamily: sysFont,
  fontSize: 'clamp(3.2rem, 7vw, 5.5rem)',
  fontWeight: 700,
  lineHeight: 0.9,
  letterSpacing: '-0.02em',
  marginBottom: '0.5rem',
};

const heroSubStyle: React.CSSProperties = {
  color: '#7aaa91',
  fontSize: '0.85rem',
  fontFamily: sysFont,
  letterSpacing: '0.08em',
  marginBottom: '2rem',
};

const dividerStyle: React.CSSProperties = {
  width: '2rem',
  height: '2px',
  background: '#D4A843',
  marginBottom: '1.75rem',
};

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  marginBottom: '2rem',
  flexWrap: 'wrap' as const,
};

const statItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.2rem',
};

const statNumStyle: React.CSSProperties = {
  color: '#D4A843',
  fontFamily: sysFont,
  fontSize: '1.8rem',
  fontWeight: 700,
  lineHeight: 1,
};

const statLblStyle: React.CSSProperties = {
  color: '#7aaa91',
  fontSize: '0.72rem',
  fontFamily: sysFont,
  lineHeight: 1.3,
  maxWidth: '80px',
};

const pricePanelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,168,67,0.2)',
  borderRadius: '12px',
  padding: '1.25rem 1.5rem',
  marginBottom: '1.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

const priceLblStyle: React.CSSProperties = {
  color: '#4d7a66',
  fontSize: '0.62rem',
  letterSpacing: '0.25em',
  textTransform: 'uppercase' as const,
  fontFamily: sysFont,
  display: 'block',
  marginBottom: '0.3rem',
};

const priceValStyle: React.CSSProperties = {
  color: '#F5EDD6',
  fontFamily: sysFont,
  fontSize: '2.4rem',
  fontWeight: 700,
  lineHeight: 1,
};

const priceCurrStyle: React.CSSProperties = {
  color: '#D4A843',
  fontFamily: sysFont,
  fontSize: '1rem',
  fontWeight: 500,
  marginLeft: '0.35rem',
};

const deliveryBadgeStyle: React.CSSProperties = {
  background: 'rgba(122,170,145,0.1)',
  border: '1px solid rgba(122,170,145,0.2)',
  borderRadius: '8px',
  padding: '0.5rem 0.75rem',
  color: '#7aaa91',
  fontSize: '0.62rem',
  fontFamily: sysFont,
  lineHeight: 1.6,
  maxWidth: '200px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  textAlign: 'center' as const,
};

const btnOrderStyle: React.CSSProperties = {
  background: '#D4A843',
  color: '#060f0b',
  padding: '1rem 2.5rem',
  borderRadius: '4px',
  fontWeight: 700,
  fontSize: '0.75rem',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  fontFamily: sysFont,
  width: '100%',
};

const imageWrapStyle: React.CSSProperties = {
  filter: 'drop-shadow(0 30px 60px rgba(212,168,67,0.15)) drop-shadow(0 10px 30px rgba(0,0,0,0.7))',
  width: '100%',
  maxWidth: '420px',
  margin: '0 auto',
};

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  borderRadius: '12px',
};

export default function GamesHero({ pageTitle, gameTitle, gameSubtitle, cards, price, currency, btnOrder, onOrder }: Props) {
  return (
    <section style={heroBgStyle}>
      <div style={heroInnerStyle} className="games-hero-grid">
        <div className="order-2 md:order-1" style={{ paddingBottom: '2.5rem' }}>
          <span style={badgeStyle}>{"◆"} {pageTitle}</span>
          <h1 style={heroTitleStyle}>{gameTitle}</h1>
          <p style={heroSubStyle}>{gameSubtitle}</p>
          <div style={dividerStyle} />
          <div style={statsRowStyle}>
            {cards.map((card, i) => (
              <div key={i} style={statItemStyle}>
                <span style={statNumStyle}>{card.count}</span>
                <span style={statLblStyle}>{card.label}</span>
              </div>
            ))}
          </div>
          <div style={pricePanelStyle}>
            <div>
              <span style={priceLblStyle}>{gameTitle}</span>
              <div>
                <span style={priceValStyle}>{price}</span>
                <span style={priceCurrStyle}>{currency}</span>
              </div>
            </div>
            <div style={deliveryBadgeStyle}>
              <span>{"📦 Доставка Нова пошта"}</span>
              <span>{"(оплачується додатково)"}</span>
            </div>
          </div>
          <button style={btnOrderStyle} onClick={onOrder}>
            {btnOrder}
          </button>
        </div>
        <div className="order-1 md:order-2 flex justify-center" style={{ paddingBottom: '2.5rem' }}>
          <div style={imageWrapStyle}>
            <Image src={"/Connector game.jpg"} alt={gameTitle} width={420} height={420} style={imageStyle} priority quality={100} />
          </div>
        </div>
      </div>
    </section>
  );
}
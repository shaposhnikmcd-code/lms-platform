'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import OrderForm from '@/components/connector/OrderForm';

interface FormLabels {
  title: string;
  subtitle: string;
  emailLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  countryLabel: string;
  callMe: string;
  btnSubmit: string;
  btnLoading: string;
  errorMsg: string;
  agree: string;
  cityLabel: string;
  cityPlaceholder: string;
  cityPlaceholderEu: string;
  branchLabel: string;
  branchLabelEu: string;
  branchPlaceholder: string;
  branchPlaceholderEu: string;
  branchSelectCity: string;
  notFound: string;
  deliveryTitle: string;
  deliveryText: string;
  deliveryContact: string;
  countries: { code: string; name: string }[];
}

interface Content {
  pageTitle: string;
  gameTitle: string;
  gameSubtitle: string;
  cards: { count: string; label: string }[];
  desc1: string;
  desc2: string;
  desc3: string;
  quote: string;
  price: string;
  deliveryNote: string;
  btnOrder: string;
  comingSoon: string;
  form: FormLabels;
}

interface Props {
  content: Content;
  currency: string;
}

// ─── STYLE CONSTANTS ────────────────────────────────────────────────────────────

const pageWrapperStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const heroBgStyle: React.CSSProperties = {
  background: 'linear-gradient(155deg, #060f0b 0%, #0d2418 45%, #1C3A2E 100%)',
};

const heroInnerStyle: React.CSSProperties = {
  maxWidth: '1080px',
  margin: '0 auto',
  padding: '0 1.5rem',
  width: '100%',
};

const pageLabelStyle: React.CSSProperties = {
  color: '#4d7a66',
  fontSize: '0.68rem',
  letterSpacing: '0.3em',
  textTransform: 'uppercase' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  marginBottom: '3rem',
  display: 'block',
};

const heroSubtitleStyle: React.CSSProperties = {
  color: '#D4A843',
  letterSpacing: '0.2em',
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  marginBottom: '0.75rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};

const heroTitleStyle: React.CSSProperties = {
  color: '#F5EDD6',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 'clamp(3.8rem, 8vw, 6rem)',
  fontWeight: 700,
  lineHeight: 0.92,
  letterSpacing: '-0.02em',
  marginBottom: '2rem',
};

const dividerGoldStyle: React.CSSProperties = {
  width: '2.5rem',
  height: '2px',
  background: '#D4A843',
  marginBottom: '2rem',
};

const statCountStyle: React.CSSProperties = {
  color: '#D4A843',
  fontFamily: 'Georgia, serif',
  fontSize: '2rem',
  fontWeight: 700,
  minWidth: '3.8rem',
  lineHeight: 1,
};

const statLabelStyle: React.CSSProperties = {
  color: '#7aaa91',
  fontSize: '0.85rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  lineHeight: 1.3,
};

const btnHeroStyle: React.CSSProperties = {
  background: '#D4A843',
  color: '#060f0b',
  padding: '0.95rem 2.8rem',
  borderRadius: '2px',
  fontWeight: 700,
  fontSize: '0.78rem',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  alignSelf: 'flex-start' as const,
};

const imageGlowWrapperStyle: React.CSSProperties = {
  filter: 'drop-shadow(0 25px 55px rgba(212,168,67,0.18)) drop-shadow(0 8px 25px rgba(0,0,0,0.6))',
  width: '100%',
  maxWidth: '400px',
};

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  borderRadius: '10px',
};

const descBgStyle: React.CSSProperties = {
  background: '#FAF6F0',
};

const descInnerStyle: React.CSSProperties = {
  maxWidth: '680px',
  margin: '0 auto',
  padding: '0 1.5rem',
};

const descTextStyle: React.CSSProperties = {
  color: '#2a3d35',
  fontSize: '1.05rem',
  lineHeight: 1.9,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontWeight: 400,
};

const quoteBgStyle: React.CSSProperties = {
  background: '#0d2418',
};

const quoteInnerStyle: React.CSSProperties = {
  maxWidth: '680px',
  margin: '0 auto',
  padding: '0 1.5rem',
};

const blockquoteStyle: React.CSSProperties = {
  borderLeft: '3px solid #D4A843',
  paddingLeft: '2rem',
  margin: 0,
};

const quoteTextStyle: React.CSSProperties = {
  color: '#c8c1a5',
  fontSize: '1.05rem',
  lineHeight: 1.9,
  fontStyle: 'italic',
  fontFamily: 'Georgia, serif',
};

const priceBgStyle: React.CSSProperties = {
  background: '#FAF6F0',
};

const priceInnerStyle: React.CSSProperties = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '0 1.5rem',
  textAlign: 'center' as const,
};

const priceLabelStyle: React.CSSProperties = {
  color: '#4d7a66',
  fontSize: '0.68rem',
  letterSpacing: '0.25em',
  textTransform: 'uppercase' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  marginBottom: '0.75rem',
  display: 'block',
};

const priceNumberStyle: React.CSSProperties = {
  color: '#1C3A2E',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(3.5rem, 9vw, 5rem)',
  fontWeight: 700,
  lineHeight: 1,
  display: 'inline',
};

const priceCurrStyle: React.CSSProperties = {
  color: '#1C3A2E',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: '1.3rem',
  fontWeight: 500,
  marginLeft: '0.5rem',
};

const deliveryNoteStyle: React.CSSProperties = {
  color: '#9a9a9a',
  fontSize: '0.76rem',
  lineHeight: 1.75,
  maxWidth: '420px',
  margin: '1.2rem auto 2.5rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};

const btnBottomStyle: React.CSSProperties = {
  background: '#1C3A2E',
  color: '#D4A843',
  padding: '1.05rem 4rem',
  borderRadius: '2px',
  fontWeight: 700,
  fontSize: '0.78rem',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};

const comingSoonBgStyle: React.CSSProperties = {
  background: '#060f0b',
  borderTop: '1px solid #0d2418',
};

const comingSoonTextStyle: React.CSSProperties = {
  color: '#334d42',
  fontSize: '0.72rem',
  letterSpacing: '0.25em',
  textTransform: 'uppercase' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────────

export default function GamesPageClient({ content, currency }: Props) {
  const [showOrderForm, setShowOrderForm] = useState(false);

  return (
    <div style={pageWrapperStyle}>

      {/* ── HERO ── */}
      <section className="pt-20 pb-16 md:pt-24 md:pb-20 flex items-center" style={heroBgStyle}>
        <div style={heroInnerStyle}>
          <span style={pageLabelStyle}>{content.pageTitle}</span>
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Text — below image on mobile */}
            <div className="order-2 md:order-1 flex flex-col">
              <p style={heroSubtitleStyle}>{content.gameSubtitle}</p>
              <h1 style={heroTitleStyle}>{content.gameTitle}</h1>
              <div style={dividerGoldStyle} />
              <div className="flex flex-col gap-4 mb-10">
                {content.cards.map((card, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span style={statCountStyle}>{card.count}</span>
                    <span style={statLabelStyle}>{card.label}</span>
                  </div>
                ))}
              </div>
              <button style={btnHeroStyle} onClick={() => setShowOrderForm(true)}>
                {content.btnOrder}
              </button>
            </div>

            {/* Image — above text on mobile */}
            <div className="order-1 md:order-2 flex justify-center">
              <div style={imageGlowWrapperStyle}>
                <Image
                  src={"/Connector game.jpg"}
                  alt={content.gameTitle}
                  width={400}
                  height={400}
                  style={imageStyle}
                  priority
                  quality={100}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DESCRIPTION ── */}
      <section className="py-20" style={descBgStyle}>
        <div style={descInnerStyle}>
          <p className="mb-6" style={descTextStyle}>{content.desc1}</p>
          <p className="mb-6" style={descTextStyle}>{content.desc2}</p>
          <p style={descTextStyle}>{content.desc3}</p>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <section className="py-16" style={quoteBgStyle}>
        <div style={quoteInnerStyle}>
          <blockquote style={blockquoteStyle}>
            <p style={quoteTextStyle}>{`"${content.quote}"`}</p>
          </blockquote>
        </div>
      </section>

      {/* ── PRICE & ORDER ── */}
      <section className="py-20" style={priceBgStyle}>
        <div style={priceInnerStyle}>
          <span style={priceLabelStyle}>{content.gameTitle}</span>
          <div className="mb-1">
            <span style={priceNumberStyle}>{content.price}</span>
            <span style={priceCurrStyle}>{currency}</span>
          </div>
          <p style={deliveryNoteStyle}>{`* ${content.deliveryNote}`}</p>
          <button style={btnBottomStyle} onClick={() => setShowOrderForm(true)}>
            {content.btnOrder}
          </button>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="py-10 text-center" style={comingSoonBgStyle}>
        <p style={comingSoonTextStyle}>{content.comingSoon}</p>
      </section>

      <OrderForm
        isOpen={showOrderForm}
        onClose={() => setShowOrderForm(false)}
        labels={content.form}
      />
    </div>
  );
}
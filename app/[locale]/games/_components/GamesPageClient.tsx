'use client';

import React, { useState } from 'react';
import OrderForm from '@/components/connector/OrderForm';
import GamesHero from './GamesHero';
import GamesAbout from './GamesAbout';
import GamesQuote from './GamesQuote';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

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

export default function GamesPageClient({ content, currency }: Props) {
  const [showOrderForm, setShowOrderForm] = useState(false);

  return (
    <div style={{ fontFamily: sysFont, background: '#FAF6F0' }}>
      <GamesHero
        pageTitle={content.pageTitle}
        gameTitle={content.gameTitle}
        gameSubtitle={content.gameSubtitle}
        cards={content.cards}
        price={content.price}
        currency={currency}
        btnOrder={content.btnOrder}
        onOrder={() => setShowOrderForm(true)}
      />
      <GamesAbout desc1={content.desc1} desc2={content.desc2} desc3={content.desc3} />
      <GamesQuote quote={content.quote} comingSoon={content.comingSoon} />
      <OrderForm isOpen={showOrderForm} onClose={() => setShowOrderForm(false)} labels={content.form} />
      <style>{`
        @media (max-width: 768px) {
          .games-hero-grid { grid-template-columns: 1fr !important; gap: 2rem !important; padding: 3rem 1.5rem 2.5rem !important; }
          .games-about-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
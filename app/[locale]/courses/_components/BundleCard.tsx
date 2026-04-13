'use client';

import { useState } from 'react';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const CARD_BG = '#1e3d2e';
const CARD_BG_HOVER = '#244838';

type BundleCourse = {
  slug: string;
  title: string;
  price: number;
};

type Props = {
  title: string;
  description?: string;
  price: number;
  courses: BundleCourse[];
  currency: string;
  priceLabel: string;
  bundleLabel: string;
  saveLabel: string;
  slug: string;
  buyLabel: string;
};

export default function BundleCard({ title, description, price, courses, currency, priceLabel, saveLabel, slug, buyLabel }: Props) {
  const [hovered, setHovered] = useState(false);
  const totalOriginal = courses.reduce((sum, c) => sum + c.price, 0);
  const savings = totalOriginal - price;
  const savingsPercent = Math.round((savings / totalOriginal) * 100);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? CARD_BG_HOVER : CARD_BG,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: hovered ? '0 28px 56px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.1)',
        transform: hovered ? 'translateY(-4px) scale(1.008)' : 'translateY(0) scale(1)',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        border: '1px solid rgba(212,168,67,0.2)',
      }}
    >
      {/* Header with badge */}
      <div style={{ padding: '28px 32px 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 100, padding: '4px 14px', marginBottom: 16 }}>
          <span style={{ fontSize: 12 }}>📦</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
            ПАКЕТ
          </span>
        </div>

        <h3 style={{ fontFamily: sysFont, fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700, color: '#F5EDD6', lineHeight: 1.2, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          {title}
        </h3>

        {description && (
          <p style={{ fontSize: 13.5, color: 'rgba(245,237,214,0.5)', lineHeight: 1.7, margin: '0 0 20px', fontFamily: sysFont }}>
            {description}
          </p>
        )}
      </div>

      {/* Courses list */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {courses.map((course) => (
            <div
              key={course.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 14, color: '#F5EDD6', fontFamily: sysFont, fontWeight: 500 }}>
                {course.title}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(245,237,214,0.4)', fontFamily: sysFont, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                {course.price.toLocaleString()} {currency}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Price section */}
      <div style={{ background: 'rgba(212,168,67,0.08)', borderTop: '1px solid rgba(212,168,67,0.15)', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: 'rgba(212,168,67,0.6)', margin: '0 0 4px', fontFamily: sysFont }}>
            {priceLabel}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: sysFont, fontSize: 36, fontWeight: 700, color: '#D4A843', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {price.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: 'rgba(212,168,67,0.5)', fontFamily: sysFont }}>
              {currency}
            </span>
          </div>
          {savings > 0 && (
            <p style={{ fontSize: 12, color: '#6ee7b7', margin: '6px 0 0', fontFamily: sysFont, fontWeight: 500 }}>
              {saveLabel}: {savings.toLocaleString()} {currency} ({savingsPercent}%)
            </p>
          )}
        </div>
        <CoursePurchaseModal
          courseName={title}
          price={price}
          courseId={`bundle_${slug}`}
          currency={currency}
          buttonLabel={buyLabel}
        />
      </div>
    </div>
  );
}

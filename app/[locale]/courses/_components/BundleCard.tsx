'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';
const CARD_BG = '#1e3d2e';
const CARD_BG_HOVER = '#244838';
const STRIP_BORDER = 'rgba(255,255,255,0.06)';

type BundleCourse = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  price: number;
  icon: string;
  accent: string;
  accentRgb: string;
};

type Benefit = { icon: string; title: string };

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
  benefits: Benefit[];
  layout?: 'full' | 'compact';
};

export default function BundleCard({ title, description, price, courses, currency, priceLabel, saveLabel, slug, buyLabel, benefits, layout = 'full' }: Props) {
  const [hovered, setHovered] = useState(false);
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);
  const totalOriginal = courses.reduce((sum, c) => sum + c.price, 0);
  const savings = totalOriginal - price;
  const savingsPercent = Math.round((savings / totalOriginal) * 100);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column' as const,
        background: 'linear-gradient(135deg, rgba(212,168,67,0.06) 0%, rgba(212,168,67,0.12) 50%, rgba(212,168,67,0.04) 100%)',
        borderRadius: 24,
        border: '1px solid rgba(212,168,67,0.06)',
        padding: 'clamp(16px, 3vw, 28px)',
        boxShadow: hovered
          ? '0 8px 24px rgba(28,58,46,0.04)'
          : 'none',
        transition: 'all 0.6s ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1C3A2E', borderRadius: 100, padding: '4px 14px',
          }}>
            <span style={{ fontSize: 12 }}>📦</span>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
              ПАКЕТ
            </span>
          </div>
          {savings > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#059669', borderRadius: 100, padding: '4px 12px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'white', fontFamily: sysFont }}>
                −{savingsPercent}%
              </span>
            </div>
          )}
        </div>

        <h3 style={{
          fontFamily: sysFont, fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700,
          color: '#1C3A2E', lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em',
          minHeight: '2.4em',
        }}>
          {title}
        </h3>
      </div>

      {/* Course cards grid */}
      <div
        className={`grid ${courses.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : courses.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}
        style={{ gap: layout === 'compact' ? 10 : 14, marginBottom: layout === 'compact' ? 28 : 32, flex: 1 }}
      >
        {courses.map((course, i) => {
          const isHovered = hoveredCourse === course.slug;
          const tagColor = i % 2 === 0 ? '#D4A843' : '#C4919A';
          return (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              onMouseEnter={() => setHoveredCourse(course.slug)}
              onMouseLeave={() => setHoveredCourse(null)}
              style={{
                textDecoration: 'none',
                background: isHovered ? CARD_BG_HOVER : CARD_BG,
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: isHovered ? '0 16px 40px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.1)',
                transform: isHovered ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Content area */}
              <div style={{ padding: '25px 21px 21px', flex: 1 }}>
                {/* Icon + Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `rgba(${course.accentRgb},0.18)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                    transition: 'transform 0.3s ease',
                    transform: isHovered ? 'scale(1.12) rotate(-5deg)' : 'scale(1)',
                  }}>
                    {course.icon}
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
                    {course.tag}
                  </span>
                </div>

                {/* Title */}
                <h4 style={{
                  fontFamily: sysFont, fontSize: 'clamp(15px, 1.6vw, 19px)', fontWeight: 700,
                  color: '#F5EDD6', lineHeight: 1.3, margin: '0 0 10px', letterSpacing: '-0.01em',
                }}>
                  {course.title}
                </h4>

                {/* Accent line */}
                <div style={{ width: 26, height: 2, background: tagColor, borderRadius: 2, marginBottom: 10, opacity: 0.5 }} />

                {/* Description */}
                <p style={{
                  fontSize: 12, color: 'rgba(245,237,214,0.5)', lineHeight: 1.7, margin: 0, fontFamily: sysFont,
                }}>
                  {course.description}
                </p>
              </div>

              {/* Benefits strip */}
              <div style={{ borderTop: `1px solid ${STRIP_BORDER}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                {benefits.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 3px', borderRight: bi < benefits.length - 1 ? `1px solid ${STRIP_BORDER}` : 'none', flex: 1, justifyContent: 'center', minWidth: 0 }}>
                    <span style={{ fontSize: 9, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
                    <span style={{ fontSize: 8.5, color: 'rgba(245,237,214,0.3)', fontFamily: sysFont, fontWeight: 500, whiteSpace: 'nowrap' as const, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Gold price section */}
              {(() => {
                const weight = course.price / totalOriginal;
                const newPrice = Math.round((course.price - savings * weight) / 100) * 100;
                return (
                  <div style={{
                    background: '#D4A843',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: 'rgba(28,58,46,0.4)', fontFamily: sysFont, fontWeight: 600 }}>
                      {priceLabel}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(28,58,46,0.35)', fontFamily: sysFont, fontWeight: 500, textDecoration: 'line-through' }}>
                      {course.price.toLocaleString()}
                    </span>
                    <span style={{ fontFamily: sysFont, fontSize: 18, fontWeight: 700, color: '#1C3A2E', lineHeight: 1 }}>
                      {newPrice.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(28,58,46,0.45)', fontFamily: sysFont }}>
                      {currency}
                    </span>
                  </div>
                );
              })()}
            </Link>
          );
        })}
      </div>

      {/* Price + CTA */}
      <div style={{
        background: '#1C3A2E',
        borderRadius: layout === 'compact' ? 14 : 16,
        padding: layout === 'compact' ? '12px 16px' : '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: layout === 'compact' ? 12 : 16,
        width: layout === 'compact' ? '53%' : '50%',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 'auto',
        marginBottom: 0,
      }}>
        <div>
          <p style={{ fontSize: layout === 'compact' ? 8 : 9, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: 'rgba(212,168,67,0.5)', margin: '0 0 4px', fontFamily: sysFont }}>
            {priceLabel}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: layout === 'compact' ? 6 : 8 }}>
            <span style={{ fontFamily: sysFont, fontSize: layout === 'compact' ? 'clamp(20px, 2.5vw, 26px)' : 'clamp(28px, 3.5vw, 36px)', fontWeight: 700, color: '#D4A843', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {price.toLocaleString()}
            </span>
            <span style={{ fontSize: layout === 'compact' ? 11 : 13, color: 'rgba(212,168,67,0.5)', fontFamily: sysFont }}>
              {currency}
            </span>
          </div>
          {savings > 0 && (
            <p style={{ fontSize: layout === 'compact' ? 10 : 12, color: '#D4A843', opacity: 0.7, margin: '2px 0 0', fontFamily: sysFont, fontWeight: 500 }}>
              {saveLabel}: {savings.toLocaleString()} {currency}
            </p>
          )}
        </div>
        <CoursePurchaseModal
          courseName={title}
          price={price}
          courseId={`bundle_${slug}`}
          currency={currency}
          buttonLabel={buyLabel}
          compact={layout === 'compact'}
        />
      </div>
    </div>
  );
}

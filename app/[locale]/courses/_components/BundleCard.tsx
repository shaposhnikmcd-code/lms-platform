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

export type BundleType = 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE';

type Props = {
  title: string;
  price: number;
  courses: BundleCourse[];
  freeCourses?: BundleCourse[];
  bundleType?: BundleType;
  freeCount?: number;
  currency: string;
  priceLabel: string;
  bundleLabel: string;
  saveLabel: string;
  slug: string;
  buyLabel: string;
  benefits: Benefit[];
  layout?: 'full' | 'compact';
};

export default function BundleCard({
  title,
  price,
  courses,
  freeCourses = [],
  bundleType = 'DISCOUNT',
  freeCount = 0,
  currency,
  priceLabel,
  saveLabel,
  slug,
  buyLabel,
  benefits,
  layout = 'full',
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);
  // Індекс першого видимого кандидата в каруселі (для CHOICE_FREE)
  const [choiceStart, setChoiceStart] = useState(0);
  // Які безкоштовні клієнт обрав (для CHOICE_FREE)
  const [selectedFree, setSelectedFree] = useState<string[]>([]);

  const totalOriginal = courses.reduce((sum, c) => sum + c.price, 0);
  const savings = Math.max(0, totalOriginal - price);
  const savingsPercent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : 0;

  const hasFreeRow = bundleType !== 'DISCOUNT' && freeCourses.length > 0;
  const choiceMode = bundleType === 'CHOICE_FREE';

  // Для каруселі: скільки карток показуємо одночасно (== freeCount)
  const choiceWindow = Math.max(1, freeCount || 1);
  const visibleChoice = choiceMode
    ? freeCourses
        .slice(0)
        .concat(freeCourses) // дубль для нескінченного гортання
        .slice(choiceStart, choiceStart + choiceWindow)
    : [];

  const toggleFreeSelection = (courseSlug: string) => {
    setSelectedFree((prev) => {
      if (prev.includes(courseSlug)) return prev.filter((s) => s !== courseSlug);
      if (prev.length >= choiceWindow) {
        // замінити найдавніший вибір
        return [...prev.slice(1), courseSlug];
      }
      return [...prev, courseSlug];
    });
  };

  const canBuy = choiceMode ? selectedFree.length === choiceWindow : true;

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
        padding: layout === 'compact' ? 'clamp(12px, 2vw, 18px)' : 'clamp(16px, 3vw, 28px)',
        boxShadow: hovered ? '0 8px 24px rgba(28,58,46,0.04)' : 'none',
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
          {bundleType === 'DISCOUNT' && savings > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#059669', borderRadius: 100, padding: '4px 12px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'white', fontFamily: sysFont }}>
                −{savingsPercent}%
              </span>
            </div>
          )}
          {bundleType !== 'DISCOUNT' && freeCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#059669', borderRadius: 100, padding: '4px 12px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'white', fontFamily: sysFont }}>
                +{freeCount} БЕЗКОШТОВНО
              </span>
            </div>
          )}
        </div>

        <h3 style={{
          fontFamily: sysFont, fontSize: layout === 'compact' ? 'clamp(18px, 2.2vw, 24px)' : 'clamp(20px, 2.5vw, 28px)', fontWeight: 700,
          color: '#1C3A2E', lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em',
          minHeight: '2.4em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title}
        </h3>
      </div>

      {/* Paid course cards grid */}
      <div
        className={`grid ${courses.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : courses.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}
        style={{ gap: layout === 'compact' ? 8 : 14, marginBottom: hasFreeRow ? 10 : (layout === 'compact' ? 24 : 32), flex: hasFreeRow ? undefined : 1 }}
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
              <div style={{ padding: layout === 'full' ? '30px 24px 26px' : '25px 21px 21px', flex: 1 }}>
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
                <h4 style={{
                  fontFamily: sysFont, fontSize: 'clamp(15px, 1.6vw, 19px)', fontWeight: 700,
                  color: '#F5EDD6', lineHeight: 1.3, margin: '0 0 10px', letterSpacing: '-0.01em',
                }}>
                  {course.title}
                </h4>
                <div style={{ width: 26, height: 2, background: tagColor, borderRadius: 2, marginBottom: 10, opacity: 0.5 }} />
                <p style={{
                  fontSize: 12, color: 'rgba(245,237,214,0.5)', lineHeight: 1.7, margin: 0, fontFamily: sysFont,
                }}>
                  {course.description}
                </p>
              </div>
              <div style={{ borderTop: `1px solid ${STRIP_BORDER}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                {benefits.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 1, padding: layout === 'full' ? '7px 4px' : '4px 1px', borderRight: bi < benefits.length - 1 ? `1px solid ${STRIP_BORDER}` : 'none', flex: 1, justifyContent: 'center', minWidth: 0 }}>
                    <span style={{ fontSize: layout === 'full' ? 10 : 6.5, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
                    <span style={{ fontSize: layout === 'full' ? 9.5 : 6, color: 'rgba(245,237,214,0.3)', fontFamily: sysFont, fontWeight: 500, whiteSpace: 'nowrap' as const, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.title}
                    </span>
                  </div>
                ))}
              </div>
              {(() => {
                if (bundleType === 'DISCOUNT') {
                  const weight = totalOriginal > 0 ? course.price / totalOriginal : 0;
                  const newPrice = Math.round((course.price - savings * weight) / 100) * 100;
                  return (
                    <div style={{
                      background: '#D4A843', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
                }
                // Для FIXED_FREE / CHOICE_FREE — у платних показуємо повну ціну (без знижки)
                return (
                  <div style={{
                    background: '#D4A843', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: 'rgba(28,58,46,0.4)', fontFamily: sysFont, fontWeight: 600 }}>
                      {priceLabel}
                    </span>
                    <span style={{ fontFamily: sysFont, fontSize: 18, fontWeight: 700, color: '#1C3A2E', lineHeight: 1 }}>
                      {course.price.toLocaleString()}
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

      {/* FREE ROW — FIXED_FREE */}
      {hasFreeRow && bundleType === 'FIXED_FREE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: layout === 'compact' ? 20 : 28 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#059669', fontFamily: sysFont, textAlign: 'center' }}>
            + У ПОДАРУНОК
          </span>
          <div
            className={`grid ${freeCourses.length === 1 ? 'grid-cols-1' : freeCourses.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}
            style={{ gap: layout === 'compact' ? 8 : 14 }}
          >
            {freeCourses.map((c) => (
              <FreeCourseMini key={c.slug} course={c} currency={currency} layout={layout} />
            ))}
          </div>
        </div>
      )}

      {/* FREE ROW — CHOICE_FREE (carousel) */}
      {hasFreeRow && choiceMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: layout === 'compact' ? 20 : 28 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#059669', fontFamily: sysFont, textAlign: 'center' }}>
            ОБЕРИ БЕЗКОШТОВНИЙ {freeCount > 1 ? `(${selectedFree.length}/${freeCount})` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setChoiceStart((s) => (s - 1 + freeCourses.length) % freeCourses.length)}
              aria-label="prev"
              style={{
                width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(28,58,46,0.2)',
                background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#1C3A2E', flexShrink: 0,
              }}
            >
              ←
            </button>
            <div
              className={`grid ${choiceWindow === 1 ? 'grid-cols-1' : choiceWindow === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}
              style={{ gap: layout === 'compact' ? 8 : 14, flex: 1 }}
            >
              {visibleChoice.map((c, idx) => {
                const isSelected = selectedFree.includes(c.slug);
                return (
                  <button
                    key={`${c.slug}-${idx}`}
                    type="button"
                    onClick={() => toggleFreeSelection(c.slug)}
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <FreeCourseMini
                      course={c}
                      currency={currency}
                      layout={layout}
                      highlight={isSelected}
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setChoiceStart((s) => (s + 1) % freeCourses.length)}
              aria-label="next"
              style={{
                width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(28,58,46,0.2)',
                background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#1C3A2E', flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Price + CTA */}
      <div style={{
        background: '#1C3A2E',
        borderRadius: layout === 'compact' ? 14 : 16,
        padding: layout === 'compact' ? '12px 16px' : '9px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: layout === 'compact' ? 'wrap' : 'nowrap',
        gap: layout === 'compact' ? 12 : 20,
        width: layout === 'compact' ? '53%' : '48%',
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
            <span style={{ fontFamily: sysFont, fontSize: layout === 'compact' ? 'clamp(20px, 2.5vw, 26px)' : 'clamp(24px, 3vw, 30px)', fontWeight: 700, color: '#D4A843', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {price.toLocaleString()}
            </span>
            <span style={{ fontSize: layout === 'compact' ? 11 : 12, color: 'rgba(212,168,67,0.5)', fontFamily: sysFont }}>
              {currency}
            </span>
          </div>
          {bundleType === 'DISCOUNT' && savings > 0 && (
            <p style={{ fontSize: layout === 'compact' ? 10 : 11, color: '#D4A843', opacity: 0.7, margin: '2px 0 0', fontFamily: sysFont, fontWeight: 500 }}>
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
          selectedFreeSlugs={choiceMode ? selectedFree : undefined}
          disabled={!canBuy}
        />
      </div>
    </div>
  );
}

function FreeCourseMini({
  course,
  currency,
  layout,
  highlight,
}: {
  course: BundleCourse;
  currency: string;
  layout: 'full' | 'compact';
  highlight?: boolean;
}) {
  return (
    <div style={{
      background: CARD_BG,
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      border: highlight ? '2px solid #059669' : '2px solid transparent',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ padding: layout === 'full' ? '14px 18px 12px' : '10px 14px 8px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `rgba(${course.accentRgb},0.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0,
          }}>
            {course.icon}
          </div>
          <h4 style={{
            fontFamily: sysFont, fontSize: 'clamp(13px, 1.3vw, 16px)', fontWeight: 700,
            color: '#F5EDD6', lineHeight: 1.25, margin: 0, letterSpacing: '-0.01em',
          }}>
            {course.title}
          </h4>
        </div>
      </div>
      <div style={{
        background: '#059669',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.75)', fontFamily: sysFont, fontWeight: 600 }}>
          У ПОДАРУНОК
        </span>
        <span style={{ fontFamily: sysFont, fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1 }}>
          0 {currency}
        </span>
      </div>
    </div>
  );
}

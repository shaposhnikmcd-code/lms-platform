'use client';

import { useEffect, useState, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import CoursePurchaseModal from '@/components/CoursePurchaseModal';
import { autoTuneBundle } from './bundleAutoTuner';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);
  // Які безкоштовні клієнт обрав (для CHOICE_FREE)
  const [selectedFree, setSelectedFree] = useState<string[]>([]);
  // Drum-скролер для CHOICE_FREE — refs та drag-стан
  const drumRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startScroll: number; lastX: number; lastT: number; velocity: number; moved: boolean }>({
    active: false, startX: 0, startScroll: 0, lastX: 0, lastT: 0, velocity: 0, moved: false,
  });

  const totalOriginal = courses.reduce((sum, c) => sum + c.price, 0);
  const savings = Math.max(0, totalOriginal - price);
  const savingsPercent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : 0;

  const hasFreeRow = bundleType !== 'DISCOUNT' && freeCourses.length > 0;
  const choiceMode = bundleType === 'CHOICE_FREE';
  const isPairLayout = courses.length === 2 && (freeCourses.length === 1 || freeCourses.length === 2) && hasFreeRow;
  // Уніфікована висота 920px для пакетів, які за замовчуванням рендеряться в діапазоні 850-1000px:
  // - 3-рядкові конфіги з free-рядом ≥2 (FIXED 1+2, 2+2; CHOICE 1+пул2, 1+пул3, 2+пул2, 2+пул4)
  // - DISCOUNT 4-paid (2×2 внутрішня сітка) — висота форсована, авто-тюнер вміщує контент
  const unifyHeight920 = (hasFreeRow && freeCourses.length >= 2) || (bundleType === 'DISCOUNT' && courses.length === 4);
  // Уніфікована висота 740px для FIXED_FREE з 1 безкоштовним (inline CTA): 6a (1+1), 6b (2+1)
  const unifyHeight740 = bundleType === 'FIXED_FREE' && freeCourses.length === 1;
  const unifiedHeight = unifyHeight920 ? 920 : unifyHeight740 ? 740 : undefined;

  // Для каруселі: скільки карток показуємо одночасно (== freeCount)
  const choiceWindow = Math.max(1, freeCount || 1);

  const toggleFreeSelection = (courseSlug: string) => {
    setSelectedFree((prev) => {
      if (prev.includes(courseSlug)) return prev.filter((s) => s !== courseSlug);
      if (prev.length >= choiceWindow) {
        return [...prev.slice(1), courseSlug];
      }
      return [...prev, courseSlug];
    });
  };

  const canBuy = choiceMode ? selectedFree.length === choiceWindow : true;

  // ─── Drum-скролер: pointer drag + momentum + arrow-scroll ───
  const scrollDrumBy = (dir: 1 | -1) => {
    const el = drumRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-drum-card]');
    const step = card ? (card.offsetWidth + 14) * choiceWindow : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const onDrumPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = drumRef.current;
    if (!el) return;
    dragRef.current = {
      active: true, startX: e.clientX, startScroll: el.scrollLeft,
      lastX: e.clientX, lastT: performance.now(), velocity: 0, moved: false,
    };
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.style.cursor = 'grabbing';
  };
  const onDrumPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = drumRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    el.scrollLeft = d.startScroll - dx;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.velocity = (e.clientX - d.lastX) / dt; // px per ms
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const onDrumPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = drumRef.current;
    if (!d.active || !el) return;
    d.active = false;
    el.style.cursor = 'grab';
    try { el.releasePointerCapture(e.pointerId); } catch {}
    // момент-інерція: дограсти відстань пропорційно швидкості
    const boost = -d.velocity * 300; // px
    if (Math.abs(boost) > 20) {
      el.scrollBy({ left: boost, behavior: 'smooth' });
    }
  };

  const [tuned, setTuned] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    const run = () => {
      autoTuneBundle(root);
      setTuned(true);
    };
    raf = requestAnimationFrame(run);
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => autoTuneBundle(root));
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-bundle-root
      data-bundle-type={bundleType}
      data-bundle-paid={courses.length}
      data-bundle-free={freeCourses.length}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column' as const,
        background: 'linear-gradient(135deg, rgba(212,168,67,0.06) 0%, rgba(212,168,67,0.12) 50%, rgba(212,168,67,0.04) 100%)',
        borderRadius: 24,
        border: '1.5px solid rgba(212,168,67,0.28)',
        padding: layout === 'compact' ? 'clamp(12px, 2vw, 18px)' : 'clamp(16px, 3vw, 28px)',
        boxShadow: hovered
          ? '0 14px 36px rgba(28,58,46,0.12), 0 0 0 1px rgba(212,168,67,0.2)'
          : '0 4px 14px rgba(28,58,46,0.06), inset 0 1px 0 rgba(255,255,255,0.4)',
        transition: 'box-shadow 0.4s ease, transform 0.4s ease, opacity 0.25s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        opacity: tuned ? 1 : 0,
        height: unifiedHeight,
        overflow: unifiedHeight !== undefined ? 'hidden' : undefined,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bundleChoiceShimmer {
          0% { transform: translateX(-160%) skewX(-20deg); opacity: 0; }
          15% { opacity: 1; }
          45% { opacity: 1; }
          60%, 100% { transform: translateX(280%) skewX(-20deg); opacity: 0; }
        }
        @keyframes bundleSealIn {
          0% { transform: scale(0.55) rotate(-28deg); opacity: 0; }
          65% { transform: scale(1.06) rotate(-4deg); opacity: 1; }
          100% { transform: scale(1) rotate(-6deg); opacity: 1; }
        }
        .bundle-choice-idle {
          border-radius: 14px;
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bundle-choice-idle:hover {
          box-shadow: 0 8px 20px rgba(28,58,46,0.12), 0 3px 8px rgba(212,168,67,0.12);
          transform: translateY(-2px) !important;
        }
        .bundle-choice-shimmer {
          position: absolute;
          top: 0; left: 0;
          width: 38%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,240,200,0.22) 50%, transparent 100%);
          pointer-events: none;
          animation: bundleChoiceShimmer 7s ease-in-out infinite;
          z-index: 4;
          mix-blend-mode: screen;
        }
        .bundle-seal {
          animation: bundleSealIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}} />
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

        <h3 data-bundle-title style={{
          fontFamily: sysFont, fontSize: layout === 'compact' ? 'clamp(18px, 2.2vw, 24px)' : 'clamp(20px, 2.5vw, 28px)', fontWeight: 700,
          color: '#1C3A2E', lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em',
          paddingLeft: freeCourses.length === 4 && courses.length === 2 ? 'clamp(60px, 9%, 110px)' : 0,
          paddingRight: freeCourses.length === 4 && courses.length === 2 ? 'clamp(60px, 9%, 110px)' : 0,
        }}>
          {title}
        </h3>
      </div>

      {/* Paid course cards grid */}
      <div
        className={courses.length === 1
          ? 'flex justify-center'
          : `grid ${courses.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : courses.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}
        style={{
          gap: layout === 'compact' ? 8 : 14,
          marginBottom: hasFreeRow ? 10 : (layout === 'compact' ? 24 : 32),
          flex: hasFreeRow ? undefined : 1,
          maxWidth: freeCourses.length === 4 && courses.length === 2 ? 705 : undefined,
          marginLeft: freeCourses.length === 4 && courses.length === 2 ? 'auto' : undefined,
          marginRight: freeCourses.length === 4 && courses.length === 2 ? 'auto' : undefined,
          width: freeCourses.length === 4 && courses.length === 2 ? '100%' : undefined,
        }}
      >
        {courses.map((course, i) => {
          const isHovered = hoveredCourse === course.slug;
          const tagColor = i % 2 === 0 ? '#D4A843' : '#C4919A';
          // isLargePaid відключено: усі платні картки мають однакову висоту, стандарт = FIXED_FREE 3+1
          const isLargePaid = false;
          const isMidPaid = courses.length === 2 && freeCourses.length === 4;
          const isEqualPair = isPairLayout;
          const isDiscount2Paid = bundleType === 'DISCOUNT' && (courses.length === 2 || courses.length === 3);
          return (
            <Link
              key={course.slug}
              data-bundle-paid-card
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
                transition: 'box-shadow 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s cubic-bezier(0.16,1,0.3,1)',
                display: 'flex',
                flexDirection: 'column',
                width: courses.length === 1 ? (layout === 'compact' ? '64%' : '58%') : undefined,
                height: 'var(--tuned-paid-card-h, 345px)',
              }}
            >
              <div style={{
                padding: isLargePaid
                  ? (layout === 'full' ? '40px 34px 36px' : '32px 28px 28px')
                  : isMidPaid
                    ? (layout === 'full' ? '36px 28px 30px' : '28px 24px 24px')
                    : (layout === 'full' ? '30px 24px 26px' : '25px 21px 21px'),
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isLargePaid ? 12 : isMidPaid ? 10 : 8, marginBottom: isLargePaid ? 16 : isMidPaid ? 13 : 10 }}>
                  <div style={{
                    width: isLargePaid ? 44 : isMidPaid ? 36 : 32,
                    height: isLargePaid ? 44 : isMidPaid ? 36 : 32,
                    borderRadius: isLargePaid ? 10 : 8,
                    background: `rgba(${course.accentRgb},0.18)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isLargePaid ? 20 : isMidPaid ? 17 : 15, flexShrink: 0,
                    transition: 'transform 0.3s ease',
                    transform: isHovered ? 'scale(1.12) rotate(-5deg)' : 'scale(1)',
                  }}>
                    {course.icon}
                  </div>
                  <span style={{ fontSize: isLargePaid ? 10 : isMidPaid ? 9 : 8, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
                    {course.tag}
                  </span>
                </div>
                <h4 style={{
                  fontFamily: sysFont,
                  fontSize: isLargePaid
                    ? 'clamp(25px, 2.5vw, 32px)'
                    : isMidPaid
                      ? 'clamp(18px, 1.9vw, 22px)'
                      : 'clamp(15px, 1.6vw, 19px)',
                  fontWeight: 700,
                  color: '#F5EDD6',
                  lineHeight: 1.25,
                  margin: isLargePaid ? '0 0 14px' : isMidPaid ? '0 0 12px' : '0 0 10px',
                  letterSpacing: '-0.015em',
                }}>
                  {course.title}
                </h4>
                <div style={{ width: isLargePaid ? 34 : isMidPaid ? 30 : 26, height: isLargePaid ? 3 : 2, background: tagColor, borderRadius: 2, marginBottom: isLargePaid ? 14 : isMidPaid ? 12 : 10, opacity: 0.5 }} />
                <p data-bundle-desc style={{
                  fontSize: `var(--tuned-paid-desc-fs, ${isLargePaid ? 17 : isMidPaid ? 14 : 12}px)`,
                  color: 'rgba(245,237,214,0.6)',
                  lineHeight: 1.65,
                  margin: 0,
                  fontFamily: sysFont,
                }}>
                  {course.description}
                </p>
              </div>
              <div style={{ borderTop: `1px solid ${STRIP_BORDER}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                {benefits.map((b, bi) => (
                  <div key={bi} style={{
                    display: 'flex', alignItems: 'center',
                    gap: isLargePaid ? 4 : isDiscount2Paid ? 2 : 1,
                    padding: isLargePaid ? '11px 6px' : isDiscount2Paid ? '8px 3px' : (layout === 'full' ? '7px 4px' : '4px 1px'),
                    borderRight: bi < benefits.length - 1 ? `1px solid ${STRIP_BORDER}` : 'none',
                    flex: 1, justifyContent: 'center', minWidth: 0,
                  }}>
                    <span data-bundle-benefit-icon style={{
                      fontSize: isLargePaid ? 13 : isDiscount2Paid ? 11 : (layout === 'full' ? 10 : 6.5),
                      lineHeight: 1, flexShrink: 0,
                    }}>{b.icon}</span>
                    <span data-bundle-benefit-title style={{
                      fontSize: isLargePaid ? 11 : isDiscount2Paid ? (b.title.length > 16 ? 8 : 9) : isEqualPair ? 8.5 : (layout === 'full' ? 9.5 : 6),
                      color: 'rgba(245,237,214,0.5)',
                      fontFamily: sysFont, fontWeight: 500,
                      whiteSpace: 'nowrap' as const, lineHeight: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
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
                    background: '#D4A843',
                    padding: isLargePaid ? '9px 16px' : '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: isLargePaid ? 9 : 8,
                  }}>
                    <span style={{
                      fontSize: isLargePaid ? 10 : 8,
                      textTransform: 'uppercase' as const, letterSpacing: '0.18em',
                      color: 'rgba(28,58,46,0.4)', fontFamily: sysFont, fontWeight: 600,
                    }}>
                      {priceLabel}
                    </span>
                    <span style={{
                      fontFamily: sysFont,
                      fontSize: isLargePaid ? 21 : 18,
                      fontWeight: 700, color: '#1C3A2E', lineHeight: 1,
                    }}>
                      {course.price.toLocaleString()}
                    </span>
                    <span style={{
                      fontSize: isLargePaid ? 12 : 10,
                      color: 'rgba(28,58,46,0.45)', fontFamily: sysFont,
                    }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: freeCourses.length === 1 ? 0 : (layout === 'compact' ? 20 : 28) }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#059669', fontFamily: sysFont, textAlign: 'center' }}>
            + У ПОДАРУНОК
          </span>
          {freeCourses.length === 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: layout === 'compact' ? 8 : 14 }}>
              <FreeCourseMini course={freeCourses[0]} currency={currency} layout={layout} benefits={benefits} equalPair />
              {/* Premium CTA card */}
              <div style={{
                position: 'relative',
                background: 'radial-gradient(120% 100% at 100% 0%, rgba(212,168,67,0.22) 0%, rgba(212,168,67,0) 55%), linear-gradient(160deg, #244838 0%, #1C3A2E 55%, #152C22 100%)',
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 18px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
                overflow: 'hidden',
                minHeight: 220,
              }}>
                {/* Subtle pattern */}
                <span aria-hidden style={{
                  position: 'absolute', top: -40, right: -40, width: 140, height: 140,
                  borderRadius: '50%', background: 'rgba(212,168,67,0.07)', filter: 'blur(20px)',
                }} />
                <span aria-hidden style={{
                  position: 'absolute', top: 16, left: 20, right: 20, height: 1,
                  background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.2), transparent)',
                }} />

                {/* Top: badge + декор */}
                <div style={{ position: 'relative', padding: layout === 'full' ? '22px 22px 14px' : '18px 18px 10px' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(212,168,67,0.14)',
                    border: '1px solid rgba(212,168,67,0.28)',
                    borderRadius: 100, padding: '4px 10px',
                  }}>
                    <span style={{ fontSize: 11 }}>🎯</span>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
                      ГОТОВИЙ НАБІР
                    </span>
                  </div>
                </div>

                {/* Mid: price hero */}
                <div style={{ position: 'relative', padding: layout === 'full' ? '0 22px 18px' : '0 18px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.26em', color: 'rgba(245,237,214,0.45)', margin: '0 0 6px', fontFamily: sysFont, fontWeight: 600 }}>
                    {priceLabel}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      fontFamily: sysFont,
                      fontSize: 'clamp(30px, 3.4vw, 42px)',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #F2C76D 0%, #D4A843 50%, #B8901F 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      lineHeight: 1,
                      letterSpacing: '-0.03em',
                    }}>
                      {price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 14, color: 'rgba(212,168,67,0.6)', fontFamily: sysFont, fontWeight: 500 }}>
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Bottom: amber CTA — більша і зміщена вправо */}
                <div
                  className="[&>button]:!ml-auto [&>button]:!mr-0 [&>button]:!px-4 [&>button]:!py-3 [&>button]:!text-[18px] [&>button]:!gap-2 [&>button>span:last-child]:!max-w-[90px] [&>button>span:last-child]:!whitespace-normal [&>button>span:last-child]:!leading-tight [&>button>span:last-child]:!inline-block [&>button>span:last-child]:!text-center"
                  style={{ position: 'relative', padding: layout === 'full' ? '14px 22px 20px' : '12px 18px 18px', display: 'flex', justifyContent: 'flex-end' }}
                >
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
            </div>
          ) : (
            <div
              className={`grid ${freeCourses.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : freeCourses.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
              style={{ gap: layout === 'compact' ? 8 : 14 }}
            >
              {freeCourses.map((c) => (
                <FreeCourseMini key={c.slug} course={c} currency={currency} layout={layout} benefits={benefits} slim={freeCourses.length === 4} equalPair={isPairLayout} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FREE ROW — CHOICE_FREE (footer-як-сигнал вибору) */}
      {hasFreeRow && choiceMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: layout === 'compact' ? 20 : 28, alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#059669', borderRadius: 999, padding: '5px 14px',
            boxShadow: '0 4px 14px rgba(5,150,105,0.25)',
          }}>
            <span style={{ fontSize: 12 }}>🎁</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
              textTransform: 'uppercase' as const, color: 'white', fontFamily: sysFont,
            }}>
              Курс в подарунок на вибір
            </span>
            {freeCount > 1 && (
              <span style={{
                fontSize: 10, fontWeight: 800, color: 'white', fontFamily: sysFont,
                background: 'rgba(255,255,255,0.2)', borderRadius: 999,
                padding: '2px 7px', fontVariantNumeric: 'tabular-nums',
              }}>
                {selectedFree.length}/{freeCount}
              </span>
            )}
          </div>
          {(() => {
            const renderCard = (c: BundleCourse) => {
              const isSelected = selectedFree.includes(c.slug);
              const selectionComplete = selectedFree.length >= choiceWindow;
              const dimmed = selectionComplete && !isSelected;
              const idle = !isSelected && !dimmed;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggleFreeSelection(c.slug)}
                  className={idle ? 'bundle-choice-idle' : ''}
                  style={{
                    padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%', height: '100%', position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1), box-shadow 0.45s ease',
                    overflow: 'visible',
                    transform: isSelected ? 'translateY(-2px) scale(1.015)' : undefined,
                  }}
                >
                  {/* Wax seal — преміум медальйон при виборі */}
                  {isSelected && (
                    <span aria-hidden className="bundle-seal" style={{
                      position: 'absolute', top: -10, right: -10, zIndex: 5,
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'radial-gradient(circle at 32% 28%, #10b981 0%, #059669 55%, #047857 100%)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      boxShadow: '0 8px 22px rgba(5,150,105,0.42), inset 0 1px 0 rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transformOrigin: 'center',
                    }}>
                      <span aria-hidden style={{
                        position: 'absolute', inset: 3, borderRadius: '50%',
                        border: '1px dashed rgba(255,255,255,0.4)',
                      }} />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}>
                        <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}

                  <FreeCourseMini
                    course={c}
                    currency={currency}
                    layout={layout}
                    highlight={isSelected}
                    dimmed={dimmed}
                    benefits={benefits}
                    choiceMode
                    isSelected={isSelected}
                    slim={freeCourses.length === 4}
                    equalPair={isPairLayout}
                  />
                </button>
              );
            };
            if (freeCourses.length === 1) {
              return (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{ width: '100%', maxWidth: `calc(50% - ${(layout === 'compact' ? 8 : 14) / 2}px)` }}>
                    {renderCard(freeCourses[0])}
                  </div>
                </div>
              );
            }
            return (
              <div
                className={`grid w-full ${freeCourses.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : freeCourses.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
                style={{ gap: layout === 'compact' ? 8 : 14 }}
              >
                {freeCourses.map(renderCard)}
              </div>
            );
          })()}
        </div>
      )}

      {/* Price + CTA — прибираємо коли вже вбудовано в free-row (FIXED_FREE з 1 безкоштовним) */}
      {!(hasFreeRow && bundleType === 'FIXED_FREE' && freeCourses.length === 1) && (
      <div data-bundle-cta style={{
        position: 'relative',
        background: 'radial-gradient(140% 180% at 0% 50%, rgba(212,168,67,0.18) 0%, rgba(212,168,67,0) 55%), radial-gradient(140% 180% at 100% 50%, rgba(212,168,67,0.10) 0%, rgba(212,168,67,0) 55%), linear-gradient(135deg, #244838 0%, #1C3A2E 50%, #142A20 100%)',
        borderRadius: layout === 'compact' ? 16 : 18,
        padding: layout === 'compact' ? '16px' : 'clamp(18px, 2.4vw, 26px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap' as const,
        gap: layout === 'compact' ? 20 : 'clamp(28px, 4vw, 48px)',
        width: 'fit-content',
        maxWidth: freeCourses.length === 4 ? 640
          : (courses.length === 2 && bundleType === 'DISCOUNT') ? 480
          : undefined,
        marginTop: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginBottom: 0,
      }}>
        {/* Декор: blurred amber blobs + верхня hairline */}
        <span aria-hidden style={{
          position: 'absolute', top: -60, left: -40, width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(212,168,67,0.10)', filter: 'blur(28px)',
          pointerEvents: 'none',
        }} />
        <span aria-hidden style={{
          position: 'absolute', bottom: -70, right: -50, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(212,168,67,0.07)', filter: 'blur(30px)',
          pointerEvents: 'none',
        }} />
        <span aria-hidden style={{
          position: 'absolute', top: 0, left: 24, right: 24, height: 1,
          background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.32), transparent)',
        }} />

        {/* Left: label + hero price + savings pill */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: layout === 'compact' ? 4 : 6, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: layout === 'compact' ? 11 : 13, lineHeight: 1 }}>💎</span>
            <p style={{
              fontSize: layout === 'compact' ? 9 : 10, textTransform: 'uppercase' as const,
              letterSpacing: '0.28em', color: 'rgba(212,168,67,0.6)', margin: 0,
              fontFamily: sysFont, fontWeight: 600,
            }}>
              {priceLabel}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: layout === 'compact' ? 6 : 8, marginLeft: layout === 'compact' ? 'calc(6px + 1.5cm)' : 'calc(10px + 1.5cm)' }}>
            <span style={{
              fontFamily: sysFont,
              fontSize: layout === 'compact' ? 'clamp(26px, 3vw, 32px)' : 'clamp(34px, 4vw, 48px)',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #F2C76D 0%, #D4A843 50%, #B8901F 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>
              {price.toLocaleString()}
            </span>
            <span style={{
              fontSize: layout === 'compact' ? 13 : 16,
              color: 'rgba(212,168,67,0.65)', fontFamily: sysFont, fontWeight: 500,
            }}>
              {currency}
            </span>
          </div>
          {bundleType === 'DISCOUNT' && savings > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(212,168,67,0.12)',
              border: '1px solid rgba(212,168,67,0.35)',
              borderRadius: 999, padding: layout === 'compact' ? '3px 10px' : '4px 12px',
              alignSelf: 'flex-start',
              marginTop: 2,
            }}>
              <span style={{ fontSize: 11, lineHeight: 1 }}>💰</span>
              <span style={{
                fontSize: layout === 'compact' ? 10 : 11, fontWeight: 700,
                color: 'rgba(242,199,109,0.9)', fontFamily: sysFont, letterSpacing: '-0.01em',
              }}>
                {saveLabel}: {savings.toLocaleString()} {currency}
              </span>
            </div>
          )}
        </div>

        {/* Right: amber CTA — мега преміум кнопка з gradient + amber halo */}
        <div
          className={`[&>button]:!px-9 [&>button]:!text-[16px] [&>button]:!gap-2.5 sm:[&>button]:!px-12 sm:[&>button]:!text-[18px] sm:[&>button]:!gap-3 [&>button]:!bg-[linear-gradient(135deg,#F2C76D_0%,#D4A843_50%,#B8901F_100%)] [&>button]:!text-[#152C22] [&>button]:!border-[rgba(255,255,255,0.18)] [&>button]:!shadow-[0_12px_32px_rgba(212,168,67,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] hover:[&>button]:!bg-[linear-gradient(135deg,#F5CE78_0%,#DBAF4B_50%,#C19A27_100%)] hover:[&>button]:!shadow-[0_16px_40px_rgba(212,168,67,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] ${isPairLayout ? '[&>button]:!py-4 sm:[&>button]:!py-5' : (bundleType === 'DISCOUNT' && courses.length === 2) ? '[&>button]:!py-[18px] sm:[&>button]:!py-[22px]' : '[&>button]:!py-3.5 sm:[&>button]:!py-4'}`}
          style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignSelf: isPairLayout ? 'flex-end' : undefined }}
        >
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
      )}
    </div>
  );
}

function FreeCourseMini({
  course,
  currency,
  layout,
  highlight,
  dimmed,
  benefits = [],
  choiceMode = false,
  isSelected = false,
  slim = false,
  equalPair = false,
}: {
  course: BundleCourse;
  currency: string;
  layout: 'full' | 'compact';
  highlight?: boolean;
  dimmed?: boolean;
  benefits?: Benefit[];
  choiceMode?: boolean;
  isSelected?: boolean;
  slim?: boolean;
  equalPair?: boolean;
}) {
  const tagColor = '#D4A843';
  const showShimmer = !dimmed && !isSelected;
  return (
    <div data-bundle-free-card style={{
      background: CARD_BG,
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      width: '100%',
      height: 'var(--tuned-free-card-h, auto)',
      boxShadow: dimmed
        ? 'none'
        : highlight
          ? '0 0 0 2px #059669, 0 2px 10px rgba(0,0,0,0.1)'
          : '0 2px 10px rgba(0,0,0,0.1)',
      opacity: dimmed ? 0.35 : 1,
      filter: dimmed ? 'grayscale(0.6) blur(0.5px)' : 'none',
      transition: 'all 0.3s ease',
    }}>
      {showShimmer && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0,
          overflow: 'hidden', pointerEvents: 'none', zIndex: 3,
          borderRadius: 14,
        }}>
          <span className="bundle-choice-shimmer" />
        </span>
      )}
      <div style={{
        padding: slim
          ? (layout === 'full' ? '20px 18px 18px' : '18px 16px 16px')
          : equalPair
            ? (layout === 'full' ? '22px 22px 20px' : '20px 19px 19px')
            : (layout === 'full' ? '30px 24px 26px' : '25px 21px 21px'),
        flex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: slim ? 8 : equalPair ? 8 : 10 }}>
          <div style={{
            width: slim ? 28 : 32, height: slim ? 28 : 32, borderRadius: 8,
            background: `rgba(${course.accentRgb},0.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: slim ? 13 : 15, flexShrink: 0,
          }}>
            {course.icon}
          </div>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
            {course.tag}
          </span>
        </div>
        <h4 style={{
          fontFamily: sysFont,
          fontSize: slim ? 'clamp(14px, 1.3vw, 16px)' : 'clamp(15px, 1.6vw, 19px)',
          fontWeight: 700,
          color: '#F5EDD6', lineHeight: 1.3, margin: slim ? '0 0 8px' : equalPair ? '0 0 8px' : '0 0 10px', letterSpacing: '-0.01em',
          minHeight: equalPair ? undefined : '2.6em',
        }}>
          {course.title}
        </h4>
        <div style={{ width: 26, height: 2, background: tagColor, borderRadius: 2, marginBottom: slim ? 8 : equalPair ? 8 : 10, opacity: 0.5 }} />
        <p data-bundle-desc style={{
          fontSize: `var(--tuned-free-desc-fs, ${slim ? 11 : 12}px)`,
          color: 'rgba(245,237,214,0.5)', lineHeight: equalPair ? 1.65 : 1.6, margin: 0, fontFamily: sysFont,
        }}>
          {course.description}
        </p>
      </div>
      {benefits.length > 0 && (
        <div style={{ borderTop: `1px solid ${STRIP_BORDER}`, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
          {benefits.map((b, bi) => (
            <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 1, padding: layout === 'full' ? '7px 4px' : '4px 1px', borderRight: bi < benefits.length - 1 ? `1px solid ${STRIP_BORDER}` : 'none', flex: 1, justifyContent: 'center', minWidth: 0 }}>
              <span data-bundle-benefit-icon style={{ fontSize: layout === 'full' ? 10 : 6.5, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
              <span data-bundle-benefit-title style={{ fontSize: equalPair ? 8.5 : (layout === 'full' ? 9.5 : 6), color: 'rgba(245,237,214,0.3)', fontFamily: sysFont, fontWeight: 500, whiteSpace: 'nowrap' as const, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.title}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{
        background: '#059669', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.75)', fontFamily: sysFont, fontWeight: 600 }}>
          У ПОДАРУНОК
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: sysFont, fontWeight: 500, textDecoration: 'line-through' }}>
          {course.price.toLocaleString()}
        </span>
        <span style={{ fontFamily: sysFont, fontSize: 18, fontWeight: 700, color: 'white', lineHeight: 1 }}>
          0
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: sysFont }}>
          {currency}
        </span>
      </div>
    </div>
  );
}

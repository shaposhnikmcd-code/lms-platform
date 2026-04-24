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
  /** Локалізовані підписи. Передаються із серверного page.tsx через t(). */
  freeBadgeLabel?: string;
  yourGiftLabel?: string;
  chooseCoursesLabel?: string;
  freeCoursesCountLabel?: string;
  giftStripLabel?: string;
  layout?: 'full' | 'compact';
  /** Міні-режим для адмінки: пропускає autoTuner/hover/drag, статичний рендер.
   * Використовується для Row View в /dashboard/admin/bundles. */
  miniature?: boolean;
  /** Форсована висота бандла (обрізає контент по borderRadius). Для miniature в адмінці. */
  forcedHeight?: number;
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
  bundleLabel = 'ПАКЕТ',
  saveLabel,
  slug,
  buyLabel,
  benefits,
  freeBadgeLabel,
  yourGiftLabel = '🎁 Ваш подарунок',
  chooseCoursesLabel,
  freeCoursesCountLabel,
  giftStripLabel = 'У ПОДАРУНОК',
  layout = 'full',
  miniature = false,
  forcedHeight,
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
  // Gift value — сума цін безкоштовних курсів.
  // FIXED_FREE: сума всіх freeCourses.
  // CHOICE_FREE:
  //   - коли ВСІ pickN вибрано → фактична сума вибраних (число)
  //   - коли частково / нічого → вилка "MIN – MAX грн"
  //     MIN = сума top pickN найдешевших з пулу
  //     MAX = сума top pickN найдорожчих з пулу
  const isChoiceFullySelected = bundleType !== 'CHOICE_FREE' || selectedFree.length >= (freeCount || 0);
  const pickN = freeCount || 0;
  const sortedFreeByPrice = [...freeCourses].sort((a, b) => a.price - b.price);
  const choiceMin = sortedFreeByPrice.slice(0, pickN).reduce((sum, c) => sum + c.price, 0);
  const choiceMax = sortedFreeByPrice.slice(-pickN).reduce((sum, c) => sum + c.price, 0);
  const choiceActual = freeCourses.filter((c) => selectedFree.includes(c.slug)).reduce((sum, c) => sum + c.price, 0);
  const giftValue = bundleType === 'CHOICE_FREE'
    ? (isChoiceFullySelected ? choiceActual : choiceMax)
    : freeCourses.reduce((sum, c) => sum + c.price, 0);
  const displayedSavings = bundleType === 'DISCOUNT' ? savings : giftValue;
  // Показувати вилку "min – max" коли CHOICE ще не довершено (і min !== max)
  const savingsRange = bundleType === 'CHOICE_FREE' && !isChoiceFullySelected && choiceMin !== choiceMax;

  const hasFreeRow = bundleType !== 'DISCOUNT' && freeCourses.length > 0;
  const choiceMode = bundleType === 'CHOICE_FREE';
  const isPairLayout = courses.length === 2 && (freeCourses.length === 1 || freeCourses.length === 2) && hasFreeRow;
  // Уніфіковані відступи 28px скрізь (header→paid, paid→free, free→CTA, боки, низ).
  // Слак іде/береться з висоти частини картки з описом (rule #18). Скоуп: 2+2 і 2+4.
  const isUniformSpacing = courses.length === 2 && (freeCourses.length === 2 || freeCourses.length === 4) && hasFreeRow;
  // Inline square CTA-card (rule #24) — останній ряд має 1 блок:
  //   - FIXED_FREE з 1 безкоштовним (free-row grid-cols-2: FreeMini + InlineCTA)
  //   - DISCOUNT з непарною кількістю paid ≥ 5 у grid-cols-2 (5-paid, 7-paid, ...):
  //     після paid cards рендериться InlineCTA як останній grid item
  const inlineCtaInFreeRow = hasFreeRow && bundleType === 'FIXED_FREE' && freeCourses.length === 1;
  const inlineCtaInPaidRow = !hasFreeRow && bundleType === 'DISCOUNT' && courses.length >= 5 && courses.length % 2 === 1;
  const hideBottomCta = inlineCtaInFreeRow || inlineCtaInPaidRow;
  // Уніфікована висота 920px для пакетів:
  // - 3-рядкові конфіги з free-рядом ≥2 (FIXED 1+2, 2+2; CHOICE 1+пул2, 1+пул3, 2+пул2, 2+пул4)
  // - DISCOUNT 4-paid (2×2 сітка) — M5
  // - DISCOUNT ≥5 paid з inline CTA (rule #24) — немає в таблиці, беремо найближче M5
  const unifyHeight920 = (hasFreeRow && freeCourses.length >= 2)
    || (bundleType === 'DISCOUNT' && courses.length === 4)
    || (bundleType === 'DISCOUNT' && courses.length >= 5 && courses.length % 2 === 1);
  // Уніфікована висота 740px для FIXED_FREE з 1 безкоштовним (inline CTA): 6a (1+1), 6b (2+1)
  const unifyHeight740 = bundleType === 'FIXED_FREE' && freeCourses.length === 1;
  // Уніфіковані висоти для DISCOUNT без free:
  //  - 2 paid (cards широкі, ~312px) → 560
  //  - 3 paid (cards вужчі 240px, text wraps more → вища картка) → 620
  const isDiscount2Only = bundleType === 'DISCOUNT' && !hasFreeRow && courses.length === 2;
  const isDiscount3Only = bundleType === 'DISCOUNT' && !hasFreeRow && courses.length === 3;
  const unifyHeight580 = isDiscount2Only || isDiscount3Only;
  const unifiedHeight = unifyHeight920 ? 920 : unifyHeight740 ? 740 : isDiscount2Only ? 560 : isDiscount3Only ? 620 : undefined;

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

  // Rule #24 — рендерер inline квадратної CTA-картки. Використовується коли в
  // останньому ряду пакета рівно 1 блок: FIXED_FREE з 1 free та DISCOUNT з непарним paid ≥ 5.
  const renderInlineCtaCard = () => (
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
      <span aria-hidden style={{
        position: 'absolute', top: -40, right: -40, width: 140, height: 140,
        borderRadius: '50%', background: 'rgba(212,168,67,0.07)', filter: 'blur(20px)',
      }} />
      <span aria-hidden style={{
        position: 'absolute', top: 16, left: 20, right: 20, height: 1,
        background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.2), transparent)',
      }} />
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
        {displayedSavings > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(212,168,67,0.12)',
            border: '1px solid rgba(212,168,67,0.35)',
            borderRadius: 999, padding: '3px 10px',
            alignSelf: 'flex-start',
            marginTop: 8,
          }}>
            <span style={{ fontSize: 10, lineHeight: 1 }}>💰</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: 'rgba(242,199,109,0.9)', fontFamily: sysFont, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap' as const,
            }}>
              {saveLabel}: {savingsRange
                ? `${choiceMin.toLocaleString()} – ${choiceMax.toLocaleString()}`
                : displayedSavings.toLocaleString()} {currency}
            </span>
          </div>
        )}
      </div>
      <div
        className="[&>button]:!ml-auto [&>button]:!mr-0 [&>button]:!px-6 sm:[&>button]:!px-8 [&>button]:!py-[14px] sm:[&>button]:!py-[16px] [&>button]:!text-[14px] sm:[&>button]:!text-[15px] [&>button]:!gap-2 sm:[&>button]:!gap-2.5 [&>button]:!whitespace-nowrap [&>button]:!bg-[linear-gradient(135deg,#F2C76D_0%,#D4A843_50%,#B8901F_100%)] [&>button]:!text-[#152C22] [&>button]:!border-[rgba(255,255,255,0.18)] [&>button]:!shadow-[0_12px_32px_rgba(212,168,67,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] hover:[&>button]:!bg-[linear-gradient(135deg,#F5CE78_0%,#DBAF4B_50%,#C19A27_100%)] hover:[&>button]:!shadow-[0_16px_40px_rgba(212,168,67,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]"
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
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    raf = requestAnimationFrame(() => autoTuneBundle(root));
    // Resize listener потрібен і для miniature (scale не змінюється але viewport може).
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => autoTuneBundle(root));
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [miniature]);

  // SSR-defaults для --tuned-paid-card-h (CSS var що autoTuner перераховує).
  // Раніше був fallback 345px, але autoTuner типово ставить 242-272 залежно
  // від paid.length — був "стрибок" −80px коли client-side tuner спрацьовував.
  // Ставимо тип-специфічний default що дуже близький до фінального значення →
  // максимальний зсув висоти ~5px, візуально плавний через CSS transition.
  // SSR-defaults виведені з фактичних значень autoTuner (заміряно Playwright-ом
  // на /uk/courses 2026-04-20). Максимальний зсув після client-side tuning — ≤5px,
  // що невідчутно і згладжується CSS transition height 0.35s.
  const paidCardDefaultH =
    courses.length === 1 ? '244px'                                          // solo hero (CHOICE 1+3)
    : courses.length === 2 ? '248px'                                        // DISCOUNT 2 / FIXED 2+2 / CHOICE 2+N
    : courses.length === 3
      ? (!hasFreeRow ? '272px'                                              // DISCOUNT 3 (ширші)
         : freeCourses.length === 1 ? '267px'                               // FIXED 3+1 (інший лейаут з inline CTA)
         : '246px')                                                         // CHOICE 3+N (вужчі)
    : '246px';                                                              // 4+, 5+ paid

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
        transition: 'box-shadow 0.4s ease, transform 0.4s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        // Rule #42: bundle адаптивний. forcedHeight (miniature preview) — фіксована висота
        // з overflow:hidden щоб скейл не ламав. У нормі — minHeight (unifiedHeight як baseline);
        // тюнер expandBundleIfNeeded() піднімає minHeight до naturalNeeded → описи ніколи не клiпаються.
        height: forcedHeight,
        minHeight: forcedHeight === undefined ? unifiedHeight : undefined,
        overflow: forcedHeight !== undefined ? 'hidden' : undefined,
        // CSS var що autoTuner перераховує на клієнті — префіксуємо розумним
        // SSR-дефолтом щоб paid cards не стрибали на 80px коли tuner запускається.
        ['--tuned-paid-card-h' as string]: paidCardDefaultH,
      } as React.CSSProperties}
    >
      {/* Bundle-specific keyframes, selected seal, shimmer і mobile overrides
          винесено в app/globals.css (секція "BundleCard: shimmer + selected-seal").
          Раніше CSS дублювався 12 разів у HTML через <style dangerouslySetInnerHTML>. */}
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1C3A2E', borderRadius: 100, padding: '4px 14px',
          }}>
            <span style={{ fontSize: 12 }}>📦</span>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#D4A843', fontFamily: sysFont }}>
              {bundleLabel}
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
                {freeBadgeLabel ?? `+${freeCount} БЕЗКОШТОВНО`}
              </span>
            </div>
          )}
        </div>

        <h3 data-bundle-title style={{
          fontFamily: sysFont,
          // У miniature фіксуємо title fontSize (не clamp) — viewport-based clamp у scaled контейнері
          // поводиться непередбачувано і робить title на 1 рядок вище ніж на сайті.
          fontSize: miniature
            ? (layout === 'compact' ? 19 : 22)
            : (layout === 'compact' ? 'clamp(18px, 2.2vw, 24px)' : 'clamp(20px, 2.5vw, 28px)'),
          fontWeight: 700,
          color: '#1C3A2E', lineHeight: 1.2, margin: 0, letterSpacing: '-0.02em',
          paddingLeft: freeCourses.length === 4 && courses.length === 2 ? 'clamp(20px, 3%, 50px)' : 0,
          paddingRight: freeCourses.length === 4 && courses.length === 2 ? 'clamp(20px, 3%, 50px)' : 0,
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
          // isDiscount2Only: 16 (замість 32) — щоб cap у тюнері залишив ≥4 рядки desc у картках
          // при unifiedHeight=560 (див. Rule #40 у bundleAutoTuner.ts).
          marginBottom: isUniformSpacing ? 28 : (hasFreeRow ? 10 : (isDiscount2Only ? 16 : (layout === 'compact' ? 24 : 32))),
          // flex:1 видалено: коли cards мають explicit height, flex:1 на grid ростив би
          // контейнер повз cards → порожнеча ВСЕРЕДИНІ grid, adjuster бачив extraSpace≈0
          // і не спрацьовував. Без flex:1 grid=natural(cards), adjuster розподіляє delta
          // рівно в padding/margins (rule #39 + #40).
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
                // height transition згладжує корекцію від autoTuner (typical ±5-15px)
                transition: 'box-shadow 0.3s cubic-bezier(0.16,1,0.3,1), transform 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s cubic-bezier(0.16,1,0.3,1), height 0.35s cubic-bezier(0.16,1,0.3,1)',
                display: 'flex',
                flexDirection: 'column',
                width: courses.length === 1 ? (layout === 'compact' ? '64%' : '58%') : undefined,
                maxWidth: courses.length === 1 && freeCourses.length >= 3 ? 390 : undefined,
                height: 'var(--tuned-paid-card-h, 345px)',
              }}
            >
              <div style={{
                padding: isLargePaid
                  ? (layout === 'full' ? '40px 34px 8px' : '32px 28px 8px')
                  : isMidPaid
                    ? (layout === 'full' ? '36px 28px 8px' : '28px 24px 8px')
                    : (layout === 'full' ? '30px 24px 8px' : '25px 21px 8px'),
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isLargePaid ? 12 : isMidPaid ? 10 : 8, marginBottom: isLargePaid ? 16 : isMidPaid ? 13 : 10 }}>
                  <div style={{
                    width: 33,
                    height: 33,
                    borderRadius: 8,
                    background: `rgba(${course.accentRgb},0.18)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                    transition: 'transform 0.3s ease',
                    transform: isHovered ? 'scale(1.12) rotate(-5deg)' : 'scale(1)',
                  }}>
                    {course.icon}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
                    {course.tag}
                  </span>
                </div>
                <h4 style={{
                  fontFamily: sysFont,
                  fontSize: 19,
                  fontWeight: 700,
                  color: '#F5EDD6',
                  lineHeight: 1.25,
                  margin: isLargePaid ? '0 0 10px' : isMidPaid ? '0 0 8px' : '0 0 6px',
                  letterSpacing: '-0.015em',
                }} data-bundle-paid-h4>
                  {course.title}
                </h4>
                <div style={{ width: isLargePaid ? 34 : isMidPaid ? 30 : 26, height: isLargePaid ? 3 : 2, background: tagColor, borderRadius: 2, marginBottom: isLargePaid ? 10 : isMidPaid ? 8 : 6, opacity: 0.5 }} />
                <p data-bundle-desc style={{
                  fontSize: 12,
                  color: 'rgba(245,237,214,0.6)',
                  lineHeight: 1.65,
                  margin: 0,
                  paddingBottom: 4,
                  minHeight: 'calc(1.65em * 4)',
                  fontFamily: sysFont,
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
                      background: '#D4A843', padding: '6px 14px',
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
                    padding: isLargePaid ? '5px 16px' : '6px 14px',
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
        {inlineCtaInPaidRow && renderInlineCtaCard()}
      </div>

      {/* FREE ROW — FIXED_FREE */}
      {hasFreeRow && bundleType === 'FIXED_FREE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: freeCourses.length === 1 ? 0 : (layout === 'compact' ? 20 : 28), alignItems: 'center' }}>
          {/* Paper gift tag (rule #27 стиль) — аналогічно CHOICE_FREE */}
          <div style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(135deg, #FFFCF3 0%, #FAF2DA 55%, #EDDBA5 100%) padding-box, linear-gradient(135deg, #F2C76D 0%, #D4A843 50%, #B8901F 100%) border-box',
            border: '1.5px solid transparent',
            borderRadius: 10,
            padding: '8px 22px 8px 36px',
            boxShadow: '0 8px 20px rgba(164,122,40,0.3), 0 2px 5px rgba(70,48,10,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
            transform: 'rotate(-0.8deg)',
          }}>
            <span aria-hidden style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 11, height: 11, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #1C3A2E 0%, #142A20 70%, #0A1A13 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(164,122,40,0.4)',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.26em',
                textTransform: 'uppercase' as const, color: 'rgba(70,48,10,0.55)', fontFamily: sysFont,
              }}>
                {yourGiftLabel}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
                color: '#3A2608', fontFamily: sysFont,
              }}>
                {freeCoursesCountLabel ?? (() => {
                  const n = freeCourses.length;
                  const word = n === 1 ? 'курс' : (n >= 2 && n <= 4) ? 'курси' : 'курсів';
                  return `${n} ${word} безкоштовно`;
                })()}
              </span>
            </div>
          </div>
          {freeCourses.length === 1 ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2"
              style={{
                gap: layout === 'compact' ? 8 : 14,
                // У miniature трохи зменшуємо пару (FreeMini + InlineCTA) пропорційно разом,
                // щоб inline CTA не виглядав завеликим, і FreeMini поруч не розбіглась по розміру.
                ...(miniature ? {
                  transform: 'scale(0.92)',
                  transformOrigin: 'top center',
                } : {}),
              }}
            >
              <FreeCourseMini course={freeCourses[0]} currency={currency} layout={layout} benefits={benefits} equalPair giftStripLabel={giftStripLabel} />
              {renderInlineCtaCard()}
            </div>
          ) : (
            <div
              className={`grid ${freeCourses.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : freeCourses.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
              style={{ gap: layout === 'compact' ? 8 : 14 }}
            >
              {freeCourses.map((c) => (
                <FreeCourseMini key={c.slug} course={c} currency={currency} layout={layout} benefits={benefits} slim={freeCourses.length === 4} equalPair={isPairLayout} giftStripLabel={giftStripLabel} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FREE ROW — CHOICE_FREE (footer-як-сигнал вибору) */}
      {hasFreeRow && choiceMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: layout === 'compact' ? 20 : 28, alignItems: 'center' }}>
          {/* Paper gift tag — метафора реального подарункового ярлика з дірочкою для стрічки */}
          <div style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(135deg, #FFFCF3 0%, #FAF2DA 55%, #EDDBA5 100%) padding-box, linear-gradient(135deg, #F2C76D 0%, #D4A843 50%, #B8901F 100%) border-box',
            border: '1.5px solid transparent',
            borderRadius: 10,
            padding: '8px 22px 8px 36px',
            boxShadow: '0 8px 20px rgba(164,122,40,0.3), 0 2px 5px rgba(70,48,10,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
            transform: 'rotate(-0.8deg)',
          }}>
            {/* Дірочка для стрічки — темний круг зліва з 3D ефектом */}
            <span aria-hidden style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 11, height: 11, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #1C3A2E 0%, #142A20 70%, #0A1A13 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(164,122,40,0.4)',
            }} />

            {/* Текст: 2 рядки (label + main) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.26em',
                textTransform: 'uppercase' as const, color: 'rgba(70,48,10,0.55)', fontFamily: sysFont,
              }}>
                {yourGiftLabel}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
                color: '#3A2608', fontFamily: sysFont,
              }}>
                {chooseCoursesLabel ?? (freeCount > 1 ? `Оберіть ${freeCount} курси` : 'Оберіть один курс')}
              </span>
            </div>

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
                  {/* UIMP branded wax seal — premium індикатор вибору */}
                  {isSelected && (
                    <span aria-hidden className="bundle-seal" style={{
                      position: 'absolute', top: -12, right: -12, zIndex: 5,
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 25%, #FFFCF3 0%, #FAF2DA 55%, #EDDBA5 100%)',
                      border: '1.5px solid rgba(164,122,40,0.65)',
                      boxShadow: '0 10px 26px rgba(164,122,40,0.4), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -1.5px 3px rgba(164,122,40,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img
                        src="/logo-white.png"
                        alt=""
                        style={{
                          width: 38, height: 38,
                          objectFit: 'contain',
                          mixBlendMode: 'multiply' as const,
                        }}
                      />
                    </span>
                  )}

                  <FreeCourseMini
                    course={c}
                    currency={currency}
                    layout={layout}
                    highlight={isSelected}
                    highlightColor="#D4A843"
                    dimmed={dimmed}
                    benefits={benefits}
                    choiceMode
                    isSelected={isSelected}
                    slim={freeCourses.length === 4}
                    equalPair={isPairLayout}
                    giftStripLabel={giftStripLabel}
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

      {/* Price + CTA — прибираємо коли inline-CTA задіяний (rule #24):
           FIXED_FREE з 1 безкоштовним АБО DISCOUNT з непарним paid ≥ 5 */}
      {!hideBottomCta && (
      <div data-bundle-cta className="bundle-bottom-cta" style={{
        position: 'relative',
        background: 'radial-gradient(140% 180% at 0% 50%, rgba(212,168,67,0.18) 0%, rgba(212,168,67,0) 55%), radial-gradient(140% 180% at 100% 50%, rgba(212,168,67,0.10) 0%, rgba(212,168,67,0) 55%), linear-gradient(135deg, #244838 0%, #1C3A2E 50%, #142A20 100%)',
        borderRadius: layout === 'compact' ? 16 : 18,
        padding: layout === 'compact' ? '8px 16px' : '11px clamp(18px, 2.4vw, 26px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap' as const,
        gap: layout === 'compact' ? 20 : 'clamp(28px, 4vw, 48px)',
        width: 'max-content',
        minWidth: 510,
        minHeight: 104,
        marginTop: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginBottom: 0,
        // У miniature — візуально зменшуємо весь CTA пропорційно (minWidth/fontSize/padding усе разом).
        ...(miniature ? {
          transform: 'scale(0.82)',
          transformOrigin: 'center bottom',
        } : {}),
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
          {displayedSavings > 0 && (
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
                whiteSpace: 'nowrap' as const,
              }}>
                {saveLabel}: {savingsRange
                  ? `${choiceMin.toLocaleString()} – ${choiceMax.toLocaleString()}`
                  : displayedSavings.toLocaleString()} {currency}
              </span>
            </div>
          )}
        </div>

        {/* Right: amber CTA — мега преміум кнопка з gradient + amber halo */}
        <div
          className={`[&>button]:!px-10 [&>button]:!text-[17px] [&>button]:!gap-2.5 [&>button]:!whitespace-nowrap sm:[&>button]:!px-[58px] sm:[&>button]:!text-[19px] sm:[&>button]:!gap-3 [&>button]:!bg-[linear-gradient(135deg,#F2C76D_0%,#D4A843_50%,#B8901F_100%)] [&>button]:!text-[#152C22] [&>button]:!border-[rgba(255,255,255,0.18)] [&>button]:!shadow-[0_12px_32px_rgba(212,168,67,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] hover:[&>button]:!bg-[linear-gradient(135deg,#F5CE78_0%,#DBAF4B_50%,#C19A27_100%)] hover:[&>button]:!shadow-[0_16px_40px_rgba(212,168,67,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] [&>button]:!py-[15px] sm:[&>button]:!py-[19px]`}
          style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', marginRight: 16 }}
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
  highlightColor = '#059669',
  dimmed,
  benefits = [],
  choiceMode = false,
  isSelected = false,
  slim = false,
  equalPair = false,
  giftStripLabel = 'У ПОДАРУНОК',
}: {
  course: BundleCourse;
  currency: string;
  layout: 'full' | 'compact';
  highlight?: boolean;
  highlightColor?: string;
  dimmed?: boolean;
  benefits?: Benefit[];
  choiceMode?: boolean;
  isSelected?: boolean;
  slim?: boolean;
  equalPair?: boolean;
  giftStripLabel?: string;
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
          ? `0 0 0 2px ${highlightColor}, 0 2px 10px rgba(0,0,0,0.1)`
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
            width: 33, height: 33, borderRadius: 8,
            background: `rgba(${course.accentRgb},0.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>
            {course.icon}
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: tagColor, fontFamily: sysFont }}>
            {course.tag}
          </span>
        </div>
        <h4 data-bundle-free-h4 style={{
          fontFamily: sysFont,
          fontSize: 19,
          fontWeight: 700,
          color: '#F5EDD6', lineHeight: 1.3, margin: slim ? '0 0 5px' : equalPair ? '0 0 5px' : '0 0 6px', letterSpacing: '-0.01em',
        }}>
          {course.title}
        </h4>
        <div style={{ width: 26, height: 2, background: tagColor, borderRadius: 2, marginBottom: slim ? 5 : equalPair ? 5 : 6, opacity: 0.5 }} />
        <p data-bundle-desc style={{
          fontSize: 12,
          color: 'rgba(245,237,214,0.5)', lineHeight: equalPair ? 1.65 : 1.6, margin: 0,
          paddingBottom: 4,
          minHeight: equalPair ? 'calc(1.65em * 4)' : 'calc(1.6em * 4)',
          fontFamily: sysFont,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
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
        background: '#065f46',
        padding: '9px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{
          fontFamily: sysFont, fontSize: 9, fontWeight: 500,
          textTransform: 'uppercase' as const, letterSpacing: '0.24em',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1,
        }}>
          {giftStripLabel}
        </span>
        <span aria-hidden style={{
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
        }} />
        <span style={{
          fontFamily: sysFont, fontSize: 12.5, fontWeight: 500,
          color: 'rgba(255,255,255,0.95)', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.01em',
        }}>
          {course.price.toLocaleString()} {currency}
        </span>
      </div>
    </div>
  );
}

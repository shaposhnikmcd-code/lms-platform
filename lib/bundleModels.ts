// Довідник моделей пакетів + mapping bundle→model + compatibility check.
// Шериться між адмінкою (таблиця Моделі + сторінка Пакети) щоб кольорова логіка
// була в одному місці.

export type PairColor = 'blue' | 'green' | 'black';
export type PairTag = { color: PairColor; striped?: boolean };

export type BundleModelId =
  | '1' | '4' | '5' | '6a' | '6b' | '7a' | '7b' | '9' | '10a' | '10b' | '11';

export type BundleModel = {
  id: BundleModelId;
  name: string;
  type: 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE';
  paid: number;
  free: number;
  pickN?: number;
  widthPx: number;
  heightPx: number;
  note: string;
  pairColors: PairTag[];
};

export const MODELS: BundleModel[] = [
  {
    id: '1', name: 'DISCOUNT 2 платних',
    type: 'DISCOUNT', paid: 2, free: 0,
    widthPx: 625, heightPx: 605,
    note: 'Однаковий розмір чи соло, чи в 2-per-row групі. Amber savings pill "💰 Економія". H підвищена 580→605 для rule #38.',
    pairColors: [{ color: 'blue', striped: true }, { color: 'green' }],
  },
  {
    id: '4', name: '3 платних в ряду',
    type: 'DISCOUNT', paid: 3, free: 0,
    widthPx: 730, heightPx: 605,
    note: 'grid-cols-3 внутрішня сітка. H підвищена 580→605 для rule #38.',
    pairColors: [{ color: 'blue' }, { color: 'green', striped: true }],
  },
  {
    id: '5', name: '4 платних (2×2)',
    type: 'DISCOUNT', paid: 4, free: 0,
    widthPx: 730, heightPx: 920,
    note: '2 × 2 внутрішня сітка. Висота форсована до 920px.',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '6a', name: '1 платний + 1 безкоштовний (inline CTA)',
    type: 'FIXED_FREE', paid: 1, free: 1,
    widthPx: 625, heightPx: 740,
    note: '🎯 badge, ціна в CTA-card поряд з безплатним.',
    pairColors: [{ color: 'blue' }, { color: 'green', striped: true }],
  },
  {
    id: '6b', name: '2 платних + 1 безкоштовний (inline CTA)',
    type: 'FIXED_FREE', paid: 2, free: 1,
    widthPx: 625, heightPx: 740,
    note: '🎯 badge, ціна в CTA-card поряд з безплатним.',
    pairColors: [{ color: 'blue' }, { color: 'green', striped: true }],
  },
  {
    id: '7a', name: '1 платний + 2 безкоштовних (gift-row)',
    type: 'FIXED_FREE', paid: 1, free: 2,
    widthPx: 625, heightPx: 920,
    note: 'gift-row 2-col + нижній Price+CTA.',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '7b', name: '2 платних + 2 безкоштовних (gift-row)',
    type: 'FIXED_FREE', paid: 2, free: 2,
    widthPx: 625, heightPx: 920,
    note: 'gift-row + isPairLayout (equalPair).',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '9', name: 'CHOICE 1 платний + пул 3',
    type: 'CHOICE_FREE', paid: 1, free: 3, pickN: 1,
    widthPx: 730, heightPx: 920,
    note: 'Paid стандартизовано до 345px.',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '10a', name: 'CHOICE 1 платний + пул 2',
    type: 'CHOICE_FREE', paid: 1, free: 2, pickN: 1,
    widthPx: 625, heightPx: 920,
    note: 'toggle-вибір, dim / wax-seal / shimmer.',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '10b', name: 'CHOICE 2 платних + пул 2',
    type: 'CHOICE_FREE', paid: 2, free: 2, pickN: 1,
    widthPx: 625, heightPx: 920,
    note: 'toggle-вибір + isPairLayout (equalPair).',
    pairColors: [{ color: 'blue' }, { color: 'green' }],
  },
  {
    id: '11', name: 'CHOICE 2 платних + пул 4',
    type: 'CHOICE_FREE', paid: 2, free: 4, pickN: 2,
    widthPx: 1250, heightPx: 920,
    note: 'slim free cards, 4 в ряду. Соло (занадто широкий для пари).',
    pairColors: [{ color: 'black' }],
  },
];

export const PAIR_COLOR_META: Record<PairColor, {
  label: string;
  dark: string;
  light: string;
  dot: string;
}> = {
  blue:  { label: 'Пара з 625px', dark: 'bg-sky-500/25 border-sky-400/60',       light: 'bg-sky-500/30 border-sky-600/60',       dot: '#38bdf8' },
  green: { label: 'Пара з 730px', dark: 'bg-emerald-500/25 border-emerald-400/60', light: 'bg-emerald-500/30 border-emerald-600/60', dot: '#34d399' },
  black: { label: 'Соло (1200px+)', dark: 'bg-slate-500/30 border-slate-400/50',   light: 'bg-stone-700/25 border-stone-700/60',   dot: '#1c1917' },
};

/** Параметри конкретного бандла, потрібні для мепінгу на модель. */
export type BundleLike = {
  type: 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE';
  paidCount: number;
  freeCount: number;
  pickN?: number;
};

/** Знайти модель що відповідає параметрам бандла. Повертає null якщо комбінація не в таблиці. */
export function matchBundleToModel(b: BundleLike): BundleModel | null {
  return MODELS.find((m) =>
    m.type === b.type &&
    m.paid === b.paidCount &&
    m.free === b.freeCount &&
    (m.pickN ?? null) === (b.pickN ?? null),
  ) ?? null;
}

/**
 * Derives віртуальну модель із layout-правил BundleCard.tsx коли точний match у frozen
 * таблиці не знайдений (напр. DISCOUNT 5-paid, FIXED 3+1, CHOICE 3+4 pickN=2).
 * Дає адекватні widthPx/heightPx + pairColors щоб admin preview працював.
 */
export function deriveVirtualModel(b: BundleLike): BundleModel {
  const { type, paidCount, freeCount, pickN } = b;

  // Висота (зі same логіки BundleCard.tsx `unifyHeight`):
  //  - FIXED_FREE з 1 безкоштовним (inline CTA) → 740
  //  - DISCOUNT 2–3 paid (без free) → 605
  //  - інакше → 920 (включно з DISCOUNT 4+ paid, усі конфіги з free-рядом ≥ 2)
  let heightPx = 920;
  if (type === 'FIXED_FREE' && freeCount === 1) heightPx = 740;
  else if (type === 'DISCOUNT' && freeCount === 0 && (paidCount === 2 || paidCount === 3)) heightPx = 605;

  // Ширина — узгоджена з `nativeBundleWidth` в app/[locale]/courses/page.tsx:
  //   - non-DISCOUNT з paid=2 і free=4 (CHOICE pool=4)       → 1250
  //   - non-DISCOUNT з free=4                                 → 1200
  //   - paid ≤ 2 AND free ≤ 2 AND paid+free ≥ 2              → 625
  //   - інакше (3+ paid; 2 paid з 3 free; 1 paid з 3 free)   → 730
  let widthPx: number;
  if (type !== 'DISCOUNT' && paidCount === 2 && freeCount === 4) widthPx = 1250;
  else if (type !== 'DISCOUNT' && freeCount === 4) widthPx = 1200;
  else if (paidCount <= 2 && freeCount <= 2 && paidCount + freeCount >= 2) widthPx = 625;
  else widthPx = 730;

  // Pair colors — залежно від ширини, solid якщо є frozen model з такою ж шириною+висотою, інакше striped
  const pairColors: PairTag[] = [];
  if (widthPx >= 1200) {
    pairColors.push({ color: 'black' });
  } else {
    const pool: PairColor = widthPx === 730 ? 'green' : 'blue';
    const sameExists = MODELS.some((m) => m.widthPx === widthPx && m.heightPx === heightPx);
    pairColors.push({ color: pool, striped: !sameExists });
    // Також можна в пару з іншою шириною-пулом якщо висота збігається
    const otherPool: PairColor = pool === 'blue' ? 'green' : 'blue';
    const otherWidth = pool === 'blue' ? 730 : 625;
    const otherSameH = MODELS.some((m) => m.widthPx === otherWidth && m.heightPx === heightPx);
    if (otherSameH) pairColors.push({ color: otherPool, striped: false });
  }

  return {
    id: `virtual-${type}-${paidCount}-${freeCount}-${pickN ?? 0}` as unknown as BundleModelId,
    name: `Віртуальна ${paidCount}+${freeCount}${pickN ? ` pickN=${pickN}` : ''}`,
    type,
    paid: paidCount,
    free: freeCount,
    pickN,
    widthPx,
    heightPx,
    note: 'Не в списку frozen Моделей — розраховано за layout-правилами BundleCard.tsx.',
    pairColors,
  };
}

/** Знайти exact model або derive virtual. Завжди повертає щось. */
export function getBundleModelOrVirtual(b: BundleLike): BundleModel {
  return matchBundleToModel(b) ?? deriveVirtualModel(b);
}

/** Перевірити чи два бандли можуть стояти в одному ряду.
 * - canPair: сума ширин ≤ 1460px (практичний ліміт рядка)
 * - quality: solid якщо висоти збігаються, striped якщо різні
 * - sharedColors: які pool-и вони ділять (для відображення)
 */
export type PairResult =
  | { canPair: true; quality: 'solid' | 'striped'; sharedColors: PairColor[] }
  | { canPair: false; reason: 'too-wide' | 'unknown-model' };

const ROW_WIDTH_LIMIT_PX = 1460;

export function canPairBundles(a: BundleLike, b: BundleLike): PairResult {
  const mA = matchBundleToModel(a) ?? deriveVirtualModel(a);
  const mB = matchBundleToModel(b) ?? deriveVirtualModel(b);
  if (!mA || !mB) return { canPair: false, reason: 'unknown-model' };

  // Ширина: обидва мають вміститись поруч
  if (mA.widthPx + mB.widthPx > ROW_WIDTH_LIMIT_PX) {
    return { canPair: false, reason: 'too-wide' };
  }

  // Колір(и) які вони ділять (для візуальної маркіровки)
  const colorsA = new Set(mA.pairColors.filter((p) => p.color !== 'black').map((p) => p.color));
  const colorsB = new Set(mB.pairColors.filter((p) => p.color !== 'black').map((p) => p.color));
  const shared: PairColor[] = [];
  colorsA.forEach((c) => { if (colorsB.has(c)) shared.push(c); });

  // Якість = збіг висот
  const quality: 'solid' | 'striped' = mA.heightPx === mB.heightPx ? 'solid' : 'striped';
  return { canPair: true, quality, sharedColors: shared };
}

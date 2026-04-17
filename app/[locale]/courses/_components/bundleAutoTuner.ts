// ⚠️ ЗАМОРОЖЕНО — не змінювати без явного прохання користувача.
// Усі 19 правил нижче затверджені. Цей файл не редагувати навіть якщо логіка здається
// неоптимальною. Зміни лише якщо користувач явно сказав "онови скрипт" / "додай правило".
//
// Скрипт Пакетів курсів — авто-тюнер + валідатор.
// Працює через CSS variables (встановлюються на [data-bundle-root]), щоб React
// не міг переписати значення під час re-render-ів. JSX читає var(--...) з fallback.
//
// Правила:
//  1. Ширина/висота пакета — з таблиці Моделей, не міняються.
//  2. Скрипт не підганяє розмір самого пакета.
//  3. Платні картки в пакеті однакові за розміром.
//  4. Безкоштовні картки однакові за розміром.
//  5. Заголовок (h3) не чіпаємо.
//  6. Текст усередині картки вміщається та підлаштовується під вільне місце.
//  7. Бенефіти (🎓 Навчання тощо) в 1 рядок, максимально великим шрифтом без ellipsis.
//  8. Прайс-смужка в картці (ЦІНА ПАКЕТУ) — не чіпаємо.
//  9. CTA-блок (💎 + "Купити пакет") вписаний у пакет, дизайн/форма/положення не міняються.
// 10. Ефекти/дизайн пакета не чіпаємо.
// 11. Шрифт опису ≤ шрифт заголовка − 2.
// 12. Шрифт опису однаковий у межах категорії (всіх платних чи всіх безкоштовних).
// 13. Іконка бенефіту того ж fs, що й текст бенефіту.
// 14. CTA padding однаковий по вертикалі і горизонталі (T=B=L=R).
// 15. Шрифт опису максимум 13px.
// 16. CTA-блок має пріоритет. Якщо у висоті пакета не вистачає місця на все —
//     картки (і їхній опис) зменшуються, щоб CTA повністю вмістився.
// 17. CTA-блок має ширину за контентом (fit-content), не тягнеться на всю ширину пакета.
//     Великої порожнечі між ціною і кнопкою не має бути.
//     ⚠️ ОНОВЛЕНО правилом 19: ширину CTA скрипт більше не виставляє — frozen з JSX.
// 18. Опис може бути обрізаним (не весь текст), головне — не затирати benefits-strip
//     і price-strip у картці. Tuner міряє простір до benefits, а не всю картку.
// 19. CTA inviolate — скрипт НЕ модифікує жоден параметр CTA-блоку (ні width, ні padding,
//     ні шрифти). CTA рендериться рівно з тих стилів, що задані в JSX (frozen-дизайн).
//     Картки беруть min(cap, naturalMax) — не розтягуються щоб заповнити пустоту;
//     якщо їх natural контент менший за доступне місце, лишається повітря між cards і CTA.

const MIN_DESC_FS = 10;
const MAX_DESC_FS = 24;
const MIN_BEN_FS = 6;
const MAX_BEN_FS = 14;
const BS_ITERATIONS = 16;
const STABILIZE_PASSES = 2;

function setVar(root: HTMLElement, name: string, value: string) {
  root.style.setProperty(name, value);
}

// Знайти макс fs опису, де desc разом з header НЕ виходить за межі inner-контейнера
// (контейнер = desc.parentElement, тобто div перед benefits-strip-ом).
// Це правило 18: desc може бути обрізаним, але не затирати benefits.
function findMaxFittingDescFs(
  desc: HTMLElement,
  capFs: number,
): number {
  const container = desc.parentElement;
  if (!container) return MIN_DESC_FS;
  let lo = MIN_DESC_FS, hi = Math.min(capFs, MAX_DESC_FS);
  if (hi < lo) return lo;
  let best = lo;
  const orig = desc.style.fontSize;
  for (let i = 0; i < BS_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    desc.style.fontSize = `${mid}px`;
    if (container.scrollHeight <= container.clientHeight + 1) { best = mid; lo = mid; }
    else { hi = mid; }
  }
  desc.style.fontSize = orig;
  return best;
}

// Правила 3+4+16+19: картки ніколи не вищі за свій natural-контент.
// Якщо cap заданий і natural max < cap — лишаємо natural max (картки не розтягуються
// щоб заповнити пустоту). Cap діє тільки як стеля коли natural max > cap.
function equalizeAndGetMaxHeight(
  cards: HTMLElement[],
  resetVarName: string,
  root: HTMLElement,
  cap: number | null,
): number {
  if (cards.length === 0) return 0;
  setVar(root, resetVarName, 'auto');
  const naturalMax = Math.max(...cards.map((c) => c.clientHeight));
  const h = (cap != null && cap > 0) ? Math.min(cap, naturalMax) : naturalMax;
  setVar(root, resetVarName, `${h}px`);
  return h;
}

// Правило 16: обчислити макс висоту рядів карток (paid + free) з урахуванням висоти CTA,
// заголовка, paddings пакета та всіх gap-ів. Картки не можуть тягнути CTA поза межі.
// Повертає єдиний cap для всіх рядів (paid і free ділять простір порівну).
function computeCardHeightCaps(
  root: HTMLElement,
  paidCards: HTMLElement[],
  freeCards: HTMLElement[],
  cta: HTMLElement | null,
): { paid: number | null; free: number | null } {
  if (!cta || (paidCards.length === 0 && freeCards.length === 0)) return { paid: null, free: null };

  const countRows = (cards: HTMLElement[]) => {
    if (cards.length === 0) return 0;
    const xs = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left)));
    return Math.ceil(cards.length / Math.max(1, xs.size));
  };
  const paidRows = countRows(paidCards);
  const freeRows = countRows(freeCards);
  const totalRows = paidRows + freeRows;
  if (totalRows === 0) return { paid: null, free: null };

  const paidContainer = paidCards[0]?.parentElement ?? null;
  const freeContainer = freeCards[0]?.parentElement ?? null;

  // Header — перший дочірній елемент root, який не є grid-контейнером, CTA, STYLE чи абс. позиціонованим
  const header = Array.from(root.children).find((c) => {
    if (c.tagName === 'STYLE') return false;
    if (c === paidContainer || c === freeContainer || c === cta) return false;
    return getComputedStyle(c as HTMLElement).position !== 'absolute';
  }) as HTMLElement | undefined;
  const headerH = header?.offsetHeight || 0;
  const headerMB = header ? parseFloat(getComputedStyle(header).marginBottom) || 0 : 0;

  // Сумуємо всі row-gap у paid/free гридах + margin між paid і free контейнерами
  let gapsTotal = 0;
  if (paidContainer && paidRows > 1) {
    gapsTotal += (paidRows - 1) * (parseFloat(getComputedStyle(paidContainer).rowGap) || 0);
  }
  if (freeContainer && freeRows > 1) {
    gapsTotal += (freeRows - 1) * (parseFloat(getComputedStyle(freeContainer).rowGap) || 0);
  }
  if (paidContainer && freeContainer && paidContainer !== freeContainer) {
    gapsTotal += parseFloat(getComputedStyle(paidContainer).marginBottom) || 0;
    gapsTotal += parseFloat(getComputedStyle(freeContainer).marginTop) || 0;
  }

  const rootCs = getComputedStyle(root);
  const padT = parseFloat(rootCs.paddingTop) || 0;
  const padB = parseFloat(rootCs.paddingBottom) || 0;
  const ctaH = Math.max(cta.offsetHeight, cta.scrollHeight);
  const bundleH = root.clientHeight;

  const available = bundleH - padT - padB - headerH - headerMB - ctaH - gapsTotal;
  const cardH = Math.floor(available / totalRows);
  const safe = Math.max(120, cardH);
  return {
    paid: paidCards.length ? safe : null,
    free: freeCards.length ? safe : null,
  };
}

// Правила 6+11+12+15: target 13px (але не більше titleFs-2), shrink якщо не вміщається, uniform у категорії.
const DESC_FS_TARGET = 13;
function tuneDescsUniform(cards: HTMLElement[], titleFs: number): number {
  if (cards.length === 0) return 0;
  const target = Math.min(DESC_FS_TARGET, Math.max(MIN_DESC_FS, titleFs - 2));
  const maxFitPerCard = cards.map((card) => {
    const desc = card.querySelector<HTMLElement>('[data-bundle-desc]');
    return desc ? findMaxFittingDescFs(desc, target) : target;
  });
  return Math.min(target, ...maxFitPerCard);
}

// Canvas для точного виміру тексту
let measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, fontCss: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = fontCss;
  return ctx.measureText(text).width;
}

// Правила 7+13: тюнимо кожен бенефіт (текст+іконка разом).
function tuneBenefit(ben: HTMLElement, icon: HTMLElement | null) {
  const parent = ben.parentElement;
  if (!parent) return;
  const cs = getComputedStyle(ben);
  const fontFamily = cs.fontFamily;
  const fontWeight = cs.fontWeight;
  const text = ben.textContent || '';
  const parentCs = getComputedStyle(parent);
  const gap = parseFloat(parentCs.gap) || 0;
  const parentPadL = parseFloat(parentCs.paddingLeft) || 0;
  const parentPadR = parseFloat(parentCs.paddingRight) || 0;

  let lo = MIN_BEN_FS, hi = MAX_BEN_FS;
  let best = MIN_BEN_FS;
  for (let i = 0; i < BS_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (icon) icon.style.fontSize = `${mid}px`;
    const iconW = icon ? icon.getBoundingClientRect().width : 0;
    const available = parent.clientWidth - parentPadL - parentPadR - iconW - gap;
    const textW = measureTextWidth(text, `${fontWeight} ${mid}px ${fontFamily}`);
    if (textW + 2 <= available) { best = mid; lo = mid; }
    else { hi = mid; }
  }
  ben.style.fontSize = `${best}px`;
  if (icon) icon.style.fontSize = `${best}px`;
}

export function autoTuneBundle(root: HTMLElement) {
  const title = root.querySelector<HTMLElement>('[data-bundle-title]');
  const titleFs = title ? parseFloat(getComputedStyle(title).fontSize) || 24 : 24;
  const paidCards = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-paid-card]'));
  const freeCards = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-free-card]'));
  const cta = root.querySelector<HTMLElement>('[data-bundle-cta]');

  // Правило 16: спочатку тимчасово "схлопуємо" картки (minHeight auto), щоб CTA
  // отримала натуральну висоту. Потім обчислюємо cap, потім накладаємо.
  // Все в одному JS-тіку (RAF), тому візуально проміжний стан не видно.
  setVar(root, '--tuned-paid-card-h', 'auto');
  setVar(root, '--tuned-free-card-h', 'auto');
  // Force reflow + read CTA natural size
  void root.offsetHeight;

  const caps = computeCardHeightCaps(root, paidCards, freeCards, cta);
  const paidCap = caps.paid;
  const freeCap = caps.free;

  // Кілька passes для стабілізації (flex/grid з minHeight можуть міняти розміри між ітераціями)
  for (let pass = 0; pass < STABILIZE_PASSES; pass++) {
    equalizeAndGetMaxHeight(paidCards, '--tuned-paid-card-h', root, paidCap);
    equalizeAndGetMaxHeight(freeCards, '--tuned-free-card-h', root, freeCap);
    const paidDescFs = tuneDescsUniform(paidCards, titleFs);
    const freeDescFs = tuneDescsUniform(freeCards, titleFs);
    setVar(root, '--tuned-paid-desc-fs', `${paidDescFs}px`);
    setVar(root, '--tuned-free-desc-fs', `${freeDescFs}px`);
  }

  // Правило 19: CTA inviolate — скрипт НЕ модифікує CTA. Frozen-дизайн з JSX лишається як є.
  // (раніше тут було `cta.style.width = 'fit-content'` — це і було порушенням rule 19)

  // Бенефіти — per-element inline style (розмір залежить від довжини тексту, не uniform)
  const benefits = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-benefit-title]'));
  for (const ben of benefits) {
    const parent = ben.parentElement;
    const icon = parent?.querySelector<HTMLElement>('[data-bundle-benefit-icon]') ?? null;
    tuneBenefit(ben, icon);
  }
}

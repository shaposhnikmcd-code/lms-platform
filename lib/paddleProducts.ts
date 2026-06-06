/// Мапа: внутрішній продукт UIMP → Paddle Price ID (USD).
/// Джерело правди про закордонну ціну — Paddle Price-об'єкт, а не наша UAH-ціна.
/// Тому для іноземців ми НЕ конвертуємо UAH live — кожен продукт має власний USD-прайс у Paddle.
///
/// Заповнюється у Фазі 1 після створення Products у Paddle: кладемо JSON у env
/// PADDLE_PRICE_MAP, напр.:
///   PADDLE_PRICE_MAP={"course:psyhosomatyka":"pri_01...","bundle_starter":"pri_02...","yearly-program":"pri_03..."}
///
/// Ключі (productKey):
///   - курс:    "course:<slug>"          (slug = courseId з каталогу)
///   - пакет:   "bundle_<slug>"          (рівно те, що клієнт шле у courseId для пакета)
///   - річна:   "yearly-program"         (YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix)

let cache: Record<string, string> | null = null;

function loadMap(): Record<string, string> {
  if (cache) return cache;
  const raw = process.env.PADDLE_PRICE_MAP;
  if (!raw) {
    cache = {};
    return cache;
  }
  try {
    const parsed = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    console.error('⚠️ PADDLE_PRICE_MAP — невалідний JSON, ігнорую');
    cache = {};
  }
  return cache;
}

/// productKey будується з resolveServerPricing-результату:
///   bundle  → bundleId? ні — клієнтський courseId "bundle_<slug>" вже є ключем
///   course  → "course:<paymentCourseId>"
///   yearly  → "yearly-program"
export function resolvePaddlePriceId(productKey: string): string | null {
  return loadMap()[productKey] ?? null;
}

/// Будує productKey з полів resolved pricing + сирого courseId з body.
export function buildPaddleProductKey(args: {
  kind: 'course' | 'bundle' | 'yearly';
  courseId?: string | null; // сирий з body: "bundle_xxx" або slug курсу
  paymentCourseId?: string | null;
}): string | null {
  if (args.kind === 'bundle') {
    return args.courseId && args.courseId.startsWith('bundle_') ? args.courseId : null;
  }
  if (args.kind === 'course') {
    return args.paymentCourseId ? `course:${args.paymentCourseId}` : null;
  }
  if (args.kind === 'yearly') {
    return 'yearly-program';
  }
  return null;
}

/// Lazy-loaded шрифт файли для PDF-сертифікатів. Читаємо TTF з `public/fonts/` один раз
/// на процес. У Vercel serverless файли з `public/` доступні через `process.cwd()`
/// (public/ є частиною deployment-у лямбди).
///
/// Cormorant Garamond — variable TTF з github.com/google/fonts (wght axis).
/// Inter — variable TTF з opsz+wght axes.
///
/// ВАЖЛИВО: використовуємо ТІЛЬКИ variable TTFs з github — вони parse-яться коректно
/// у pdf-lib fontkit. Static TTFs з Google Fonts CSS API (fonts.gstatic.com) МАЛФОРМЕД
/// для pdf-lib — падають з RangeError при embed.
///
/// embed-имо з `subset: false` бо pdf-lib має баг з subsetting variable TTFs (частина
/// гліфів пропадає). Повний embed ~200-500 KB per font — ~2 MB фінальний PDF.
///
/// Для різних "weights" (SemiBold, Medium, BoldItalic) aliases → той самий variable файл.
/// У результаті всі вони рендеряться у weight=400. Faux-bold робиться в drawTemplate
/// через double-draw.

import fs from 'fs';
import path from 'path';

export type FontKey =
  | 'cormorantItalic'
  | 'cormorantBoldItalic'
  | 'cormorantRegular'
  | 'interRegular'
  | 'interSemiBold'
  | 'interMedium'
  | 'russoOne'
  | 'cinzel'
  | 'bebasNeue'
  | 'bowlbyOne';

const FONT_FILES: Record<FontKey, string> = {
  cormorantItalic: 'CormorantGaramond-Italic.ttf',
  /// Aliased to Italic — faux-bold у drawHeading через double-draw.
  cormorantBoldItalic: 'CormorantGaramond-Italic.ttf',
  cormorantRegular: 'CormorantGaramond-Regular.ttf',
  interRegular: 'Inter-Regular.ttf',
  /// Aliased — static Inter-Medium/SemiBold з Google Fonts malformed у fontkit.
  interMedium: 'Inter-Regular.ttf',
  interSemiBold: 'Inter-Regular.ttf',
  /// Russo One — bold geometric sans, wide proportions. Для heavy 3D treatments.
  russoOne: 'RussoOne-Regular.ttf',
  /// Cinzel — Roman capitals serif (Trajan-style), monumental institute feel
  cinzel: 'Cinzel-Regular.ttf',
  /// Bebas Neue — condensed bold all-caps, tall narrow display
  bebasNeue: 'BebasNeue-Regular.ttf',
  /// Bowlby One — extra-wide bold display
  bowlbyOne: 'BowlbyOne-Regular.ttf',
};

const cache = new Map<FontKey, Uint8Array>();

export function loadFont(key: FontKey): Uint8Array {
  const cached = cache.get(key);
  if (cached) return cached;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', FONT_FILES[key]);
  const buf = fs.readFileSync(fontPath);
  const arr = new Uint8Array(buf);
  cache.set(key, arr);
  return arr;
}

/// Зчитує raster asset з public/ (PNG-підпис, лого тощо). Кешується.
const assetCache = new Map<string, Uint8Array>();

export function loadPublicAsset(relativePath: string): Uint8Array {
  const cached = assetCache.get(relativePath);
  if (cached) return cached;
  const p = path.join(process.cwd(), 'public', relativePath);
  const buf = fs.readFileSync(p);
  const arr = new Uint8Array(buf);
  assetCache.set(relativePath, arr);
  return arr;
}

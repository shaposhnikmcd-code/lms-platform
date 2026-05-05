/// Список країн для форми "Країна проживання" в покупці Річної програми.
/// ISO-3166-1 alpha-2 коди. Росія (RU) свідомо виключена — UIMP не обслуговує.
/// Білорусь (BY) — виключена з тієї ж причини.
/// Назви — українською мовою; для рендерингу в інших мовах використовуй
/// Intl.DisplayNames через `getCountryName(code, locale, fallback)`.

export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  { code: 'UA', name: 'Україна' },
  { code: 'PL', name: 'Польща' },
  { code: 'DE', name: 'Німеччина' },
  { code: 'CZ', name: 'Чехія' },
  { code: 'SK', name: 'Словаччина' },
  { code: 'HU', name: 'Угорщина' },
  { code: 'RO', name: 'Румунія' },
  { code: 'MD', name: 'Молдова' },
  { code: 'LT', name: 'Литва' },
  { code: 'LV', name: 'Латвія' },
  { code: 'EE', name: 'Естонія' },
  { code: 'AT', name: 'Австрія' },
  { code: 'CH', name: 'Швейцарія' },
  { code: 'IT', name: 'Італія' },
  { code: 'ES', name: 'Іспанія' },
  { code: 'PT', name: 'Португалія' },
  { code: 'FR', name: 'Франція' },
  { code: 'BE', name: 'Бельгія' },
  { code: 'NL', name: 'Нідерланди' },
  { code: 'LU', name: 'Люксембург' },
  { code: 'GB', name: 'Велика Британія' },
  { code: 'IE', name: 'Ірландія' },
  { code: 'DK', name: 'Данія' },
  { code: 'SE', name: 'Швеція' },
  { code: 'NO', name: 'Норвегія' },
  { code: 'FI', name: 'Фінляндія' },
  { code: 'IS', name: 'Ісландія' },
  { code: 'BG', name: 'Болгарія' },
  { code: 'GR', name: 'Греція' },
  { code: 'CY', name: 'Кіпр' },
  { code: 'MT', name: 'Мальта' },
  { code: 'HR', name: 'Хорватія' },
  { code: 'SI', name: 'Словенія' },
  { code: 'RS', name: 'Сербія' },
  { code: 'BA', name: 'Боснія і Герцеговина' },
  { code: 'ME', name: 'Чорногорія' },
  { code: 'MK', name: 'Північна Македонія' },
  { code: 'AL', name: 'Албанія' },
  { code: 'XK', name: 'Косово' },
  { code: 'TR', name: 'Туреччина' },
  { code: 'GE', name: 'Грузія' },
  { code: 'AM', name: 'Вірменія' },
  { code: 'AZ', name: 'Азербайджан' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'UZ', name: 'Узбекистан' },
  { code: 'KG', name: 'Киргизстан' },
  { code: 'TJ', name: 'Таджикистан' },
  { code: 'TM', name: 'Туркменістан' },
  { code: 'IL', name: 'Ізраїль' },
  { code: 'AE', name: 'ОАЕ' },
  { code: 'QA', name: 'Катар' },
  { code: 'SA', name: 'Саудівська Аравія' },
  { code: 'EG', name: 'Єгипет' },
  { code: 'MA', name: 'Марокко' },
  { code: 'TN', name: 'Туніс' },
  { code: 'ZA', name: 'Південно-Африканська Республіка' },
  { code: 'US', name: 'США' },
  { code: 'CA', name: 'Канада' },
  { code: 'MX', name: 'Мексика' },
  { code: 'BR', name: 'Бразилія' },
  { code: 'AR', name: 'Аргентина' },
  { code: 'CL', name: 'Чилі' },
  { code: 'PE', name: 'Перу' },
  { code: 'CO', name: 'Колумбія' },
  { code: 'AU', name: 'Австралія' },
  { code: 'NZ', name: 'Нова Зеландія' },
  { code: 'JP', name: 'Японія' },
  { code: 'KR', name: 'Південна Корея' },
  { code: 'CN', name: 'Китай' },
  { code: 'TW', name: 'Тайвань' },
  { code: 'HK', name: 'Гонконг' },
  { code: 'SG', name: 'Сінгапур' },
  { code: 'TH', name: 'Таїланд' },
  { code: 'VN', name: 'Вʼєтнам' },
  { code: 'MY', name: 'Малайзія' },
  { code: 'ID', name: 'Індонезія' },
  { code: 'PH', name: 'Філіппіни' },
  { code: 'IN', name: 'Індія' },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function isValidCountryCode(code: unknown): code is string {
  return typeof code === 'string' && COUNTRY_BY_CODE.has(code);
}

export function getCountry(code: string | null | undefined): Country | null {
  if (!code) return null;
  return COUNTRY_BY_CODE.get(code) ?? null;
}

export function getCountryName(
  code: string | null | undefined,
  locale: string = 'uk',
  fallback?: string,
): string {
  if (!code) return fallback ?? '';
  const local = COUNTRY_BY_CODE.get(code);
  if (local) {
    if (locale === 'uk') return local.name;
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? local.name;
    } catch {
      return local.name;
    }
  }
  return fallback ?? code;
}

/// Emoji-прапор з ISO-2 коду через regional-indicator символи. Працює всюди де
/// шрифт підтримує emoji. Для адмінки використовуємо це замість зовнішніх PNG —
/// нуль HTTP-запитів, миттєвий рендер.
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(A + upper.charCodeAt(0) - 65, A + upper.charCodeAt(1) - 65);
}

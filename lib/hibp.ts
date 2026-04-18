/// Have I Been Pwned — k-anonymity password breach check.
/// Клієнт шле лише перші 5 символів SHA-1 префікса, отримує список suffix→count.
/// Пароль ніколи не покидає сервер, лише 5 символів хеша.
/// Free, без реєстрації, rate limit 1/1.5s (нам не критично).

import crypto from 'crypto';

/// Повертає кількість зливів пароля у HIBP-базі. 0 = не знайдено (безпечно).
/// У разі помилки мережі — повертаємо 0, щоб не блокувати реєстрацію (fail-open).
export async function countPwnedOccurrences(password: string): Promise<number> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'uimp-lms' },
      // 3s timeout — щоб не блокувати реєстрацію на довгі помилки
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 0;

    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);
        return Number.isFinite(count) ? count : 0;
      }
    }
    return 0;
  } catch {
    // Network error / timeout — не блокуємо реєстрацію.
    return 0;
  }
}

/// Helper для invalidate ISR-кеша на всіх локалях одразу.
/// Next.js маршрути під `/[locale]/...` — revalidatePath потребує явний локалізований шлях,
/// тому ми перебираємо всі locale-и. Якщо додаєш нову локаль — дописуй сюди.

import { revalidatePath } from 'next/cache';

// Має збігатися з i18n/routing.ts `locales`. Якщо додаєш нову — дописуй сюди.
const LOCALES = ['uk', 'pl', 'en'] as const;

/// Інвалідувати одну сторінку на всіх локалях. `path` без ведучого `/[locale]`.
/// Приклад: `revalidateLocalized('/courses')` → refresh `/uk/courses`, `/en/courses`, ...
export function revalidateLocalized(path: string): void {
  for (const loc of LOCALES) {
    try {
      revalidatePath(`/${loc}${path.startsWith('/') ? path : `/${path}`}`, 'page');
    } catch {
      // revalidatePath може кидати "page not found" якщо маршрут ще не відвідували —
      // це нормально, ігноруємо.
    }
  }
}

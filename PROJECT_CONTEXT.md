# PROJECT CONTEXT — LMS Platform (UIMP)

## Ролі
- **Іхор** — Product Manager
- **Claude** — розробник

## Правила роботи
- Завжди давати **повний код файлу**, не частину і не одну строчку
- Код і пояснення — **в одному повідомленні**, не окремо
- **Попереджати за 2 задачі** до того як чат починає стискатися (тобто коли до ліміту контексту залишається ~2 задачі — написати: «⚠️ Увага: чат скоро стиснеться, рекомендую зберегти контекст»)

---

## Опис проєкту

**LMS-платформа для UIMP** — Українського інституту психотерапії та душеопікунства. Це повноцінний освітній сайт із публічними сторінками курсів, новинами, особистим кабінетом студента/вчителя/адміна, платіжною системою та мультимовністю.

**Tech stack:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Supabase)
- NextAuth v4 (Google, Facebook, email)
- next-intl v4 (i18n)
- DeepL API (автоматичний переклад контенту сторінок)
- Cloudinary (зображення)
- WayForPay (оплата)
- Resend (email)
- Vercel (деплой)

---

## Структура проєкту

```
lms-platform/
├── app/
│   ├── [locale]/               # Всі публічні сторінки з підтримкою локалі
│   │   ├── layout.tsx          # Locale layout: NextIntlClientProvider, Navbar, Footer
│   │   ├── page.tsx            # Головна сторінка
│   │   ├── courses/
│   │   │   ├── page.tsx        # Список курсів
│   │   │   ├── [courseId]/     # Динамічна сторінка курсу (з БД)
│   │   │   ├── psychology-basics/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── config.ts   # Ціна, SendPulse URL
│   │   │   │   ├── _content/uk.ts   # Контент сторінки (тільки uk)
│   │   │   │   └── _components/PsychologyPricing.tsx
│   │   │   ├── mentorship/         # (аналогічна структура)
│   │   │   ├── psychiatry-basics/  # (аналогічна структура)
│   │   │   ├── sex-education/      # (аналогічна структура)
│   │   │   ├── psychotherapy-of-biblical-heroes/  # (аналогічна структура)
│   │   │   └── Fundamentals-of-Christian-Psychology-2.0/  # (аналогічна структура)
│   │   ├── yearly-program/     # Річна програма (з _components та _content/uk.ts)
│   │   ├── consultations/      # База спеціалістів
│   │   ├── contacts/           # Про нас (багато _components)
│   │   ├── games/              # Терапевтичні ігри
│   │   ├── news/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/         # Динамічна новина (BlockRenderer)
│   │   ├── links/              # Благодійні проєкти
│   │   │   └── connector/      # Замовлення Коннектора
│   │   ├── login/ register/    # Авторизація
│   │   ├── privacy/ terms/ accessibility/  # Документи
│   │   └── payment/success/    # Після оплати
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth
│   │   ├── admin/              # courses, news, teachers, users, sync-divisions
│   │   ├── courses/[courseId]/access/
│   │   ├── wayforpay/          # callback, return, initiate
│   │   ├── nova-poshta/        # міста, вулиці, відділення, вартість
│   │   ├── nova-poshta-eu/     # міста Польщі
│   │   ├── user/me, profile/   # профіль
│   │   ├── lessons/[lessonId]/ # дані уроку
│   │   ├── lesson-progress/    # прогрес
│   │   ├── certificate/        # генерація сертифіката
│   │   ├── contact/            # форма зв'язку
│   │   ├── connector/          # замовлення Коннектора
│   │   ├── messages/           # повідомлення між студентом і вчителем
│   │   └── upload/             # Cloudinary upload
│   └── dashboard/
│       ├── page.tsx            # Редирект по ролі
│       ├── layout.tsx
│       ├── student/            # my-courses, certificates, payments, messages, settings
│       ├── teacher/            # messages, courses/[courseId]/students
│       ├── admin/              # courses, news (з кастомним редактором), users, payments, analytics
│       └── manager/            # замовлення Коннектора
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── LanguageSwitcher.tsx    # Дропдаун uk/pl/en з SVG-прапорами
│   ├── AuthButtons.tsx
│   ├── CookieBanner.tsx
│   ├── WayForPayButton.tsx
│   ├── SendPulseButton.tsx
│   ├── CertificatePDF.tsx
│   ├── home/                   # Hero, About, Directions, WhyUs, CTA, тощо
│   ├── connector/              # OrderForm та всі sub-компоненти (NovaPoshta, Delivery)
│   └── news/                   # BlockRenderer, newsTypes
├── i18n/
│   ├── routing.ts              # defineRouting: locales ['uk','pl','en'], default 'uk', localePrefix 'as-needed'
│   ├── request.ts              # getRequestConfig: підвантажує messages/${locale}.json
│   └── navigation.ts           # Link, useRouter, usePathname, redirect з next-intl
├── messages/
│   ├── uk.json                 # Навігація, Auth, Footer, CookieBanner, HomePage тощо
│   ├── en.json                 # Те саме англійською
│   └── pl.json                 # Те саме польською
├── lib/
│   ├── translate.ts            # DeepL-логіка + кешування (unstable_cache)
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts               # Prisma client
│   └── currency.ts
├── prisma/schema.prisma        # User, Course, Module, Lesson, Enrollment, Payment, Certificate, Message, News...
├── middleware.ts               # next-intl middleware, matcher: /(uk|pl|en)/:path*
├── next.config.mjs             # withNextIntl plugin
└── types/
```

---

## Рішення по Мультимовності — ПОВНІ ДЕТАЛІ

### Загальний підхід: 2 шари

#### Шар 1 — next-intl (UI-рядки, компоненти)
Використовується для всього що є частиною інтерфейсу: навігація, кнопки, форми, auth-модальне вікно, footer, cookie banner.

- Локалі: `uk`, `pl`, `en`
- Дефолтна: `uk` (без префіксу в URL, тобто `/courses` = українська, `/en/courses` = англійська)
- Конфіг: `i18n/routing.ts` з `localePrefix: 'as-needed'`, `localeDetection: false`
- JSON файли: `messages/uk.json`, `messages/en.json`, `messages/pl.json`
- У компонентах: `useTranslations('Navigation')`, `useTranslations('Auth')` тощо
- У серверних компонентах: `getTranslations()`
- Layout: `app/[locale]/layout.tsx` огортає все в `<NextIntlClientProvider messages={messages}>`
- Middleware: `middleware.ts` використовує `createMiddleware(routing)`, matcher виключає `/api`, `/dashboard`, `/_next`

#### Шар 2 — DeepL API (контент сторінок курсів і лендінгів)
Для великих об'єктів контенту (сторінки курсів, yearly-program, contacts, games тощо) використовується автоматичний переклад через DeepL.

**Принцип:**
- Контент пишеться **тільки українською** у файлі `_content/uk.ts`
- Для `pl` та `en` — DeepL перекладає автоматично і результат **кешується на 30 днів** через Next.js `unstable_cache`
- Якщо locale = `uk` — одразу повертається оригінал без запиту до API

**Файл `lib/translate.ts` — ключові функції:**

```
getTranslatedContent<T>(content: T, cacheKey: string)
  → повертає async функцію (locale: string) => Promise<T>
  → якщо locale === 'uk' — повертає оригінал
  → інакше — викликає translateObject() через unstable_cache з revalidate: 2592000 (30 днів)

translateObject<T>(obj: T, targetLang: string): Promise<T>
  → рекурсивно обходить об'єкт, збирає всі рядки
  → відправляє батчами по 50 рядків до DeepL
  → повертає той самий об'єкт зі збереженою структурою

collectStrings() — збирає рядки для перекладу, пропускаючи:
  - URL (http://, /, #color)
  - Числа з + (200+)
  - Порожні рядки
  - Ключі: color, image, href, icon, number, rating, step, value, currency

applyFixes() — після перекладу виправляє некоректні переклади:
  EN: 'Soul Care and Psychotherapy' → 'Ministry and Psychotherapy'
  PL: 'Opieki nad Duszą i Psychoterapii' → 'Służby i Psychoterapii'
  (і ще кілька варіацій)
```

**Як використовується в сторінці курсу:**
```tsx
// app/[locale]/courses/psychology-basics/page.tsx
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';

const getContent = getTranslatedContent(content, 'psychology-basics-page');

export default async function PsychologyBasicsPage({ params }) {
  const { locale } = await params;
  const c = await getContent(locale);
  // c — повністю перекладений об'єкт
  return <main>...</main>;
}
```

**Ця ж схема** діє для: `yearly-program`, `contacts`, `games`, `news` (контент), `consultations`, `links`, `links/connector`, `accessibility`, `privacy`, `terms`.

### LanguageSwitcher
`components/LanguageSwitcher.tsx` — клієнтський компонент:
- Дропдаун з SVG-прапорами (Україна, Польща, Великобританія)
- При виборі мови: `router.replace(pathname, { locale: code })` з `useRouter` та `usePathname` з `@/i18n/navigation`
- Поточна мова виділена темним фоном

### Dashboard
`/dashboard` **не має локалізації** — він виключений з middleware matcher. Там не використовується `[locale]` і немає next-intl обгортки.

### Динамічні сторінки курсів (`/courses/[courseId]`)
Контент береться **з бази даних** (назва курсу, опис — тільки українською). Мультимовність там ще не реалізована.

---

## База даних (Prisma / PostgreSQL)

Основні моделі:
- `User` — roles: STUDENT, TEACHER, ADMIN, MANAGER
- `Course` — title, description, price, slug, published
- `Module` — до курсу
- `Lesson` — до модуля, з videoUrl
- `Enrollment` — зв'язок user ↔ course
- `LessonProgress` — completed boolean
- `CourseProgress` — загальний прогрес
- `Payment` — статус, сума, wayforpay order ID
- `Certificate` — генерується після завершення курсу
- `Message` — між студентом і вчителем
- `News` — блокова структура (JSON blocks), slug, published
- `Subscription` — SendPulse

---

## Поточний стан

Що вже зроблено:
- Повна структура routing з локалями
- next-intl для UI рядків (uk/en/pl JSON повністю заповнені для Navbar, Auth, Footer, CookieBanner)
- DeepL переклад + кешування для всіх сторінок-лендінгів курсів
- LanguageSwitcher в Navbar
- Всі сторінки курсів (6 окремих лендінгів + динамічна [courseId])
- Dashboard (student, teacher, admin, manager)
- Платіжна система (WayForPay)
- Система новин з кастомним block-editor (адмін)
- Генерація сертифікатів (PDF через @react-pdf/renderer)
- Nova Poshta інтеграція (Україна + ЄС)
- Форма замовлення "Коннектора"

Що потребує уваги / в процесі:
- Контент деяких сторінок (messages JSON) для pl/en може бути неповним
- Динамічні курси ([courseId]) — контент з БД тільки українською
- Dashboard — без локалізації (навмисно)

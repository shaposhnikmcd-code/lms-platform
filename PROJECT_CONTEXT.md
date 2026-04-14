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

**LMS-платформа для UIMP** — Українського інституту психотерапії та душеопікунства. Повноцінний освітній сайт із публічними сторінками курсів, новинами, особистим кабінетом студента/вчителя/адміна, платіжною системою та мультимовністю.

**Tech stack:**
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS 3.4
- Prisma 5 + PostgreSQL (Supabase)
- NextAuth v4 (Google, Facebook, email/password)
- next-intl v4 (i18n: uk/pl/en)
- DeepL API (автоматичний переклад контенту)
- Cloudinary (зображення, upload)
- WayForPay (оплата)
- Resend (email)
- Tiptap v3 (rich text editor в news editor)
- @dnd-kit (drag-and-drop в news editor)
- @react-pdf/renderer (генерація сертифікатів)
- Vercel (деплой + cron)

---

## Структура проєкту

```
lms-platform/
├── app/
│   ├── [locale]/               # Всі публічні сторінки з підтримкою локалі
│   │   ├── layout.tsx          # NextIntlClientProvider, Navbar, Footer
│   │   ├── page.tsx            # Головна сторінка
│   │   ├── accessibility/
│   │   ├── additional-materials/
│   │   ├── charity/
│   │   ├── consultations/      # База спеціалістів
│   │   ├── contacts/           # Про нас (з _components)
│   │   ├── courses/
│   │   │   ├── page.tsx
│   │   │   ├── [courseId]/     # Динамічна сторінка курсу (з БД)
│   │   │   ├── psychology-basics/       # _content/uk.ts + _components/
│   │   │   ├── mentorship/
│   │   │   ├── psychiatry-basics/
│   │   │   ├── sex-education/
│   │   │   ├── psychotherapy-of-biblical-heroes/
│   │   │   └── Fundamentals-of-Christian-Psychology-2.0/
│   │   ├── delete-data/
│   │   ├── games/              # Терапевтичні ігри
│   │   ├── links/
│   │   │   └── connector/      # Замовлення Коннектора
│   │   ├── login/ register/
│   │   ├── news/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/         # Рендер через BlockRenderer
│   │   ├── partners/
│   │   ├── payment/success/
│   │   ├── privacy/ terms/
│   │   └── yearly-program/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── register/
│   │   ├── admin/
│   │   │   ├── courses/        # [id]/details, [id]/teachers
│   │   │   ├── news/[id]/
│   │   │   ├── teachers/
│   │   │   ├── users/
│   │   │   ├── payments/
│   │   │   └── sync-divisions/
│   │   ├── courses/[courseId]/access/
│   │   ├── lessons/[lessonId]/
│   │   ├── lesson-progress/
│   │   ├── certificate/
│   │   ├── messages/
│   │   ├── user/me, profile/, profile/password/
│   │   ├── student/teachers/
│   │   ├── teacher/students/
│   │   ├── wayforpay/          # initiate, callback, return
│   │   ├── nova-poshta/        # cities, streets, buildings, warehouses, delivery-cost
│   │   ├── nova-poshta-eu/cities/
│   │   ├── cron/sync-divisions/
│   │   ├── contact/            # форма зв'язку (Resend)
│   │   ├── connector/          # замовлення Коннектора
│   │   └── upload/             # Cloudinary
│   └── dashboard/
│       ├── page.tsx            # Редирект по ролі
│       ├── layout.tsx
│       ├── student/            # my-courses, certificates, payments, messages, settings
│       ├── teacher/            # courses, messages
│       ├── manager/            # замовлення Коннектора
│       └── admin/
│           ├── analytics/
│           ├── courses/
│           ├── users/
│           ├── payments/
│           └── news/           # list + new + [id]/edit
│               └── _components/editor/   # кастомний block editor (детально нижче)
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── LanguageSwitcher.tsx    # Дропдаун uk/pl/en з SVG-прапорами
│   ├── AuthButtons.tsx
│   ├── CookieBanner.tsx
│   ├── GoogleTranslate.tsx
│   ├── WayForPayButton.tsx
│   ├── SendPulseButton.tsx
│   ├── CertificatePDF.tsx
│   ├── _components/AuthModal.tsx
│   ├── home/                   # Hero, About, AboutTetiana, Directions, DiplomasSection,
│   │                           # MissionSection, SocialDropdown, SocialSection,
│   │                           # SupportCard, WhyUs, CTA
│   ├── connector/              # OrderForm, DeliveryInfo, EuDelivery, UkraineDelivery,
│   │                           # DeliveryTypeSelector, DeliveryCostSummary,
│   │                           # CountrySelector, PhoneInput, FlagImg, countries.ts
│   └── news/
│       ├── BlockRenderer.tsx   # Рендер блоків на публічній сторінці
│       └── newsTypes.ts
├── i18n/
│   ├── routing.ts              # locales ['uk','pl','en'], default 'uk', prefix 'as-needed'
│   ├── request.ts
│   └── navigation.ts           # Link, useRouter, usePathname, redirect
├── messages/
│   ├── uk.json
│   ├── en.json
│   └── pl.json
├── lib/
│   ├── translate.ts            # DeepL + unstable_cache (30 днів)
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts
│   └── currency.ts
├── prisma/schema.prisma
├── middleware.ts               # next-intl, виключає /api /dashboard /_next
├── next.config.mjs             # withNextIntl
└── types/
```

---

## Мультимовність — 2 шари

### Шар 1 — next-intl (UI рядки)
- Локалі: `uk` (дефолт, без префіксу), `pl`, `en`
- `localeDetection: false`, `localePrefix: 'as-needed'`
- Файли: `messages/uk.json`, `en.json`, `pl.json`
- Компоненти: `useTranslations('Navigation')`, серверні: `getTranslations()`
- Dashboard **без локалізації** (виключений з middleware matcher)

### Шар 2 — Статичні переклади контенту лендінгів
- Контент пишеться у `_content/uk.ts` (оригінал) + `_content/en.ts` + `_content/pl.ts`
- Всі три файли коммітяться в репозиторій. **DeepL для лендінгів не використовується.**
- При додаванні нового рядка в `uk.ts` потрібно вручну додати такий самий ключ у `en.ts` та `pl.ts`

**`lib/translate.ts`:**
```
getTranslatedContent<T>(content, cacheKey, loaders?) → (locale) => Promise<T>
  uk → повертає оригінал content
  en/pl → викликає loaders[locale]() (dynamic import _content/{locale}.ts)
  якщо loader відсутній або кидає → fallback на uk content
```

**Використання в page.tsx:**
```tsx
import { getTranslatedContent } from '@/lib/translate';
import { content } from './_content/uk';

const getContent = getTranslatedContent(content, 'psychology-basics-page', {
  en: () => import('./_content/en').then(m => m.default),
  pl: () => import('./_content/pl').then(m => m.default),
});
// у компоненті:
const c = await getContent(locale);
```

`transliterateUA(text)` — транслітерація uk → латиниця (для slug генерації) — лишається.

### Шар 3 — DeepL для новин (рантайм)
- Тільки для моделі `News` (динамічний контент з адмінки)
- Поля БД: `titleEn/titlePl/excerptEn/excerptPl/contentEn/contentPl`
- API `POST /api/admin/news` і `PATCH /api/admin/news/[id]` після збереження
  викликає `translateNewsAllLocales()` з `lib/translateNews.ts`, який ходить
  у DeepL і пише переклади в БД одним батчем
- PATCH перекладає тільки якщо у пейлоаді є `title/excerpt/content` —
  toggle `published` чи зміна `imageUrl` квоту не жере
- Фронт `/news` і `/news/[slug]` читає поля за локаллю з fallback на uk
- Якщо DeepL повертає помилку (квота, мережа) — поле лишається `null`,
  фронт показує укр оригінал
- Backfill існуючих новин: `node scripts/backfillNewsTranslations.mjs`

**`lib/translate.ts` додатково експортує:**
```
translateStringWithDeepL(text, lang) → string  // для title/excerpt
translateNewsContent(jsonString, lang) → string // для блоків редактора (HTML mode)
translateContentWithDeepL(obj, lang) → T        // raw escape hatch
```

---

## News Block Editor (адмін)

`app/dashboard/admin/news/_components/editor/`

Кастомний block-based редактор на @dnd-kit. Новина = масив блоків (JSON у полі `blocks` в БД).

**Блоки (6 типів):** `text`, `heading`, `image`, `youtube`, `quote`, `divider`

**Опції блоку:** ширина (25%/33%/50%/66%/75%/100%), вирівнювання, колір

**Компоненти:**
- `NewsEditor.tsx` — головний, автозбереження чернетки в localStorage
- `EditorCanvas.tsx` — полотно для блоків
- `MetaSidebar.tsx` — title, slug, excerpt, category, imageUrl, published
- `BlockPalette.tsx` — вибір типу нового блоку
- `BlockItem.tsx` + `BlockItemHeader.tsx` — рендер блоку
- `DropZones.tsx`, `GhostBlock.tsx`, `OverlayItem.tsx`, `BlockItemSnapGuide.tsx` — DnD UI
- `blocks/TextEditor.tsx` — Tiptap rich text
- `blocks/HeadingEditor.tsx`
- `blocks/ImageEditor.tsx`
- `blocks/YoutubeEditor.tsx`
- `blocks/QuoteEditor.tsx`
- `TiptapEditor.tsx` — standalone Tiptap wrapper
- `types.ts` — типи блоків
- `useBlockManager.ts` — CRUD для блоків
- `useEditorDnd.ts` — DnD логіка
- `useBlockResize.ts` — ресайз блоків

**Публічна сторінка:** `components/news/BlockRenderer.tsx` рендерить ті самі блоки.

---

## База даних (Prisma / PostgreSQL)

| Модель | Призначення |
|--------|-------------|
| `User` | ADMIN / MANAGER / TEACHER / STUDENT |
| `Account` | OAuth (NextAuth) |
| `Session` | Сесії |
| `Course` | title, description, price, slug, published |
| `CourseTeacher` | Зв'язок вчитель ↔ курс |
| `Module` | Модулі курсу (з ordering) |
| `Lesson` | Уроки (videoUrl, підтримка YouTube/Vimeo/Sendpulse/Local) |
| `Enrollment` | Студент ↔ курс |
| `CourseProgress` | Загальний прогрес |
| `LessonProgress` | Прогрес уроку (watchedTime, completed) |
| `Message` | Повідомлення між юзерами |
| `Payment` | WayForPay: orderId, amount, status |
| `Certificate` | Сертифікат після завершення курсу |
| `Subscription` | monthly / 6-month / yearly |
| `News` | blocks (JSON), slug, category (NEWS/ANNOUNCEMENT/ARTICLE), published |
| `ConnectorOrder` | Замовлення продукту "Коннектор" |
| `NovaPostDivision` | Відділення Нової Пошти (кешовані) |
| `NovaPostSyncLog` | Логи синхронізації Нової Пошти |
| `PaymentCallbackLog` | Лог усіх WayForPay callback-ів (course/bundle/connector) |

---

## Логування платежів (ВАЖЛИВО)

**Усі callback-и WayForPay пишуться в таблицю `PaymentCallbackLog`** — і для курсів, і для пакетів, і для гри Конектор. Лог пишеться **ЗАВЖДИ**: навіть при невірному підписі, при retry, при idempotent skip, при помилці.

Джерело: [`app/api/wayforpay/callback/route.ts`](app/api/wayforpay/callback/route.ts)

Поля логу:
- `kind` — `course` / `bundle` / `connector` / `unknown` (визначається за префіксом `orderReference`)
- `orderReference`, `transactionStatus`, `amount`, `currency`, `clientEmail`
- `ip`, `userAgent` — щоб бачити звідки прийшов callback
- `signatureValid` — пройшла HMAC-перевірка чи ні
- `prevStatus` — статус Payment/ConnectorOrder **до** цього callback (виявлення ретраїв)
- `actionsTaken` — `payment:updated`, `enrollment:<slug>`, `sendpulse:sent(N)`, `skip:already_paid`, `connector:paid`, тощо
- `sendpulseSlugs` — слаги курсів, по яких реально пішли events в SendPulse
- `skipped` + `skipReason` — `already_paid` / `invalid_signature` / `payment_not_found` / `missing_course_and_bundle`
- `rawPayload` — повне тіло запиту від WFP (JSON)
- `error` — повідомлення помилки якщо була

**Ідемпотентність:** якщо Payment/ConnectorOrder уже `PAID` — НЕ повторюємо enrollment і НЕ шлемо SendPulse events повторно (тільки пишемо лог з `skipped=true, skipReason=already_paid`). Це захищає від дублікатів при ретраях WFP.

Як передивлятись логи:
```bash
# Останні 20 callback-ів
node -e "const p=require('@prisma/client');const c=new p.PrismaClient();c.paymentCallbackLog.findMany({orderBy:{createdAt:'desc'},take:20}).then(r=>console.table(r.map(x=>({t:x.createdAt.toISOString(),kind:x.kind,status:x.transactionStatus,amt:x.amount,prev:x.prevStatus,act:x.actionsTaken,sp:x.sendpulseSlugs,ip:x.ip,ref:x.orderReference})))).finally(()=>c.\$disconnect())"
```

---

## Що зроблено

- Повна структура routing з локалями (uk/pl/en)
- next-intl для UI + DeepL для контенту лендінгів
- 6 лендінгів курсів + динамічний `[courseId]`
- Dashboard: student, teacher, admin, manager
- WayForPay (ініціація, callback, підтвердження)
- News block editor (адмін) + BlockRenderer (публічна)
- Генерація сертифікатів PDF (@react-pdf/renderer)
- Nova Poshta API (Україна: міста/вулиці/будинки/відділення/вартість + ЄС)
- Форма "Коннектор" з доставкою
- Повідомлення студент ↔ вчитель
- Cloudinary upload
- Cron: `/api/cron/sync-divisions` (Vercel cron)

## Що потребує уваги / не зроблено

- Мультимовність для динамічних курсів `[courseId]` — контент тільки uk
- Dashboard — без локалізації (навмисно)
- messages JSON для pl/en може бути неповним для деяких сторінок

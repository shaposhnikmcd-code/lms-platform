# LMS Platform — rules for Claude

## Local dev workflow — ЗАВЖДИ

Локальна розробка йде на ізольованій Neon-гілці `dev`, щоб експерименти не торкали живий сайт.

**Шари:**
- `next dev` (localhost) → Neon branch **`dev`** (`ep-sparkling-wave-alq11hyy`) — з `.env.local`.
- Гілка `pre-production` → Vercel preview на pre.uimp.com.ua → **прод Neon** (`ep-odd-night-alip82dn`).
- Гілка `main` → Vercel prod на uimp.com.ua → **прод Neon**.

**Git flow (обов'язковий):**
1. Зміни → тест локально (`npm run dev`).
2. Коли ок → коміт → `git push origin pre-production` → фінальний тест на pre.uimp.com.ua з реальними даними.
3. Merge `pre-production → main` → push → деплой на uimp.com.ua.

**Prisma CLI:** читає тільки `.env`, не `.env.local`. Використовуй npm-скрипти (через dotenv-cli):
- `npm run db:status` — статус міграцій на dev-branch
- `npm run db:migrate` — `prisma migrate dev` на dev-branch
- `npm run db:deploy` — `prisma migrate deploy` на dev-branch
- `npm run db:studio` — Prisma Studio на dev-branch
- `npm run db:push` — `prisma db push` (schema без міграції)

**Коли використати прод-БД локально:** тимчасово закоментувати `DATABASE_URL`/`DIRECT_URL` у `.env.local` (fallback на `.env`). Робити тільки для readonly-перевірок, НЕ мутувати.

**Reset dev branch:** Neon console → Branches → `dev` → "Reset from parent" (синхронізує з prod).

## Frozen bundle designs — DO NOT modify without explicit request

Ці дизайни пакетів затверджені користувачем. НЕ міняти розміри/пропорції/CSS без явного прохання.

1. **1 пакет з 2 курсами** (full layout) — `BundleCard.tsx`, `courses.length === 2` + 1 пакет.
2. **2 пакети по 2 курси** (compact) — 2-col grid з `courses.length === 2`.
3. **3 пакети по 2 курси** (compact, 3-col grid) — кожен пакет з 2 курсами.
4. **1 пакет DISCOUNT з 3 платними** (full, `grid-cols-3`) — внутрішня сітка заморожена.
5. **1 пакет DISCOUNT з 4 платними** (full, `2×2 grid`) — лейаут заморожений.
6. **Пакет FIXED_FREE з 1 безкоштовним курсом (1 або 2 платних)** — блок 625px, grid-cols-2: FreeMini `equalPair` + CTA-картка з 🎯 ГОТОВИЙ НАБІР badge, hero gradient ціна, кнопка "Купити пакет" `text-[18px] px-4 py-3 max-w-[90px]` в 2 рядки центровано. Стандартний нижній Price+CTA прихований. marginBottom: 0 на free-row.
7. **Пакет FIXED_FREE з 2 безкоштовними** — gift-row 2-col grid + Price+CTA.
8. **Нижній Price+CTA блок** (86% ширини, amber gradient + golden CTA з halo) — заморожений.
9. **Пакет 🎲 Безкоштовний на Вибір з 1 платним + 3 безкоштовних на вибір** — гілка `isLargePaid` (ширина 58%/64%, h4 до 32px, опис 17px, прайс-смужка 9×16 padding + число 21px, hover free-карток з `translateY(-2px) !important` + light shadow). Всі три free-картки однакової висоти через flex-chain. Нижній Price+CTA — стандартний frozen блок (без maxWidth override, ширина за `width: fit-content` з JSX, скрипт CTA не торкає — rule 19).
10. **Пакет 🎲 Безкоштовний на Вибір з пулом = 2** (1 чи 2 платних + 2 на вибір) — `grid-cols-1 sm:grid-cols-2` free-row, toggle-вибір, dim/wax-seal/shimmer ефекти, нижній Price+CTA стандартний. Реюзає hover CSS + `isLargePaid` розміри.
11. **Пакет 🎲 Безкоштовний на Вибір з пулом = 4** (2 платних + 4 на вибір) — обгортка **1250px**, ряд платних 705px (центр), 4 free `sm:grid-cols-2 lg:grid-cols-4` повна ширина. Платні — гілка `isMidPaid` (h4 до 22px, опис 14px, іконка 36). Free — `slim={true}` (паддінг 20×18, h4 до 16px, опис 11px, minHeight 4 рядки). H3 заголовок — `paddingLeft/Right: clamp(60px, 9%, 110px)` (починається з середини відступу між краєм блоку і краєм курсів).
12. **Пакет 2 платних + 1 або 2 безкоштовних — уніфікований isPairLayout** — обгортка 745px, `isPairLayout` + `isEqualPair`. Безкоштовні картки `equalPair={isPairLayout}` (паддінг 22×22×20, minHeight прибрано). Benefits text 8.5px. Price+CTA: стандартний frozen блок з `justifyContent: space-between` + `flexWrap: nowrap`, кнопка `alignSelf: flex-end` `py-4 sm:py-5`. **Скоуп**: CHOICE_FREE 2+1, CHOICE_FREE 2+2, FIXED_FREE 2+2. **FIXED_FREE 2+1** і **FIXED_FREE 1+1** — НЕ цей кейс, перекрито пунктом #6 (inline CTA-card 625px).
13. **Пакет DISCOUNT з 2 платними курсами** — блок 625px, Price+CTA `maxWidth: 480px`, savings pill `💰 Економія` в **amber** (не emerald): bg `rgba(212,168,67,0.12)`, border `0.35`, text `rgba(242,199,109,0.9)`. Кнопка "Купити пакет" `[&>button]:!py-[18px] sm:[&>button]:!py-[22px]` (вища за дефолт). **Benefits-смужка** (isDiscount2Paid, спільна для DISCOUNT 2-paid і 3-paid): іконка 11px, текст 9px (8px якщо length > 16, для "Підтримка кураторів"), gap 2 padding 8×3, nowrap+ellipsis.

## Кольори ЕКОНОМІЯ/SAVINGS

Emerald (`#059669`, `#6ee7b7`) виключено з палітри для "Економія"/"Savings" акцентів. Використовувати **amber** `rgba(212,168,67,...)` / `#D4A843` / `#F2C76D`. Emerald OK для семантики "Безкоштовно/Подарунок" (type pill, У ПОДАРУНОК footer).

## Auto-title BundleForm (CHOICE_FREE)

- `choicePickN >= 2`: `"{paid} та {N} Безкоштовних на вибір {free1, free2, ...}"` (коми між всіма).
- `choicePickN === 1`: `"{paid} та на вибір {free1 або free2 або ...}"` (стара поведінка).
- Реалізація: [BundleForm.tsx:322-340](app/dashboard/admin/bundles/_components/BundleForm.tsx#L322-L340).

## Draft toast

`#bundle-toast-slot` в [new/page.tsx](app/dashboard/admin/bundles/new/page.tsx) і [[id]/page.tsx](app/dashboard/admin/bundles/%5Bid%5D/page.tsx) — `fixed top-36 right-5 z-30` (під floating DashboardBackButton).

Деталі кожного кейсу — в [memory/](C:\Users\Shapo\.claude\projects\c--Users-Shapo-lms-platform\memory\) (`feedback_bundle_*_frozen.md`).

## Bundle title — no clamp

`<h3>` заголовок пакета НЕ обрізати (без `WebkitLineClamp`, `ellipsis`, `maxHeight`).

## CHOICE_FREE selected-індикатор — UIMP branded wax seal

Коли користувач вибирає безкоштовний курс у CHOICE_FREE пакеті (будь-який pool size), картка отримує:
1. **Amber ring** `#D4A843` навколо картки (через `highlightColor` prop FreeCourseMini — замість старого emerald `#059669`)
2. **Branded wax seal** у правому верхньому куті: кремово-білий круг 48×48 з золотим rim (`1.5px rgba(164,122,40,0.65)`) і UIMP лого всередині (`/logo-white.png`, 38×38, `mixBlendMode: multiply` щоб білий фон лого зливався з кремовим фоном медальйону).

Реалізація: [BundleCard.tsx:602-621](app/[locale]/courses/_components/BundleCard.tsx#L602-L621). Entrance animation `bundleSealIn` збережена (scale+rotate -6°). Зелений `checkmark` видалено (користувач вважав його не-преміальним).

## Solo paid card — max 390px

Якщо в пакеті один ряд має ≥3 курсів, а інший ряд рівно **1 курс** — той одиночний курс не може бути ширшим за **390px**. Застосовується до paid `<Link>` через `maxWidth: 390` коли `courses.length === 1 && freeCourses.length >= 3` ([BundleCard.tsx:314](app/[locale]/courses/_components/BundleCard.tsx#L314)).

Скоуп: CHOICE_FREE/FIXED_FREE 1+3 і 1+4. НЕ застосовується до 1+1, 1+2, 2+N, DISCOUNT-only лейаутів.

## Уніфікований CTA-блок (frozen, всі бандли)

CTA-блок ідентичний у всіх бандлах (перекриває попередні frozen-конфіги #11 640px / #12 isPairLayout py-4+flex-end / #13 DISCOUNT-2-paid 480px+py-[22px]):

- **width**: `510px` (фіксована)
- **minHeight**: `104px`
- **padding**: `11px clamp(18px, 2.4vw, 26px)` (full) / `8px 16px` (compact)
- **Центрування**: `marginLeft: auto, marginRight: auto, marginTop: auto` (притискається до низу пакета)
- **Layout**: `display: flex, alignItems: center, justifyContent: space-between, flexWrap: nowrap`
- **gap**: `clamp(28px, 4vw, 48px)` (full) / `20px` (compact)

Кнопка "Купити пакет":
- `text-[17px] sm:text-[19px]`, `px-10 sm:px-[58px]`, `py-[15px] sm:py-[19px]`, `gap-2.5 sm:gap-3`
- `whitespace-nowrap` (гарантовано 1 рядок)
- Button-wrapper має `marginRight: 16` (кнопка зсунута ліворуч від правого краю CTA на 16px)
- Amber gradient BG + golden halo shadow — без змін

Pill **💰 Економія: X грн** — показується на ВСІХ бандлах:
- DISCOUNT: `savings = sum(paid) − bundle_price`
- FIXED/CHOICE: `giftValue = sum(freeCourses.price)` — вартість подарункових курсів

Реалізація: [BundleCard.tsx:670-780](app/[locale]/courses/_components/BundleCard.tsx#L670-L780). Auto-tuner CTA НЕ торкає (rule 19).

**Виняток (Inline square CTA-card)** — коли в ОСТАННЬОМУ ряду пакета рівно 1 курс, замість нижнього rectangle CTA використовується inline квадратна CTA-картка (🎯 ГОТОВИЙ НАБІР badge, hero ціна, кнопка "Купити пакет"), яка стоїть ПОРЯД з цим одним курсом у grid-cols-2. Нижній rectangle CTA прихований. Поточні кейси: FIXED_FREE з 1 безкоштовним (1+1, 2+1, 3+1, ...).

## Bundle auto-tuner заморожено

Файл [app/[locale]/courses/_components/bundleAutoTuner.ts](app/[locale]/courses/_components/bundleAutoTuner.ts) з 37 правилами для пакетів — **не редагувати** без явного прохання. Також не чіпати `data-bundle-*` маркери в [BundleCard.tsx](app/[locale]/courses/_components/BundleCard.tsx) та пов'язані CSS variables.

## Dashboard — uk-only

`/dashboard/*` свідомо не локалізується, тільки укр.

## Admin/Manager test price — 1 ₴ (2 ₴ для yearly)

Для ролей `ADMIN` і `MANAGER` оплата через WFP завжди йде за символічною ціною **1 ₴** (для Річної програми `yearly` plan — **2 ₴**, бо WFP відхиляє 1 ₴ на цьому продукті). Логіка: [app/api/wayforpay/route.ts:56-60](app/api/wayforpay/route.ts#L56-L60). Перевіряється через `session.user.role` на сервері — клієнт підробити не може. Призначення: тестування callback-флоу (SendPulse events, enrollment upsert, листи) без реальних списань. Якщо в `Payment.amount = 1` для bundle/course або `= 2` для yearly — це адмін/менеджер-тест, а не реальний продаж.

## Річна програма — підписка + автосписання

Повноцінна підписка з контролем на нашій стороні. Деталі:

- **Модель даних**: `YearlyProgramSubscription` + `YearlyProgramSubscriptionEvent` в [schema.prisma](prisma/schema.prisma); лінк на `Payment.yearlyProgramSubscriptionId`.
- **Плани**: `YEARLY` (15000 грн, доступ 365 днів) і `MONTHLY` (2200 грн, +30 днів за успішне авто-списання).
- **Статуси**: `PENDING` → `ACTIVE` → `GRACE` (7 днів після expiresAt, `YEARLY_PROGRAM_CONFIG.graceDays`) → `EXPIRED` / `CANCELLED`.
- **Флоу перший платіж**: [CoursePurchaseModal](components/CoursePurchaseModal.tsx) → `/api/wayforpay` детектить префікс `yearly-program_` / `yearly-program-monthly_` через [yearlyProgramConfig.ts](lib/yearlyProgramConfig.ts) → створює/знаходить підписку (`PENDING`), для MONTHLY додає `regularOn=1, regularMode=monthly, dateBegin, dateEnd` у payload (токенізація + автосписання на стороні WFP).
- **Callback**: `handleYearlyProgramCallback` в [callback/route.ts](app/api/wayforpay/callback/route.ts) — для `Approved` активує підписку, продовжує `expiresAt`, зберігає `recToken`, шле SendPulse event (відкриття доступу), лукапить `sendpulseStudentId`. Для рекурентних callback-ів (orderReference не знайдено) — створює новий Payment і лінкує з існуючою MONTHLY підпискою.
- **Cron**: [/api/cron/yearly-subscriptions](app/api/cron/yearly-subscriptions/route.ts) щодня о 04:00 — `ACTIVE→GRACE` при `expiresAt<now`, `GRACE→EXPIRED` після `graceDays` (виклик [SendPulse `closeAccessInCourse`](lib/sendpulse.ts) → `DELETE /students/{id}/{courseId}`), нагадування за 3 та 1 день перед `expiresAt` + лист при закритті. Авторизація `Authorization: Bearer ${CRON_SECRET}`.
- **SendPulse Education API**: OAuth2 (`SENDPULSE_API_KEY` + `SENDPULSE_SECRET_KEY` в `.env`), токен кешується на 1 год, закриття через `DELETE /students/{studentId}/{courseId}`. `studentId` знаходиться через `POST /students/by-course/{courseId}` пошуком по email (інтегровано в callback і cron).
- **Env**: `SENDPULSE_YEARLY_COURSE_ID` — числовий ID курсу в SendPulse (треба заповнити з кабінету SendPulse → Автоматизація → Онлайн-курси → URL). Без нього закриття в SendPulse пропускається; локальне `EXPIRED` ставиться все одно. `WAYFORPAY_MERCHANT_PASSWORD` — для `regularApi REMOVE` при скасуванні.
- **Адмінка**: `/dashboard/admin/yearly-program` — таблиця з KPI, фільтрами (план/статус/пошук), expandable row (клік по chevron) з трьома панелями: **Дії** (Продовжити/Скасувати/Закрити доступ/Відкрити знову/Видалити — POST на `/api/admin/yearly-program/[id]`), **Платежі** (список orderReference+сума+статус), **Події** (повний лог з `YearlyProgramSubscriptionEvent`). Endpoint `GET /api/admin/yearly-program/[id]/details` тягне все це разом.

Палітра `Savings`-елементів — amber, не emerald (Правило вже зафіксоване вище для пакетів, стосується і цієї секції).

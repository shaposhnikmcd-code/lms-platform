# LMS Platform — rules for Claude

## Питання — тільки текстом

НЕ використовувати `AskUserQuestion` (popup з варіантами вибору). Усі уточнення задавати звичайним текстом у чаті — користувач відповість текстом. Це стосується і "виберіть один з варіантів", і "yes/no" — все текстом.

## Курси — самостійне проходження

Усі курси UIMP — **самостійні**, без стартової дати чи розкладу. Студент проходить у власному темпі після покупки. У будь-яких текстах (лендінги, листи, плейсхолдери, UI, описи) **не вживати** формулювання типу "курс скоро стартує", "запуск", "початок навчання", "розклад", "потік". Доступ відкривається одразу після оплати і є **безстроковим** — у текстах не обіцяти жодного терміну ("180 днів", "6 місяців", "пів року"), формулювати як "Безстроковий доступ до матеріалів" / "Lifetime access to materials" / "Bezterminowy dostęp do materiałów".

Виняток — **Річна програма** (`/yearly-program`). Це cohort-based навчання з реальним стартом, запусками, тиждневими потоками. Там слова "запуск" / "cohort" / "початок програми" — доречні.

## Local dev workflow — ЗАВЖДИ

Локальна розробка йде на ізольованій Neon-гілці `dev`. Pre.uimp ізольований у власний Neon-проєкт `uimp-pre` 2026-05-21 — більше не пише в прод.

**Три повністю окремі БД:**
- `next dev` (localhost) → Neon branch **`dev`** на проєкті `lms-platform` (`ep-sparkling-wave-alq11hyy`), креди в `.env.local` (gitignored).
- Гілка `pre-production` → Vercel preview на pre.uimp.com.ua → **окремий Neon-проєкт `uimp-pre`** (`ep-proud-paper-aliphx2d`), env vars у Vercel scope=Preview.
- Гілка `main` → Vercel prod на uimp.com.ua → **прод Neon** проєкт `lms-platform` (`ep-odd-night-alip82dn`), env vars scope=Production.

**Vercel env vars** (Settings → Environment Variables):
- `DATABASE_URL` × 2: Production → прод-pooled; Preview → pre-pooled.
- `DIRECT_URL` × 2: Production → прод-direct; Preview → pre-direct.
- Прод- і pre-credentials повністю окремі.

**Перевірка до якої БД конектиться який deploy:**
- Локально: `node scripts/whoami-db.mjs` (host/dbName/tag/users count).
- Runtime (pre/prod): `GET /api/admin/db-info` (admin-only, повертає host/tag/vercelEnv/vercelGitBranch).

**Зовнішні інтеграції — спільні між pre і prod:**
- **WayForPay** — той самий merchant, callback URL динамічний з host header (pre.uimp callback → пише у pre-БД).
- **Telegram bot** — один токен/webhook зареєстрований на uimp.com.ua → pre-події приходять на прод-сервер і безпечно відхиляються (subscription не знайдеться у прод-БД).
- **SendPulse** — фіксований Events URL, тестові оплати на pre реєструють студентів у проді-SP-кабінеті (свідоме рішення для end-to-end тестування воронки).

**Git flow (обов'язковий):**
1. Зміни → тест локально (`npm run dev`, працює з dev-branch даних).
2. Коли ок → коміт → `git push origin main:pre-production` → фінальний тест на pre.uimp.com.ua **в окремій pre-БД, без впливу на прод**.
3. `git push origin main` → деплой на uimp.com.ua.

### Env loading — три entry point-и

Будь-який код, що читає `DATABASE_URL`, проходить через один із трьох шляхів:

| Entry point | Що читає env | Як сконфігуровано |
|---|---|---|
| `next dev` / runtime | Next.js framework auto-load: `.env.local > .env` | вбудовано, нічого не робити |
| Prisma CLI (`migrate`, `studio`, `db push`) | Тільки `.env` за замовчуванням | обгорнуто в `npm run db:*` через `dotenv-cli` |
| Standalone `.mjs` скрипти в [scripts/](scripts/) | Через [scripts/_db.mjs](scripts/_db.mjs) singleton | всі 10 скриптів імпортують `prisma` звідти |

**Команди для Prisma CLI** (ЗАВЖДИ через `npm run db:*`, не напряму `npx prisma`):
- `npm run db:status` — статус міграцій
- `npm run db:migrate` — `prisma migrate dev` (створює нову міграцію)
- `npm run db:deploy` — `prisma migrate deploy` (застосовує існуючі)
- `npm run db:studio` — Prisma Studio
- `npm run db:push` — `prisma db push`
- `npm run db:seed` — `prisma db seed` (виконує [prisma/seed.ts](prisma/seed.ts) через `tsx`)

**Команди для скриптів:** `node scripts/xxx.mjs` — просто запускай, `_db.mjs` розрулює env автоматично.

### Scripts architecture

Всі `.mjs` скрипти в [scripts/](scripts/) мають імпортувати prisma із shared helper, а НЕ створювати `new PrismaClient()`:

```js
import prisma from './_db.mjs';
// ...
```

**Чому `_db.mjs` робить `config({ override: true })`:** `@prisma/client` має власний `dotenv` auto-load на import-time (читає `.env` → встановлює prod-URL у `process.env`). Оскільки ES-імпорти hoisted, це відбувається **до** того як `_db.mjs` викликає свій `config()`. Без `override: true` dotenv не перезапише prod-URL і скрипти б'ють у прод. НЕ ПРИБИРАЙ `override: true` з `_db.mjs` — це не косметика, а load-order-фікс.

**`lib/prisma.ts`** (для Next.js runtime) `override` НЕ потрібен, бо Next.js вантажить env **до** імпорту Prisma.

### Коли треба проти прода локально (рідко, для діагностики)

Тимчасово закоментувати `DATABASE_URL`/`DIRECT_URL` у `.env.local` (fallback на `.env`). Тільки readonly-перевірки, НЕ мутувати. Після — розкоментувати.

### Reset dev-branch

Neon console → Branches → `dev` → "Reset from parent" (синхронізує з прод-даними). Корисно коли на dev-branch накопичилось тестове сміття.

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

## Admin Платежі / Логи — нейминг колонок Тип/Вид

Симетрична таблиця між `/dashboard/admin/payments` (Тип / Вид) і `/dashboard/admin/payment-logs` (Тип / Вид). Назви мають збігатись у обох views.

| Продукт | Тип | Вид |
|---|---|---|
| Курс | Курс | назва курсу |
| Пакет | Пакет | 📦 назва пакету |
| Yearly (plan=YEARLY) | Річна програма | Річна підписка |
| Monthly РАЗОВА (autoRenew=false) | Річна програма | Місячна на 1 міс. |
| Monthly АВТОПЛАТІЖ (autoRenew=true) | Річна програма | Місячна Автоплатіж |
| Конектор | Гра | 🧩 Конектор |

Спелінг продукту — **"Конектор"** (1 н), не "Коннектор". Виняток: коментарі в [BundlesView.tsx](app/dashboard/admin/bundles/_components/BundlesView.tsx) і [BundleForm.tsx](app/dashboard/admin/bundles/_components/BundleForm.tsx) — там "Коннектор" означає CSS-з'єднувач rail↔form, інше значення.

Реалізація:
- Платежі productLabel: [payments/page.tsx:46-51](app/dashboard/admin/payments/page.tsx#L46-L51) і [page.tsx:86](app/dashboard/admin/payments/page.tsx#L86).
- Логи resolveProductName: [payment-logs/page.tsx:117-133](app/dashboard/admin/payment-logs/page.tsx#L117-L133).
- TypePill labels: [PaymentsView.tsx:329-334](app/dashboard/admin/payments/_components/PaymentsView.tsx#L329-L334) і [PaymentLogsView.tsx:495-500](app/dashboard/admin/payment-logs/_components/PaymentLogsView.tsx#L495-L500).

Filter dropdown в Платежах і таб у Логах для конектора використовують label **"Конектор"** (specific product), а не "Гра" — тому що в БД одна категорія, фільтрація по "Гра" поки що еквівалентна "all-connectors".

## Admin/Manager test price — 1 ₴ (2 ₴ для yearly)

Для ролей `ADMIN` і `MANAGER` оплата через WFP завжди йде за символічною ціною **1 ₴** (для Річної програми `yearly` plan — **2 ₴**, бо WFP відхиляє 1 ₴ на цьому продукті). Логіка: [app/api/wayforpay/route.ts:56-60](app/api/wayforpay/route.ts#L56-L60). Перевіряється через `session.user.role` на сервері — клієнт підробити не може. Призначення: тестування callback-флоу (SendPulse events, enrollment upsert, листи) без реальних списань. Якщо в `Payment.amount = 1` для bundle/course або `= 2` для yearly — це адмін/менеджер-тест, а не реальний продаж.

## Річна програма — підписка + автосписання

Повноцінна підписка з контролем на нашій стороні. Деталі:

- **Модель даних**: `YearlyProgramSubscription` + `YearlyProgramSubscriptionEvent` в [schema.prisma](prisma/schema.prisma); лінк на `Payment.yearlyProgramSubscriptionId`.
- **Плани**: `YEARLY` (15000 грн, доступ 365 днів) і `MONTHLY` (2200 грн, разова або автосписання). Місячний графік — календарні місяці від дати старту cohort-у (для старту 01.09 це 01.09 → 01.10 → 01.11 → ...), однаковий для разових і автоплатежу; момент фактичної оплати графік не зсуває ([lib/yearlyProgramAccess.ts](lib/yearlyProgramAccess.ts)).
- **Статуси**: `PENDING` → `ACTIVE` → `GRACE` → `EXPIRED` / `CANCELLED`. Тривалість grace **конфігурується з адмінки** — ключ `yearlyGraceDays` в `AppSetting` (читається через `getYearlyGraceDays`, межі `YEARLY_GRACE_MIN_DAYS`…`YEARLY_GRACE_MAX_DAYS`); `YEARLY_PROGRAM_CONFIG.graceDays` — лише fallback, коли рядка в БД ще немає. Кількість днів НЕ хардкодити в текстах листів, FAQ і UI — брати з налаштування. Зміна впливає тільки на нові переходи ACTIVE→GRACE: у вже наявних записів межа зафіксована в `gracePeriodEndsAt`.
- **Флоу перший платіж**: [CoursePurchaseModal](components/CoursePurchaseModal.tsx) → `/api/wayforpay` детектить префікс `yearly-program_` / `yearly-program-monthly_` через [yearlyProgramConfig.ts](lib/yearlyProgramConfig.ts) → створює/знаходить підписку (`PENDING`), для MONTHLY додає `regularOn=1, regularMode=monthly, dateNext, dateEnd` у payload (токенізація + автосписання на стороні WFP). `dateNext` = якір + 1 місяць (якір = cohort.startDate для покупки до старту, інакше дата покупки); поля `dateBegin` у Purchase WFP не існує — не використовувати.
- **Назва товару для WFP**: `productName` у Purchase береться з `YEARLY_PROGRAM_CONFIG.yearlyProductLabel` / `monthlyProductLabel` — це те, що клієнт бачить у віджеті оплати, в листах WayForPay («Опис») і в квитанції. НЕ підставляти туди `yearlyOrderPrefix`/`monthlyOrderPrefix` (їх парсить callback) чи `sendpulseEventSlug` — це технічні рядки.
- **Callback**: `handleYearlyProgramCallback` в [callback/route.ts](app/api/wayforpay/callback/route.ts) — для `Approved` активує підписку, продовжує `expiresAt`, зберігає `recToken`. Для рекурентних callback-ів (orderReference не знайдено) — резолвить підписку по батьківському orderReference (`_WFPREG`), далі по email case-insensitive, і створює новий Payment із лінком на неї.
- **⚠️ SendPulse-подія з callback-а НЕ шлеться.** Оплата НЕ відкриває доступ до платформи — відкриття відкладене до запуску набору і робиться централізовано: `executeLaunchLoop` (кнопка «🚀 Запустити програму»), `runExtraLaunchForSubscription` (оплата після запуску — «пізній покупець», викликається автоматично з callback-а, і вручну кнопкою «🎯 Екстра Запуск») та крок `heal_unopened` денного cron-а (добирає тих, кому доступ не відкрився). У callback-у на цьому місці стоїть маркер `sendpulse:deferred_until_launch`. До запуску студент отримує лише generic welcome-лист без креденшилів. Якщо десь бачиш «callback шле SendPulse event» — це застарілий опис.
- **Cron**: [/api/cron/yearly-subscriptions](app/api/cron/yearly-subscriptions/route.ts) щодня о 04:00 — `ACTIVE→GRACE` при `expiresAt<now`, `GRACE→EXPIRED` після grace-періоду (виклик [SendPulse `closeAccessInCourse`](lib/sendpulse.ts) → `DELETE /students/{id}/{courseId}` + кік з Telegram-каналу). Для MONTHLY з автоплатежем крок `autopay_precharge_notice` шле власний лист «Скоро черговий платіж» за 3 дні до дати з `wfpNextChargeAt` (шаблон `precharge-notice`); дедуп — поле `autopayNoticeSentFor` (дата списання, про яке вже попередили), тому перенесення графіка у WFP автоматично відкриває нове попередження. Ланцюг нагадувань: за 3 дні до закінчення → у день закінчення → grace-start (наступним добовим проходом) → mid (якщо grace ≥5 днів) → last (≥3 днів) → лист про закриття. Авторизація `Authorization: Bearer ${CRON_SECRET}`.
- **SendPulse Education API**: OAuth2 (`SENDPULSE_API_KEY` + `SENDPULSE_SECRET_KEY` в `.env`), токен кешується на 1 год, закриття через `DELETE /students/{studentId}/{courseId}`. `studentId` знаходиться через `POST /students/by-course/{courseId}` пошуком по email (інтегровано в callback і cron).
- **Env**: `SENDPULSE_YEARLY_COURSE_ID` — числовий ID курсу в SendPulse (треба заповнити з кабінету SendPulse → Автоматизація → Онлайн-курси → URL). Без нього закриття в SendPulse пропускається; локальне `EXPIRED` ставиться все одно. `WAYFORPAY_MERCHANT_PASSWORD` — для `regularApi REMOVE` при скасуванні.
- **Адмінка**: `/dashboard/admin/yearly-program` — таблиця з KPI, фільтрами (план/статус/пошук), expandable row (клік по chevron) з трьома панелями: **Дії** (Продовжити/Скасувати/Закрити доступ/Відкрити знову/Видалити — POST на `/api/admin/yearly-program/[id]`), **Платежі** (список orderReference+сума+статус), **Події** (повний лог з `YearlyProgramSubscriptionEvent`). Endpoint `GET /api/admin/yearly-program/[id]/details` тягне все це разом.

### Річна програма — Telegram-канал (інтеграція з Telegram bot API)

Опціональна привʼязка приватного Telegram-каналу/групи до Річної. Бот UIMP має бути доданий у канал як адмін з правом «Запрошувати користувачів» (Invite Users). Налаштовується кнопкою «📡 Telegram-канал» у toolbar `/dashboard/admin/yearly-program`. Зберігається у [YearlyProgramTelegramSetting](prisma/schema.prisma) (singleton row, `id="singleton"`).

**Два toggle-и працюють в парі — за замовчуванням обидва ON:**

1. **`autoAdd` — «Автоматично додавати до Telegram-каналу»** = «дати посилання».
   Після успішної оплати Річної (callback) система викликає Telegram bot API → генерує **одноразове** invite-посилання (`creates_join_request: true` якщо joinRequestMode ON) → зберігає у `YearlyProgramSubscription.telegramInviteLink` → вкладає в welcome-лист як кнопку. Якщо OFF — лист піде без посилання, менеджер додає вручну з панелі підписки.

2. **`joinRequestMode` — «Канал у режимі заявок на вступ»** = «не пустити чужих».
   Захист від «витоку» invite-посилань (студент може форварднути своє). Коли студент клікає на invite-link, замість того щоб одразу зайти в канал, він створює **заявку**. Webhook [/api/telegram/yearly-program-webhook](app/api/telegram/yearly-program-webhook/route.ts) ловить `chat_join_request` → автоматично approve-ить тільки якщо invite_link збігається з `telegramInviteLink` чинної підписки, інакше decline. **Передумова**: у самому Telegram-каналі має бути увімкнено «Заявки на вступ» (Адмін → Запрошення → **Підтвердження адміна**) — без цього налаштування з боку Telegram, наш toggle ефекту не дає.

**Зв'язка**: AutoAdd шле invite студенту, JoinRequestMode фільтрує тих, хто прийде по цьому invite. Зазвичай використовуємо обидва разом для повного автоматичного pipeline-у. Менеджер може тимчасово вимкнути будь-який toggle (наприклад, якщо канал відкритий для всіх або під час технічного обслуговування).

**Env**: `TELEGRAM_BOT_TOKEN` (бот UIMP), `TELEGRAM_YEARLY_WEBHOOK_SECRET` (для валідації webhook-ів). Налаштовуються через [scripts/setup-yearly-program-telegram-webhook.mjs](scripts/setup-yearly-program-telegram-webhook.mjs).

**Preview (pre.uimp) не чіпає бойовий канал.** pre працює з тим самим ботом і скопійованим `chatId`, що й прод, тому будь-який тестовий кік/invite/revoke бив би по реальних людях. На будь-якому Vercel-середовищі, де `VERCEL_ENV` заданий і ≠ `production`, **мутуючі** виклики Telegram API заглушені — див. `isReadOnlyEnv` у [lib/telegram.ts](lib/telegram.ts) (бот UIMP: `banChatMember`, `unbanChatMember`, `createChatInviteLink`, `revokeChatInviteLink`, `approveChatJoinRequest`, `declineChatJoinRequest`) і [lib/telegramConnector.ts](lib/telegramConnector.ts) (бот @connectorgame_bot: `sendMessage` менеджерам). Виклик логується і повертає правдоподібну заглушку, тож флоу проходить до кінця. Інвайти, згенеровані на pre, мають вигляд `https://t.me/+PREVIEW-STUB-NOT-A-REAL-LINK-…` — вони осідають у pre-БД і потрапляють у листи як звичайна кнопка, тому побачивши такий лінк, знай: це не збій, а заглушка. Read-only методи (`getChat`, `getChatMember`, `getMe`, `getWebhookInfo`) працюють скрізь. **Localhost** (`VERCEL_ENV` не заданий) працює з реальним API — там своя dev-БД і свідомі тести, тож перед локальними експериментами з каналом підміняй токен.

Палітра `Savings`-елементів — amber, не emerald (Правило вже зафіксоване вище для пакетів, стосується і цієї секції).

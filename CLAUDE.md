# LMS Platform — rules for Claude

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
11. **Пакет 🎲 Безкоштовний на Вибір з пулом = 4** (2 платних + 4 на вибір) — обгортка 1200px, ряд платних 705px (центр), 4 free `sm:grid-cols-2 lg:grid-cols-4` повна ширина, нижній Price+CTA 640px. Платні — гілка `isMidPaid` (h4 до 22px, опис 14px, іконка 36). Free — `slim={true}` (паддінг 20×18, h4 до 16px, опис 11px, minHeight 4 рядки). H3 заголовок — `paddingLeft/Right: clamp(60px, 9%, 110px)` (починається з середини відступу між краєм блоку і краєм курсів).
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

## Bundle auto-tuner заморожено

Файл [app/[locale]/courses/_components/bundleAutoTuner.ts](app/[locale]/courses/_components/bundleAutoTuner.ts) з 18 правилами для пакетів — **не редагувати** без явного прохання. Також не чіпати `data-bundle-*` маркери в [BundleCard.tsx](app/[locale]/courses/_components/BundleCard.tsx) та пов'язані CSS variables.

## Dashboard — uk-only

`/dashboard/*` свідомо не локалізується, тільки укр.

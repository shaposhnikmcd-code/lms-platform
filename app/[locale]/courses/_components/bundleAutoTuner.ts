// ⚠️ ЗАМОРОЖЕНО — не змінювати без явного прохання користувача.
// Усі 37 правил нижче затверджені. Цей файл не редагувати навіть якщо логіка здається
// неоптимальною. Зміни лише якщо користувач явно сказав "онови скрипт" / "додай правило".
//
// Скрипт Пакетів курсів — авто-тюнер + валідатор.
// Працює через CSS variables (встановлюються на [data-bundle-root]), щоб React
// не міг переписати значення під час re-render-ів. JSX читає var(--...) з fallback.
//
// Правила:
//  1. Ширина/висота пакета — з таблиці Моделей, не міняються.
//  2. Скрипт не підганяє розмір самого пакета.
//  3. Платні картки в пакеті однакові за розміром.
//  4. Безкоштовні картки однакові за розміром.
//  5. Заголовок (h3) не чіпаємо.
//  6. Текст усередині картки вміщається та підлаштовується під вільне місце.
//  7. Бенефіти (🎓 Навчання тощо) в 1 рядок, максимально великим шрифтом без ellipsis.
//  8. Прайс-смужка в картці (ЦІНА ПАКЕТУ) — не чіпаємо.
//  9. CTA-блок (💎 + "Купити пакет") вписаний у пакет, дизайн/форма/положення не міняються.
// 10. Ефекти/дизайн пакета не чіпаємо.
// 11. [ПЕРЕКРИТО RULE #31]. Була динамічна умова "шрифт опису ≤ шрифт заголовка − 2"
//     коли тюнер керував desc fontSize. Зараз desc статичний 12px (rule #31), title 19px
//     (rule #30) — умова 12 ≤ 17 виконується автоматично, але вона більше НЕ є частиною
//     алгоритму. Залишено для історії.
// 12. Шрифт опису однаковий у межах категорії (всіх платних чи всіх безкоштовних).
// 13. Іконка бенефіту того ж fs, що й текст бенефіту.
// 14. СТА 1 — НИЖНІЙ rectangle CTA-блок (frozen specification, скрипт НЕ торкає — rule 19).
//     У пакеті існує ДВА CTA: СТА 1 (цей — нижній rectangle) і СТА 2 (inline square CTA-картка,
//     rule 24 — використовується коли в останньому ряду рівно 1 курс, тоді СТА 1 прихований).
//     Весь СТА 1 рендериться виключно з JSX у BundleCard.tsx (`[data-bundle-cta]`). Ключові параметри:
//     - Контейнер: minWidth 510 + width max-content, minHeight 104,
//       marginTop/Left/Right auto, marginBottom 0 (центрується по горизонталі,
//       притискається до низу пакета). CTA росте натурально коли pill або інший
//       контент не вміщається в 510px — мін залишається 510 (візуальна консистенція).
//     - Padding АСИМЕТРИЧНИЙ (свідомо, перекриває старий T=B=L=R): full '11px clamp(18px,2.4vw,26px)'
//       (верт 11, гориз 18-26), compact '8px 16px'. Боки ширші за верх/низ — треба для ширини 510
//       з hero-ціною та кнопкою.
//     - borderRadius: full 18 / compact 16.
//     - Background: radial amber glow + linear темно-зелений (#244838→#1C3A2E→#142A20).
//     - Layout: flex, alignItems center, justifyContent space-between, flexWrap nowrap,
//       gap full 'clamp(28px,4vw,48px)' / compact 20.
//     - Ліва частина: label "💎 ЦІНА ПАКЕТУ" (13/11 emoji, 10/9 text uppercase amber muted),
//       hero ціна gradient amber 'clamp(34px,4vw,48px)' / compact 'clamp(26px,3vw,32px)' weight 800,
//       marginLeft 'calc(10px+1.5cm)' / 'calc(6px+1.5cm)'. Currency 16/13 amber muted.
//     - Pill "💰 Економія: X грн": показується якщо savings>0, bg rgba(212,168,67,0.12),
//       border 0.35, radius 999, padding 4×12 / 3×10, font 11/10 weight 700 color rgba(242,199,109,0.9).
//       Amber палітра (НЕ emerald). Логіка: DISCOUNT = sum(paid)−bundle_price;
//       FIXED = sum(freeCourses.price); CHOICE = fully-selected → факт, partially → вилка "MIN–MAX грн".
//     - Права частина (кнопка "Купити пакет"): wrapper flex justifyContent flex-end + marginRight 16
//       (кнопка зсунута на 16px ліворуч від правого краю). Button: text-[17px]/sm:[19px],
//       px-10/sm:[58px], py-[15px]/sm:[19px], gap-2.5/sm:3, whitespace-nowrap, amber gradient
//       (#F2C76D→#D4A843→#B8901F), text #152C22, border rgba(255,255,255,0.18),
//       golden halo shadow '0 12px 32px rgba(212,168,67,0.38), inset 0 1px 0 rgba(255,255,255,0.35)' + hover.
//     Перекриває: старе Rule 14 (T=B=L=R) + старе Rule 21 (окрема "уніфікована" специфікація).
// 15. [ПЕРЕКРИТО RULE #31]. Була cap 13px коли тюнер контролював desc fontSize
//     (через CSS variable `--tuned-{paid,free}-desc-fs`). Зараз desc статичний 12px (rule #31),
//     тюнер desc fs більше не виставляє. Cap 13 залишається як внутрішня константа тюнера
//     (DESC_FS_TARGET), але результат обчислення нікуди не застосовується.
// 16. CTA-блок має ПРІОРИТЕТ у розподілі висоти пакета. Тюнер обчислює cap для карток
//     як (bundleH − padT − padB − header − CTA − gaps) / totalRows — CTA повністю
//     резервує свою висоту ДО того, як картки отримають свій cap.
//     ⚠️ Взаємодія з rule #19 і #31:
//     - rule #19: картки беруть `min(cap, naturalMax)` — якщо natural < cap, cap не розтягує їх.
//     - rule #31: desc статичний 12px, тюнер його не скорочує. Якщо cap < naturalMax карток
//       (контент не вміщається) — НЕ desc-font зменшується, а бачимо clipping опису через
//       -webkit-line-clamp:4 + overflow:hidden (rule #33). Це свідома поведінка: desc — перший
//       кандидат на клiпінг (rule #23 priority).
//     - rule #38: мін 4px gap desc→benefits залишається обов'язковим. Якщо cap затісний
//       для (desc.minHeight + інші блоки + 4px) → це сигнал що unifiedHeight пакета треба
//       підняти (але НЕ в рамках цього тюнера — як окремий дизайн-рішення).
// 17. [ОБ'ЄДНАНО В RULE #14 — СТА 1]. Принцип "fit-content" скасований: СТА 1 має
//     фіксовану ширину 510px (rule #14). Баланс між ціною і кнопкою тримається через
//     flex space-between + gap clamp(28,4vw,48) — "великої порожнечі" не виникає візуально.
// 18. Опис може бути обрізаним (не весь текст), головне — не затирати benefits-strip
//     і price-strip у картці. Tuner міряє простір до benefits, а не всю картку.
// 19. CTA inviolate — скрипт НЕ модифікує жоден параметр CTA-блоку (ні width, ні padding,
//     ні шрифти). CTA рендериться рівно з тих стилів, що задані в JSX (frozen-дизайн).
//     Картки беруть min(cap, naturalMax) — не розтягуються щоб заповнити пустоту;
//     якщо їх natural контент менший за доступне місце, лишається повітря між cards і CTA.
// 20. CHOICE_FREE selected-індикатор — UIMP branded wax seal (frozen-дизайн, не через тюнер).
//     Коли картка безкоштовного курсу вибрана в CHOICE_FREE пакеті:
//     - Кремово-біла печатка 48×48 у правому верхньому куті (top:-12, right:-12) з
//       золотим rim 1.5px, UIMP лого всередині (`/logo-white.png`, 38×38, mixBlendMode:multiply).
//     - Amber ring `#D4A843` навколо картки (через `highlightColor` prop FreeCourseMini).
//     - Entrance animation `bundleSealIn` (scale+rotate).
//     Реалізація: BundleCard.tsx (render seal) + FreeCourseMini `highlightColor` prop.
//     Скрипт НЕ керує seal-ом — виключно JSX/CSS. Правило зафіксоване тут для повноти.
// 21. [ОБ'ЄДНАНО В RULE 14 — СТА 1]. Повна специфікація нижнього rectangle CTA-блоку
//     тепер живе в одному правилі (#14). Номер 21 зберігаємо щоб не ламати посилання
//     з інших правил (#23, #34, #35) і з пам'яті/CLAUDE.md.
// 22. Benefits-strip (🎓 Навчання / 🤝 Підтримка / 📜 Сертифікат) у картці курсу має
//     ВИЩИЙ пріоритет за текст опису. Якщо простору не вистачає — обрізаються рядки
//     опису (clipping через overflow: hidden), а не зменшується benefits. Benefits-strip
//     завжди повністю видимий у всіх станах. Пріоритет: benefits/price strip > опис тексту.
// 23. CTA-блок (розміри, положення) і відступи пакета (бічні, верхні, нижні, між блоками)
//     мають НАЙВИЩИЙ пріоритет. Якщо контенту забагато — жертвуємо описом курсів
//     (клiпаються рядки опису). Ієрархія пріоритетів:
//     1) CTA (510×104, marginRight 16 на кнопці, position/padding)
//     2) Відступи/paddings пакета (всі бічні та міжблокові)
//     3) Benefits-strip + price-strip у картках
//     4) Опис курсу — перший кандидат на обрізання при нестачі місця.
// 24. СТА 2 — INLINE "square" CTA-картка (замість нижнього rectangle CTA — СТА 1). Використовується,
//     коли в ОСТАННЬОМУ ряду пакета рівно 1 курсовий блок. Inline-картка має 🎯 ГОТОВИЙ НАБІР
//     badge, hero gradient ціну, кнопку "Купити пакет" і рендериться ПОРЯД з одним курсом
//     (у grid-cols-2). СТА 1 (нижній rectangle, rule #14) у цьому кейсі ПРИХОВАНИЙ.
//     Поточні кейси: FIXED_FREE з 1 безкоштовним курсом (freeCourses.length === 1) — будь-яка
//     кількість платних (1+1, 2+1, 3+1, ...). Якщо з'явиться DISCOUNT/інший тип з 1-блоком
//     в останньому ряду — те саме правило застосовується.
// 25. Тісні відступи біля риски-розділювача (під h4 заголовком курсу). Застосовується до
//     ВСІХ типів пакетів (paid і free картки). Значення marginBottom для title та divider:
//     - Paid default: 6px / 6px (було 10/10)
//     - Paid isMidPaid: 8px / 8px (було 12/12)
//     - Paid isLargePaid: 10px / 10px (було 14/14)
//     - Free default: 6px / 6px (було 10/10)
//     - Free slim (4 вільних): 5px / 5px (було 8/8)
//     - Free equalPair (isPairLayout): 5px / 5px (було 8/8)
//     Frozen-дизайн, JSX only. Скрипт ці значення не змінює.
// 26. [v3] Заголовок курсу (h4) — natural wrap + CONDITIONAL force-break для візуальної
//     уніформності рядків. 3-крокова логіка в `equalizeH4()`:
//       a) Natural wrap: h4 рендериться без force-break (JSX просто `{course.title}`).
//          Короткі → 1 рядок, довгі → 2+ рядків.
//       b) Conditional force-break: tuner вимірює натуральну кількість рядків у кожного
//          h4 в категорії (paid/free окремо). Якщо MAX lines > 1 (бодай один заголовок
//          wrap-иться), ВСІ однорядкові h4 отримують force-break після першого слова
//          через inline `<br/>` (`{firstWord}<br/>{rest}`). Так ВСІ h4 в категорії
//          мають однакову К-СТЬ рядків, не тільки однакову висоту.
//       c) minHeight equalize: після всіх breaks tuner виставляє `minHeight = max(scrollHeight)`
//          на всіх h4 у категорії — остаточна синхронізація.
//     Оригінальний текст зберігається в `dataset.bundleOriginalTitle` щоб resize-reset
//     міг відновити натуральний стан перед повторним виміром.
//     Атрибути: `data-bundle-paid-h4`, `data-bundle-free-h4`.
//     Реалізація: `equalizeH4()` у `autoTuneBundle()`.
//     Приклад: CHOICE 1+3 з вибором {Основи психіатрії, Основи душеопікунства, Психотерапія
//     біблійних героїв}. "Психотерапія біблійних героїв" wrap-иться натурально на 2 рядки,
//     tuner це бачить (maxLines=2) і force-breakає "Основи психіатрії" → "Основи / психіатрії",
//     те саме з "Основи душеопікунства" → "Основи / душеопікунства". Усі 3 free-картки
//     мають 2-рядковий title → візуально uniform.
// 27. Gift strip (нижня стрічка безкоштовної картки з "У ПОДАРУНОК + ціна") — елегантний
//     мінімалістичний дизайн (без emoji, без serif italic, без градієнту):
//     - bg: solid `#065f46` (глибокий muted emerald)
//     - border-top: `1px rgba(255,255,255,0.08)` (hairline separator)
//     - padding: `9px 16px`
//     - layout: flex center, gap 12
//     - Label "У ПОДАРУНОК": sans, fontSize 9, weight 500, letter-spacing 0.24em,
//       uppercase, color rgba(255,255,255,0.7)
//     - Роздільник: dot 3×3 білий 0.3 opacity (НЕ vertical line, НЕ em-dash)
//     - Ціна "X грн": sans, fontSize 12.5, weight 500, color rgba(255,255,255,0.95),
//       tabular-nums, letter-spacing 0.01em
//     - БЕЗ "0 грн" і БЕЗ line-through (як було раніше) — показуємо лише вартість подарунку
//     Застосовується до ВСІХ безкоштовних курсів (FreeCourseMini).
//     Frozen-дизайн, JSX only.
// 28. Pill "💰 Економія" у CTA — логіка розрахунку:
//     - DISCOUNT: savings = sum(paid) − bundle_price (фіксоване число)
//     - FIXED_FREE: sum(freeCourses.price) — сума всіх подарункових курсів (фіксоване)
//     - CHOICE_FREE:
//       * ВСІ pickN вибрано → фактична сума вибраних (фіксоване число)
//       * Частково / нічого → ВИЛКА "MIN – MAX грн"
//         MIN = sum(top pickN найдешевших з пулу)
//         MAX = sum(top pickN найдорожчих з пулу)
//       * Якщо всі ціни в пулі однакові (MIN===MAX) — показуємо лише одне число
//     Чесно показує діапазон можливої економії до вибору. Frozen JSX only.
// 29. Label free-row у пакеті — Paper Gift Tag (заміщує старий "+ У ПОДАРУНОК" / "🎁 Курс в
//     подарунок на вибір" pill). Застосовується у FIXED_FREE і CHOICE_FREE free-row:
//     - Кремовий paper tag (radial gradient FFFCF3→FAF2DA→EDDBA5) з gradient gold border
//       (linear F2C76D→D4A843→B8901F через padding-box/border-box трюк)
//     - Border-radius 10, padding 8×22×8×36 (додатковий лівий padding для дірочки)
//     - Shadow: 0 8px 20px rgba(164,122,40,0.3) + 0 2px 5px dark + inset highlight
//     - Нахил transform: rotate(-0.8deg) — недбало прив'язаний ярлик
//     - Дірочка зліва (width 11×11, radial темно-зелений, inset shadow, amber rim)
//     - Два рядки тексту:
//       * Малий (8px): "🎁 ВАШ ПОДАРУНОК" uppercase letter-spacing 0.26em opacity 0.55
//       * Великий (13px, weight 800): динамічний текст:
//         - FIXED_FREE: "{N} курс/курси/курсів безкоштовно" (укр. pluralization: 1=курс, 2-4=курси, 5+=курсів)
//         - CHOICE_FREE: "Оберіть один курс" (pickN=1) або "Оберіть {N} курси" (pickN>1)
//     Frozen JSX only.
// 30. Заголовок курсу <h4> в картці — УНІФІКОВАНА величина **19px** у всіх бандлах і
//     обох типах карток (paid і free). Прибрано: clamp-responsive, isLargePaid/isMidPaid/slim
//     варіанти (25-32/18-22/15-19/14-16). Тепер одне число: `fontSize: 19`. Frozen JSX only.
// 31. Опис курсу <p data-bundle-desc> — УНІФІКОВАНА величина **12px** у всіх бандлах і
//     обох типах карток (paid і free). Прибрано: CSS variable `--tuned-{paid,free}-desc-fs`
//     override, isLargePaid/isMidPaid/slim fallback варіанти (17/14/12/11/12). Тюнер
//     desc fontSize більше НЕ контролює (rule #15 "max 13px" фактично не застосовується —
//     desc статичний 12px). Якщо не вміщується — клiпається через overflow: hidden
//     (rule #18, #22, #23). Frozen JSX only.
// 32. Іконка курсу в картці (емоджі-квадрат + tag-надпис над h4) — УНІФІКОВАНІ величини
//     у всіх бандлах і обох типах карток (paid і free):
//     - Квадрат: 33×33, borderRadius 8, bg `rgba(accentRgb, 0.18)`
//     - Емоджі fontSize: 16
//     - Tag fontSize: 9, weight 700, letterSpacing 0.25em, uppercase,
//       color чергується `#D4A843` / `#C4919A` (paid по index), solid tagColor (free)
//     Прибрано: isLargePaid (44/20/10), isMidPaid (36/17/9), slim (28/13), default (32/15/8).
//     Тепер одне значення для всіх. Frozen JSX only.
// 33. Опис курсу <p data-bundle-desc> — обмежений **4 рядками максимум** через
//     `-webkit-line-clamp: 4` (display: -webkit-box, WebkitBoxOrient: vertical,
//     overflow: hidden, textOverflow: ellipsis). Якщо текст довший — браузер
//     автоматично додає символ `…` (horizontal ellipsis) в кінці останнього рядка.
//     Застосовується до ВСІХ бандлів і обох типів карток (paid і free).
//     ⚠️ `flex: 1` на inner-padding-контейнері картки (що містить icon+h4+divider+desc)
//     МАЄ ЗАЛИШАТИСЬ. Спроба прибрати `flex: 1` щоб усунути gap між 4-рядковим описом
//     і benefits-strip — ЛАМАЄ вирівнювання карток у інших бандлах (price-strip повзе
//     вгору, картки різної висоти). Якщо користувач скаржиться на gap — не чіпати flex:1;
//     думати про тюнер / висоту картки окремо. Frozen JSX only.
// 34. Кнопка "Купити пакет" у СТА 2 (inline CTA-картка, rule #24, FIXED_FREE 1-free) має
//     ІДЕНТИЧНИЙ ВІЗУАЛ до кнопки в СТА 1 (нижній rectangle, rule #14): amber gradient
//     `linear-gradient(135deg, #F2C76D 0%, #D4A843 50%, #B8901F 100%)`, dark green text
//     `#152C22`, border `rgba(255,255,255,0.18)`, golden halo shadow
//     `0 12px 32px rgba(212,168,67,0.38), inset 0 1px 0 rgba(255,255,255,0.35)` + hover.
//     Розміри зменшені щоб вмістилось у вузьку (~220px) CTA-картку:
//     - px: 6/sm:8 (замість 10/sm:[58px]) — вужчі бокові відступи
//     - py: [14px]/sm:[16px] (замість [15px]/sm:[19px])
//     - text: [14px]/sm:[15px] (замість [17px]/sm:[19px])
//     - gap: 2/sm:2.5 (замість 2.5/sm:3)
//     - whitespace-nowrap (1 рядок, без wrap в 2 рядки як було раніше 18px в 2 рядки)
//     Прибрано старі overrides `max-w-[90px]`, `whitespace-normal`, `leading-tight`
//     (кнопка тепер не wrap-иться, а це нормально бо nowrap в 1 рядок).
//     Frozen JSX only.
// 35. Pill "💰 Економія" у СТА 2 (inline CTA-картка, rule #24) — з ТОЮ Ж ЛОГІКОЮ rule #28
//     (DISCOUNT: sum(paid)−bundle_price; FIXED: sum(freeCourses.price); CHOICE:
//     fully-selected → фактична сума, partially → вилка "MIN – MAX грн").
//     Рендериться відразу під hero ціною, перед кнопкою "Купити пакет":
//     - bg `rgba(212,168,67,0.12)`, border `1px rgba(212,168,67,0.35)`, borderRadius 999
//     - padding `3px 10px`, alignSelf flex-start, marginTop 8
//     - емоджі 💰 fontSize 10, текст fontSize 10 weight 700 color `rgba(242,199,109,0.9)`
//     - whitespace-nowrap (1 рядок)
//     Показується тільки якщо `displayedSavings > 0`. Рендериться виключно в inline
//     CTA-картці (СТА 2); СТА 1 (rule #14) має власний pill з ТОЮ Ж ЛОГІКОЮ rule #28, але більшого розміру.
//     Frozen JSX only.
// 36. Header → paid row marginBottom = **16px УНІВЕРСАЛЬНО** (не залежить від типу
//     бандла). Прибрана гілка `isUniformSpacing ? 28 : 16` — тепер завжди 16.
//     Причина: gap h3→card top однаковий скрізь = 16px (verified via Playwright:
//     7 бандлів усі показали gap=16px). Раніше 28px для isUniformSpacing (2+2, 2+4)
//     створювало непотрібну порожнечу. ⚠️ Стара uniform-гілка (28px скрізь) в частині
//     header→paid повністю ПЕРЕКРИТА — header→paid = 16 всюди; решта uniform-відступів
//     (paid→free, free→CTA, боки) залишаються 28px. Frozen JSX only.
//     (Раніше тут було хибне посилання на Rule #12 — це правило про шрифт опису, не про spacing.)
// 37. BundleRowSync — h3-sync minHeight **ВІДКЛЮЧЕНО**. Раніше [BundleRowSync.tsx]
//     компонент встановлював `minHeight: maxH3ScrollHeight` на всіх h3 в одному ряду
//     бандлів — щоб заголовки були одної висоти (`gap` до карток синхронізувався).
//     Побічка: у бандлі з коротшим текстом h3 резервувалось місце для зайвих рядків
//     (напр. CHOICE 2+4 отримував minHeight 86px (3 рядки) хоча текст у 2 рядки, через
//     що нижче 2-го рядка залишалось фантомних 28px — користувач бачив це як
//     "порожній 3-й рядок"). ТЕПЕР compute() лише СКИДАЄ будь-який старий minHeight
//     (el.style.minHeight = '') і НЕ встановлює нічого. Кожен h3 натуральної висоти
//     (58/86/...px залежно від тексту). Побічний ефект: paid-row сусідніх бандлів у
//     ряду може починатись на різному Y — це ПРИЙНЯТНО (bundle bottom все одно
//     вирівняний через unifiedHeight, cards всередині уніфіковані). Рядок h3 резервує
//     ПЛОЩУ ТІЛЬКИ ПІД ТЕКСТ — без фантомних порожніх рядків.
// 39. Spacing Adjuster — рівномірний розподіл вільного місця в bundle. Запускається
//     ПІСЛЯ всіх card/h4/desc tuning коли всі розміри фінальні. Логіка:
//       a) Міряє bundle.clientHeight, padding, всі дочірні (h3, paid container, label,
//          free container, CTA), суму їх heights + margin-bottom.
//       b) extraSpace = clientHeight − padding − children.
//       c) Якщо extraSpace > 8px (порог) — розподіляє по (N+1) слотах: top padding,
//          (N−1) inter-block gaps, bottom padding. Кожен слот отримує +floor(extra/(N+1))px.
//       d) CTA marginTop:auto тимчасово знімається щоб не поглинав delta. Після adjuster-а
//          CTA сидить на своєму місці через margin-bottom на попередньому sibling-у.
//     Переопреділяє "bottom padding = side padding" (старе правило неявне) — тепер
//     bottom padding росте щоб bundle виглядав збалансовано. Idempotent: зберігає orig
//     значення в dataset `ajOrigPt/Pb/Mb/Mt` і резетить перед кожним запуском.
//     Реалізація: `adjustBundleSpacing()` викликається в кінці `autoTuneBundle()`.
//     uniform висота desc-area між картками в пакеті. Доповнює (НЕ перекриває) rule #33.
//     Проблема яку вирішує: у пакетах з описом на 4+ рядки остання (4-та) строчка
//     частково обрізана benefits-strip-ом — хвостики літер (g, p, й, ц) кліпаються
//     через тісну висоту desc-контейнера. Приклад: пакет "Основи психології, Основи
//     психіатрії та Психотерапія біблійних героїв" — картка "Основи психології",
//     рядок "зцілення на тьох рівнях: дух..." обрізаний зверху benefits-strip-ом.
//     Нові вимоги:
//     a) Між останнім ВИДИМИМ рядком опису і benefits-strip (або іншим наступним блоком)
//        МАЄ бути повітря МІНІМУМ 4px. Жодна буква / хвостик літери / ellipsis (…) не
//        може частково ховатися під benefits-strip. Це жорстка інваріанта.
//     b) Desc-area резервує висоту на ВСІ 4 рядки (4 × line-height + 4px bottom gap),
//        навіть якщо реальний текст коротший (1-3 рядки). Це гарантує що:
//        - 4-рядковий текст вміщається без клiпінгу
//        - короткий текст не ламає layout — під ним видима порожнеча до benefits-strip
//     c) Для uniform look між картками в ряду допустимо РОЗШИРИТИ desc-area понад 4 рядки
//        (напр. 5 зарезервованих рядків, текст все одно clamp до 4) — якщо це потрібно
//        щоб відступи між блоками (benefits-strip, price-strip, нижня межа картки)
//        збігались у всіх картках ряду. Картки в одному ряду мусять виглядати
//        візуально однаковими за структурою.
//     d) Пріоритети з rule #23 залишаються: CTA > відступи пакета > benefits/price strip >
//        опис. Але тепер "опис" включає не тільки текст, а й 4px gap під останнім рядком —
//        цей gap НЕ можна з'їдати benefits-strip-ом.
//     Implementation (до уточнення): або JSX (`paddingBottom: 4` + `minHeight` на
//     desc-контейнері = 4 * line-height + 4), або тюнер (міряє maxDescHeight у ряду,
//     виставляє uniform minHeight на всі картки + 4px bottom gap).
//     TODO: конкретну реалізацію user затвердить окремим запитом. Зараз — лише правило.
// 41. Cross-bundle row sync: коли два (або більше) однотипних бандли (same type/paid/free)
//     стоять поруч у тому ж ряду, тюнер синхронізує їхню paid-card висоту до max(natural)
//     серед пари. Вирішує кейс: DISCOUNT 2-paid з коротким desc (natural 220) поруч з
//     бандлом з довшим desc (natural 249) → обидва стають 249, щоб уникнути візуальної
//     диспропорції коли adjuster "роздуває" відступи у коротшого для fit-у в unifiedHeight.
//     Не зачіпає CTA (rule #19/14) і не зачіпає free-cards (можна розширити за потреби).
//     Реалізація: `syncBundleRow()` у кінці `autoTuneBundle()`.
// 42. Адаптивна висота бандлу — картки НІКОЛИ не клiпаються; бандл росте під контент.
//     Перекриває попередню "fixed unifiedHeight з overflow:hidden" модель де при довгому h3 +
//     довгих описах cap стискав картки і desc обрізалось пів-літери benefits-стрипом.
//     a) `computeCardHeightCaps` ДЕПРЕКЕЙТНО — cap скасований. Тюнер не передає cap у
//        `equalizeAndGetMaxHeight` (paidCap=null, freeCap=null) → картки завжди беруть naturalMax.
//     b) JSX root: `height` → `minHeight: unifiedHeight` (BundleCard.tsx:355). Бандл росте якщо
//        sum(content) > unifiedHeight. `overflow:hidden` прибрано з root (картки залишають своє).
//     c) Нова функція `expandBundleIfNeeded(root, cta)` запускається ПІСЛЯ STABILIZE_PASSES і
//        ПЕРЕД adjuster: міряє padT+padB+sum(children offsetH + child.mb) з тимчасово знятим
//        cta.marginTop:auto, виставляє `root.style.minHeight = needed` якщо needed > clientHeight.
//        Idempotent: orig minHeight зберігається в `dataset.tunerOrigMinH`, скидається на
//        кожному запуску. Skip для `forcedHeight` (miniature) — там фіксована висота важлива.
//     d) `syncBundleRow` розширений: окрім paid-card висоти синхронізує також bundle minHeight
//        серед mate-ів (same type/paid/free/top Y) до max(naturals). Сусідні бандли в ряду
//        вирівнюються знизу автоматично; коротші отримують slack → adjuster (rule #39) рівномірно
//        розподіляє по слотах.
//     e) WebkitLineClamp:4 у JSX лишається як safety net (тексти 5+ рядків отримають ellipsis,
//        але висота резервується точно під 4 рядки → клiпається тільки реально надлишковий 5+ рядок).
//     Сумісність: bundles де naturalMax < unifiedHeight (короткі h3+descs) поведінкою не змінюються
//     (cap=null повертає natural; bundle.minHeight = unifiedHeight як раніше).
// 40. CAP calc враховує margin ОСТАННЬОГО grid-контейнера → CTA. У `computeCardHeightCaps`
//     до `gapsTotal` додається `lastContainer.marginBottom` (lastContainer = freeContainer
//     якщо є, інакше paidContainer). Раніше враховувався лише paid→free (коли обидва
//     контейнери існують) — для бандлів без free-row paid-grid.marginBottom "провалювався"
//     і cap був завищений на цю величину. Наслідок: bundle переповнювався overflow-ом АБО
//     картки капалися зі значною порожнечею перед CTA (через grid.mb + CTA auto-margin
//     розв'язки). Фікс: єдине правило для обох кейсів (з і без free-row).

const MIN_DESC_FS = 10;
const MAX_DESC_FS = 24;
const MIN_BEN_FS = 6;
const MAX_BEN_FS = 14;
const BS_ITERATIONS = 16;
const STABILIZE_PASSES = 2;

function setVar(root: HTMLElement, name: string, value: string) {
  root.style.setProperty(name, value);
}

// Знайти макс fs опису, де desc разом з header НЕ виходить за межі inner-контейнера
// (контейнер = desc.parentElement, тобто div перед benefits-strip-ом).
// Це правило 18: desc може бути обрізаним, але не затирати benefits.
function findMaxFittingDescFs(
  desc: HTMLElement,
  capFs: number,
): number {
  const container = desc.parentElement;
  if (!container) return MIN_DESC_FS;
  let lo = MIN_DESC_FS, hi = Math.min(capFs, MAX_DESC_FS);
  if (hi < lo) return lo;
  let best = lo;
  const orig = desc.style.fontSize;
  for (let i = 0; i < BS_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    desc.style.fontSize = `${mid}px`;
    if (container.scrollHeight <= container.clientHeight + 1) { best = mid; lo = mid; }
    else { hi = mid; }
  }
  desc.style.fontSize = orig;
  return best;
}

// Правила 3+4+16+19: картки ніколи не вищі за свій natural-контент.
// Якщо cap заданий і natural max < cap — лишаємо natural max (картки не розтягуються
// щоб заповнити пустоту). Cap діє тільки як стеля коли natural max > cap.
function equalizeAndGetMaxHeight(
  cards: HTMLElement[],
  resetVarName: string,
  root: HTMLElement,
  cap: number | null,
): number {
  if (cards.length === 0) return 0;
  setVar(root, resetVarName, 'auto');
  const naturalMax = Math.max(...cards.map((c) => c.clientHeight));
  const h = (cap != null && cap > 0) ? Math.min(cap, naturalMax) : naturalMax;
  setVar(root, resetVarName, `${h}px`);
  return h;
}

// Правило 16: обчислити макс висоту рядів карток (paid + free) з урахуванням висоти CTA,
// заголовка, paddings пакета та всіх gap-ів. Картки не можуть тягнути CTA поза межі.
// Повертає єдиний cap для всіх рядів (paid і free ділять простір порівну).
function computeCardHeightCaps(
  root: HTMLElement,
  paidCards: HTMLElement[],
  freeCards: HTMLElement[],
  cta: HTMLElement | null,
): { paid: number | null; free: number | null } {
  if (!cta || (paidCards.length === 0 && freeCards.length === 0)) return { paid: null, free: null };

  const countRows = (cards: HTMLElement[]) => {
    if (cards.length === 0) return 0;
    const xs = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left)));
    return Math.ceil(cards.length / Math.max(1, xs.size));
  };
  const paidRows = countRows(paidCards);
  const freeRows = countRows(freeCards);
  const totalRows = paidRows + freeRows;
  if (totalRows === 0) return { paid: null, free: null };

  const paidContainer = paidCards[0]?.parentElement ?? null;
  const freeContainer = freeCards[0]?.parentElement ?? null;

  // Header — перший дочірній елемент root, який не є grid-контейнером, CTA, STYLE чи абс. позиціонованим
  const header = Array.from(root.children).find((c) => {
    if (c.tagName === 'STYLE') return false;
    if (c === paidContainer || c === freeContainer || c === cta) return false;
    return getComputedStyle(c as HTMLElement).position !== 'absolute';
  }) as HTMLElement | undefined;
  const headerH = header?.offsetHeight || 0;
  const headerMB = header ? parseFloat(getComputedStyle(header).marginBottom) || 0 : 0;

  // Сумуємо всі row-gap у paid/free гридах + margin між paid і free контейнерами
  let gapsTotal = 0;
  if (paidContainer && paidRows > 1) {
    gapsTotal += (paidRows - 1) * (parseFloat(getComputedStyle(paidContainer).rowGap) || 0);
  }
  if (freeContainer && freeRows > 1) {
    gapsTotal += (freeRows - 1) * (parseFloat(getComputedStyle(freeContainer).rowGap) || 0);
  }
  if (paidContainer && freeContainer && paidContainer !== freeContainer) {
    gapsTotal += parseFloat(getComputedStyle(paidContainer).marginBottom) || 0;
    gapsTotal += parseFloat(getComputedStyle(freeContainer).marginTop) || 0;
  }
  // Rule #40: margin між ОСТАННІМ grid-контейнером (free якщо є, інакше paid) і CTA.
  // Раніше враховувався лише paid→free margin. Для бандлів БЕЗ free-row (напр. DISCOUNT 2/3/4-paid)
  // `paidContainer.marginBottom` (за JSX 32px у full / 24px у compact) залишався не врахованим,
  // → cap був більшим за реально доступне місце на величину цього margin → картки капалися таким,
  // що bundle переповнювався і overflow:hidden кліпив частину контенту ТА одночасно створював
  // видимий відступ перед CTA (adjuster returns early при extraSpace<=8).
  const lastContainer = freeContainer ?? paidContainer;
  if (lastContainer && cta) {
    gapsTotal += parseFloat(getComputedStyle(lastContainer).marginBottom) || 0;
  }

  const rootCs = getComputedStyle(root);
  const padT = parseFloat(rootCs.paddingTop) || 0;
  const padB = parseFloat(rootCs.paddingBottom) || 0;
  const ctaH = Math.max(cta.offsetHeight, cta.scrollHeight);
  const bundleH = root.clientHeight;

  const available = bundleH - padT - padB - headerH - headerMB - ctaH - gapsTotal;
  const cardH = Math.floor(available / totalRows);
  const safe = Math.max(120, cardH);
  return {
    paid: paidCards.length ? safe : null,
    free: freeCards.length ? safe : null,
  };
}

// Правила 6+11+12+15: target 13px (але не більше titleFs-2), shrink якщо не вміщається, uniform у категорії.
const DESC_FS_TARGET = 13;
function tuneDescsUniform(cards: HTMLElement[], titleFs: number): number {
  if (cards.length === 0) return 0;
  const target = Math.min(DESC_FS_TARGET, Math.max(MIN_DESC_FS, titleFs - 2));
  const maxFitPerCard = cards.map((card) => {
    const desc = card.querySelector<HTMLElement>('[data-bundle-desc]');
    return desc ? findMaxFittingDescFs(desc, target) : target;
  });
  return Math.min(target, ...maxFitPerCard);
}

// Canvas для точного виміру тексту
let measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, fontCss: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = fontCss;
  return ctx.measureText(text).width;
}

// Правила 7+13: тюнимо кожен бенефіт (текст+іконка разом).
function tuneBenefit(ben: HTMLElement, icon: HTMLElement | null) {
  const parent = ben.parentElement;
  if (!parent) return;
  const cs = getComputedStyle(ben);
  const fontFamily = cs.fontFamily;
  const fontWeight = cs.fontWeight;
  const text = ben.textContent || '';
  const parentCs = getComputedStyle(parent);
  const gap = parseFloat(parentCs.gap) || 0;
  const parentPadL = parseFloat(parentCs.paddingLeft) || 0;
  const parentPadR = parseFloat(parentCs.paddingRight) || 0;

  let lo = MIN_BEN_FS, hi = MAX_BEN_FS;
  let best = MIN_BEN_FS;
  for (let i = 0; i < BS_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (icon) icon.style.fontSize = `${mid}px`;
    const iconW = icon ? icon.getBoundingClientRect().width : 0;
    const available = parent.clientWidth - parentPadL - parentPadR - iconW - gap;
    const textW = measureTextWidth(text, `${fontWeight} ${mid}px ${fontFamily}`);
    if (textW + 2 <= available) { best = mid; lo = mid; }
    else { hi = mid; }
  }
  ben.style.fontSize = `${best}px`;
  if (icon) icon.style.fontSize = `${best}px`;
}

export function autoTuneBundle(root: HTMLElement) {
  const title = root.querySelector<HTMLElement>('[data-bundle-title]');
  const titleFs = title ? parseFloat(getComputedStyle(title).fontSize) || 24 : 24;
  const paidCards = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-paid-card]'));
  const freeCards = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-free-card]'));
  const cta = root.querySelector<HTMLElement>('[data-bundle-cta]');

  // Правило 16: спочатку тимчасово "схлопуємо" картки (minHeight auto), щоб CTA
  // отримала натуральну висоту. Потім обчислюємо cap, потім накладаємо.
  // Все в одному JS-тіку (RAF), тому візуально проміжний стан не видно.
  setVar(root, '--tuned-paid-card-h', 'auto');
  setVar(root, '--tuned-free-card-h', 'auto');
  // Force reflow + read CTA natural size
  void root.offsetHeight;

  // Правило 26 (v3): h4 рендериться натурально + **conditional force-break** у tuner.
  // Якщо в категорії (paid або free) МАКС лінії > 1 (бодай один заголовок wrap-иться),
  // tuner ФОРС-БРЕЙКАЄ всі однорядкові заголовки після першого слова через `<br>` →
  // всі картки мають однакову кількість візуальних рядків. Результат: uniform LOOK
  // не тільки через minHeight, а й через візуальну структуру.
  const equalizeH4 = (cards: HTMLElement[], selector: string) => {
    if (cards.length === 0) return;
    const h4s = cards.map((c) => c.querySelector<HTMLElement>(selector)).filter((h): h is HTMLElement => !!h);
    if (h4s.length === 0) return;

    // 1) Reset: прибрати попередній force-break і minHeight, відновити оригінальний текст
    h4s.forEach((h) => {
      h.style.minHeight = '';
      const orig = h.dataset.bundleOriginalTitle;
      if (orig !== undefined) {
        h.textContent = orig;
      }
    });
    void root.offsetHeight;

    // 2) Виміряти натуральну кількість рядків
    const lineH = parseFloat(getComputedStyle(h4s[0]).lineHeight) || 24;
    const naturalLines = h4s.map((h) => Math.round(h.getBoundingClientRect().height / lineH));
    const maxLines = Math.max(...naturalLines);

    // 3) Якщо max > 1 — force-break всі короткі (1-рядкові) після першого слова
    if (maxLines > 1) {
      h4s.forEach((h, i) => {
        if (naturalLines[i] < maxLines) {
          const title = h.textContent || '';
          const sp = title.indexOf(' ');
          if (sp > 0) {
            h.dataset.bundleOriginalTitle = title;
            h.innerHTML = `${title.slice(0, sp)}<br/>${title.slice(sp + 1)}`;
          }
        }
      });
      void root.offsetHeight;
    }

    // 4) Equalize minHeight до максимуму (після всіх breaks)
    const maxH = Math.max(...h4s.map((h) => h.scrollHeight));
    h4s.forEach((h) => { h.style.minHeight = `${maxH}px`; });
  };

  // ⚠️ H4 equalize МУСИТЬ виконатись ДО computeCardHeightCaps — інакше cap буде
  // розрахований для короткого h4 (1 рядок) і потім h4-equalize розтягне деякі до 2
  // рядків → card scrollHeight > cap → desc клiпається. Стабільність з першого рендеру.
  equalizeH4(paidCards, '[data-bundle-paid-h4]');
  equalizeH4(freeCards, '[data-bundle-free-h4]');
  void root.offsetHeight;

  // Rule #42: cap скасований. Картки завжди беруть naturalMax (`equalizeAndGetMaxHeight` з cap=null
  // повертає naturalMax безумовно). Замість того щоб стискати картки до cap і клiпати desc через
  // overflow:hidden — `expandBundleIfNeeded` нижче піднімає bundle.minHeight до needed.
  // computeCardHeightCaps лишається як deprecated історична функція (не викликається).
  const paidCap = null;
  const freeCap = null;

  // Кілька passes для стабілізації (flex/grid з minHeight можуть міняти розміри між ітераціями)
  for (let pass = 0; pass < STABILIZE_PASSES; pass++) {
    equalizeH4(paidCards, '[data-bundle-paid-h4]');
    equalizeH4(freeCards, '[data-bundle-free-h4]');
    equalizeAndGetMaxHeight(paidCards, '--tuned-paid-card-h', root, paidCap);
    equalizeAndGetMaxHeight(freeCards, '--tuned-free-card-h', root, freeCap);
    const paidDescFs = tuneDescsUniform(paidCards, titleFs);
    const freeDescFs = tuneDescsUniform(freeCards, titleFs);
    setVar(root, '--tuned-paid-desc-fs', `${paidDescFs}px`);
    setVar(root, '--tuned-free-desc-fs', `${freeDescFs}px`);
  }

  // Правило 19: CTA inviolate — скрипт НЕ модифікує CTA. Frozen-дизайн з JSX лишається як є.
  // (раніше тут було `cta.style.width = 'fit-content'` — це і було порушенням rule 19)

  // Бенефіти — per-element inline style (розмір залежить від довжини тексту, не uniform)
  const benefits = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-benefit-title]'));
  for (const ben of benefits) {
    const parent = ben.parentElement;
    const icon = parent?.querySelector<HTMLElement>('[data-bundle-benefit-icon]') ?? null;
    tuneBenefit(ben, icon);
  }

  // Правило 42: Bundle expand — піднімає bundle.minHeight до naturalNeeded (sum content +
  // paddings) якщо unifiedHeight закороткий. Картки вже на naturalMax (cap=null), тому потрібна
  // висота = sum усіх direct children + margin-bottom + padT/B. Skip для miniature (forcedHeight).
  expandBundleIfNeeded(root, cta);

  // Правило 39: Spacing Adjuster — розподіляє залишок вертикальної висоти рівномірно
  // між усіма слотами відступів (top padding, inter-block gaps, bottom padding).
  // Запускається ПІСЛЯ всіх card-tuning + h4-equalize — коли всі розміри фінальні.
  adjustBundleSpacing(root, cta);

  // Правило 41: Cross-bundle row sync — синхронізує висоту paid-cards серед однотипних
  // сусідів у тому ж рядку (одна лінія на екрані, same type/paid/free). Коли два DISCOUNT
  // 2-paid бандли стоять поруч з різним natural cards (220 vs 249), sync робить обидва 249.
  // Це зменшує "роздуття" adjuster-ом відступів у коротшого бандла → візуальна рівність пари.
  syncBundleRow(root);
}

// Правило 39 (adjuster): коли сума всіх блоків < bundleH, тюнер розподіляє delta
// рівномірно по N+1 слотах (top, між всіма sibling-парами, bottom). Результат:
// рівні "повітряні" проміжки скрізь, без великих порожніх зон перед CTA.
// Idempotent: зберігає оригінальні margin/padding в data-* атрибутах, скидає на кожному
// запуску і перерахунку на resize/hover/choice-селекції.
function adjustBundleSpacing(root: HTMLElement, cta: HTMLElement | null) {
  const children = Array.from(root.children).filter((c) => {
    if (c.tagName === 'STYLE') return false;
    return getComputedStyle(c as HTMLElement).position !== 'absolute';
  }) as HTMLElement[];
  if (children.length < 2) return;

  // 1) Reset попередніх adjustment-ів (щоб заміри були точні)
  if (root.dataset.ajOrigPt !== undefined) {
    root.style.paddingTop = root.dataset.ajOrigPt;
    root.style.paddingBottom = root.dataset.ajOrigPb || '';
    delete root.dataset.ajOrigPt;
    delete root.dataset.ajOrigPb;
  }
  children.forEach((c) => {
    if (c.dataset.ajOrigMb !== undefined) {
      c.style.marginBottom = c.dataset.ajOrigMb;
      delete c.dataset.ajOrigMb;
    }
  });
  // CTA marginTop:auto тимчасово знімаємо щоб не поглинав delta
  if (cta) {
    if (cta.dataset.ajOrigMt !== undefined) {
      cta.style.marginTop = cta.dataset.ajOrigMt;
      delete cta.dataset.ajOrigMt;
    }
    cta.dataset.ajOrigMt = cta.style.marginTop || '';
    cta.style.marginTop = '0';
  }
  void root.offsetHeight;

  // 2) Виміряти natural layout
  const bundleH = root.clientHeight; // content + padding (border-box excludes border)
  const rootCs = getComputedStyle(root);
  const padT = parseFloat(rootCs.paddingTop) || 0;
  const padB = parseFloat(rootCs.paddingBottom) || 0;
  const borderT = parseFloat(rootCs.borderTopWidth) || 0;
  const borderB = parseFloat(rootCs.borderBottomWidth) || 0;

  let childrenAndMargins = 0;
  children.forEach((c, i) => {
    childrenAndMargins += c.offsetHeight;
    if (i < children.length - 1) {
      childrenAndMargins += parseFloat(getComputedStyle(c).marginBottom) || 0;
    }
  });

  // Для border-box: clientHeight = padTop + content + padBottom (без border).
  // content доступний = bundleH - padT - padB.
  // Якщо root має box-sizing content-box (рідко) — clientHeight не включає padding, але
  // ми консервативно рахуємо extraSpace як bundleH мінус все (padding і content).
  // Для border-box (стандарт у цьому проекті): extraSpace = bundleH - padT - padB - children.
  const extraSpace = bundleH - padT - padB - childrenAndMargins;
  if (extraSpace <= 8) {
    // Restore CTA marginTop (Rule #14 марж auto якщо так було)
    if (cta && cta.dataset.ajOrigMt !== undefined) {
      cta.style.marginTop = cta.dataset.ajOrigMt;
      delete cta.dataset.ajOrigMt;
    }
    return;
  }

  // 3) Розподілити delta по N+1 слотах: padTop + (N-1) inter-gaps + padBottom
  const slots = children.length + 1; // (N-1) inter + 2 edges = N+1
  const perSlot = Math.floor(extraSpace / slots);

  root.dataset.ajOrigPt = `${padT}px`;
  root.dataset.ajOrigPb = `${padB}px`;
  root.style.paddingTop = `${padT + perSlot}px`;
  root.style.paddingBottom = `${padB + perSlot}px`;

  for (let i = 0; i < children.length - 1; i++) {
    const c = children[i];
    const origMb = parseFloat(getComputedStyle(c).marginBottom) || 0;
    c.dataset.ajOrigMb = `${origMb}px`;
    c.style.marginBottom = `${origMb + perSlot}px`;
  }

  // CTA marginTop лишаємо 0 (delta вже розподілена) — візуально CTA на своєму місці
  // завдяки margin на попередньому sibling-у + padding-bottom.
  // Не суперечить Rule #14 (marginTop auto) — adjuster явно вирішує куди розподілити.
}

// Правило 42: піднімає bundle.minHeight до natural-required якщо unifiedHeight (baseline)
// закороткий для контенту. Без cap (rule #42a) картки беруть naturalMax і можуть виходити
// за межі бандлу. Ця функція рахує точну потрібну висоту і дозволяє бандлу вирости.
// Idempotent: orig minHeight зберігається в dataset, скидається на кожному запуску.
// Skip для miniature (forcedHeight) — там фіксована висота важлива для preview масштабу.
function expandBundleIfNeeded(root: HTMLElement, cta: HTMLElement | null) {
  // Skip для miniature: forcedHeight вшитий через `style.height`. Якщо є — не торкаємось.
  if (root.style.height) return;

  // 1) Reset попереднього експансу (для точного виміру)
  if (root.dataset.tunerOrigMinH !== undefined) {
    root.style.minHeight = root.dataset.tunerOrigMinH;
    delete root.dataset.tunerOrigMinH;
  }

  const children = Array.from(root.children).filter((c) => {
    if (c.tagName === 'STYLE') return false;
    return getComputedStyle(c as HTMLElement).position !== 'absolute';
  }) as HTMLElement[];
  if (children.length === 0) return;

  // 2) Тимчасово знімаємо cta.marginTop:auto щоб виміряти точну суму контенту
  // (margin:auto у flex column поглинає вільне місце і збиває розрахунок).
  let origMt: string | null = null;
  if (cta) {
    origMt = cta.style.marginTop;
    cta.style.marginTop = '0';
  }
  void root.offsetHeight;

  // 3) Сума: padT + padB + всі children offsetH + margin-bottom між sibling-ами
  const rootCs = getComputedStyle(root);
  const padT = parseFloat(rootCs.paddingTop) || 0;
  const padB = parseFloat(rootCs.paddingBottom) || 0;
  let contentH = 0;
  children.forEach((c, i) => {
    contentH += c.offsetHeight;
    if (i < children.length - 1) {
      contentH += parseFloat(getComputedStyle(c).marginBottom) || 0;
    }
  });
  const needed = padT + padB + contentH;
  const currentH = root.clientHeight;

  // 4) Якщо контент не вміщається — піднімаємо minHeight. +1 tolerance для sub-pixel.
  if (needed > currentH + 1) {
    root.dataset.tunerOrigMinH = root.style.minHeight || '';
    root.style.minHeight = `${needed}px`;
  }

  // 5) Restore CTA marginTop (adjuster нижче все одно своє виставить)
  if (cta && origMt !== null) {
    cta.style.marginTop = origMt;
  }
}

// Правило 41: синхронізує paid-card висоту серед однотипних сусідів у тому ж ряду.
// Кожен бандл зберігає свій naturalMax у dataset під час tune. Sync знаходить mate-ів
// (same type/paid/free, top Y в межах 10px), виводить max(naturals), та застосовує
// через `--tuned-paid-card-h` на всіх учасниках. Після зміни — перезапускає adjuster
// на оновлених бандлах (margins/padding перерозподіляються під нову card.h).
// Idempotent: викликається в кожному autoTuneBundle; перший бандл у ряду просто збереже
// свій natural, останній — знайде всіх готових і застосує row-max.
function syncBundleRow(root: HTMLElement) {
  const paidCards = Array.from(root.querySelectorAll<HTMLElement>('[data-bundle-paid-card]'));
  if (paidCards.length === 0) return;

  // Зберегти natural у dataset (measurement — після adjuster, але cards height фіксована varom)
  const myCardH = parseFloat(root.style.getPropertyValue('--tuned-paid-card-h')) || paidCards[0].offsetHeight;
  root.dataset.bundleNaturalPaidH = String(myCardH);

  const myType = root.getAttribute('data-bundle-type');
  const myPaid = root.getAttribute('data-bundle-paid');
  const myFree = root.getAttribute('data-bundle-free');
  const myTop = root.getBoundingClientRect().top;

  const allRoots = Array.from(document.querySelectorAll<HTMLElement>('[data-bundle-root]'));
  const mates = allRoots.filter((r) => {
    if (r.getAttribute('data-bundle-type') !== myType) return false;
    if (r.getAttribute('data-bundle-paid') !== myPaid) return false;
    if (r.getAttribute('data-bundle-free') !== myFree) return false;
    return Math.abs(r.getBoundingClientRect().top - myTop) < 10;
  });
  if (mates.length < 2) return;

  // Перевірити чи всі mate-и вже мають встановлений natural
  const naturals = mates.map((r) => parseFloat(r.dataset.bundleNaturalPaidH || '0'));
  if (naturals.some((n) => !n || n <= 0)) return;

  const rowMax = Math.max(...naturals);
  const changed: HTMLElement[] = [];
  mates.forEach((r) => {
    const currentVar = parseFloat(r.style.getPropertyValue('--tuned-paid-card-h')) || 0;
    if (Math.abs(currentVar - rowMax) > 1) {
      r.style.setProperty('--tuned-paid-card-h', `${rowMax}px`);
      changed.push(r);
    }
  });

  // Перезапустити adjuster на mate-ах з оновленою card height (margins/padding тепер застарілі)
  changed.forEach((r) => {
    const ct = r.querySelector<HTMLElement>('[data-bundle-cta]');
    adjustBundleSpacing(r, ct);
  });

  // Rule #42d: cross-bundle bundle-height sync. Після того як `expandBundleIfNeeded` встановив
  // кожному mate його natural minHeight — синхронізуємо до max серед mate-ів. Сусіди в ряду
  // вирівнюються знизу; коротші отримують slack → adjuster розподіляє по слотах.
  // Skip для miniature (forcedHeight через style.height).
  const heightMates = mates.filter((r) => !r.style.height);
  if (heightMates.length >= 2) {
    const heightNaturals = heightMates.map((r) => {
      // clientHeight = поточна visible висота (border-box без border). Включає padding + content.
      // expandBundleIfNeeded вже міг підняти minHeight → r.clientHeight ≈ max(unifiedHeight, needed).
      return r.clientHeight;
    });
    const rowMaxH = Math.max(...heightNaturals);
    const changedH: HTMLElement[] = [];
    heightMates.forEach((r) => {
      if (r.clientHeight + 1 < rowMaxH) {
        // Зберегти orig для idempotent reset (якщо ще не збережено expand-ом)
        if (r.dataset.tunerOrigMinH === undefined) {
          r.dataset.tunerOrigMinH = r.style.minHeight || '';
        }
        r.style.minHeight = `${rowMaxH}px`;
        changedH.push(r);
      }
    });
    // Adjuster перерозподілить новий slack по слотах
    changedH.forEach((r) => {
      const ct = r.querySelector<HTMLElement>('[data-bundle-cta]');
      adjustBundleSpacing(r, ct);
    });
  }
}

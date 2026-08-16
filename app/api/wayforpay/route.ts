import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { buildBundleSlugsSnapshot, type BundleSlugsSnapshot } from '@/lib/paymentProvisioning';
import { getYearlyPostAccessMonths, isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { buildRegularPurchaseFlags, getWayforpayCreds } from '@/lib/wayforpay';
import { applyPromoServerSide, resolveServerPricing } from '@/lib/paymentPricing';
import { claimPromoUse, releasePromoUse } from '@/lib/promoUsage';
import { checkRateLimit } from '@/lib/ratelimit';
import { calculateAccessUntil, lastAutopayChargeDate, maxAutopayChargeCount } from '@/lib/yearlyProgramAccess';
import { removeSubscriptionAutopay, recordAutopayRemoveOutcome } from '@/lib/yearlyProgramAutopay';
import { resolveSellableCohort } from '@/lib/yearlyProgramCohort';
import { verifyInvite, type InvitePayload } from '@/lib/yearlyProgramInvite';
import { isValidCountryCode } from '@/lib/countries';
import { parseTelegramUsername } from '@/lib/telegramUsername';

/// Текст, який пишемо в `YearlyProgramSubscription.telegramInviteError`, коли людина
/// оформила Річну без валідного Telegram username. Константа — щоб при повторній
/// покупці з коректним username можна було впізнати й прибрати саме НАШУ помітку,
/// не затерши справжню помилку Bot API.
const MISSING_TELEGRAM_USERNAME_ERROR = 'Telegram username не вказано або невалідний';

/// `orderReference` приходить з браузера і стає UNIQUE-ключем `Payment`. Це означає, що
/// ним можна ЗАЙНЯТИ чужий простір імен: створити PENDING-платіж з ref-ом
/// `tetyana:1001` — і коли з сайту Тетяни реально прийде продаж №1001, його
/// `payment.create` впаде на UNIQUE (P2002) назавжди, бо номер замовлення там не
/// перегенеровується. Те саме з ручними платежами адмінки (`manual-…`).
///
/// Тому простори імен, які веде НЕ цей роут, тут заборонені:
///   `<джерело>:…`   — зовнішні продажі (`/api/external-sales`);
///   `manual-`/`manual_` — ручні платежі Річної (адмінка);
///   `yearly-program…` без валідного суфікса — сміття в просторі Річної (валідні форми
///   `yearly-program_…` і `yearly-program-monthly_…` проходять як звичайні продукти).
/// `connector_` не в списку свідомо: цей роут по такому ref-у взагалі не пише Payment,
/// а ціну бере з наявного `ConnectorOrder` (немає замовлення → 400 вище).
function isReservedOrderReference(ref: string): boolean {
  const lower = ref.trim().toLowerCase();
  if (/^[a-z0-9_-]+:/.test(lower)) return true;
  if (lower.startsWith('manual-') || lower.startsWith('manual_')) return true;
  if (lower.startsWith(YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix) && !isYearlyProgramOrderRef(ref)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'payment');
    if (!rl.ok) return rl.response!;

    const { orderReference, clientEmail, clientName, clientPhone, courseId, promoCode, selectedFreeSlugs, recurring, invite, country, telegramUsername } = await req.json();

    if (typeof orderReference !== 'string' || !orderReference) {
      return NextResponse.json({ error: 'Missing orderReference' }, { status: 400 });
    }
    if (orderReference.length > 200) {
      return NextResponse.json({ error: 'Invalid orderReference' }, { status: 400 });
    }
    if (isReservedOrderReference(orderReference)) {
      console.warn('⛔ Спроба зайняти зарезервований orderReference:', orderReference);
      return NextResponse.json(
        { error: 'Некоректний номер замовлення. Оновіть сторінку і спробуйте ще раз.', code: 'reserved_order_reference' },
        { status: 400 },
      );
    }

    // Manual-add invite: менеджер заздалегідь згенерував signed token із email/plan/cohortId.
    // Якщо token валідний — email, cohortId і (коли задані) план та тип оплати мають
    // збігатися з тим, що прислав браузер: інакше 400. Тобто підписані менеджером умови
    // не підміниш з боку клієнта. Підписка створюється з manuallyAddedAt + прив'язується
    // до cohort-у з token-у замість поточного `isCurrent`.
    let invitePayload: InvitePayload | null = null;
    if (typeof invite === 'string' && invite.length > 0) {
      invitePayload = verifyInvite(invite);
      if (!invitePayload) {
        return NextResponse.json({ error: 'Invite-посилання недійсне або застаріло' }, { status: 400 });
      }
      // Email з body має співпадати з email у token-і — захист від підміни на стороні браузера.
      if (typeof clientEmail === 'string' && clientEmail.trim().toLowerCase() !== invitePayload.email) {
        return NextResponse.json({ error: 'Email не співпадає з invite-посиланням' }, { status: 400 });
      }
      // План визначається префіксом orderReference (yearly-program_ / yearly-program-monthly_),
      // а він приходить з браузера. Без цієї звірки invite на MONTHLY можна було відправити
      // з річним orderReference — інша ціна, інший графік доступу.
      if (invitePayload.plan) {
        const orderKind = isYearlyProgramOrderRef(orderReference);
        const orderPlan = orderKind === 'yearly' ? 'YEARLY' : orderKind === 'monthly' ? 'MONTHLY' : null;
        if (orderPlan !== invitePayload.plan) {
          return NextResponse.json({ error: 'План оплати не співпадає з invite-посиланням' }, { status: 400 });
        }
      }
      // Те саме для «разова / автосписання»: нижче autoRenew рахується саме з `recurring`.
      if (invitePayload.autoRenew !== null && invitePayload.autoRenew !== undefined) {
        if ((recurring === true) !== invitePayload.autoRenew) {
          return NextResponse.json({ error: 'Тип оплати (автосписання) не співпадає з invite-посиланням' }, { status: 400 });
        }
      }
    }

    const creds = getWayforpayCreds();
    const merchantLogin = creds.merchantAccount;
    const secretKey = creds.secretKey;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const domain = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || 'http://localhost:3000');
    const merchantDomain = creds.merchantDomainName;

    const isConnector = orderReference.startsWith('connector_');
    const yearlyKind = isYearlyProgramOrderRef(orderReference);

    // Серверний price lookup — НЕ довіряємо клієнту. Якщо resolveServerPricing повернув null —
    // орder невідомий (неіснуючий bundle/course, не зареєстрований connector order, etc.).
    const resolved = await resolveServerPricing({
      orderReference,
      courseId: typeof courseId === 'string' ? courseId : undefined,
    });
    if (!resolved) {
      return NextResponse.json({ error: 'Unknown product' }, { status: 400 });
    }

    // Промо — теж на сервері. Якщо невалідний — ігноруємо, працюємо з basePrice.
    // courseId для промо — для course/bundle це courseId з body. Для yearly-program —
    // спеціальний slug, проти якого може бути створено PromoCode (наприклад monthlyPromoCode).
    const promoCourseKey = yearlyKind
      ? (yearlyKind === 'monthly' ? YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix : YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix)
      : (typeof courseId === 'string' ? courseId : null);
    // Конектор СВІДОМО без промо на цьому роуті: у гри власна промо-система в
    // `/api/connector` (CategoryPromoOverride category='connector'), яка вже врахована
    // в `ConnectorOrder.amount`. Загальний `PromoCode` з `courseId=null` тут проходив
    // повз усі перевірки і різав суму ще раз — при тому що товар (і сума в замовленні
    // менеджера) лишались повними.
    const { finalPrice: promoFinalPrice, promoId } = await applyPromoServerSide({
      promoCode: !isConnector && typeof promoCode === 'string' ? promoCode : undefined,
      courseId: promoCourseKey,
      basePrice: resolved.basePrice,
      orderReference,
    });

    // Admin/Manager test: дозволяємо символічну ціну 1/2 ₴ для перевірки callback-флоу.
    // Роль перевіряється через session, клієнт не може підробити.
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'MANAGER';
    const adminTestPrice = yearlyKind === 'yearly' ? 2 : 1;
    /// НЕ const: якщо лічильник промокоду не вдасться зайняти (ліміт вичерпали
    /// паралельні покупці), ціна нижче перераховується без знижки.
    let finalAmount = isAdmin ? adminTestPrice : promoFinalPrice;
    /// `PromoCode.id`, використання якого ми реально зайняли під цей платіж. Пишеться
    /// у `Payment.promoCodeId`, щоб Declined/Expired міг повернути його в ліміт.
    let claimedPromoId: string | null = null;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let bundleId: string | null = resolved.bundleId;
    let paymentCourseId: string | null = resolved.paymentCourseId;
    const productName: string = resolved.productName;
    const productCount: number = resolved.productCount;
    /// Поточний cohort Річної програми. Якщо менеджер ще не створив cohort — null
    /// (підписка створюється без cohort, регулярка йде по legacy-логіці = 9 платежів від покупки).
    let currentCohortId: string | null = null;
    /// Дати поточного набору — потрібні і для guard-ів, і для WFP-графіка нижче.
    let currentCohortDates: { startDate: Date; endDate: Date } | null = null;
    /// Скільки місячних платежів підписка вже має (PAID). Реюз існуючої підписки означає,
    /// що майбутніх автосписань має бути менше — інакше upgrade разова→автоплатіж програмує
    /// зайві списання поверх уже сплачених місяців.
    let monthlyPaidCount = 0;
    /// Скільки ВСЬОГО списань (Purchase + регулярні) має бути в цій покупці:
    /// min(лишок за програмою, слотів до кінця набору). null — не рахували (не MONTHLY).
    /// `<= 1` означає «цей платіж останній» → регулярку не створюємо взагалі.
    let autopayTotalPayments: number | null = null;
    /// Якщо лишок за програмою жорсткіший за межу набору — dateEnd рахує сам хелпер
    /// з totalPayments (інакше тримаємо межу набору).
    let autopayLimitedByProgram = false;
    /// Якір графіка (дата, яку покриває перший платіж) — спільний для DB-рішення й WFP-флагів.
    let autopayAnchor: Date | null = null;

    // Для курсів/пакетів/yearly — створюємо/знаходимо користувача і Payment
    if (!isConnector) {
      if (!clientEmail || typeof clientEmail !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }
      /// Defense-in-depth: формат email перевіряємо і на сервері.
      /// Клієнт уже валідовано у CoursePurchaseDialog, але `/api/wayforpay`
      /// доступний прямим POST, тому без серверного гарду «римо» проходить у БД.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
        return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
      }
      /// Нормалізація ДО пошуку/створення юзера: без неї "Ihor@..." і "ihor@..."
      /// давали два різні акаунти, і платежі однієї людини розпорошувались.
      const normalizedEmail = clientEmail.trim().toLowerCase();
      /// Phone: ми приймаємо вже нормалізований номер з prefix (`+380...`). Перевіряємо
      /// тільки що містить розумну кількість цифр (E.164 range 7-15) — детальніша перевірка
      /// на стороні клієнта (per country maxDigits) у CoursePurchaseDialog.
      if (typeof clientPhone === 'string' && clientPhone.trim()) {
        const phoneDigits = clientPhone.replace(/\D/g, '');
        if (phoneDigits.length < 7 || phoneDigits.length > 15) {
          return NextResponse.json({ error: 'Невалідний номер телефону' }, { status: 400 });
        }
      }

      // Знайти активного (НЕ soft-deleted) юзера за email, або створити нового з
      // ім'ям з форми WFP. Soft-deleted користувачі свідомо ігноруються — їх дані
      // (name/email) не повинні потрапляти в нові замовлення та аналітику.
      // Якщо email вже зайнятий soft-deleted юзером — звільняємо слот, перейменувавши
      // його email у `deleted_{timestamp}_{original}`, щоб створити свіжий запис.
      const trimmedName = typeof clientName === 'string' ? clientName.trim() : '';

      let user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' }, deletedAt: null },
      });

      if (user) {
        if (trimmedName && trimmedName !== user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: trimmedName },
          });
        }
      } else {
        const zombie = await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (zombie && zombie.deletedAt) {
          await prisma.user.update({
            where: { id: zombie.id },
            data: { email: `deleted_${Date.now()}_${zombie.email}` },
          });
        }
        user = await prisma.user.create({
          data: { email: normalizedEmail, name: trimmedName },
        });
      }

      // Duplicate-purchase guard для індивідуального курсу: якщо юзер уже має Enrollment
      // на цей курс — блокуємо повторну оплату на етапі форми (до WFP-редіректу).
      // Для пакетів і Річної цей блок не застосовується — пакети валідуємо нижче,
      // Річна має власну логіку cross-plan blocks вище.
      if (paymentCourseId && !bundleId && !yearlyKind) {
        const existingEnrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: paymentCourseId } },
          select: { id: true },
        });
        if (existingEnrollment) {
          return NextResponse.json(
            {
              error: 'У вас уже є цей курс — доступ до нього відкритий на платформі SendPulse. Якщо не можете увійти або потрібна допомога — напишіть на edu@uimp.com.ua',
              code: 'course_already_purchased',
            },
            { status: 409 },
          );
        }
      }

      // Для bundle — валідація вибору безкоштовних (CHOICE_FREE) + обчислення finalFreeSlugs
      let finalFreeSlugs: string[] = [];
      /// Склад пакета, зафіксований ЗАРАЗ. Провіжинінг після callback-у бере курси звідси,
      /// а не з живого bundle — правка складу між оплатою і callback-ом не з'їдає доступ.
      let bundleSnapshot: BundleSlugsSnapshot | null = null;
      if (bundleId) {
        const bundle = await prisma.bundle.findUnique({
          where: { id: bundleId },
          include: { courses: true },
        });
        if (bundle) {
          paymentCourseId = null;
          const fixedFree = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
          const choicePool = fixedFree;

          if (bundle.type === 'FIXED_FREE') {
            finalFreeSlugs = fixedFree;
          } else if (bundle.type === 'CHOICE_FREE') {
            const incoming: string[] = Array.isArray(selectedFreeSlugs) ? selectedFreeSlugs : [];
            const unique = [...new Set(incoming)];
            if (unique.length !== bundle.freeCount) {
              return NextResponse.json(
                { error: `Оберіть рівно ${bundle.freeCount} безкоштовних курсів` },
                { status: 400 },
              );
            }
            if (unique.some((s) => !choicePool.includes(s))) {
              return NextResponse.json(
                { error: 'Один з обраних курсів не входить до пулу пакету' },
                { status: 400 },
              );
            }
            finalFreeSlugs = unique;
          }
          bundleSnapshot = buildBundleSlugsSnapshot(bundle.courses, finalFreeSlugs);
        }
      }

      // Для річної програми — знаходимо/створюємо підписку і лінкуємо Payment
      let yearlyProgramSubscriptionId: string | null = null;
      // Парсимо нові yearly-only поля з форми. Невалідні значення відкидаємо тихо
      // (форма вже валідовано на клієнті — це другий захист, не reject цілої оплати).
      const parsedCountry = yearlyKind && isValidCountryCode(country) ? country : null;
      const parsedTelegram = yearlyKind ? parseTelegramUsername(telegramUsername) : null;
      const normalizedTelegramUsername = parsedTelegram?.ok ? parsedTelegram.normalized : null;
      /// Без валідного username бот не зможе додати людину в канал — фіксуємо це одразу
      /// в `telegramInviteError`, щоб підписка потрапила у вкладку «Помилки» адмінки, а не
      /// виявилась «тихо без Telegram» аж на запуску.
      const telegramInviteError = yearlyKind && parsedTelegram && !parsedTelegram.ok
        ? MISSING_TELEGRAM_USERNAME_ERROR
        : null;
      const normalizedPhone = yearlyKind && typeof clientPhone === 'string' && clientPhone.trim() ? clientPhone.trim() : null;
      if (yearlyKind) {
        // Invite-flow: cohortId беремо з token-у замість поточного `isCurrent`. Дозволяє
        // менеджеру додати студента в конкретний cohort, навіть якщо він не isCurrent.
        if (invitePayload) {
          // Перевіряємо що cohort з invite ще існує (менеджер не видалив після генерації token-у).
          const inviteCohort = await prisma.yearlyProgramCohort.findUnique({
            where: { id: invitePayload.cohortId },
            select: { id: true },
          });
          if (!inviteCohort) {
            return NextResponse.json({ error: 'Cohort з invite-посилання не існує' }, { status: 400 });
          }
          currentCohortId = inviteCohort.id;
        } else {
          // Той самий резолвер, що й публічна сторінка: «Поточний» або fallback на найближчий
          // незавершений запуск. Має збігатися з page.tsx — інакше кнопка активна, а оплата падає.
          const currentCohort = await resolveSellableCohort(prisma);
          currentCohortId = currentCohort?.id ?? null;
          // Без жодного придатного cohort-у не продаємо доступ — бо немає від чого рахувати дати
          // (cohort.startDate / cohort.endDate). Це жорсткий контракт продукту: реєстрація
          // відкрита тільки коли менеджер створив cohort з фіксованими датами.
          if (!currentCohortId) {
            return NextResponse.json({
              error: 'Реєстрація на Річну програму поки закрита. Очікуйте оголошення наступного запуску — ми повідомимо.',
              code: 'no_current_cohort',
            }, { status: 409 });
          }
        }
        const plan = yearlyKind === 'yearly' ? 'YEARLY' : 'MONTHLY';

        // Беремо ВСІ активні (не-термінальні) підписки користувача — потрібно для крос-плановий
        // блок-логіки: одна людина = одна активна Річна-програма (з нюансами).
        const activeSubs = await prisma.yearlyProgramSubscription.findMany({
          where: {
            userId: user.id,
            status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        // PENDING без PAID-платежу = абандон (відкрив форму, не оплатив) → не блокуємо retry.
        const subIsPaid = async (s: { id: string; status: string }) => {
          if (s.status === 'ACTIVE' || s.status === 'GRACE') return true;
          const p = await prisma.payment.findFirst({
            where: { yearlyProgramSubscriptionId: s.id, status: 'PAID' },
            select: { id: true },
          });
          return !!p;
        };
        const yearlySub = activeSubs.find((s) => s.plan === 'YEARLY') ?? null;
        const monthlySub = activeSubs.find((s) => s.plan === 'MONTHLY') ?? null;
        const yearlyPaid = yearlySub ? await subIsPaid(yearlySub) : false;
        const monthlyPaid = monthlySub ? await subIsPaid(monthlySub) : false;

        // Rule 1: активна YEARLY → блокує будь-яку нову оплату (YEARLY/MONTHLY/автоплатіж).
        if (yearlyPaid) {
          return NextResponse.json({
            error: 'Ви вже маєте Річну підписку. Якщо потрібна допомога — напишіть на edu@uimp.com.ua',
            code: 'yearly_already_purchased',
          }, { status: 409 });
        }
        // Rule 2: активний MONTHLY автоплатіж → блокує все. Спочатку треба скасувати
        // автосписання, потім зможе купити заново.
        if (monthlyPaid && monthlySub!.autoRenew) {
          return NextResponse.json({
            error: 'У вас активна Місячна підписка з автосписанням. Спочатку скасуйте автосписання, потім зможете оформити нову оплату. Допомога: edu@uimp.com.ua',
            code: 'monthly_autopay_active',
          }, { status: 409 });
        }
        // Rule 3: активна MONTHLY разова (autoRenew=false) → блокує лише YEARLY. На місячну
        // (разова чи апгрейд на автоплатіж) — допускаємо через існуючий reuse-флоу нижче.
        if (monthlyPaid && !monthlySub!.autoRenew && plan === 'YEARLY') {
          return NextResponse.json({
            error: 'У вас активна Місячна підписка. Перейти на Річну можна після завершення місячного періоду. Допомога: edu@uimp.com.ua',
            code: 'monthly_blocks_yearly',
          }, { status: 409 });
        }

        // Reuse абандонованої PENDING-спроби або того ж same-plan-у. YEARLY-paid вже відсіяний
        // Rule 1, тут лишається лише YEARLY-PENDING-без-PAID (retry) і MONTHLY same-plan.
        let existing = plan === 'YEARLY' ? yearlySub : monthlySub;
        // Реюз — ТІЛЬКИ в межах поточного набору, симетрично до пошуку «мертвої» нижче.
        // Без цього фільтра жива підписка минулорічного набору реюзалась, `repointCohort`
        // переставляв її `cohortId` на поточний, а старі PAID-платежі лишались на місці:
        // `calculateAccessUntil` зараховувала торішні місяці в новому наборі (8 старих +
        // 1 новий = 9/9 → повний доступ і пост-доступ за одну оплату).
        // Підписка без набору (`cohortId=null`, legacy/абандон) реюзається лише поки на ній
        // немає жодної зарахованої оплати — тоді repoint нічого не переносить.
        if (existing && existing.cohortId !== currentCohortId) {
          const existingPaid = plan === 'YEARLY' ? yearlyPaid : monthlyPaid;
          if (existing.cohortId !== null || existingPaid) existing = null;
        }
        // Живої підписки нема → перш ніж заводити нову, шукаємо «мертву» (EXPIRED/CANCELLED)
        // того ж плану В ТОМУ Ж поточному cohort-і й реюзаємо її. Інакше людина, у якої
        // місячна протермінувалась посеред програми, при повторній покупці отримувала б
        // підписку з нуля: сплачені місяці згорають (calculateAccessUntil рахує PAID-платежі
        // саме цієї підписки), а графік доступу стартує заново. Обмеження по cohort-у
        // принципове — підписка минулорічного набору не має воскресати у новому.
        // ВАЖЛИВО: статус мертвої підписки тут НЕ чіпаємо — вона лишається EXPIRED/CANCELLED
        // до реальної оплати. Оживляє її callback (handleYearlyProgramCallback вміє це з
        // 2026-08-04). Передчасний флип у PENDING створював «вічний» неоплачений PENDING зі
        // старими PAID-платежами: він висів у KPI і його підбирав нічний heal — безкоштовний доступ.
        let revivedFromStatus: string | null = null;
        if (!existing) {
          const dead = await prisma.yearlyProgramSubscription.findFirst({
            where: {
              userId: user.id,
              plan,
              status: { in: ['EXPIRED', 'CANCELLED'] },
              cohortId: currentCohortId,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (dead) {
            existing = dead;
            revivedFromStatus = dead.status;
          }
        }

        // Дати набору тягнемо один раз — їх використовують guard-и нижче і побудова
        // WFP-графіка наприкінці запиту.
        if (currentCohortId) {
          currentCohortDates = await prisma.yearlyProgramCohort.findUnique({
            where: { id: currentCohortId },
            select: { startDate: true, endDate: true },
          });
        }

        if (plan === 'MONTHLY' && existing) {
          const paidPayments = await prisma.payment.findMany({
            // `excludedFromAccess` — списання, які система свідомо не зарахувала в доступ
            // (orphan по закритій підписці, понад ліміт, розбіжність суми). Вони не є
            // сплаченим місяцем ні для кепу 9/9, ні для guard-а боргу.
            where: { yearlyProgramSubscriptionId: existing.id, status: 'PAID', excludedFromAccess: false },
            select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true },
          });
          monthlyPaidCount = paidPayments.length;

          // Cap: усі місяці програми вже сплачені — продавати 10-й місяць нікуди.
          // Доступ у такої підписки вже максимальний (cohort.endDate + пост-доступ),
          // новий платіж не дав би нічого, крім списаних грошей.
          if (monthlyPaidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
            return NextResponse.json({
              error: 'Програму вже повністю оплачено. Якщо потрібна допомога — напишіть на edu@uimp.com.ua',
              code: 'monthly_fully_paid',
            }, { status: 409 });
          }

          // Guard боргу (тільки MONTHLY — у YEARLY один платіж, борг неможливий).
          // Місячний графік прив'язаний до КАЛЕНДАРНИХ слотів набору, а не до дати оплати:
          // наступний платіж «займає» слот `anchor + (сплачено + 1) місяців`. Якщо людина
          // пропустила кілька місяців, цей слот уже в минулому — оплата відкрила б доступ,
          // що вже прострочений (callback фіксує такий кейс подією `revived_with_debt`).
          // Грошей наосліп не беремо: рахуємо дату слота ТІЄЮ Ж формулою, що й доступ
          // (calculateAccessUntil із синтетичними майбутніми платежами — щоб не дублювати
          // правила anchor/клемпу/кепа), і відправляємо до менеджера: пропущені місяці
          // він закриває вручну через ручні платежі.
          if (monthlyPaidCount > 0 && currentCohortDates) {
            const postAccessMonths = await getYearlyPostAccessMonths(prisma);
            const nowTs = new Date();
            /// Дата завершення доступу, якщо людина зараз зробить `extra` платежів.
            const accessAfter = (extra: number) => calculateAccessUntil({
              plan: 'MONTHLY',
              autoRenew: existing!.autoRenew,
              cohort: currentCohortDates!,
              payments: [
                ...paidPayments,
                ...Array.from({ length: extra }, () => ({
                  amount: 0,
                  status: 'PAID',
                  paidAt: nowTs,
                  createdAt: nowTs,
                })),
              ],
              postAccessMonths,
            });
            const nextAccessEnd = accessAfter(1);
            if (nextAccessEnd && nextAccessEnd <= nowTs) {
              // Скільки слотів поспіль лишились би в минулому = скільки місяців пропущено.
              let missed = 1;
              while (missed < YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
                const d = accessAfter(missed + 1);
                if (!d || d > nowTs) break;
                missed++;
              }
              const monthWord = missed % 10 === 1 && missed % 100 !== 11
                ? 'місяць'
                : ([2, 3, 4].includes(missed % 10) && ![12, 13, 14].includes(missed % 100) ? 'місяці' : 'місяців');
              return NextResponse.json({
                error: `Пропущено ${missed} ${monthWord} оплат за графіком набору — для поновлення звертніться до менеджера`,
                code: 'monthly_schedule_debt',
              }, { status: 409 });
            }
          }
        }

        // Скільки списань іще має сенс програмувати. Дві межі: лишок за програмою
        // (9 − уже сплачені цією підпискою) і кількість слотів до кінця набору.
        // Без цього upgrade разова→автоплатіж після 2 сплачених місяців створював би
        // регулярку на всі 9 списань — 2 місяці людина оплатила б двічі.
        if (plan === 'MONTHLY') {
          const nowTs = new Date();
          autopayAnchor = currentCohortDates && currentCohortDates.startDate > nowTs
            ? currentCohortDates.startDate
            : nowTs;
          const remainingByProgram = YEARLY_PROGRAM_CONFIG.totalMonthlyPayments - monthlyPaidCount;
          const remainingBySlots = currentCohortDates
            ? maxAutopayChargeCount({
                firstPaymentDate: autopayAnchor,
                cohortEndDate: currentCohortDates.endDate,
              })
            : YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
          autopayTotalPayments = Math.min(remainingByProgram, remainingBySlots);
          autopayLimitedByProgram = remainingByProgram < remainingBySlots;
        }

        if (existing) {
          yearlyProgramSubscriptionId = existing.id;
          // Cohort re-point: підписка, яка ще не має оплаченого доступу (PENDING або щойно
          // оживлена мертва), завжди прив'язується до АКТУАЛЬНОГО cohort-у. Без цього
          // абандонована спроба лишається на старому наборі, і дати доступу рахуються по
          // минулій програмі — оплачений доступ «народжується» вже простроченим, а callback
          // не бачить оплату як «у launched-cohort» (студент не отримує SendPulse-доступ).
          // ACTIVE/GRACE не чіпаємо — це renewal у своєму cohort-і.
          const isPendingLike = existing.status === 'PENDING' || revivedFromStatus !== null;
          const repointCohort = isPendingLike && existing.cohortId !== currentCohortId;
          // Invite-flow додатково позначає підписку як manually added.
          const markManualAdd = !!invitePayload && isPendingLike;
          // Свою ж помітку про відсутній username прибираємо, якщо цього разу він валідний.
          // Справжні помилки Bot API (бот не адмін, канал видалено) не чіпаємо.
          const clearOwnTelegramError = !!normalizedTelegramUsername
            && existing.telegramInviteError === MISSING_TELEGRAM_USERNAME_ERROR;
          // Позначку ставимо, лише коли валідного username нема ВЗАГАЛІ. Якщо він уже
          // збережений з попередньої покупки, а цього разу поле не заповнили — інвайт
          // усе одно можливий, помилку не вигадуємо.
          const telegramErrorToSet = telegramInviteError && !existing.telegramUsername
            ? telegramInviteError
            : null;
          if (parsedCountry || normalizedTelegramUsername || normalizedPhone || repointCohort || markManualAdd || telegramErrorToSet) {
            await prisma.yearlyProgramSubscription.update({
              where: { id: existing.id },
              data: {
                ...(parsedCountry ? { country: parsedCountry } : {}),
                ...(normalizedTelegramUsername ? { telegramUsername: normalizedTelegramUsername } : {}),
                ...(normalizedPhone ? { phone: normalizedPhone } : {}),
                ...(repointCohort ? { cohortId: currentCohortId } : {}),
                ...(telegramErrorToSet ? { telegramInviteError: telegramErrorToSet } : {}),
                ...(clearOwnTelegramError ? { telegramInviteError: null } : {}),
                ...(markManualAdd && !existing.manuallyAddedAt
                  ? { manuallyAddedAt: new Date(), manuallyAddedBy: invitePayload!.invitedBy }
                  : {}),
              },
            });
            if (markManualAdd && repointCohort) {
              await prisma.yearlyProgramSubscriptionEvent.create({
                data: {
                  subscriptionId: existing.id,
                  type: 'admin_action',
                  message: `Manual-add via invite by ${invitePayload!.invitedBy} · re-pointed cohort → ${currentCohortId}`,
                  metadata: {
                    invitedBy: invitePayload!.invitedBy,
                    cohortId: invitePayload!.cohortId,
                    repointedFromCohortId: existing.cohortId,
                  },
                },
              });
            } else if (repointCohort) {
              await prisma.yearlyProgramSubscriptionEvent.create({
                data: {
                  subscriptionId: existing.id,
                  type: 'admin_action',
                  message: existing.cohortId
                    ? `Нова оплата ${orderReference} · набір перепризначено → ${currentCohortId}`
                    : `Нова оплата ${orderReference} · набір призначено → ${currentCohortId}`,
                  metadata: {
                    orderReference,
                    cohortId: currentCohortId,
                    repointedFromCohortId: existing.cohortId,
                  },
                },
              });
            }
          }
          if (revivedFromStatus) {
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: existing.id,
                type: 'repurchase_initiated',
                message: `Ініційована повторна покупка (${orderReference}) — реюзається підписка у статусі ${revivedFromStatus}, сплачені платежі лишаються в заліку. Статус зміниться після успішної оплати.`,
                metadata: {
                  previousStatus: revivedFromStatus,
                  orderReference,
                  plan,
                  cohortId: currentCohortId,
                },
              },
            });
          }
          // Sync autoRenew з recurring — АСИМЕТРИЧНО, і це навмисно.
          // Якщо програмувати нічого (`autopayTotalPayments <= 1` — цей платіж останній),
          // підписка лишається разовою: WFP-регулярки не буде, тож і прапорець брехати не має.
          const desiredAutoRenew = plan === 'MONTHLY' && recurring === true && (autopayTotalPayments ?? 0) > 1;

          // ── АВТОПЛАТІЖ → РАЗОВА (downgrade): застосовуємо одразу на ініціації.
          // Ідемпотентно і безпечно: знімаємо правила у WFP і гасимо прапорець. Навіть якщо
          // людина не доплатить, стан «немає регулярки + autoRenew=false» коректний.
          if (existing.autoRenew && !desiredAutoRenew) {
            // Якщо REMOVE впаде — все одно мутимо БД, щоб уникнути неконсистентного стану;
            // помилку логуємо в subscription event для діагностики.
            const autopay = await removeSubscriptionAutopay(existing.id);
            // Провал REMOVE має підняти окрему подію `wfp_remove_failed`, інакше «знято 0 з 3»
            // губиться в тексті події нижче: ретрай-крок крона і вкладка «Помилки» його не
            // бачать, а регулярка у WFP лишається живою і списує гроші з разової підписки.
            await recordAutopayRemoveOutcome({
              subscriptionId: existing.id,
              result: autopay,
              source: `checkout:${orderReference} · downgrade_to_one_time`,
            });
            await prisma.yearlyProgramSubscription.update({
              where: { id: existing.id },
              data: { autoRenew: false },
            });
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: existing.id,
                type: 'autorenew_downgraded',
                message: `Downgraded to РАЗОВА on new payment · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`,
                metadata: {
                  wfpRemovedCount: autopay.removed,
                  wfpAttemptedCount: autopay.attempted,
                  wfpRemoveError: autopay.error,
                },
              },
            });
          }
          // ── РАЗОВА → АВТОПЛАТІЖ (upgrade): БД тут НЕ чіпаємо.
          // Regular-флаги в payload для WFP усе одно йдуть (нижче), але прапорець у нас
          // виставить Approved-callback — за фактом живого правила у WFP. Інакше людина,
          // яка перемкнула тумблер і закрила вкладку не заплативши, лишалась би з
          // autoRenew=true без жодної регулярки, і Rule 2 («скасуйте автосписання»)
          // блокував би їй наступну оплату — самоблокування без виходу.
          else if (!existing.autoRenew && desiredAutoRenew) {
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: existing.id,
                type: 'autorenew_upgrade_requested',
                message: `Обрано АВТОПЛАТІЖ при оплаті ${orderReference}. Прапорець увімкнеться після успішної оплати — за фактом правила регулярки у WFP.`,
                metadata: { orderReference, plan },
              },
            });
          }
        } else {
          const autoRenew = plan === 'MONTHLY' && recurring === true && (autopayTotalPayments ?? 0) > 1;
          const created = await prisma.yearlyProgramSubscription.create({
            data: {
              userId: user.id,
              plan,
              status: 'PENDING',
              autoRenew,
              cohortId: currentCohortId,
              ...(parsedCountry ? { country: parsedCountry } : {}),
              ...(normalizedTelegramUsername ? { telegramUsername: normalizedTelegramUsername } : {}),
              ...(normalizedPhone ? { phone: normalizedPhone } : {}),
              ...(telegramInviteError ? { telegramInviteError } : {}),
              ...(invitePayload
                ? {
                    manuallyAddedAt: new Date(),
                    manuallyAddedBy: invitePayload.invitedBy,
                  }
                : {}),
            },
          });
          if (invitePayload) {
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: created.id,
                type: 'admin_action',
                message: `Manual-add via invite by ${invitePayload.invitedBy}`,
                metadata: {
                  invitedBy: invitePayload.invitedBy,
                  cohortId: invitePayload.cohortId,
                  plan,
                  autoRenew,
                },
              },
            });
          }
          yearlyProgramSubscriptionId = created.id;
        }
        paymentCourseId = null;
      }

      // Upsert Payment. Якщо Payment вже PAID — відмовляємо (захист від replay
      // з новим selectedFreeSlugs / promo після callback-у).
      const existingPayment = await prisma.payment.findUnique({
        where: { orderReference },
        select: { status: true, userId: true, promoCodeId: true },
      });
      // REFUNDED нарівні з PAID: по поверненому платежу гроші вже пройшли обидва боки,
      // і його рядок — фінансовий слід. Без цієї гілки повторний POST на той самий
      // orderReference переписував товар/суму на поверненому платежі (upsert.update
      // нижче міняє courseId/bundleId/amount), і в звітності рефанд «повертав» уже
      // інший продукт. Нова оплата має йти новим orderReference.
      if (existingPayment?.status === 'PAID' || existingPayment?.status === 'REFUNDED') {
        return NextResponse.json({ error: 'Payment already finalized' }, { status: 409 });
      }
      // Ownership guard: orderReference приходить з браузера, тож чужий (наприклад
      // підглянутий) ref можна було переприсвоїти собі — Payment лишався б із чужим
      // userId, а доступи після оплати отримав би не той, хто платив. Пере-використання
      // свого ж PENDING-у (звичайний retry оплати) працює як раніше.
      if (existingPayment && existingPayment.userId !== user.id) {
        return NextResponse.json(
          { error: 'Це замовлення належить іншому користувачу. Оновіть сторінку і спробуйте ще раз.', code: 'order_owner_mismatch' },
          { status: 409 },
        );
      }

      // ── Промо-лічильник: CAS ДО того, як знижена ціна стане сумою платежу.
      //
      // Раніше порядок був зворотний: знижку рахували в `applyPromoServerSide` (там ліміт
      // перевіряється звичайним читанням `usedCount < maxUses`), Payment створювався вже
      // з акційною сумою, і лише ПОТІМ ішов атомарний інкремент — результат якого ніхто
      // не дивився. Тобто при `maxUses = 1` п'ять паралельних чекаутів усі читали
      // `usedCount = 0`, усі отримували знижку, а CAS дозволяв інкремент рівно одному:
      // лічильник казав «використано 1», а продано за акцією було п'ять.
      //
      // Тепер: спершу займаємо використання, і тільки якщо зайняли — лишаємо знижку.
      // Не зайняли (ліміт вичерпали інші) — ціна перераховується без промо, людина бачить
      // повну суму у формі WFP.
      //
      // Адмін-тест (1–2 ₴) використання не займає: ціна там і так перевизначена.
      if (promoId && !isAdmin) {
        const alreadyClaimedHere = existingPayment?.promoCodeId === promoId;
        if (alreadyClaimedHere) {
          // Ретрай тієї ж оплати з тим самим кодом — використання вже зайняте цим
          // замовленням, вдруге лічильник не чіпаємо.
          claimedPromoId = promoId;
        } else if (await claimPromoUse(promoId)) {
          claimedPromoId = promoId;
        } else {
          finalAmount = resolved.basePrice;
          console.warn('ℹ️ Промокод вичерпано на етапі CAS — ціна без знижки:', orderReference, promoId);
        }
      }
      // На цьому ж замовленні раніше був ІНШИЙ промокод (людина повернулась і ввела новий,
      // або цього разу без коду) — повертаємо старе використання в ліміт.
      if (existingPayment?.promoCodeId && existingPayment.promoCodeId !== claimedPromoId) {
        await releasePromoUse(existingPayment.promoCodeId);
      }

      if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      await prisma.payment.upsert({
        where: { orderReference },
        create: {
          userId: user.id,
          courseId: paymentCourseId,
          bundleId,
          orderReference,
          amount: finalAmount,
          status: 'PENDING',
          freeSlugs: finalFreeSlugs,
          bundleSlugsSnapshot: bundleSnapshot ?? Prisma.DbNull,
          yearlyProgramSubscriptionId,
          promoCodeId: claimedPromoId,
        },
        // ВАЖЛИВО: update переписує і ТОВАР, не лише суму. Інакше повторний POST з тим
        // самим orderReference, але іншим courseId/bundleId, змінював суму на дешевшу,
        // а courseId/bundleId лишались від першого (дорогого) створення — оплата 1 курсу
        // видавала пакет. Товар і сума мають походити з ОДНОГО запиту.
        update: {
          userId: user.id,
          courseId: paymentCourseId,
          bundleId,
          amount: finalAmount,
          freeSlugs: finalFreeSlugs,
          // Snapshot переписуємо разом з товаром: інакше повторний POST на той самий
          // orderReference з іншим пакетом лишив би склад від першого.
          bundleSlugsSnapshot: bundleSnapshot ?? Prisma.DbNull,
          yearlyProgramSubscriptionId,
          // Пишемо і в update: за цим полем Declined/Expired-callback повертає
          // використання в ліміт, а повторний POST розуміє, що воно вже зайняте.
          promoCodeId: claimedPromoId,
        },
      });
    }

    const orderDate = Math.floor(Date.now() / 1000);

    const signatureString = [
      merchantLogin,
      merchantDomain,
      orderReference,
      orderDate,
      finalAmount,
      'UAH',
      productName,
      productCount,
      // Ціна товару = підсумкова сума (в чеку один товар). Беремо `finalAmount` тут, після
      // можливого перерахунку без промо — інакше підпис пішов би зі старою ціною.
      finalAmount,
    ].join(';');

    const merchantSignature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex');

    const paymentData: Record<string, unknown> = {
      merchantAccount: merchantLogin,
      merchantDomainName: merchantDomain,
      orderReference,
      orderDate,
      amount: finalAmount,
      currency: 'UAH',
      orderLifetime: 86400,
      productName: [productName],
      productPrice: [finalAmount],
      productCount: [productCount],
      clientEmail,
      clientFirstName: typeof clientName === 'string' ? clientName.split(' ')[0] || '' : '',
      clientLastName: typeof clientName === 'string' ? clientName.split(' ').slice(1).join(' ') || '' : '',
      clientPhone: typeof clientPhone === 'string' ? clientPhone : '',
      returnUrl: `${domain}/api/wayforpay/return`,
      serviceUrl: `${domain}/api/wayforpay/callback`,
      merchantSignature,
      language: 'UA',
    };

    // Для MONTHLY плану Річної програми — увімкнути токенізацію й регулярне щомісячне списання.
    // Admin теж отримує regular flags — це свідомий вибір: для перевірки cyclical потоку треба
    // справжню регулярку на стороні WFP. Адмін після тесту викликає Cancel → removeRegularSchedule.
    // `autopayTotalPayments <= 1` — програмувати нічого: цей платіж закриває або останній
    // місяць програми, або останній слот набору. Регулярні флаги не чіпляємо взагалі —
    // покупка йде як разова (підписка вище теж лишилась з autoRenew=false).
    if (yearlyKind === 'monthly' && recurring !== false && (autopayTotalPayments ?? 0) > 1) {
      // Якщо є поточний cohort — обмежуємо регулярку cohort.endDate, щоб остання
      // автосписання не виходила за межі програми. Без cohort — стара поведінка
      // (9 платежів × 30 днів від моменту покупки).
      const totalPayments = autopayTotalPayments!;
      let regularFlags: ReturnType<typeof buildRegularPurchaseFlags>;
      if (currentCohortDates && autopayAnchor) {
        // Покупка ДО старту програми: перший (Purchase) платіж покриває перший місяць
        // ВІД дати старту cohort-у, тому WFP-графік наступних списань якоримо на
        // cohort.startDate, а не на дату покупки: dateNext = anchor + 1 місяць.
        // Друге списання прийде через місяць після старту, а не через місяць після
        // покупки. Після старту — як раніше (від now).
        regularFlags = buildRegularPurchaseFlags({
          amount: finalAmount,
          anchor: autopayAnchor,
          // Межу набору тримаємо лише коли саме вона обмежує кількість списань. Якщо
          // жорсткіший лишок за програмою (реюз підписки з уже сплаченими місяцями) —
          // dateEnd рахує хелпер з totalPayments, інакше WFP списував би до кінця набору.
          ...(autopayLimitedByProgram
            ? {}
            : {
                dateEnd: lastAutopayChargeDate({
                  firstPaymentDate: autopayAnchor,
                  cohortEndDate: currentCohortDates.endDate,
                }),
              }),
          totalPayments,
        });
      } else {
        regularFlags = buildRegularPurchaseFlags({
          amount: finalAmount,
          totalPayments,
        });
      }
      Object.assign(paymentData, regularFlags);
    }

    return NextResponse.json(paymentData);
  } catch (error) {
    console.error('❌ Помилка створення платежу:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

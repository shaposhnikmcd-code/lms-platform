import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { buildRegularPurchaseFlags, getWayforpayCreds } from '@/lib/wayforpay';
import { applyPromoServerSide, resolveServerPricing } from '@/lib/paymentPricing';
import { checkRateLimit } from '@/lib/ratelimit';
import { lastAutopayChargeDate, maxAutopayChargeCount } from '@/lib/yearlyProgramAccess';
import { removeSubscriptionAutopay } from '@/lib/yearlyProgramAutopay';
import { verifyInvite, type InvitePayload } from '@/lib/yearlyProgramInvite';

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'payment');
    if (!rl.ok) return rl.response!;

    const { orderReference, clientEmail, clientName, clientPhone, courseId, promoCode, selectedFreeSlugs, recurring, invite } = await req.json();

    if (typeof orderReference !== 'string' || !orderReference) {
      return NextResponse.json({ error: 'Missing orderReference' }, { status: 400 });
    }

    // Manual-add invite: менеджер заздалегідь згенерував signed token із email/plan/cohortId.
    // Якщо token валідний — primary email/plan/autoRenew йдуть з token-у, не з body
    // (захист від підміни клієнтом). Підписка створюється з manuallyAddedAt + прив'язується
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
    const { finalPrice: promoFinalPrice, promoId } = await applyPromoServerSide({
      promoCode: typeof promoCode === 'string' ? promoCode : undefined,
      courseId: promoCourseKey,
      basePrice: resolved.basePrice,
    });

    // Admin/Manager test: дозволяємо символічну ціну 1/2 ₴ для перевірки callback-флоу.
    // Роль перевіряється через session, клієнт не може підробити.
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'MANAGER';
    const adminTestPrice = yearlyKind === 'yearly' ? 2 : 1;
    const finalAmount = isAdmin ? adminTestPrice : promoFinalPrice;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let bundleId: string | null = resolved.bundleId;
    let paymentCourseId: string | null = resolved.paymentCourseId;
    const productName: string = resolved.productName;
    const productPrice: number = finalAmount;
    const productCount: number = resolved.productCount;
    /// Поточний cohort Річної програми. Якщо менеджер ще не створив cohort — null
    /// (підписка створюється без cohort, регулярка йде по legacy-логіці = 9 платежів від покупки).
    let currentCohortId: string | null = null;

    // Для курсів/пакетів/yearly — створюємо/знаходимо користувача і Payment
    if (!isConnector) {
      if (!clientEmail || typeof clientEmail !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }

      // Знайти активного (НЕ soft-deleted) юзера за email, або створити нового з
      // ім'ям з форми WFP. Soft-deleted користувачі свідомо ігноруються — їх дані
      // (name/email) не повинні потрапляти в нові замовлення та аналітику.
      // Якщо email вже зайнятий soft-deleted юзером — звільняємо слот, перейменувавши
      // його email у `deleted_{timestamp}_{original}`, щоб створити свіжий запис.
      const trimmedName = typeof clientName === 'string' ? clientName.trim() : '';

      let user = await prisma.user.findFirst({
        where: { email: clientEmail, deletedAt: null },
      });

      if (user) {
        if (trimmedName && trimmedName !== user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: trimmedName },
          });
        }
      } else {
        const zombie = await prisma.user.findUnique({ where: { email: clientEmail } });
        if (zombie && zombie.deletedAt) {
          await prisma.user.update({
            where: { id: zombie.id },
            data: { email: `deleted_${Date.now()}_${zombie.email}` },
          });
        }
        user = await prisma.user.create({
          data: { email: clientEmail, name: trimmedName },
        });
      }

      // Для bundle — валідація вибору безкоштовних (CHOICE_FREE) + обчислення finalFreeSlugs
      let finalFreeSlugs: string[] = [];
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
        }
      }

      // Для річної програми — знаходимо/створюємо підписку і лінкуємо Payment
      let yearlyProgramSubscriptionId: string | null = null;
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
          const currentCohort = await prisma.yearlyProgramCohort.findFirst({
            where: { isCurrent: true },
            select: { id: true },
          });
          currentCohortId = currentCohort?.id ?? null;
          // Без активного cohort-у не продаємо доступ — бо немає від чого рахувати дати
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
        const existing = plan === 'YEARLY' ? yearlySub : monthlySub;
        if (existing) {
          yearlyProgramSubscriptionId = existing.id;
          // Sync autoRenew з recurring у обидва боки. Без цього БД залишається "разова"
          // навіть коли юзер апгрейдиться на АВТОПЛАТІЖ (callback пише monthly-once у логи).
          const desiredAutoRenew = plan === 'MONTHLY' && recurring === true;
          if (existing.autoRenew !== desiredAutoRenew) {
            // Downgrade: знімаємо ВСІ WFP-регулярки existing підписки перед UPDATE.
            // Якщо REMOVE впаде — все одно мутимо БД, щоб уникнути неконсистентного стану;
            // помилку логуємо в subscription event для діагностики.
            const downgrade = !desiredAutoRenew && existing.autoRenew;
            const autopay = downgrade
              ? await removeSubscriptionAutopay(existing.id)
              : { removed: 0, attempted: 0, error: null };

            await prisma.yearlyProgramSubscription.update({
              where: { id: existing.id },
              data: {
                autoRenew: desiredAutoRenew,
              },
            });
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: existing.id,
                type: desiredAutoRenew ? 'autorenew_upgraded' : 'autorenew_downgraded',
                message: desiredAutoRenew
                  ? 'Upgraded to АВТОПЛАТІЖ on new payment'
                  : `Downgraded to РАЗОВА on new payment · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`,
                metadata: {
                  wfpRemovedCount: autopay.removed,
                  wfpAttemptedCount: autopay.attempted,
                  wfpRemoveError: autopay.error,
                },
              },
            });
          }
        } else {
          const autoRenew = plan === 'MONTHLY' && recurring === true;
          const created = await prisma.yearlyProgramSubscription.create({
            data: {
              userId: user.id,
              plan,
              status: 'PENDING',
              autoRenew,
              cohortId: currentCohortId,
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
        select: { status: true },
      });
      if (existingPayment?.status === 'PAID') {
        return NextResponse.json({ error: 'Payment already finalized' }, { status: 409 });
      }

      const isNewPayment = !existingPayment;
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
          yearlyProgramSubscriptionId,
        },
        update: {
          amount: finalAmount,
          freeSlugs: finalFreeSlugs,
          yearlyProgramSubscriptionId,
        },
      });

      // Idempotent promo counter: інкрементуємо usedCount лише на першому створенні Payment.
      // Raw SQL гарантує атомарну перевірку maxUses (CAS) — дві паралельні оплати не зможуть
      // перевищити ліміт.
      if (isNewPayment && promoId) {
        await prisma.$executeRaw`
          UPDATE "PromoCode"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${promoId}
            AND "active" = true
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        `;
      }
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
      productPrice,
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
      productPrice: [productPrice],
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
    if (yearlyKind === 'monthly' && recurring !== false) {
      // Якщо є поточний cohort — обмежуємо регулярку cohort.endDate, щоб остання
      // автосписання не виходила за межі програми. Без cohort — стара поведінка
      // (9 платежів × 30 днів від моменту покупки).
      let regularFlags: ReturnType<typeof buildRegularPurchaseFlags>;
      if (currentCohortId) {
        const cohort = await prisma.yearlyProgramCohort.findUnique({
          where: { id: currentCohortId },
          select: { endDate: true },
        });
        if (cohort) {
          const now = new Date();
          const totalPayments = maxAutopayChargeCount({
            firstPaymentDate: now,
            cohortEndDate: cohort.endDate,
          });
          const dateEndCohort = lastAutopayChargeDate({
            firstPaymentDate: now,
            cohortEndDate: cohort.endDate,
          });
          regularFlags = buildRegularPurchaseFlags({
            amount: finalAmount,
            dateBegin: now,
            dateEnd: dateEndCohort,
            totalPayments,
          });
        } else {
          regularFlags = buildRegularPurchaseFlags({
            amount: finalAmount,
            totalPayments: YEARLY_PROGRAM_CONFIG.totalMonthlyPayments,
          });
        }
      } else {
        regularFlags = buildRegularPurchaseFlags({
          amount: finalAmount,
          totalPayments: YEARLY_PROGRAM_CONFIG.totalMonthlyPayments,
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

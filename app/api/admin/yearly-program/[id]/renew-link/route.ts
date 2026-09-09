import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getStaffActor } from '@/lib/adminAuth';
import { issueRenewLink } from '@/lib/yearlyProgramRenew';
import { nextUnpaidModule } from '@/lib/yearlyProgramModules';

/// POST /api/admin/yearly-program/[id]/renew-link
/// Повертає: { url, expiresAt, module? }
///
/// Персональне посилання «Оплатити наступний модуль» для конкретної підписки — те саме,
/// що система вкладає в листи-нагадування. Менеджеру воно потрібно окремо: студент
/// загубив лист, пише в Telegram, і копіювати треба тут і зараз.
///
/// Доступ — ADMIN і MANAGER: це не дія над грошима, а копія посилання, яке студент і
/// так отримує поштою. Жодних повноважень токен не дає — усі гварди оплати працюють
/// однаково і для нього (див. lib/yearlyProgramRenew.ts).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffActor(req);
  if (!staff) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actorLabel = staff.actor.email ?? staff.actor.name ?? staff.role.toLowerCase();
  const { id } = await params;

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    select: {
      id: true,
      plan: true,
      status: true,
      autoRenew: true,
      cohortId: true,
      user: { select: { email: true } },
      cohort: { select: { startDate: true, endDate: true } },
      payments: {
        where: { status: 'PAID', excludedFromAccess: false },
        select: {
          amount: true, status: true, paidAt: true, createdAt: true,
          excludedFromAccess: true, manualMethod: true,
        },
      },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json(
      { error: 'Посилання на оплату модуля існує тільки для місячної підписки' },
      { status: 400 },
    );
  }
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json(
      { error: 'Підписку деактивовано — посилання на оплату не видаємо' },
      { status: 400 },
    );
  }
  // Автоплатіж списує сам. Посилання відкриє сторінку, яка чесно скаже «у вас підключене
  // автосписання» — і менеджер даремно надішле студенту глухий кут. Краще відмовити тут.
  if (sub.autoRenew) {
    return NextResponse.json(
      { error: 'У підписки увімкнене автосписання — модуль спишеться сам. Спочатку вимкніть автоплатіж.' },
      { status: 409 },
    );
  }
  if (!sub.cohortId) {
    return NextResponse.json(
      { error: 'Підписка не привʼязана до набору — сітки модулів немає' },
      { status: 400 },
    );
  }
  // Жодного зарахованого платежу — посилання видавати нема за чим: воно продовжує вже
  // почате навчання, а не відкриває його. Manual-add у режимі «чекаємо перший платіж»
  // створює саме таку підписку (PENDING без оплат), і сторінка на неї чесно відповість
  // `no_payment`, а `/api/wayforpay` при закритій реєстрації — 409. Менеджеру треба
  // сказати це тут, поки він не надіслав студенту глухий кут; перший платіж іде через
  // invite-запрошення.
  if (sub.payments.length === 0) {
    return NextResponse.json(
      {
        error: 'За підпискою ще не було оплат — посилання на оплату модуля продовжує вже почате навчання. '
          + 'Перший платіж оформіть через запрошення («Додати студента»).',
      },
      { status: 409 },
    );
  }
  const email = sub.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'У підписки немає email' }, { status: 400 });
  }

  // Модуль лише для тексту тоста — посилання видаємо і тоді, коли модуль порахувати
  // не вдалось (сторінка все одно покаже студенту чесний стан).
  const nextModule = sub.cohort
    ? nextUnpaidModule({ cohort: sub.cohort, payments: sub.payments })
    : null;

  const { url, expiresAt } = issueRenewLink({
    subscriptionId: sub.id,
    email,
    cohortId: sub.cohortId,
    origin: originOf(req),
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Renew link issued by ${actorLabel}`
        + (nextModule ? ` · модуль ${nextModule.number} з ${nextModule.total}` : '')
        + ` · дійсне до ${expiresAt.toISOString().slice(0, 10)}`,
      metadata: {
        issuedBy: actorLabel,
        cohortId: sub.cohortId,
        module: nextModule?.number ?? null,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    url,
    expiresAt: expiresAt.toISOString(),
    module: nextModule ? { number: nextModule.number, total: nextModule.total, monthLabel: nextModule.monthLabel } : null,
  });
}

/// Origin з самого запиту — щоб посилання, скопійоване на pre.uimp, вело на pre, а не
/// на прод (де цієї підписки може не бути взагалі).
function originOf(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

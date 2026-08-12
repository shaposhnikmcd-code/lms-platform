import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { timingSafeEqualStr } from '@/lib/authTiming';
import { provisionPayment } from '@/lib/paymentProvisioning';
import { notifyManagers, isNotificationDelivered } from '@/lib/connectorNotifications';
import { alertStuckPayments } from '@/lib/paymentAlerts';

/// Вхідний webhook від зовнішніх сайтів (зараз — персональний сайт Тетяни).
/// Приймає факт успішної оплати й створює Payment або ConnectorOrder з source=TETYANA,
/// щоб продаж відображався в Адмінці/Аналітиці разом з маркером джерела.
///
/// Ідемпотентний по (source, externalRef): повторний виклик на той самий externalRef
/// не створює дубль.
///
/// `amount` — ЦІЛЕ число ГРИВЕНЬ (не копійок), як і всюди в системі. Відправник
/// (`tetyana-website/lib/lmsWebhook.ts`) бере суму з власного `Payment.amount` /
/// `ConnectorOrder.amount`, а вони теж у гривнях.

const SOURCE_VALUES = ['TETYANA'] as const;
type ExternalSource = (typeof SOURCE_VALUES)[number];

/// Номер замовлення із зовнішнього сайту вже зайнятий іншим записом у нашій базі.
/// Викидається з хендлера, POST перетворює її на 409 — щоб відправник побачив
/// відмову і не вважав продаж записаним.
class OrderRefConflictError extends Error {
  constructor(readonly prefixedRef: string, readonly detail: string) {
    super(`orderReference conflict: ${prefixedRef} — ${detail}`);
  }
}

/// Конфлікт номера означає «продаж стався, а в базі його немає» — німим це лишати не
/// можна: клієнт заплатив на зовнішньому сайті і чекає доступ. Шлемо той самий алерт,
/// що й recon-cron («гроші є, доступу немає»). Best-effort: не кидає.
async function alertOrderRefConflict(args: {
  prefixedRef: string;
  amount: number;
  currency: string;
  email: string;
  productLabel: string;
  detail: string;
}): Promise<void> {
  try {
    await alertStuckPayments([{
      kind: 'order_ref_conflict',
      orderReference: args.prefixedRef,
      amount: args.amount,
      currency: args.currency,
      clientEmail: args.email,
      productLabel: args.productLabel,
      reason: args.detail.slice(0, 300),
      paidAt: new Date(),
    }]);
  } catch (e) {
    console.error('❌ [external-sales] alert про конфлікт номера не пішов:', args.prefixedRef, e);
  }
}

interface CourseSalePayload {
  kind: 'course';
  source: ExternalSource;
  externalRef: string;
  amount: number;
  currency?: string;
  paidAt?: string;
  email: string;
  fullName?: string;
  courseSlug?: string;
  courseTitle?: string;
}

interface ConnectorSalePayload {
  kind: 'connector';
  source: ExternalSource;
  externalRef: string;
  amount: number;
  currency?: string;
  paidAt?: string;
  email: string;
  fullName: string;
  phone: string;
  city?: string;
  postOffice?: string;
  gamePrice?: number;
  shippingCost?: number;
  callMe?: boolean;
}

type Payload = CourseSalePayload | ConnectorSalePayload;

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.EXTERNAL_SALES_SECRET;
  if (!secret || !header) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualStr(header, expected);
}

function isCoursePayload(p: Payload): p is CourseSalePayload {
  return p.kind === 'course';
}

function isConnectorPayload(p: Payload): p is ConnectorSalePayload {
  return p.kind === 'connector';
}

function validate(raw: Record<string, unknown>): Payload | string {
  if (!SOURCE_VALUES.includes(raw.source as ExternalSource)) return 'source must be TETYANA';
  if (typeof raw.externalRef !== 'string' || !raw.externalRef.trim()) return 'externalRef required';
  // Одиниця — ГРИВНІ (ціле), як і в усій системі: `Payment.amount`, `ConnectorOrder.amount`,
  // сума у WayForPay. Відправник (tetyana-website, `lib/lmsWebhook.ts`) шле саме
  // `payment.amount` / `order.amount` зі своєї бази, а вони теж у гривнях (адмін-тест = 1).
  // У старому докстрінгу тут стояли «kopiykas» — це було неправдою і при першому ж
  // «виправленні» під нього ціни поїхали б у 100 разів.
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    return 'amount required (positive integer, UAH)';
  }
  if (typeof raw.email !== 'string' || !raw.email.includes('@')) return 'email required';

  if (raw.kind === 'course') {
    return raw as unknown as CourseSalePayload;
  }
  if (raw.kind === 'connector') {
    if (typeof raw.fullName !== 'string' || !raw.fullName.trim()) return 'fullName required for connector';
    if (typeof raw.phone !== 'string' || !raw.phone.trim()) return 'phone required for connector';
    return raw as unknown as ConnectorSalePayload;
  }
  return 'kind must be "course" or "connector"';
}

async function handleCourse(p: CourseSalePayload) {
  const prefixedRef = `${p.source.toLowerCase()}:${p.externalRef}`;

  const existing = await prisma.payment.findFirst({
    where: { source: p.source, externalRef: p.externalRef },
    select: { id: true, status: true },
  });
  if (existing) {
    return { created: false, id: existing.id, status: existing.status };
  }

  // Користувач — тією ж логікою, що й у WFP-чекауті: беремо лише ЖИВОГО (не soft-deleted).
  // Голий `upsert` по email оживляв би видаленого: продаж лінкувався б у запис із
  // `deletedAt`, який адмінка й аналітика не показують — оплата ставала невидимою, а
  // доступ ішов на «видалений» акаунт. Якщо email тримає soft-deleted запис, звільняємо
  // слот перейменуванням і заводимо свіжого студента.
  const email = p.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, name: true } });
  if (user) {
    if (p.fullName && p.fullName !== user.name) {
      await prisma.user.update({ where: { id: user.id }, data: { name: p.fullName } });
    }
  } else {
    const zombie = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, deletedAt: true } });
    if (zombie?.deletedAt) {
      await prisma.user.update({
        where: { id: zombie.id },
        data: { email: `deleted_${Date.now()}_${zombie.email}` },
      });
    }
    user = await prisma.user.create({
      data: { email, name: p.fullName ?? null, role: 'STUDENT' },
      select: { id: true, name: true },
    });
  }

  let courseId: string | null = null;
  if (p.courseSlug) {
    const course = await prisma.course.findUnique({
      where: { slug: p.courseSlug },
      select: { id: true },
    });
    courseId = course?.id ?? null;
  }

  // `orderReference` унікальний, а формується з номера зовнішнього замовлення. Якщо цей
  // номер уже зайнятий (сквотнутий чекаутом, зіткнення нумерацій, паралельний ретрай
  // цього ж вебхука) — `create` падає на P2002. Голий throw давав 500 і мовчазну втрату
  // продажу назавжди: відправник ретраїть 3 рази, отримує 500 і здається.
  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        userId: user.id,
        courseId,
        orderReference: prefixedRef,
        amount: p.amount,
        currency: p.currency ?? 'UAH',
        status: 'PAID',
        paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
        source: p.source,
        externalRef: p.externalRef,
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
    const clash = await prisma.payment.findUnique({
      where: { orderReference: prefixedRef },
      select: { id: true, status: true, source: true, externalRef: true },
    });
    // Наш же запис (паралельний виклик того самого вебхука встиг першим) — відповідаємо
    // ідемпотентно 200, як і на повторний виклик по (source, externalRef).
    if (clash && clash.source === p.source && clash.externalRef === p.externalRef) {
      return { created: false, id: clash.id, status: clash.status, idempotent: 'race' as const };
    }
    const detail = clash
      ? `номер зайнятий платежем ${clash.id} (source=${clash.source}, status=${clash.status})`
      : 'номер зайнятий, але конфліктний запис не знайдено';
    await alertOrderRefConflict({
      prefixedRef,
      amount: p.amount,
      currency: p.currency ?? 'UAH',
      email,
      productLabel: p.courseTitle ?? p.courseSlug ?? 'Курс (зовнішній продаж)',
      detail,
    });
    throw new OrderRefConflictError(prefixedRef, detail);
  }

  // Доступ видаємо тим самим шляхом, що й WFP-callback: enrollment.upsert + SendPulse-подія
  // (реєстрація на курс у SP) + timestamps провіжинінгу. Раніше тут був голий
  // `enrollment.upsert` — запис у нашій БД з'являвся, а листа/доступу в SendPulse клієнт
  // не отримував узагалі. Best-effort: помилки осідають у `Payment.provisionError`,
  // recon-cron доганяє.
  let provisioned: string[] = [];
  let provisionErrors: string[] = [];
  if (courseId) {
    const provision = await provisionPayment(payment);
    provisioned = provision.enrollmentsCreated;
    provisionErrors = provision.errors;
    if (provision.errors.length > 0) {
      console.error('⚠️ [external-sales] провіжинінг курсу не завершився:', prefixedRef, provision.errors);
    }
  }

  return {
    created: true,
    id: payment.id,
    courseMatched: !!courseId,
    enrollments: provisioned,
    provisionErrors,
  };
}

async function handleConnector(p: ConnectorSalePayload) {
  const prefixedRef = `${p.source.toLowerCase()}:${p.externalRef}`;

  const existing = await prisma.connectorOrder.findFirst({
    where: { source: p.source, externalRef: p.externalRef },
    select: { id: true, paymentStatus: true },
  });
  if (existing) {
    return { created: false, id: existing.id, status: existing.paymentStatus };
  }

  // Той самий захист від зайнятого номера, що й для курсів (P2002 на unique
  // `orderReference`): наш паралельний ретрай → ідемпотентні 200, чужий запис → 409+алерт.
  let order;
  try {
    order = await prisma.connectorOrder.create({
    data: {
      email: p.email.toLowerCase(),
      fullName: p.fullName,
      phone: p.phone,
      city: p.city ?? '',
      postOffice: p.postOffice ?? '',
      orderReference: prefixedRef,
      amount: p.amount,
      gamePrice: p.gamePrice ?? null,
      shippingCost: p.shippingCost ?? null,
      paymentStatus: 'PAID',
      paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
      orderStatus: 'NEW',
      callMe: p.callMe ?? false,
      source: p.source,
      externalRef: p.externalRef,
    },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
    const clash = await prisma.connectorOrder.findUnique({
      where: { orderReference: prefixedRef },
      select: { id: true, paymentStatus: true, source: true, externalRef: true },
    });
    if (clash && clash.source === p.source && clash.externalRef === p.externalRef) {
      return { created: false, id: clash.id, status: clash.paymentStatus, idempotent: 'race' as const };
    }
    const detail = clash
      ? `номер зайнятий замовленням ${clash.id} (source=${clash.source}, status=${clash.paymentStatus})`
      : 'номер зайнятий, але конфліктний запис не знайдено';
    await alertOrderRefConflict({
      prefixedRef,
      amount: p.amount,
      currency: p.currency ?? 'UAH',
      email: p.email.toLowerCase(),
      productLabel: 'Гра Конектор (зовнішній продаж)',
      detail,
    });
    throw new OrderRefConflictError(prefixedRef, detail);
  }

  // Замовлення прийшло вже ОПЛАЧЕНИМ, тож менеджерам потрібна та сама нотифікація
  // 'paid', що й з WFP-callback-у — інакше оплачена гра із зовнішнього сайту тихо
  // лежала б у списку, і ніхто б її не відправив. `notifyManagers` не кидає.
  const notify = await notifyManagers('paid', order);
  const notified = isNotificationDelivered(notify);
  if (notified) {
    await prisma.connectorOrder.update({
      where: { id: order.id },
      data: { paidNotifiedAt: new Date() },
    });
  }

  return { created: true, id: order.id, managersNotified: notified };
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!verifySignature(rawBody, req.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const payload = validate(raw);
  if (typeof payload === 'string') {
    return NextResponse.json({ error: payload }, { status: 400 });
  }

  try {
    const result = isCoursePayload(payload)
      ? await handleCourse(payload)
      : isConnectorPayload(payload)
        ? await handleConnector(payload)
        : null;
    if (!result) return NextResponse.json({ error: 'unreachable' }, { status: 500 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderRefConflictError) {
      // 409, а не 500: ретраї відправника нічого не полагодять — номер зайнятий і буде
      // зайнятий далі. Менеджерам уже пішов алерт, розбір ручний.
      console.error('⛔ external-sales orderReference conflict:', err.message);
      return NextResponse.json(
        { error: 'orderReference already taken by another record', code: 'order_ref_conflict', orderReference: err.prefixedRef },
        { status: 409 },
      );
    }
    console.error('❌ external-sales error:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

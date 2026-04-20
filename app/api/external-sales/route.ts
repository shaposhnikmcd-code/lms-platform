import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { timingSafeEqualStr } from '@/lib/authTiming';

/// Вхідний webhook від зовнішніх сайтів (зараз — персональний сайт Тетяни).
/// Приймає факт успішної оплати й створює Payment або ConnectorOrder з source=TETYANA,
/// щоб продаж відображався в Адмінці/Аналітиці разом з маркером джерела.
///
/// Ідемпотентний по (source, externalRef): повторний виклик на той самий externalRef
/// не створює дубль.

const SOURCE_VALUES = ['TETYANA'] as const;
type ExternalSource = (typeof SOURCE_VALUES)[number];

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
  if (typeof raw.amount !== 'number' || raw.amount <= 0) return 'amount required (positive integer kopiykas)';
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

  const user = await prisma.user.upsert({
    where: { email: p.email.toLowerCase() },
    update: p.fullName ? { name: p.fullName } : {},
    create: {
      email: p.email.toLowerCase(),
      name: p.fullName ?? null,
      role: 'STUDENT',
    },
    select: { id: true },
  });

  let courseId: string | null = null;
  if (p.courseSlug) {
    const course = await prisma.course.findUnique({
      where: { slug: p.courseSlug },
      select: { id: true },
    });
    courseId = course?.id ?? null;
  }

  const payment = await prisma.payment.create({
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
    select: { id: true },
  });

  if (courseId) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: { userId: user.id, courseId },
      update: {},
    });
  }

  return { created: true, id: payment.id, courseMatched: !!courseId };
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

  const order = await prisma.connectorOrder.create({
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
    select: { id: true },
  });

  return { created: true, id: order.id };
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
    console.error('❌ external-sales error:', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

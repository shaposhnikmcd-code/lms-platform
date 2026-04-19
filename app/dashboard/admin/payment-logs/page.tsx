import prisma from '@/lib/prisma';
import PaymentLogsView, { type PaymentLogsData } from './_components/PaymentLogsView';

const KIND_FILTERS = ['all', 'course', 'bundle', 'yearly', 'monthly', 'connector', 'unknown'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

export default async function PaymentLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;
  const kind: KindFilter = (KIND_FILTERS as readonly string[]).includes(sp.kind ?? '')
    ? (sp.kind as KindFilter)
    : 'all';
  const parsedPageSize = parseInt(sp.pageSize ?? '') || DEFAULT_PAGE_SIZE;
  const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(parsedPageSize)
    ? parsedPageSize
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const skip = (page - 1) * pageSize;

  const where = kind === 'all' ? {} : { kind };

  const [total, logs, approvedCount, skippedCount, invalidSigCount] = await Promise.all([
    prisma.paymentCallbackLog.count({ where }),
    prisma.paymentCallbackLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip,
    }),
    prisma.paymentCallbackLog.count({
      where: { ...where, transactionStatus: 'Approved', skipped: false, signatureValid: true },
    }),
    prisma.paymentCallbackLog.count({ where: { ...where, skipped: true } }),
    prisma.paymentCallbackLog.count({ where: { ...where, signatureValid: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const uniqueEmails = Array.from(
    new Set(logs.map((l) => l.clientEmail).filter((e): e is string => !!e)),
  );
  const users = uniqueEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: uniqueEmails } },
        select: { email: true, name: true },
      })
    : [];
  const nameByEmail = new Map(users.map((u) => [u.email, u.name]));

  // Для monthly-логів підтягуємо autoRenew з підписки через orderReference → Payment → sub.
  // Використовуємо щоб відобразити «Місячна Автоплатіж» vs «Місячна на 1 міс.» у бейджі.
  const monthlyOrderRefs = Array.from(
    new Set(
      logs
        .filter((l) => l.kind === 'monthly' && l.orderReference)
        .map((l) => l.orderReference as string),
    ),
  );
  const monthlyPayments = monthlyOrderRefs.length
    ? await prisma.payment.findMany({
        where: { orderReference: { in: monthlyOrderRefs } },
        select: {
          orderReference: true,
          yearlyProgramSubscription: { select: { autoRenew: true } },
        },
      })
    : [];
  const autoRenewByOrderRef = new Map(
    monthlyPayments
      .filter((p) => p.yearlyProgramSubscription)
      .map((p) => [p.orderReference, p.yearlyProgramSubscription!.autoRenew]),
  );

  const data: PaymentLogsData = {
    logs: logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      kind: l.kind,
      autoRenew: l.orderReference ? autoRenewByOrderRef.get(l.orderReference) ?? null : null,
      transactionStatus: l.transactionStatus,
      signatureValid: l.signatureValid,
      skipped: l.skipped,
      amount: l.amount,
      currency: l.currency,
      clientName: l.clientEmail ? nameByEmail.get(l.clientEmail) ?? null : null,
      clientEmail: l.clientEmail,
      ip: l.ip,
      actionsTaken: l.actionsTaken,
      skipReason: l.skipReason,
      sendpulseSlugs: l.sendpulseSlugs,
      orderReference: l.orderReference,
    })),
    total,
    approvedCount,
    skippedCount,
    invalidSigCount,
    kind,
    page,
    totalPages,
    pageSize,
  };

  return <PaymentLogsView data={data} />;
}

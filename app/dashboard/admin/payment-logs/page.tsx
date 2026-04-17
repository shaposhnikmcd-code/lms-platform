import prisma from '@/lib/prisma';
import PaymentLogsView, { type PaymentLogsData } from './_components/PaymentLogsView';

const KIND_FILTERS = ['all', 'course', 'bundle', 'connector', 'unknown'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

const PAGE_SIZE = 50;

export default async function PaymentLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const kind: KindFilter = (KIND_FILTERS as readonly string[]).includes(sp.kind ?? '')
    ? (sp.kind as KindFilter)
    : 'all';
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = kind === 'all' ? {} : { kind };

  const [total, logs, approvedCount, skippedCount, invalidSigCount] = await Promise.all([
    prisma.paymentCallbackLog.count({ where }),
    prisma.paymentCallbackLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.paymentCallbackLog.count({
      where: { ...where, transactionStatus: 'Approved', skipped: false, signatureValid: true },
    }),
    prisma.paymentCallbackLog.count({ where: { ...where, skipped: true } }),
    prisma.paymentCallbackLog.count({ where: { ...where, signatureValid: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const data: PaymentLogsData = {
    logs: logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      kind: l.kind,
      transactionStatus: l.transactionStatus,
      signatureValid: l.signatureValid,
      skipped: l.skipped,
      prevStatus: l.prevStatus,
      amount: l.amount,
      currency: l.currency,
      clientEmail: l.clientEmail,
      ip: l.ip,
      actionsTaken: l.actionsTaken,
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
  };

  return <PaymentLogsView data={data} />;
}

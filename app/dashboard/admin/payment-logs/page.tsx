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

  // Для маркера source=TETYANA/UIMP + назви товару (Course.title / Bundle.title)
  // підтягуємо по orderReference одним запитом. Також тягнемо ConnectorOrder для source.
  const allOrderRefs = Array.from(
    new Set(logs.map((l) => l.orderReference).filter((r): r is string => !!r)),
  );
  const [paymentRecords, connectorSources] = allOrderRefs.length
    ? await Promise.all([
        prisma.payment.findMany({
          where: { orderReference: { in: allOrderRefs } },
          select: {
            orderReference: true,
            source: true,
            course: { select: { title: true } },
            bundle: { select: { title: true } },
          },
        }),
        prisma.connectorOrder.findMany({
          where: { orderReference: { in: allOrderRefs } },
          select: { orderReference: true, source: true },
        }),
      ])
    : [[], []];
  const sourceByOrderRef = new Map<string, 'UIMP' | 'TETYANA'>();
  const productNameByOrderRef = new Map<string, string>();
  for (const p of paymentRecords) {
    sourceByOrderRef.set(p.orderReference, p.source);
    const name = p.bundle?.title ?? p.course?.title;
    if (name) productNameByOrderRef.set(p.orderReference, name);
  }
  for (const c of connectorSources) sourceByOrderRef.set(c.orderReference, c.source);

  // Резолвимо "Вид" (деталь) під kind-правилами:
  // - course/bundle → назва з Payment (Course.title / Bundle.title)
  // - connector     → "Конектор"          (Тип = "Гра")
  // - yearly        → "Річна підписка"     (Тип = "Річна програма")
  // - monthly       → "Місячна Автоплатіж" / "Місячна на 1 міс." (Тип = "Річна програма")
  //                   fallback "Місячна" якщо autoRenew невідомий
  function resolveProductName(
    kind: string,
    orderRef: string | null,
    autoRenew: boolean | null,
  ): string | null {
    if (kind === 'connector') return 'Конектор';
    if (kind === 'yearly') return 'Річна підписка';
    if (kind === 'monthly') {
      if (autoRenew === true) return 'Місячна Автоплатіж';
      if (autoRenew === false) return 'Місячна на 1 міс.';
      return 'Місячна';
    }
    if (kind === 'course' || kind === 'bundle') {
      return orderRef ? productNameByOrderRef.get(orderRef) ?? null : null;
    }
    return null;
  }

  const data: PaymentLogsData = {
    logs: logs.map((l) => {
      const autoRenew = l.orderReference ? autoRenewByOrderRef.get(l.orderReference) ?? null : null;
      return {
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        kind: l.kind,
        autoRenew,
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
        productName: resolveProductName(l.kind, l.orderReference, autoRenew),
        saleSource: (l.orderReference && sourceByOrderRef.get(l.orderReference)) || 'UIMP',
      };
    }),
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

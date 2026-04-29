/// Resolves the user-facing status of a payment by `orderReference`. Uses the
/// orderReference prefix to pick the right table (ConnectorOrder vs Payment),
/// then maps the internal status to one of four states the UI cares about.
///
/// Used by `/payment/success` and `/payment/thank-you` to render correct UI
/// after WFP redirect: WFP brings the user back regardless of approval, so
/// pages must verify against our own DB rather than trust the redirect alone.

import prisma from '@/lib/prisma';

export type PaymentResolution = 'PAID' | 'PENDING' | 'FAILED' | 'NOT_FOUND';

export type PaymentTypeKind = 'connector' | 'bundle' | 'course' | 'yearly' | 'monthly' | 'unknown';

export function inferKindFromOrderRef(orderRef: string): PaymentTypeKind {
  if (orderRef.startsWith('connector_')) return 'connector';
  if (orderRef.startsWith('bundle_')) return 'bundle';
  if (orderRef.startsWith('yearly-program-monthly_')) return 'monthly';
  if (orderRef.startsWith('yearly-program_')) return 'yearly';
  if (orderRef.includes('_')) return 'course';
  return 'unknown';
}

export async function resolvePaymentByOrderRef(orderRef: string): Promise<{
  resolution: PaymentResolution;
  kind: PaymentTypeKind;
}> {
  const kind = inferKindFromOrderRef(orderRef);

  if (kind === 'connector') {
    const c = await prisma.connectorOrder.findUnique({
      where: { orderReference: orderRef },
      select: { paymentStatus: true },
    });
    if (!c) return { resolution: 'NOT_FOUND', kind };
    if (c.paymentStatus === 'PAID') return { resolution: 'PAID', kind };
    if (c.paymentStatus === 'FAILED') return { resolution: 'FAILED', kind };
    return { resolution: 'PENDING', kind };
  }

  const p = await prisma.payment.findUnique({
    where: { orderReference: orderRef },
    select: { status: true },
  });
  if (!p) return { resolution: 'NOT_FOUND', kind };
  if (p.status === 'PAID') return { resolution: 'PAID', kind };
  if (p.status === 'FAILED') return { resolution: 'FAILED', kind };
  return { resolution: 'PENDING', kind };
}

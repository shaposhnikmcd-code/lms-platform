import prisma from '@/lib/prisma';
import ConnectorView, { type Row, type SummaryData } from './_components/ConnectorView';

const MAX_ROWS = 500;
const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

export default async function AdminConnectorPage() {
  const [orders, allCount, statusCounts, paidAggr] = await Promise.all([
    prisma.connectorOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        email: true,
        phone: true,
        city: true,
        postOffice: true,
        amount: true,
        gamePrice: true,
        shippingCost: true,
        actualShippingCost: true,
        paymentStatus: true,
        paidAt: true,
        orderStatus: true,
        trackingNumber: true,
        managerNote: true,
        callMe: true,
        orderReference: true,
        source: true,
      },
    }),
    prisma.connectorOrder.count(),
    prisma.connectorOrder.groupBy({
      by: ['orderStatus', 'paymentStatus'],
      _count: { _all: true },
    }),
    prisma.connectorOrder.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const rows: Row[] = orders.map((o) => ({
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    fullName: o.fullName,
    email: o.email,
    phone: o.phone,
    city: o.city,
    postOffice: o.postOffice,
    amount: o.amount,
    gamePrice: o.gamePrice,
    shippingCost: o.shippingCost,
    actualShippingCost: o.actualShippingCost,
    paymentStatus: o.paymentStatus,
    paidAt: o.paidAt?.toISOString() ?? null,
    orderStatus: o.orderStatus,
    trackingNumber: o.trackingNumber,
    managerNote: o.managerNote,
    callMe: o.callMe,
    orderReference: o.orderReference,
    saleSource: o.source,
    isNonStandard:
      o.paymentStatus === 'PAID' &&
      (o.gamePrice ?? CONNECTOR_STANDARD_PRICE) !== CONNECTOR_STANDARD_PRICE &&
      (o.gamePrice ?? CONNECTOR_STANDARD_PRICE) !== CONNECTOR_ADMIN_TEST_PRICE,
  }));

  // KPI з groupBy — точні навіть якщо orders > MAX_ROWS.
  const countByOrderStatus: Record<string, number> = {};
  const countByPaymentStatus: Record<string, number> = {};
  let awaitingManager = 0;
  for (const g of statusCounts) {
    countByOrderStatus[g.orderStatus] = (countByOrderStatus[g.orderStatus] ?? 0) + g._count._all;
    countByPaymentStatus[g.paymentStatus] = (countByPaymentStatus[g.paymentStatus] ?? 0) + g._count._all;
    if (g.orderStatus === 'NEW' && g.paymentStatus === 'PAID') awaitingManager += g._count._all;
  }

  const summary: SummaryData = {
    total: allCount,
    paidCount: paidAggr._count._all,
    pendingPayment: countByPaymentStatus['PENDING'] ?? 0,
    awaitingManager,
    revenueTotal: paidAggr._sum.amount ?? 0,
    statusCounts: {
      NEW: countByOrderStatus['NEW'] ?? 0,
      PROCESSING: countByOrderStatus['PROCESSING'] ?? 0,
      SHIPPED: countByOrderStatus['SHIPPED'] ?? 0,
      DELIVERED: countByOrderStatus['DELIVERED'] ?? 0,
      CANCELLED: countByOrderStatus['CANCELLED'] ?? 0,
    },
    standardPrice: CONNECTOR_STANDARD_PRICE,
  };

  return <ConnectorView rows={rows} summary={summary} />;
}

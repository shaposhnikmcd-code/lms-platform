import prisma from '@/lib/prisma';
import PaymentsView, { type Row } from './_components/PaymentsView';

/// Ліміт на server-side fetch — щоб не тягнути багатотисячну історію в dashboard.
/// Show 500 latest — покриває ~місяць трафіку. Більше — через окремий search/archive view.
const MAX_ROWS = 500;

export default async function AdminPayments() {
  const [payments, connectorOrders] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        orderReference: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
        bundle: { select: { title: true } },
        yearlyProgramSubscription: { select: { plan: true } },
      },
    }),
    prisma.connectorOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        email: true,
        amount: true,
        paymentStatus: true,
        orderReference: true,
      },
    }),
  ]);

  const courseRows: Row[] = payments.map((p) => {
    // Пріоритет визначення source: yearly (по yearlyProgramSubscription) > bundle > course.
    if (p.yearlyProgramSubscription) {
      const plan = p.yearlyProgramSubscription.plan; // 'YEARLY' | 'MONTHLY'
      return {
        id: `pay_${p.id}`,
        source: 'yearly' as const,
        createdAt: p.createdAt.toISOString(),
        clientName: p.user?.name || '—',
        clientEmail: p.user?.email || '',
        productLabel: plan === 'YEARLY' ? 'Річна' : 'Місячна',
        amount: p.amount,
        status: p.status,
        orderReference: p.orderReference,
      };
    }
    return {
      id: `pay_${p.id}`,
      source: p.bundle ? 'bundle' as const : 'course' as const,
      createdAt: p.createdAt.toISOString(),
      clientName: p.user?.name || '—',
      clientEmail: p.user?.email || '',
      productLabel: p.bundle?.title || p.course?.title || '—',
      amount: p.amount,
      status: p.status,
      orderReference: p.orderReference,
    };
  });

  const connectorRows: Row[] = connectorOrders.map((o) => ({
    id: `conn_${o.id}`,
    source: 'connector',
    createdAt: o.createdAt.toISOString(),
    clientName: o.fullName,
    clientEmail: o.email,
    productLabel: 'Гра «Коннектор»',
    amount: o.amount,
    status: o.paymentStatus,
    orderReference: o.orderReference,
  }));

  const rows: Row[] = [...courseRows, ...connectorRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return <PaymentsView rows={rows} />;
}

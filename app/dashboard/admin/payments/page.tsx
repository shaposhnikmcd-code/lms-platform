import prisma from '@/lib/prisma';
import PaymentsTable, { type Row } from './_components/PaymentsTable';

export default async function AdminPayments() {
  const [payments, connectorOrders] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, course: true, bundle: true },
    }),
    prisma.connectorOrder.findMany({
      orderBy: { createdAt: 'desc' },
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

  const courseRows: Row[] = payments.map((p) => ({
    id: `pay_${p.id}`,
    source: p.bundle ? 'bundle' : 'course',
    createdAt: p.createdAt.toISOString(),
    clientName: p.user?.name || '—',
    clientEmail: p.user?.email || '',
    productLabel: p.bundle?.title || p.course?.title || '—',
    amount: p.amount,
    status: p.status,
    orderReference: p.orderReference,
  }));

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Платежі</h1>
      <PaymentsTable rows={rows} />
    </div>
  );
}

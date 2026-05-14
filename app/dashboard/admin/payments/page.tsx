import prisma from '@/lib/prisma';
import PaymentsView, { type Row } from './_components/PaymentsView';

/// Ліміт на server-side fetch — щоб не тягнути багатотисячну історію в dashboard.
/// Show 500 latest — покриває ~місяць трафіку. Більше — через окремий search/archive view.
const MAX_ROWS = 500;

/// Стандартні цінники Конектора (для маркування знижкових покупок).
const CONNECTOR_STANDARD_PRICE = 1099;

export default async function AdminPayments() {
  const [payments, connectorOrders, courseOverrides] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        orderReference: true,
        source: true,
        user: { select: { name: true, email: true, role: true } },
        course: { select: { id: true, slug: true, title: true, price: true } },
        bundle: { select: { id: true, title: true, price: true } },
        yearlyProgramSubscription: { select: { plan: true, autoRenew: true, telegramUsername: true } },
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
        source: true,
      },
    }),
    prisma.coursePriceOverride.findMany({ select: { slug: true, price: true } }),
  ]);

  const overrideBySlug = new Map<string, number | null>();
  for (const o of courseOverrides) overrideBySlug.set(o.slug, o.price);

  // Базова ціна для маркування знижкових платежів.
  // Тестові 1-2₴ адміна/менеджера НЕ маркуємо як discount (це не помилка).
  function computeBasePrice(
    p: typeof payments[number],
  ): number | null {
    if (p.user?.role === 'ADMIN' || p.user?.role === 'MANAGER') return null;
    if (p.amount <= 2) return null;
    if (p.bundle) return p.bundle.price;
    if (p.course) {
      const slugKey = p.course.slug ?? p.course.id;
      const overridePrice = overrideBySlug.get(slugKey);
      return overridePrice ?? p.course.price;
    }
    return null;
  }

  const courseRows: Row[] = payments.map((p) => {
    // Пріоритет визначення source: yearly (по yearlyProgramSubscription) > bundle > course.
    if (p.yearlyProgramSubscription) {
      const { plan, autoRenew, telegramUsername } = p.yearlyProgramSubscription;
      const productLabel =
        plan === 'YEARLY'
          ? 'Річна підписка'
          : autoRenew
            ? 'Місячна Автоплатіж'
            : 'Місячна на 1 міс.';
      return {
        id: `pay_${p.id}`,
        source: 'yearly' as const,
        saleSource: p.source,
        createdAt: p.createdAt.toISOString(),
        clientName: p.user?.name || '—',
        clientEmail: p.user?.email || '',
        clientTelegram: telegramUsername || null,
        productLabel,
        amount: p.amount,
        basePrice: null,
        status: p.status,
        orderReference: p.orderReference,
      };
    }
    return {
      id: `pay_${p.id}`,
      source: p.bundle ? 'bundle' as const : 'course' as const,
      saleSource: p.source,
      createdAt: p.createdAt.toISOString(),
      clientName: p.user?.name || '—',
      clientEmail: p.user?.email || '',
      productLabel: p.bundle?.title || p.course?.title || '—',
      amount: p.amount,
      basePrice: computeBasePrice(p),
      status: p.status,
      orderReference: p.orderReference,
    };
  });

  const connectorRows: Row[] = connectorOrders.map((o) => ({
    id: `conn_${o.id}`,
    source: 'connector',
    saleSource: o.source,
    createdAt: o.createdAt.toISOString(),
    clientName: o.fullName,
    clientEmail: o.email,
    productLabel: 'Конектор',
    amount: o.amount,
    basePrice: o.amount > 2 ? CONNECTOR_STANDARD_PRICE : null,
    status: o.paymentStatus,
    orderReference: o.orderReference,
  }));

  const rows: Row[] = [...courseRows, ...connectorRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return <PaymentsView rows={rows} />;
}

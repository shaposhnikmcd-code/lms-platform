import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import SubscriptionView from './_components/SubscriptionView';

export default async function StudentSubscriptionPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?callbackUrl=/dashboard/student/subscription');

  const sub = await prisma.yearlyProgramSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, status: true, createdAt: true, paidAt: true, orderReference: true },
      },
    },
  });

  if (!sub) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1C3A2E] mb-3">Моя підписка</h1>
        <p className="text-gray-600 mb-8">У вас ще немає активної підписки на Річну програму.</p>
        <a
          href="/uk/yearly-program"
          className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
        >
          Переглянути програму
        </a>
      </div>
    );
  }

  const totalPaid = sub.payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const paidCount = sub.payments.filter((p) => p.status === 'PAID').length;

  return (
    <SubscriptionView
      data={{
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        startDate: sub.startDate?.toISOString() ?? null,
        expiresAt: sub.expiresAt?.toISOString() ?? null,
        lastPaymentAt: sub.lastPaymentAt?.toISOString() ?? null,
        cancelledAt: sub.cancelledAt?.toISOString() ?? null,
        totalPaid,
        paidCount,
        canCancel: sub.plan === 'MONTHLY' && ['ACTIVE', 'GRACE', 'PENDING'].includes(sub.status),
        payments: sub.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          paidAt: p.paidAt?.toISOString() ?? null,
          orderReference: p.orderReference,
        })),
      }}
    />
  );
}

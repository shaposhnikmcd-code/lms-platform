import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { FaCreditCard, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
};

const STATUS_ICONS: Record<string, any> = {
  PENDING: FaClock,
  PAID: FaCheckCircle,
  FAILED: FaTimesCircle,
  REFUNDED: FaCreditCard,
};

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  const payments = await prisma.payment.findMany({
    where: { userId: (session.user as any).id },
    include: { course: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalPaid = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        ← Назад до кабінету
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Платежі</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <FaCreditCard className="text-green-600 text-xl" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Загальна сума оплат</p>
          <p className="text-2xl font-bold text-[#1C3A2E]">{totalPaid.toLocaleString()} UAH</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FaCreditCard className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Платежів ще немає</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Курс</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Сума</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((payment) => {
                const Icon = STATUS_ICONS[payment.status] || FaClock;
                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {payment.course?.title || 'Курс'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {payment.amount.toLocaleString()} UAH
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                        <Icon className="text-xs" />
                        {STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
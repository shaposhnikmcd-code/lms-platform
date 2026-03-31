import prisma from '@/lib/prisma';
import { FaCreditCard } from 'react-icons/fa';
import Link from 'next/link';

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

export default async function AdminPayments() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      course: true,
    },
  });

  const totalRevenue = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const monthRevenue = payments
    .filter(p => p.status === 'PAID' && new Date(p.createdAt) >= new Date(new Date().setDate(new Date().getDate() - 30)))
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
  ← Назад до адмін-панелі
</Link>
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Платежі</h1>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Всього транзакцій', value: payments.length, color: 'text-gray-700' },
          { label: 'Успішних', value: payments.filter(p => p.status === 'PAID').length, color: 'text-green-600' },
          { label: 'Дохід за місяць', value: `${monthRevenue.toLocaleString()} UAH`, color: 'text-blue-600' },
          { label: 'Загальний дохід', value: `${totalRevenue.toLocaleString()} UAH`, color: 'text-[#D4A017]' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FaCreditCard className="text-5xl mx-auto mb-4" />
            <p>Платежів ще немає</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Курс</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Сума</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Референс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <p>{new Date(payment.createdAt).toLocaleDateString('uk-UA')}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(payment.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{payment.user?.name || '—'}</p>
                      <p className="text-xs text-gray-500">{payment.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.course?.title || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {payment.amount.toLocaleString()} UAH
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                        {STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {payment.orderReference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
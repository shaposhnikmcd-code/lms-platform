import prisma from '@/lib/prisma';
import { FaCreditCard } from 'react-icons/fa';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PAID: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  FAILED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  REFUNDED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
};

export default async function AdminPayments() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      course: true,
      bundle: true,
    },
  });

  const totalRevenue = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const monthRevenue = payments
    .filter(p => p.status === 'PAID' && new Date(p.createdAt) >= new Date(new Date().setDate(new Date().getDate() - 30)))
    .reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    { label: 'Всього транзакцій', value: payments.length.toLocaleString(), iconBg: 'bg-slate-100', ring: 'ring-slate-200', accent: 'from-slate-500/10 to-slate-500/5' },
    { label: 'Успішних', value: payments.filter(p => p.status === 'PAID').length.toLocaleString(), iconBg: 'bg-emerald-50', ring: 'ring-emerald-100', accent: 'from-emerald-500/15 to-emerald-500/5' },
    { label: 'Дохід за місяць', value: `${monthRevenue.toLocaleString()} ₴`, iconBg: 'bg-sky-50', ring: 'ring-sky-100', accent: 'from-sky-500/15 to-sky-500/5' },
    { label: 'Загальний дохід', value: `${totalRevenue.toLocaleString()} ₴`, iconBg: 'bg-amber-50', ring: 'ring-amber-100', accent: 'from-amber-500/15 to-amber-500/5' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Платежі</h1>

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="relative overflow-hidden bg-white rounded-xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none`} />
            <div className="relative">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Таблиця */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {payments.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <FaCreditCard className="text-5xl mx-auto mb-4 text-slate-300" />
            <p className="text-sm">Платежів ще немає</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Клієнт</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Курс</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Сума</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Референс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-600">
                      <p>{new Date(payment.createdAt).toLocaleDateString('uk-UA')}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(payment.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-800">{payment.user?.name || '—'}</p>
                      <p className="text-xs text-slate-500">{payment.user?.email}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {payment.bundle ? (
                        <span className="inline-flex items-center gap-1 text-violet-700 bg-violet-50 ring-1 ring-violet-100 px-2 py-0.5 rounded-full text-xs font-medium">
                          📦 {payment.bundle.title}
                        </span>
                      ) : (
                        payment.course?.title || '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-800 tabular-nums">
                      {payment.amount.toLocaleString()} ₴
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                        {STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 font-mono">
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
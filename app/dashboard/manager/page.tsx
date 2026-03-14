'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

interface Order {
  id: string;
  createdAt: string;
  email: string;
  fullName: string;
  phone: string;
  city: string;
  postOffice: string;
  orderReference: string;
  amount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingNumber: string | null;
  managerNote: string | null;
  paidAt: string | null;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Нове',
  PROCESSING: 'В обробці',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
};

const toDateInput = (date: Date) => date.toISOString().split('T')[0];

export default function ManagerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const today = new Date();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(toDateInput(today));

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role;
      if (role !== 'MANAGER' && role !== 'ADMIN') router.push('/dashboard');
    }
  }, [status, session]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Помилка завантаження замовлень:', error);
    } finally {
      setLoading(false);
    }
  };

  const setQuickDate = (days: number) => {
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(toDateInput(from));
    setDateTo(toDateInput(today));
  };

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.trackingNumber || '');
    setManagerNote(order.managerNote || '');
  };

  const saveOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, trackingNumber, managerNote }),
      });
      if (res.ok) {
        await fetchOrders();
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Помилка збереження:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, orderStatus: OrderStatus) => {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, orderStatus }),
      });
      await fetchOrders();
      if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, orderStatus });
    } catch (error) {
      console.error('Помилка оновлення статусу:', error);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'ALL' && o.orderStatus !== filterStatus) return false;
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(o.createdAt) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > to) return false;
    }
    return true;
  });

  const stats = {
    total: filteredOrders.length,
    new: filteredOrders.filter(o => o.orderStatus === 'NEW' && o.paymentStatus === 'PAID').length,
    processing: filteredOrders.filter(o => o.orderStatus === 'PROCESSING').length,
    shipped: filteredOrders.filter(o => o.orderStatus === 'SHIPPED').length,
    revenue: filteredOrders.filter(o => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.amount, 0),
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A017]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1C3A2E]">Кабінет менеджера</h1>
            <p className="text-sm text-gray-500">Замовлення гри Конектор</p>
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-[#D4A017] text-white rounded-lg hover:bg-[#b88913] transition-colors text-sm font-medium"
          >
            Оновити
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Всього замовлень', value: stats.total, color: 'text-gray-700' },
            { label: 'Нових (оплачено)', value: stats.new, color: 'text-blue-600' },
            { label: 'В обробці', value: stats.processing, color: 'text-yellow-600' },
            { label: 'Відправлено', value: stats.shipped, color: 'text-purple-600' },
            { label: 'Дохід (UAH)', value: stats.revenue.toLocaleString(), color: 'text-green-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Фільтр по даті */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">З:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">По:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '1 тиждень', days: 7 },
                { label: '1 місяць', days: 30 },
                { label: '3 місяці', days: 90 },
                { label: '6 місяців', days: 180 },
                { label: '1 рік', days: 365 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setQuickDate(days)}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-[#1C3A2E] hover:text-white transition-colors"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => { setDateFrom(''); setDateTo(toDateInput(today)); }}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                Скинути
              </button>
            </div>
          </div>
        </div>

        {/* Фільтр по статусу */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['ALL', 'NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-[#1C3A2E] text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'Всі' : STATUS_LABELS[s as OrderStatus]}
            </button>
          ))}
        </div>

        {/* Таблиця */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-lg">Замовлень немає</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата та час</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Клієнт</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Місто</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Оплата</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ТТН</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <p>{new Date(order.createdAt).toLocaleDateString('uk-UA')}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{order.fullName}</p>
                        <p className="text-xs text-gray-500">{order.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{order.city}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus]}`}>
                          {PAYMENT_LABELS[order.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.orderStatus}
                          onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[order.orderStatus]}`}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {order.trackingNumber || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openOrder(order)}
                          className="px-3 py-1 bg-[#1C3A2E] text-white text-xs rounded-lg hover:bg-[#2a5242] transition-colors"
                        >
                          Деталі
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Модалка деталей */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              X
            </button>

            <h3 className="text-lg font-bold text-[#1C3A2E] mb-4">Деталі замовлення</h3>

            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Клієнт</p>
                  <p className="font-medium">{selectedOrder.fullName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Телефон</p>
                  <p className="font-medium">{selectedOrder.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{selectedOrder.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Сума</p>
                  <p className="font-medium text-green-600">{selectedOrder.amount} UAH</p>
                </div>
                <div>
                  <p className="text-gray-500">Дата замовлення</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleDateString('uk-UA')}{' '}
                    {new Date(selectedOrder.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Номер замовлення</p>
                  <p className="font-medium text-xs text-gray-600">{selectedOrder.orderReference}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Адреса доставки</p>
                  <p className="font-medium">{selectedOrder.city}, {selectedOrder.postOffice}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер ТТН (трекінг)</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
                  placeholder="20450000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Нотатка менеджера</label>
                <textarea
                  value={managerNote}
                  onChange={(e) => setManagerNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] resize-none"
                  placeholder="Внутрішня нотатка..."
                />
              </div>
              <button
                onClick={saveOrder}
                disabled={saving}
                className="w-full bg-[#D4A017] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors disabled:opacity-50"
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
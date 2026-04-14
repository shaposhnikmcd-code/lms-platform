'use client';

import { useSession } from 'next-auth/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OrderDetailsModal from './OrderDetailsModal';

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
  gamePrice?: number | null;
  shippingCost?: number | null;
  actualShippingCost?: number | null;
  trackingNumber: string | null;
  trackingSetAt?: string | null;
  trackingSetByName?: string | null;
  trackingSetByEmail?: string | null;
  trackingSetByRole?: string | null;
  trackingHistory?: Array<{
    id: string;
    value: string;
    changedAt: string;
    changedByName?: string | null;
    changedByEmail?: string | null;
    changedByRole?: string | null;
  }>;
  managerNote: string | null;
  paidAt: string | null;
  callMe: boolean;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Нове',
  PROCESSING: 'В обробці',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
};

const STATUS_DOT: Record<OrderStatus, string> = {
  NEW: 'bg-sky-500',
  PROCESSING: 'bg-amber-500',
  SHIPPED: 'bg-indigo-500',
  DELIVERED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-500',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const PAYMENT_DOT: Record<PaymentStatus, string> = {
  PENDING: 'bg-slate-400',
  PAID: 'bg-emerald-500',
  FAILED: 'bg-orange-500',
  REFUNDED: 'bg-amber-500',
};

// Fallback тільки для історичних замовлень, де gamePrice не записувався в БД.
// Для нових замовлень ціна береться з order.gamePrice (з payload форми).
const LEGACY_GAME_PRICE = 1099;

const getGamePrice = (o: { gamePrice?: number | null; amount: number }) =>
  typeof o.gamePrice === 'number' ? o.gamePrice : Math.min(o.amount, LEGACY_GAME_PRICE);

const getShippingCost = (o: { shippingCost?: number | null; gamePrice?: number | null; amount: number }) =>
  typeof o.shippingCost === 'number' ? o.shippingCost : Math.max(0, o.amount - getGamePrice(o));

const toDateInput = (date: Date) => date.toISOString().split('T')[0];

const quickDates = [
  { label: '7 д', days: 7 },
  { label: '30 д', days: 30 },
  { label: '90 д', days: 90 },
  { label: '1 р', days: 365 },
];

function computeStats(orders: Order[]) {
  return {
    total: orders.length,
    new: orders.filter((o) => o.orderStatus === 'NEW' && o.paymentStatus === 'PAID').length,
    processing: orders.filter((o) => o.orderStatus === 'PROCESSING').length,
    shipped: orders.filter((o) => o.orderStatus === 'SHIPPED').length,
    revenue: orders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.amount, 0),
  };
}

export default function ManagerDashboardClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(toDateInput(today));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'city' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!openNoteId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-note-popup]')) setOpenNoteId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenNoteId(null); };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKey);
    };
  }, [openNoteId]);
  const [, setSavingRowId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role !== 'MANAGER' && role !== 'ADMIN') router.push('/dashboard');
    }
  }, [status, session]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  useEffect(() => {
    if (deepLinkHandled) return;
    const ref = searchParams.get('order');
    if (!ref || orders.length === 0) return;
    const match = orders.find((o) => o.orderReference === ref);
    if (match) setSelectedOrder(match);
    setDeepLinkHandled(true);
  }, [searchParams, orders, deepLinkHandled]);

  const handleCloseOrderModal = () => {
    setSelectedOrder(null);
    if (searchParams.get('order')) {
      const params = new URLSearchParams(searchParams);
      params.delete('order');
      const query = params.toString();
      router.replace(`/dashboard/manager${query ? `?${query}` : ''}`, { scroll: false });
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connector');
      const data = await res.json();
      setOrders(data.orders || []);
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
      const res = await fetch('/api/connector', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, trackingNumber, managerNote }),
      });
      if (res.ok) {
        await fetchOrders();
        handleCloseOrderModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, orderStatus: OrderStatus) => {
    await fetch('/api/connector', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, orderStatus }),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, orderStatus } : o)));
    if (selectedOrder?.id === id) setSelectedOrder({ ...selectedOrder, orderStatus });
  };

  const saveTracking = async (id: string) => {
    const value = trackingDraft.trim();
    setSavingRowId(id);
    try {
      const res = await fetch('/api/connector', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, trackingNumber: value }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.order;
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
        setEditingTracking(null);
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const saveActualShipping = async (id: string, value: string) => {
    const num = value.trim() === '' ? null : Number(value);
    if (num !== null && Number.isNaN(num)) return;
    setSavingRowId(id);
    try {
      const res = await fetch('/api/connector', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actualShippingCost: num }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, actualShippingCost: num } : o)));
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const saveNote = async (id: string, value: string) => {
    setSavingRowId(id);
    try {
      const res = await fetch('/api/connector', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, managerNote: value }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, managerNote: value || null } : o)));
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
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
      if (q) {
        const hay = `${o.fullName} ${o.phone} ${o.email} ${o.city} ${o.trackingNumber ?? ''} ${o.orderReference}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterStatus, dateFrom, dateTo, search]);

  const sortedOrders = useMemo(() => {
    const arr = [...filteredOrders];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'date': av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
        case 'name': av = a.fullName ?? ''; bv = b.fullName ?? ''; break;
        case 'city': av = a.city ?? ''; bv = b.city ?? ''; break;
        case 'amount': av = a.amount; bv = b.amount; break;
        case 'status': av = a.orderStatus; bv = b.orderStatus; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filteredOrders, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageOrders = sortedOrders.slice(pageStart, pageStart + pageSize);

  useEffect(() => { setPage(1); }, [filterStatus, dateFrom, dateTo, search, pageSize, sortKey, sortDir]);

  const stats = computeStats(filteredOrders);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc'); }
  };

  const SortArrow = ({ k }: { k: typeof sortKey }) =>
    sortKey === k ? <span className="text-indigo-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span> : null;


  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">

        {/* Toolbar — breadcrumb + KPI inline + дія */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Гра «Конектор»</h1>
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Замовлення</span>
          </div>

          <div className="flex-1 flex items-center justify-center gap-1 flex-wrap pl-64">
            {[
              { label: 'Всього', value: stats.total },
              { label: 'Нових', value: stats.new },
              { label: 'В обробці', value: stats.processing },
              { label: 'Відправлено', value: stats.shipped },
              { label: 'Дохід', value: `${stats.revenue.toLocaleString()} ₴` },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center">
                <div className="px-3.5 text-center">
                  <div className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mb-0.5">{s.label}</div>
                  <div className="text-base font-bold text-slate-800 tabular-nums leading-none">{s.value}</div>
                </div>
                {i < arr.length - 1 && <div className="h-8 w-px bg-slate-200" />}
              </div>
            ))}
          </div>
          <button
            onClick={fetchOrders}
            className="ml-auto mr-12 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/30 ring-1 ring-indigo-400/40 hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/40 transition-all"
            title="Оновити"
          >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
              </svg>
              Оновити
            </button>
        </div>

        {/* Sub-toolbar — пошук + статуси + дати */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px] max-w-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук: ім'я, телефон, ТТН, місто…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all"
            />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            {(['ALL', ...Object.keys(STATUS_LABELS)] as string[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'Всі' : STATUS_LABELS[s as OrderStatus]}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-sm bg-transparent focus:outline-none"
            />
            <span className="text-slate-300">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-sm bg-transparent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-0.5">
            {quickDates.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setQuickDate(days)}
                className="px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                {label}
              </button>
            ))}
            {(dateFrom || search) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(toDateInput(today)); setSearch(''); }}
                className="px-2 py-1.5 text-sm font-medium text-slate-400 hover:text-rose-600 transition-colors"
                title="Скинути все"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200">
          {pageOrders.length === 0 ? (
            <div className="p-20 text-center overflow-hidden">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Немає замовлень за цими критеріями</p>
            </div>
          ) : (
            <div data-orders-table>
              <table className="w-full table-fixed text-sm border-separate border-spacing-0 [&_th]:border-r [&_th]:border-slate-200/70 [&_th:last-child]:border-r-0 [&_tbody_td]:border-b [&_tbody_td]:border-slate-100">
                <colgroup>
                  <col style={{ width: '55px' }} />
                  <col style={{ width: '240px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '42px' }} />
                  <col style={{ width: '82px' }} />
                  <col style={{ width: '82px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '180px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-200 [&_th]:text-xs [&_th]:font-bold [&_th]:text-slate-700 [&_th]:uppercase [&_th]:tracking-wider [&_th]:px-4 [&_th]:py-3.5 [&_th]:whitespace-nowrap [&_th]:text-center">
                    <th>
                      <button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-indigo-600 mx-auto">Час<SortArrow k="date" /></button>
                    </th>
                    <th className="!text-left">
                      <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-indigo-600">Клієнт<SortArrow k="name" /></button>
                    </th>
                    <th className="!text-left">
                      <button onClick={() => toggleSort('city')} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-indigo-600">Місто<SortArrow k="city" /></button>
                    </th>
                    <th title="Передзвонити клієнту">
                      <span className="inline-flex items-center justify-center text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </th>
                    <th>
                      <button onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-indigo-600 mx-auto">Гра<SortArrow k="amount" /></button>
                    </th>
                    <th><div className="flex items-center justify-center">Доставка</div></th>
                    <th>
                      <span className="inline-flex items-center gap-1.5">
                        Оплата
                        <span className="group relative inline-flex">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-[100] ml-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="block rounded-lg bg-slate-900 text-white text-xs font-normal normal-case tracking-normal text-left px-3 py-2.5 shadow-xl ring-1 ring-slate-700">
                              <span className="block font-semibold mb-1.5 text-slate-200">Статуси оплати</span>
                              <span className="block space-y-1">
                                <span className="block"><b className="text-white">Очікує</b> — рахунок виставлений, оплати ще немає</span>
                                <span className="block"><b className="text-white">Оплачено</b> — кошти отримані</span>
                                <span className="block"><b className="text-white">Помилка</b> — платіж не пройшов</span>
                                <span className="block"><b className="text-white">Повернено</b> — кошти повернуто клієнту</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </th>
                    <th>
                      <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-indigo-600 mx-auto">Статус<SortArrow k="status" /></button>
                    </th>
                    <th>ТТН</th>
                    <th title="Фактична вартість доставки" className="!whitespace-normal !leading-tight">
                      <div className="flex flex-col items-center">
                        <span>Факт.</span>
                        <span>доставка</span>
                      </div>
                    </th>
                    <th>Нотатки</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Групуємо по даті
                    const groups: { dateKey: string; label: string; items: typeof pageOrders }[] = [];
                    const todayKey = new Date().toLocaleDateString('uk-UA');
                    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayKey = yesterday.toLocaleDateString('uk-UA');

                    pageOrders.forEach((o) => {
                      const k = new Date(o.createdAt).toLocaleDateString('uk-UA');
                      const last = groups[groups.length - 1];
                      if (last && last.dateKey === k) {
                        last.items.push(o);
                      } else {
                        let label = k;
                        if (k === todayKey) label = 'Сьогодні';
                        else if (k === yesterdayKey) label = 'Вчора';
                        groups.push({ dateKey: k, label, items: [o] });
                      }
                    });

                    return groups.map((g) => (
                      <Fragment key={`g-${g.dateKey}`}>
                        <tr>
                          <td colSpan={11} className="!border-r-0 !border-b-0 px-4 pt-5 pb-2 bg-white">
                            <div className="flex items-center gap-3">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-bold text-slate-800">{g.label}</span>
                                {g.label !== g.dateKey && (
                                  <span className="text-sm text-slate-400 tabular-nums">{g.dateKey}</span>
                                )}
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 tabular-nums">
                                  {g.items.length} {g.items.length === 1 ? 'замовлення' : g.items.length < 5 ? 'замовлення' : 'замовлень'}
                                </span>
                              </div>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                          </td>
                        </tr>
                        {g.items.map((order) => {
                          return (
                            <tr
                              key={order.id}
                              onMouseEnter={() => setHoveredRowId(order.id)}
                              onMouseLeave={() => setHoveredRowId(null)}
                              onClick={(e) => {
                                // не відкривати модалку при кліку в editable-поля/кнопки
                                const target = e.target as HTMLElement;
                                if (target.closest('input, select, button, a, [data-note-popup]')) return;
                                openOrder(order);
                              }}
                              data-hovered={hoveredRowId === order.id ? 'true' : undefined}
                              className="cursor-pointer transition-colors [&[data-hovered=true]>td:nth-child(-n+7)]:bg-slate-50 [&[data-hovered=true]>td:nth-child(-n+7)]:shadow-[inset_0_1px_0_#a5b4fc,inset_0_-1px_0_#a5b4fc] [&[data-hovered=true]>td:nth-child(1)]:!shadow-[inset_1px_0_0_#a5b4fc,inset_0_1px_0_#a5b4fc,inset_0_-1px_0_#a5b4fc] [&[data-hovered=true]>td:nth-child(1)]:!rounded-l-lg [&[data-hovered=true]>td:nth-child(7)]:!shadow-[inset_-1px_0_0_#a5b4fc,inset_0_1px_0_#a5b4fc,inset_0_-1px_0_#a5b4fc] [&[data-hovered=true]>td:nth-child(7)]:!rounded-r-lg [&[data-hovered=true]>td:nth-child(-n+7)]:transition-colors [&[data-hovered=true]>td:nth-child(-n+7)]:duration-150"
                            >
                        {/* Час */}
                        <td className="px-4 py-2 text-sm text-slate-600 tabular-nums whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        {/* Клієнт */}
                        <td className="px-4 py-2 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate" title={order.fullName}>{order.fullName}</div>
                          <div className="text-xs text-slate-500 tabular-nums">{order.phone}</div>
                        </td>

                        {/* Місто */}
                        <td className="px-4 py-2 text-sm text-slate-600 truncate" title={`${order.city}, ${order.postOffice}`}>
                          {order.city}
                        </td>

                        {/* Дзвінок */}
                        <td className="px-2 py-3 text-center">
                          {order.callMe ? (
                            <span title="Клієнт просить передзвонити" className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                          ) : (
                            <span title="Дзвонити не потрібно" className="inline-flex w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-slate-100" />
                          )}
                        </td>

                        {/* Гра */}
                        <td className="px-4 py-2 text-center text-sm text-slate-700 tabular-nums whitespace-nowrap">
                          {getGamePrice(order).toLocaleString()}
                        </td>
                        {/* Доставка */}
                        <td className="px-4 py-2 text-center text-sm text-slate-700 tabular-nums whitespace-nowrap">
                          {getShippingCost(order).toLocaleString()}
                        </td>

                        {/* Оплата */}
                        <td className="px-4 py-2 align-middle text-sm font-medium text-slate-700">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${PAYMENT_DOT[order.paymentStatus]}`} />
                          <span className="align-middle">{PAYMENT_LABELS[order.paymentStatus]}</span>
                        </td>

                        {/* Статус */}
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex items-center">
                            <span className={`absolute left-2.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[order.orderStatus]}`} />
                            <select
                              value={order.orderStatus}
                              onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                              className="appearance-none pl-6 pr-7 py-1 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-md hover:bg-slate-100 hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 cursor-pointer transition-all"
                            >
                              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute right-2 w-3 h-3 text-slate-400 pointer-events-none">
                              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </td>

                        {/* ТТН */}
                        <td className="px-4 py-2 align-middle relative" onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <input
                              type="text"
                              defaultValue={order.trackingNumber ?? ''}
                              placeholder=""
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (order.trackingNumber ?? '')) {
                                  setTrackingDraft(v);
                                  saveTracking(order.id);
                                }
                                setTrackingDraft('');
                                setEditingTracking(null);
                              }}
                              onFocus={(e) => { setEditingTracking(order.id); setTrackingDraft(e.target.value); }}
                              onChange={(e) => setTrackingDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
                              }}
                              key={order.id + (order.trackingNumber ?? '')}
                              className="w-full px-2 py-1 pr-7 text-center text-sm font-mono font-bold tabular-nums text-slate-800 bg-slate-50 border border-indigo-300 rounded-md placeholder:text-slate-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            />
                            {editingTracking === order.id && trackingDraft ? (
                              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-500 tabular-nums bg-white px-1 rounded">
                                {trackingDraft.length}
                              </span>
                            ) : order.trackingNumber ? (
                              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-400 tabular-nums">
                                {order.trackingNumber.length}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Факт. доставка */}
                        <td className="px-4 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0"
                            defaultValue={order.actualShippingCost ?? ''}
                            placeholder=""
                            onBlur={(e) => {
                              const v = e.target.value;
                              const cur = order.actualShippingCost ?? '';
                              if (String(v) !== String(cur)) saveActualShipping(order.id, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
                            }}
                            key={order.id + String(order.actualShippingCost ?? '')}
                            className="w-full px-2 py-1 text-center text-sm tabular-nums text-slate-700 bg-slate-50 border border-indigo-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none leading-none"
                          />
                        </td>
                        {/* Нотатки */}
                        <td className="px-4 py-2 min-w-0 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="relative" data-note-popup onClick={(e) => e.stopPropagation()}>
                            {/* Превʼю — видно завжди, ховається коли відкритий попап */}
                            <button
                              type="button"
                              onClick={() => setOpenNoteId(openNoteId === order.id ? null : order.id)}
                              className={`block w-full text-left px-2 py-1 text-sm text-slate-700 truncate rounded-md bg-slate-50 border border-indigo-300 leading-none ${openNoteId === order.id ? 'opacity-0 invisible' : ''}`}
                            >
                              {order.managerNote || <span className="text-slate-400">Нотатка…</span>}
                            </button>
                            {/* Розгорнута картка — повністю накриває комірку і виходить за неї */}
                            <div className={`absolute -inset-x-2 top-1/2 -translate-y-1/2 z-[100] origin-center transition-all duration-150 ${openNoteId === order.id ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
                              <div className="rounded-lg bg-white border-2 border-indigo-400 shadow-2xl shadow-slate-900/25 ring-4 ring-indigo-500/15 p-2">
                                <textarea
                                  defaultValue={order.managerNote ?? ''}
                                  placeholder="Нотатка…"
                                  rows={3}
                                  ref={(el) => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = Math.max(el.scrollHeight, 60) + 'px';
                                    }
                                  }}
                                  onInput={(e) => {
                                    const t = e.target as HTMLTextAreaElement;
                                    t.style.height = 'auto';
                                    t.style.height = t.scrollHeight + 'px';
                                  }}
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    if (v !== (order.managerNote ?? '')) saveNote(order.id, v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                                  }}
                                  key={order.id + (order.managerNote ?? '')}
                                  className="w-full px-2 py-1.5 text-sm text-slate-800 leading-snug bg-slate-50 border border-slate-200 rounded-md resize-none overflow-hidden focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </div>
                            </div>
                          </div>
                        </td>

                      </tr>
                          );
                        })}
                      </Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {sortedOrders.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50/40">
              <div className="text-sm text-slate-500">
                Показано <span className="font-semibold text-slate-700 tabular-nums">{pageStart + 1}–{Math.min(pageStart + pageSize, sortedOrders.length)}</span> з{' '}
                <span className="font-semibold text-slate-700 tabular-nums">{sortedOrders.length}</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ml-3 px-1.5 py-0.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>По {n}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-0.5">
                <button onClick={() => setPage(1)} disabled={currentPage === 1} className="w-7 h-7 flex items-center justify-center text-sm text-slate-600 hover:bg-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-7 h-7 flex items-center justify-center text-sm text-slate-600 hover:bg-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
                <span className="px-3 text-sm font-medium text-slate-700 tabular-nums">{currentPage} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-7 h-7 flex items-center justify-center text-sm text-slate-600 hover:bg-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
                <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="w-7 h-7 flex items-center justify-center text-sm text-slate-600 hover:bg-slate-200 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          trackingNumber={trackingNumber}
          managerNote={managerNote}
          saving={saving}
          onClose={handleCloseOrderModal}
          onTrackingChange={setTrackingNumber}
          onNoteChange={setManagerNote}
          onSave={saveOrder}
        />
      )}
    </div>
  );
}

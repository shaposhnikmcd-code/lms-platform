'use client';

import { useSession } from 'next-auth/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HiOutlineArrowPath,
  HiOutlineCubeTransparent,
  HiOutlineClipboardDocumentList,
  HiOutlineTruck,
  HiOutlineBanknotes,
  HiOutlineSparkles,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineMagnifyingGlass,
  HiOutlinePhone,
  HiOutlineXMark,
  HiOutlineInboxStack,
} from 'react-icons/hi2';
import OrderDetailsModal from './OrderDetailsModal';
import { useAdminTheme, type Theme, type Tone } from '../../admin/_components/adminTheme';
import { AdminShell, AdminPanel } from '../../admin/_components/AdminShell';
import SourceBadge, { type SaleSource } from '../../admin/_components/SourceBadge';

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
  source: SaleSource;
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

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const STATUS_DOT: Record<OrderStatus, keyof typeof DOT_COLORS> = {
  NEW: 'sky',
  PROCESSING: 'amber',
  SHIPPED: 'indigo',
  DELIVERED: 'emerald',
  CANCELLED: 'rose',
};

const PAYMENT_DOT: Record<PaymentStatus, keyof typeof DOT_COLORS> = {
  PENDING: 'slate',
  PAID: 'emerald',
  FAILED: 'rose',
  REFUNDED: 'amber',
};

const DOT_COLORS: Record<string, { dark: string; light: string }> = {
  sky: { dark: 'bg-sky-400', light: 'bg-sky-600' },
  amber: { dark: 'bg-amber-400', light: 'bg-amber-600' },
  indigo: { dark: 'bg-indigo-400', light: 'bg-indigo-600' },
  emerald: { dark: 'bg-emerald-400', light: 'bg-emerald-600' },
  rose: { dark: 'bg-rose-400', light: 'bg-rose-600' },
  slate: { dark: 'bg-slate-400', light: 'bg-stone-400' },
};

// Тип доставки не зберігається в БД — детектимо з postOffice. Див. OrderDetailsModal.tsx.
function detectDeliveryType(postOffice: string): 'warehouse' | 'courier' {
  const s = (postOffice ?? '').trim();
  if (!s) return 'warehouse';
  if (/(\s|^)(буд\.|корп\.|кв\.)/i.test(s)) return 'courier';
  if (/^Відділення|^Поштомат|Parcel Shop|Pick[-\s]?up|Nova Post/i.test(s)) return 'warehouse';
  if (/^(вул\.|просп\.|бул\.|пл\.|пр-т|пров\.)/i.test(s)) return 'courier';
  return 'warehouse';
}

// Fallback тільки для історичних замовлень, де gamePrice не записувався в БД.
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
  const { theme, setTheme, mounted } = useAdminTheme();
  const dark = theme === 'dark';

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
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'delivery' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [, setSavingRowId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role !== 'MANAGER' && role !== 'ADMIN') router.push('/dashboard');
    }
  }, [status, session, router]);

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
        case 'delivery': av = detectDeliveryType(a.postOffice); bv = detectDeliveryType(b.postOffice); break;
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
    sortKey === k ? (
      <span className={dark ? 'text-amber-300 ml-0.5' : 'text-amber-700 ml-0.5'}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  if (!mounted || status === 'loading' || loading) {
    return (
      <div className={`min-h-[calc(100vh-4rem)] flex items-center justify-center ${dark ? 'bg-[#0b0d12]' : 'bg-[#f4eee1]'}`}>
        <div className={`animate-spin rounded-full h-10 w-10 border-2 ${dark ? 'border-white/10 border-t-amber-300' : 'border-stone-300 border-t-amber-700'}`} />
      </div>
    );
  }

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Manager · Connector"
      title="Гра «Конектор»"
      subtitle="Замовлення — статуси, ТТН, нотатки, швидке редагування"
      maxWidth="max-w-[1400px]"
      rightSlot={
        <button
          type="button"
          onClick={fetchOrders}
          title="Оновити"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white hover:border-amber-400/40'
              : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100 hover:border-amber-600/50'
          }`}
        >
          <HiOutlineArrowPath className="text-sm" />
          Оновити
        </button>
      }
    >
      {/* KPI strip */}
      <div
        className={`mb-5 rounded-2xl grid grid-cols-2 lg:grid-cols-5 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineCubeTransparent} label="Всього" value={stats.total.toLocaleString()} />
        <Kpi
          theme={theme}
          icon={HiOutlineSparkles}
          label="Нових"
          value={stats.new.toLocaleString()}
          tone={stats.new > 0 ? 'warning' : 'neutral'}
        />
        <Kpi
          theme={theme}
          icon={HiOutlineClipboardDocumentList}
          label="В обробці"
          value={stats.processing.toLocaleString()}
          tone={stats.processing > 0 ? 'warning' : 'neutral'}
        />
        <Kpi theme={theme} icon={HiOutlineTruck} label="Відправлено" value={stats.shipped.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineBanknotes} label="Дохід" value={`${stats.revenue.toLocaleString()} ₴`} tone="success" glow />
      </div>

      {/* Filters */}
      <AdminPanel theme={theme} padding="p-4" className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px] max-w-sm">
            <HiOutlineMagnifyingGlass
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-base ${dark ? 'text-slate-500' : 'text-stone-500'}`}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук: ім'я, телефон, ТТН, місто…"
              className={`w-full pl-9 pr-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
                  : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
              }`}
            />
          </div>

          {/* Status pills */}
          <FilterGroup
            theme={theme}
            label="Статус"
            options={[
              { value: 'ALL', label: 'Всі' },
              ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
          />

          {/* Date range */}
          <div className={`inline-flex items-center gap-1 rounded-lg px-1 border ${
            dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
          }`}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`px-2 py-1 text-[12px] bg-transparent focus:outline-none tabular-nums ${
                dark ? 'text-slate-200 [color-scheme:dark]' : 'text-stone-800'
              }`}
            />
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`px-2 py-1 text-[12px] bg-transparent focus:outline-none tabular-nums ${
                dark ? 'text-slate-200 [color-scheme:dark]' : 'text-stone-800'
              }`}
            />
          </div>

          {/* Quick dates */}
          <div className="flex items-center gap-0.5">
            {quickDates.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setQuickDate(days)}
                className={`px-2 py-1 text-[12px] font-medium rounded-md transition-colors ${
                  dark ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {label}
              </button>
            ))}
            {(dateFrom || search) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(toDateInput(today)); setSearch(''); }}
                title="Скинути все"
                className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  dark ? 'text-slate-500 hover:text-rose-300 hover:bg-white/[0.06]' : 'text-stone-400 hover:text-rose-600 hover:bg-stone-100'
                }`}
              >
                <HiOutlineXMark className="text-sm" />
              </button>
            )}
          </div>
        </div>
      </AdminPanel>

      {/* Status legend */}
      <AdminPanel theme={theme} padding="px-4 py-3" className="mb-5">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-600' : 'text-stone-500'}`}>
            Статуси
          </span>
          {(['NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as OrderStatus[]).map((s) => (
            <StatusLabel
              key={s}
              theme={theme}
              label={STATUS_LABELS[s]}
              value={orders.filter((o) => o.orderStatus === s).length}
              dot={STATUS_DOT[s]}
              muted={s === 'CANCELLED'}
            />
          ))}
        </div>
      </AdminPanel>

      {/* Table */}
      <AdminPanel theme={theme} padding="p-0">
        {pageOrders.length === 0 ? (
          <div className={`p-16 text-center ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            <div
              className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                dark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-stone-100 border border-stone-200/70'
              }`}
            >
              <HiOutlineInboxStack className={`text-lg ${dark ? 'text-slate-500' : 'text-stone-400'}`} />
            </div>
            <p className="text-[13px]">Немає замовлень за цими критеріями</p>
          </div>
        ) : (
          <div data-orders-table>
            <table className="w-full table-fixed text-[13px] border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: '55px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '195px' }} />
                <col style={{ width: '34px' }} />
                <col style={{ width: '72px' }} />
                <col style={{ width: '82px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '175px' }} />
                <col style={{ width: '190px' }} />
                <col style={{ width: '74px' }} />
                <col style={{ width: '170px' }} />
              </colgroup>
              <thead>
                <tr
                  className={`[&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[12px] [&_th]:text-center [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:font-semibold [&_th]:whitespace-nowrap ${
                    dark
                      ? 'bg-black/20 [&_th]:text-slate-400 [&_th]:border-b [&_th]:border-white/[0.06]'
                      : 'bg-stone-50/60 [&_th]:text-stone-600 [&_th]:border-b [&_th]:border-stone-300/40'
                  }`}
                >
                  <th>
                    <button
                      onClick={() => toggleSort('date')}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        dark ? 'hover:text-amber-300' : 'hover:text-amber-700'
                      }`}
                    >
                      Час<SortArrow k="date" />
                    </button>
                  </th>
                  <th>
                    <button
                      onClick={() => toggleSort('name')}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        dark ? 'hover:text-amber-300' : 'hover:text-amber-700'
                      }`}
                    >
                      Клієнт<SortArrow k="name" />
                    </button>
                  </th>
                  <th>
                    <button
                      onClick={() => toggleSort('delivery')}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        dark ? 'hover:text-amber-300' : 'hover:text-amber-700'
                      }`}
                    >
                      Тип доставки<SortArrow k="delivery" />
                    </button>
                  </th>
                  <th title="Передзвонити клієнту">
                    <HiOutlinePhone className={`inline-block text-base ${dark ? 'text-slate-400' : 'text-stone-500'}`} />
                  </th>
                  <th>
                    <button
                      onClick={() => toggleSort('amount')}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        dark ? 'hover:text-amber-300' : 'hover:text-amber-700'
                      }`}
                    >
                      Гра<SortArrow k="amount" />
                    </button>
                  </th>
                  <th>Доставка</th>
                  <th>Оплата</th>
                  <th>
                    <button
                      onClick={() => toggleSort('status')}
                      className={`inline-flex items-center gap-1 transition-colors ${
                        dark ? 'hover:text-amber-300' : 'hover:text-amber-700'
                      }`}
                    >
                      Статус<SortArrow k="status" />
                    </button>
                  </th>
                  <th>ТТН</th>
                  <th className="!leading-tight !whitespace-normal" title="Фактична вартість доставки">
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
                  const groups: { dateKey: string; label: string; items: typeof pageOrders }[] = [];
                  const todayKey = new Date().toLocaleDateString('uk-UA');
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
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
                        <td colSpan={11} className="px-4 pt-5 pb-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
                                  dark ? 'text-amber-300/80' : 'text-amber-800'
                                }`}
                              >
                                {g.label}
                              </span>
                              {g.label !== g.dateKey && (
                                <span className={`text-[11px] tabular-nums ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                                  {g.dateKey}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums border ${
                                  dark
                                    ? 'bg-amber-500/[0.08] text-amber-300 border-amber-500/20'
                                    : 'bg-amber-100/60 text-amber-800 border-amber-300/50'
                                }`}
                              >
                                {g.items.length}
                              </span>
                            </div>
                            <div className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-stone-300/40'}`} />
                          </div>
                        </td>
                      </tr>
                      {g.items.map((order) => (
                        <OrderRow
                          key={order.id}
                          order={order}
                          theme={theme}
                          hovered={hoveredRowId === order.id}
                          onHoverEnter={() => setHoveredRowId(order.id)}
                          onHoverLeave={() => setHoveredRowId(null)}
                          onOpen={() => openOrder(order)}
                          onStatusChange={updateStatus}
                          editingTracking={editingTracking}
                          trackingDraft={trackingDraft}
                          setEditingTracking={setEditingTracking}
                          setTrackingDraft={setTrackingDraft}
                          saveTracking={saveTracking}
                          saveActualShipping={saveActualShipping}
                          saveNote={saveNote}
                        />
                      ))}
                    </Fragment>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {sortedOrders.length > 0 && (
          <PaginationBar
            theme={theme}
            page={currentPage}
            totalPages={totalPages}
            total={sortedOrders.length}
            pageStart={pageStart}
            pageEnd={Math.min(pageStart + pageSize, sortedOrders.length)}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}
      </AdminPanel>

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
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Order Row
// ─────────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  theme,
  hovered,
  onHoverEnter,
  onHoverLeave,
  onOpen,
  onStatusChange,
  editingTracking,
  trackingDraft,
  setEditingTracking,
  setTrackingDraft,
  saveTracking,
  saveActualShipping,
  saveNote,
}: {
  order: Order;
  theme: Theme;
  hovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onOpen: () => void;
  onStatusChange: (id: string, s: OrderStatus) => void;
  editingTracking: string | null;
  trackingDraft: string;
  setEditingTracking: (v: string | null) => void;
  setTrackingDraft: (v: string) => void;
  saveTracking: (id: string) => void;
  saveActualShipping: (id: string, v: string) => void;
  saveNote: (id: string, v: string) => void;
}) {
  const dark = theme === 'dark';
  const cellBase = `px-4 py-2 align-middle text-[13px] border-b ${
    dark ? 'border-white/[0.04] text-slate-300' : 'border-stone-200/60 text-stone-700'
  }`;

  // "Клікабельна зона" — перших 7 колонок (Час ... Оплата). Візуально виділяємо їх
  // як один суцільний pill: тонкий бордер з 4 сторін + легкий фон. На hover — підсвічується.
  // Фарбування на рівні td (не <tr>) — щоб rounded-corners чітко клацали форму
  // pill-а і bg не витікав за контур у сусідні неклікабельні колонки.
  const clickableBorder = dark ? 'border-white/[0.14]' : 'border-stone-400/40';
  const clickableBgIdle = dark ? 'bg-white/[0.02]' : 'bg-stone-50/60';
  const clickableBgHover = dark ? 'bg-white/[0.05]' : 'bg-amber-50/60';
  const clickableCellBase = `px-4 py-2 align-middle text-[13px] border-y ${clickableBorder} transition-colors ${
    dark ? 'text-slate-300' : 'text-stone-700'
  } ${hovered ? clickableBgHover : clickableBgIdle}`;
  const clickableFirst = `${clickableCellBase} border-l ${clickableBorder} rounded-l-lg`;
  const clickableLast = `${clickableCellBase} border-r ${clickableBorder} rounded-r-lg`;

  const inputCls = `w-full px-2 py-1 text-center text-[13px] tabular-nums rounded-md border outline-none transition-all leading-none ${
    dark
      ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 placeholder:text-slate-600 focus:bg-white/[0.08] focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20'
      : 'bg-white/90 border-stone-300/70 text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/20'
  }`;

  return (
    <tr
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('input, select, button, a, textarea, [data-note-popup]')) return;
        onOpen();
      }}
      className="cursor-pointer"
    >
      {/* Час (перша клікабельна комірка — rounded-l + left border) */}
      <td className={`${clickableFirst} text-center tabular-nums whitespace-nowrap`}>
        {new Date(order.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
      </td>

      {/* Клієнт */}
      <td className={`${clickableCellBase} min-w-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <SourceBadge source={order.source} />
          <div className="min-w-0">
            <div className={`font-medium truncate ${dark ? 'text-slate-100' : 'text-stone-900'}`} title={order.fullName}>
              {order.fullName}
            </div>
            <div className={`text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{order.phone}</div>
          </div>
        </div>
      </td>

      {/* Тип доставки */}
      <td className={`${clickableCellBase} text-center`} title={`${order.city}, ${order.postOffice}`}>
        {(() => {
          const dt = detectDeliveryType(order.postOffice);
          const isCourier = dt === 'courier';
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                isCourier
                  ? dark
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-300/60'
                  : dark
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300/60'
              }`}
            >
              {isCourier ? "🚗 Кур'єром за адресою" : '📦 До відділення НП'}
            </span>
          );
        })()}
      </td>

      {/* Дзвінок */}
      <td className={`${clickableCellBase} text-center`}>
        {order.callMe ? (
          <span
            title="Клієнт просить передзвонити"
            className={`inline-flex w-2.5 h-2.5 rounded-full ring-2 ${
              dark ? 'bg-emerald-400 ring-emerald-500/20' : 'bg-emerald-500 ring-emerald-100'
            }`}
          />
        ) : (
          <span
            title="Дзвонити не потрібно"
            className={`inline-flex w-2.5 h-2.5 rounded-full ring-2 ${
              dark ? 'bg-slate-600 ring-white/[0.04]' : 'bg-stone-300 ring-stone-100'
            }`}
          />
        )}
      </td>

      {/* Гра */}
      <td className={`${clickableCellBase} text-center tabular-nums whitespace-nowrap`}>
        {getGamePrice(order).toLocaleString()}
      </td>

      {/* Доставка */}
      <td className={`${clickableCellBase} text-center tabular-nums whitespace-nowrap`}>
        {getShippingCost(order).toLocaleString()}
      </td>

      {/* Оплата (остання клікабельна комірка — rounded-r + right border) */}
      <td className={clickableLast}>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              dark ? DOT_COLORS[PAYMENT_DOT[order.paymentStatus]].dark : DOT_COLORS[PAYMENT_DOT[order.paymentStatus]].light
            }`}
          />
          <span className={`font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
            {PAYMENT_LABELS[order.paymentStatus]}
          </span>
        </span>
      </td>

      {/* Статус */}
      <td className={cellBase} onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-flex items-center w-full">
          <span
            className={`absolute left-2.5 w-1.5 h-1.5 rounded-full pointer-events-none ${
              dark ? DOT_COLORS[STATUS_DOT[order.orderStatus]].dark : DOT_COLORS[STATUS_DOT[order.orderStatus]].light
            }`}
          />
          <select
            value={order.orderStatus}
            onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
            className={`appearance-none pl-6 pr-7 py-1 w-full text-[13px] font-medium rounded-md border cursor-pointer outline-none transition-all ${
              dark
                ? 'bg-transparent border-transparent text-slate-200 hover:bg-white/[0.05] hover:border-white/[0.08] focus:bg-white/[0.06] focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/20'
                : 'bg-transparent border-transparent text-stone-800 hover:bg-stone-100 hover:border-stone-300/60 focus:bg-white focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/20'
            }`}
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v} className={dark ? 'bg-[#0b0d12]' : ''}>
                {l}
              </option>
            ))}
          </select>
          <HiOutlineChevronDown className={`absolute right-2 text-xs pointer-events-none ${dark ? 'text-slate-500' : 'text-stone-400'}`} />
        </div>
      </td>

      {/* ТТН */}
      <td className={cellBase} onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <input
            type="text"
            defaultValue={order.trackingNumber ?? ''}
            placeholder="—"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (order.trackingNumber ?? '')) {
                setTrackingDraft(v);
                saveTracking(order.id);
              }
              setTrackingDraft('');
              setEditingTracking(null);
            }}
            onFocus={(e) => {
              setEditingTracking(order.id);
              setTrackingDraft(e.target.value);
            }}
            onChange={(e) => setTrackingDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
            key={order.id + (order.trackingNumber ?? '')}
            className={`${inputCls} pr-7 font-mono font-medium`}
          />
          {editingTracking === order.id && trackingDraft ? (
            <span
              className={`pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums px-1 rounded ${
                dark ? 'bg-[#0b0d12] text-amber-300' : 'bg-white text-amber-700'
              }`}
            >
              {trackingDraft.length}
            </span>
          ) : order.trackingNumber ? (
            <span
              className={`pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                dark ? 'text-slate-500' : 'text-stone-400'
              }`}
            >
              {order.trackingNumber.length}
            </span>
          ) : null}
        </div>
      </td>

      {/* Факт. доставка — м'яка амбер-підказка якщо ТТН є, а сума порожня */}
      <td className={cellBase} onClick={(e) => e.stopPropagation()}>
        {(() => {
          const needsAttention = !!order.trackingNumber && order.actualShippingCost == null;
          const attentionInputCls = needsAttention
            ? dark
              ? 'bg-amber-500/[0.07] border-amber-400/40 text-amber-100 placeholder:text-amber-300/60 focus:bg-amber-500/[0.1] focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25'
              : 'bg-amber-50/80 border-amber-500/50 text-amber-900 placeholder:text-amber-700/60 focus:bg-amber-50 focus:border-amber-600/70 focus:ring-2 focus:ring-amber-500/25'
            : '';
          return (
            <div className="relative">
              <input
                type="number"
                min="0"
                defaultValue={order.actualShippingCost ?? ''}
                placeholder={needsAttention ? 'ввести' : '—'}
                onBlur={(e) => {
                  const v = e.target.value;
                  const cur = order.actualShippingCost ?? '';
                  if (String(v) !== String(cur)) saveActualShipping(order.id, v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
                }}
                key={order.id + String(order.actualShippingCost ?? '')}
                className={`w-full px-2 py-1 text-center text-[13px] tabular-nums rounded-md border outline-none transition-all leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  needsAttention
                    ? attentionInputCls
                    : dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 placeholder:text-slate-600 focus:bg-white/[0.08] focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20'
                      : 'bg-white/90 border-stone-300/70 text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/20'
                }`}
              />
              {needsAttention && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-1.5 flex w-1.5 h-1.5"
                  title="Заповніть фактичну доставку"
                >
                  <span
                    className={`absolute inset-0 rounded-full animate-ping opacity-60 ${
                      dark ? 'bg-amber-400' : 'bg-amber-500'
                    }`}
                  />
                  <span
                    className={`relative w-1.5 h-1.5 rounded-full ${dark ? 'bg-amber-400' : 'bg-amber-500'}`}
                  />
                </span>
              )}
            </div>
          );
        })()}
      </td>

      {/* Нотатки — 2 рядки ідл, на focus розгортається ВГОРУ як overlay */}
      <td className={`${cellBase} min-w-0`} onClick={(e) => e.stopPropagation()}>
        {(() => {
          const NOTE_IDLE_MAX_PX = 42; // ~2 рядки при 13px / leading-tight + py-1
          const NOTE_EXPANDED_MAX_PX = 320; // cap розгорнутої висоти, далі — scroll
          const fitIdle = (t: HTMLTextAreaElement) => {
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, NOTE_IDLE_MAX_PX) + 'px';
          };
          const fitExpanded = (t: HTMLTextAreaElement) => {
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, NOTE_EXPANDED_MAX_PX) + 'px';
          };
          return (
            <div className="relative grid">
              {/* Sizer — задає висоту клітинки в ідлі, невидимий */}
              <div
                aria-hidden
                className="[grid-area:1/1] invisible select-none px-2 py-1 text-[13px] leading-tight whitespace-pre-wrap break-words rounded-md border border-transparent overflow-hidden"
                style={{ maxHeight: NOTE_IDLE_MAX_PX }}
              >
                {(order.managerNote ?? '') || '\u00A0'}
              </div>
              <textarea
                key={order.id + (order.managerNote ?? '')}
                defaultValue={order.managerNote ?? ''}
                placeholder="Нотатка…"
                rows={1}
                ref={(el) => { if (el) fitIdle(el); }}
                onFocus={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.position = 'absolute';
                  t.style.left = '0';
                  t.style.right = '0';
                  t.style.bottom = '0';
                  t.style.zIndex = '30';
                  t.style.overflowY = 'auto';
                  fitExpanded(t);
                }}
                onInput={(e) => fitExpanded(e.target as HTMLTextAreaElement)}
                onBlur={(e) => {
                  const t = e.target;
                  const v = t.value;
                  if (v !== (order.managerNote ?? '')) saveNote(order.id, v);
                  t.style.position = '';
                  t.style.left = '';
                  t.style.right = '';
                  t.style.bottom = '';
                  t.style.zIndex = '';
                  t.style.overflowY = '';
                  fitIdle(t);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                className={`[grid-area:1/1] block w-full px-2 py-1 text-[13px] leading-tight rounded-md border resize-none overflow-hidden outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 placeholder:text-slate-600 focus:bg-[#0f1218] focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 focus:shadow-2xl focus:shadow-black/60'
                    : 'bg-white/90 border-stone-300/70 text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/20 focus:shadow-2xl focus:shadow-stone-900/20'
                }`}
              />
            </div>
          );
        })()}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small reusable bits (mirrored from admin ConnectorView)
// ─────────────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  theme,
  glow = false,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  theme: Theme;
  glow?: boolean;
}) {
  const dark = theme === 'dark';
  const toneColor: Record<Tone, { dark: string; light: string }> = {
    neutral: { dark: 'text-white', light: 'text-stone-900' },
    success: { dark: 'text-emerald-300', light: 'text-emerald-800' },
    warning: { dark: 'text-amber-300', light: 'text-amber-800' },
    danger: { dark: 'text-rose-300', light: 'text-rose-700' },
  };
  const glowCls = glow
    ? dark
      ? 'drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]'
      : 'drop-shadow-[0_0_14px_rgba(180,83,9,0.2)]'
    : '';
  return (
    <div className="px-5 py-5">
      <div
        className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-medium mb-2 ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        <Icon className="text-sm" />
        {label}
      </div>
      <div
        className={`text-[22px] font-semibold tabular-nums leading-none ${
          dark ? toneColor[tone].dark : toneColor[tone].light
        } ${glowCls}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterGroup({
  theme,
  label,
  options,
  value,
  onChange,
}: {
  theme: Theme;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label}
      </span>
      <div
        className={`inline-flex rounded-lg p-0.5 border ${
          dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
        }`}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                active
                  ? dark
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-stone-900 text-white shadow-sm'
                  : dark
                    ? 'text-slate-500 hover:text-slate-200'
                    : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusLabel({
  label,
  value,
  dot,
  muted = false,
  theme,
}: {
  label: string;
  value: number;
  dot: keyof typeof DOT_COLORS;
  muted?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const dotClass = dark ? DOT_COLORS[dot].dark : DOT_COLORS[dot].light;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] tabular-nums ${muted ? 'opacity-60' : ''}`}>
      <span className={`w-1 h-1 rounded-full ${dotClass}`} />
      <span className={dark ? 'text-slate-500' : 'text-stone-500'}>{label}</span>
      <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{value}</span>
    </span>
  );
}

function PaginationBar({
  theme,
  page,
  totalPages,
  total,
  pageStart,
  pageEnd,
  pageSize,
  onPage,
  onPageSize,
}: {
  theme: Theme;
  page: number;
  totalPages: number;
  total: number;
  pageStart: number;
  pageEnd: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const dark = theme === 'dark';
  const pages = computePageList(page, totalPages);
  const btnBase = 'inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-md text-[12px] tabular-nums transition-colors';
  const btnIdle = dark
    ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-white/[0.06]'
    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300/50';
  const btnActive = dark
    ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
    : 'bg-amber-100 text-amber-800 border border-amber-300/60';
  const btnDisabled = dark
    ? 'text-slate-600 border border-white/[0.04] cursor-not-allowed'
    : 'text-stone-300 border border-stone-200/60 cursor-not-allowed';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-[12px] ${
        dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'
      }`}
    >
      <div className="tabular-nums">
        Показано{' '}
        <span className={dark ? 'text-slate-200' : 'text-stone-800'}>
          {pageStart + 1}–{pageEnd}
        </span>{' '}
        з <span className={dark ? 'text-slate-200' : 'text-stone-800'}>{total}</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>На сторінці:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className={`h-7 px-2 rounded-md text-[12px] outline-none ${
              dark
                ? 'bg-white/[0.04] border border-white/[0.08] text-slate-200'
                : 'bg-white/80 border border-stone-300/60 text-stone-800'
            }`}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n} className={dark ? 'bg-[#0b0d12]' : ''}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={`${btnBase} ${page <= 1 ? btnDisabled : btnIdle}`}
            aria-label="Попередня сторінка"
          >
            <HiOutlineChevronLeft className="text-sm" />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`dots-${i}`} className={`${btnBase} ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={`${btnBase} ${page >= totalPages ? btnDisabled : btnIdle}`}
            aria-label="Наступна сторінка"
          >
            <HiOutlineChevronRight className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

function computePageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

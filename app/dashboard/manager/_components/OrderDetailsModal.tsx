'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineXMark, HiOutlinePhone } from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../admin/_components/adminTheme';

type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

// Країна зашита у city поле для EU-замовлень: "Польща, Warsaw". Див. OrderForm.tsx:334.
const EU_COUNTRY_NAMES = [
  'Польща', 'Німеччина', 'Чехія', 'Литва', 'Латвія', 'Естонія',
  'Італія', 'Іспанія', 'Словаччина', 'Угорщина', 'Румунія', 'Молдова',
  'Франція', 'Велика Британія', 'Австрія', 'Нідерланди',
];

function parseCountry(city: string): { country: string; city: string } {
  const idx = city.indexOf(', ');
  if (idx > 0) {
    const head = city.slice(0, idx).trim();
    if (EU_COUNTRY_NAMES.includes(head)) {
      return { country: head, city: city.slice(idx + 2).trim() };
    }
  }
  return { country: 'Україна', city };
}

// Тип доставки зараз теж не зберігається в БД — детектимо з postOffice.
// Warehouse: "Відділення № ...", Nova Post / Parcel Shop / Poshtomat.
// Courier: будь-яка адреса з "буд.", "корп.", "кв." або префіксом вулиці.
function detectDeliveryType(postOffice: string): 'warehouse' | 'courier' {
  const s = (postOffice ?? '').trim();
  if (!s) return 'warehouse';
  if (/(\s|^)(буд\.|корп\.|кв\.)/i.test(s)) return 'courier';
  if (/^Відділення|^Поштомат|Parcel Shop|Pick[-\s]?up|Nova Post/i.test(s)) return 'warehouse';
  if (/^(вул\.|просп\.|бул\.|пл\.|пр-т|пров\.)/i.test(s)) return 'courier';
  return 'warehouse';
}

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

interface OrderDetailsModalProps {
  order: Order;
  trackingNumber: string;
  managerNote: string;
  saving: boolean;
  onClose: () => void;
  onTrackingChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
}

function Field({
  label,
  children,
  theme,
}: {
  label: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  return (
    <div>
      <p
        className={`text-[10px] font-semibold tracking-[0.18em] uppercase mb-1 ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </p>
      <div className={`text-[13px] ${dark ? 'text-slate-100' : 'text-stone-800'}`}>{children}</div>
    </div>
  );
}

export default function OrderDetailsModal({
  order,
  trackingNumber,
  saving,
  onClose,
  onTrackingChange,
  onSave,
}: OrderDetailsModalProps) {
  const { theme } = useAdminTheme();
  const dark = theme === 'dark';

  const parsed = parseCountry(order.city);
  const isUkraine = parsed.country === 'Україна';
  const deliveryType = detectDeliveryType(order.postOffice);
  const isCourier = deliveryType === 'courier';

  const fmtDateTime = (s: string) => {
    const d = new Date(s);
    return `${d.toLocaleDateString('uk-UA')} ${d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Drag-to-move. null = розмістити по центру (via transform).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    e.preventDefault();
    const panelEl = (e.currentTarget as HTMLElement).closest('[data-order-modal]') as HTMLElement | null;
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: rect.left, baseY: rect.top };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.baseX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.baseY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ESC закриває
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const positionedStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity backdrop-blur-sm ${
          dark ? 'bg-black/60' : 'bg-stone-900/30'
        }`}
      />

      {/* Panel */}
      <div className="fixed z-50" style={positionedStyle}>
        <div
          data-order-modal
          className={`rounded-2xl w-[760px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden border shadow-2xl ${
            dark
              ? 'bg-[#0f1218] border-white/[0.08] shadow-black/80'
              : 'bg-white border-stone-300/60 shadow-stone-900/25'
          }`}
        >
          {/* Header — drag handle */}
          <div
            onMouseDown={onDragStart}
            className={`flex items-center justify-between px-6 py-4 border-b cursor-move select-none active:cursor-grabbing ${
              dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/40 bg-stone-50/60'
            }`}
          >
            <div className="min-w-0">
              <p
                className={`text-[10px] font-semibold tracking-[0.2em] uppercase mb-1 ${
                  dark ? 'text-amber-400/80' : 'text-amber-700'
                }`}
              >
                Замовлення
              </p>
              <h3 className={`text-[16px] font-semibold truncate ${dark ? 'text-white' : 'text-stone-900'}`}>
                {order.fullName}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрити"
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ml-4 ${
                dark
                  ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <HiOutlineXMark className="text-base" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 overflow-y-auto [scrollbar-width:thin]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Телефон" theme={theme}>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  {order.callMe && (
                    <HiOutlinePhone
                      title="Передзвонити"
                      className={`text-sm ${dark ? 'text-amber-400' : 'text-amber-700'}`}
                    />
                  )}
                  {order.phone}
                </span>
              </Field>
              <Field label="Email" theme={theme}>
                <span className="break-all">{order.email}</span>
              </Field>
              <Field label="Сума" theme={theme}>
                <span className={`font-semibold tabular-nums ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
                  {order.amount.toLocaleString()}&nbsp;₴
                </span>
              </Field>
              <Field label="Дата замовлення" theme={theme}>
                <span className="tabular-nums">{fmtDateTime(order.createdAt)}</span>
              </Field>
              <Field label="Країна" theme={theme}>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${
                    isUkraine
                      ? dark
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                        : 'bg-sky-50 text-sky-800 border-sky-300/60'
                      : dark
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-amber-50 text-amber-800 border-amber-400/60'
                  }`}
                >
                  {parsed.country}
                  {!isUkraine && (
                    <span className={`text-[10px] tracking-wider uppercase ${dark ? 'text-amber-400/70' : 'text-amber-700/70'}`}>
                      EU
                    </span>
                  )}
                </span>
              </Field>
              <Field label="Передзвонити" theme={theme}>
                {order.callMe ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border whitespace-normal leading-tight ${
                      dark
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300/60'
                    }`}
                  >
                    Так — клієнт просить передзвонити
                  </span>
                ) : (
                  <span className={dark ? 'text-slate-600' : 'text-stone-400'}>Ні</span>
                )}
              </Field>
              <Field label="Тип доставки" theme={theme}>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${
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
              </Field>
              <Field label="Номер замовлення" theme={theme}>
                <span className={`font-mono text-[12px] break-all ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {order.orderReference}
                </span>
              </Field>
              <div className="col-span-2">
                <Field label="Адреса доставки" theme={theme}>
                  {parsed.city}, {order.postOffice}
                </Field>
              </div>
            </div>

            {/* ТТН */}
            <div className={`pt-4 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-300/40'}`}>
              <p
                className={`text-[10px] font-semibold tracking-[0.18em] uppercase mb-2 ${
                  dark ? 'text-slate-500' : 'text-stone-500'
                }`}
              >
                Номер ТТН (трекінг)
              </p>
              {order.trackingNumber ? (
                <div
                  className={`rounded-xl border p-4 space-y-3 ${
                    dark
                      ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                      : 'bg-emerald-50/60 border-emerald-300/50'
                  }`}
                >
                  <p
                    className={`font-mono text-[15px] font-bold tracking-wide break-all ${
                      dark ? 'text-emerald-300' : 'text-emerald-800'
                    }`}
                  >
                    {order.trackingNumber}
                  </p>
                  {order.trackingHistory && order.trackingHistory.length > 0 && (
                    <div className={`pt-3 border-t ${dark ? 'border-emerald-500/20' : 'border-emerald-300/50'}`}>
                      <p
                        className={`text-[10px] font-semibold tracking-[0.18em] uppercase mb-2 ${
                          dark ? 'text-slate-500' : 'text-stone-500'
                        }`}
                      >
                        Історія змін
                      </p>
                      <div className="space-y-1.5">
                        {order.trackingHistory.map((h, idx) => (
                          <div key={h.id} className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                            <span
                              className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-semibold border ${
                                dark
                                  ? 'bg-[#0f1218] text-slate-400 border-emerald-500/25'
                                  : 'bg-white text-stone-500 border-emerald-300/60'
                              }`}
                            >
                              {order.trackingHistory!.length - idx}
                            </span>
                            <span
                              className={`font-mono font-semibold truncate ${dark ? 'text-slate-200' : 'text-stone-700'}`}
                            >
                              {h.value}
                            </span>
                            <span className={dark ? 'text-slate-600' : 'text-stone-300'}>·</span>
                            <span className={`truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                              {h.changedByName || h.changedByEmail || '—'}
                            </span>
                            {h.changedByRole && (
                              <span className={dark ? 'text-slate-600' : 'text-stone-400'}>({h.changedByRole})</span>
                            )}
                            <span className={dark ? 'text-slate-600' : 'text-stone-300'}>·</span>
                            <span className={`tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                              {fmtDateTime(h.changedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => onTrackingChange(e.target.value)}
                  placeholder="20450000000000"
                  className={`w-full px-3 py-2 rounded-lg border text-[13px] font-mono outline-none transition-all ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-100 placeholder:text-slate-600 focus:bg-white/[0.08] focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20'
                      : 'bg-white border-stone-300/70 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/60 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          {!order.trackingNumber && (
            <div
              className={`px-6 py-4 border-t ${
                dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/40 bg-stone-50/60'
              }`}
            >
              <button
                onClick={onSave}
                disabled={saving}
                className={`w-full px-4 py-2.5 text-[13px] font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  dark
                    ? 'bg-amber-500/90 hover:bg-amber-400 text-[#0b0d12] shadow-[0_0_24px_-4px_rgba(251,191,36,0.45)]'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_24px_-4px_rgba(180,83,9,0.35)]'
                }`}
              >
                {saving ? 'Збереження…' : 'Зберегти'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

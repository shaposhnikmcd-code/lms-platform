'use client';

import { useEffect, useRef, useState } from 'react';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">{label}</p>
      <div className="text-sm text-slate-800">{children}</div>
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
  const fmtDateTime = (s: string) => {
    const d = new Date(s);
    return `${d.toLocaleDateString('uk-UA')} ${d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Initial position — прив'язана до першого td тіла таблиці
  const [initial, setInitial] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const tableEl = document.querySelector('[data-orders-table] table') as HTMLElement | null;
    if (!tableEl) return;
    const rect = tableEl.getBoundingClientRect();
    const thead = tableEl.querySelector('thead') as HTMLElement | null;
    const headHeight = thead?.getBoundingClientRect().height ?? 0;
    setInitial({ x: rect.left - 4, y: rect.top + headHeight + 8 - 117 });
  }, []);

  // Drag
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    e.preventDefault();
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Click outside (по самому документу, але не блокує праву частину таблиці)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-order-modal]')) onClose();
    };
    // delay subscribe to avoid catching the opening click
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={pos ? { left: pos.x, top: pos.y } : initial ? { left: initial.x, top: initial.y } : { left: 'max(24px, calc(50vw - 700px))', top: '14rem', visibility: 'hidden' }}
    >
      <div data-order-modal className="pointer-events-auto bg-white rounded-2xl shadow-2xl shadow-slate-900/30 ring-1 ring-slate-200 w-[760px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
        {/* Header — drag handle */}
        <div onMouseDown={onDragStart} className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 cursor-move select-none active:cursor-grabbing">
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Замовлення</p>
            <h3 className="text-base font-semibold text-slate-800">{order.fullName}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Закрити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Телефон"><span className="tabular-nums">{order.phone}</span></Field>
            <Field label="Email"><span className="break-all">{order.email}</span></Field>
            <Field label="Сума"><span className="font-semibold tabular-nums">{order.amount.toLocaleString()}&nbsp;₴</span></Field>
            <Field label="Дата замовлення"><span className="tabular-nums">{fmtDateTime(order.createdAt)}</span></Field>
            <div className="col-span-2">
              <Field label="Адреса доставки">{order.city}, {order.postOffice}</Field>
            </div>
            <div className="col-span-2">
              <Field label="Номер замовлення">
                <span className="font-mono text-xs text-slate-600 break-all">{order.orderReference}</span>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Передзвонити">
                {order.callMe ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 text-xs font-medium">
                    Так — клієнт просить передзвонити
                  </span>
                ) : (
                  <span className="text-slate-400">Ні</span>
                )}
              </Field>
            </div>
          </div>

          {/* ТТН */}
          <div className="pt-4 border-t border-slate-200/70">
            <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-2">Номер ТТН (трекінг)</p>
            {order.trackingNumber ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <p className="font-mono text-base font-bold text-emerald-800 tracking-wide break-all">{order.trackingNumber}</p>
                {order.trackingHistory && order.trackingHistory.length > 0 && (
                  <div className="pt-3 border-t border-emerald-200/70">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-2">Історія змін</p>
                    <div className="space-y-1.5">
                      {order.trackingHistory.map((h, idx) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs whitespace-nowrap">
                          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500 ring-1 ring-emerald-200">
                            {order.trackingHistory!.length - idx}
                          </span>
                          <span className="font-mono font-semibold text-slate-700 truncate">{h.value}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-600 truncate">{h.changedByName || h.changedByEmail || '—'}</span>
                          {h.changedByRole && <span className="text-slate-400">({h.changedByRole})</span>}
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 tabular-nums">{fmtDateTime(h.changedAt)}</span>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all"
                placeholder="20450000000000"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        {!order.trackingNumber && (
          <div className="px-6 py-4 border-t border-slate-200/70 bg-slate-50/50">
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-500/30 transition-all disabled:opacity-50"
            >
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCreditCard, FaFilter } from 'react-icons/fa';

export type Row = {
  id: string;
  source: 'course' | 'bundle' | 'connector';
  createdAt: string; // ISO
  clientName: string;
  clientEmail: string;
  productLabel: string;
  amount: number;
  status: string;
  orderReference: string;
};

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

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'course', label: 'Курс' },
  { value: 'bundle', label: 'Пакет' },
  { value: 'connector', label: 'Коннектор' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'PAID', label: 'Оплачено' },
  { value: 'PENDING', label: 'Очікує' },
  { value: 'FAILED', label: 'Помилка' },
  { value: 'REFUNDED', label: 'Повернено' },
];

export default function PaymentsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PAID');

  // Products list depends on selected type
  const productOptions = useMemo(() => {
    const PRODUCT_PREFIX: Record<Row['source'], string> = {
      course: 'Курс',
      bundle: 'Пакет',
      connector: 'Гра',
    };
    const base = typeFilter === 'ALL' ? rows : rows.filter((r) => r.source === typeFilter);
    const seen = new Map<string, Row['source']>();
    for (const r of base) {
      if (!seen.has(r.productLabel)) seen.set(r.productLabel, r.source);
    }
    const items = Array.from(seen.entries())
      .map(([label, source]) => ({ value: label, label: `${PRODUCT_PREFIX[source]} — ${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'uk'));
    return [{ value: 'ALL', label: 'Усі' }, ...items];
  }, [rows, typeFilter]);

  // Reset product filter when type changes and selection no longer valid
  useEffect(() => {
    if (productFilter !== 'ALL' && !productOptions.find((o) => o.value === productFilter)) {
      setProductFilter('ALL');
    }
  }, [productOptions, productFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.source !== typeFilter) return false;
      if (productFilter !== 'ALL' && r.productLabel !== productFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, typeFilter, productFilter, statusFilter]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {rows.length === 0 ? (
        <div className="p-16 text-center text-slate-400">
          <FaCreditCard className="text-5xl mx-auto mb-4 text-slate-300" />
          <p className="text-sm">Платежів ще немає</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/70 bg-slate-50/40">
            <p className="text-xs text-slate-500">
              Показано <span className="font-semibold text-slate-700 tabular-nums">{filtered.length}</span> з {rows.length}
            </p>
            {(typeFilter !== 'ALL' || productFilter !== 'ALL' || statusFilter !== 'PAID') && (
              <button
                onClick={() => {
                  setTypeFilter('ALL');
                  setProductFilter('ALL');
                  setStatusFilter('PAID');
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Скинути фільтри
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Клієнт</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="Тип" value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="Продукт" value={productFilter} options={productOptions} onChange={setProductFilter} />
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Сума</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <FilterHeader label="Статус" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Референс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                      За обраними фільтрами платежів не знайдено
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const date = new Date(row.createdAt);
                    const isClickable = row.source === 'connector';
                    return (
                      <tr
                        key={row.id}
                        onClick={isClickable ? () => router.push(`/dashboard/manager?order=${encodeURIComponent(row.orderReference)}`) : undefined}
                        className={`transition-colors ${isClickable ? 'cursor-pointer hover:bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="px-5 py-3 text-sm text-slate-600">
                          <p>{date.toLocaleDateString('uk-UA')}</p>
                          <p className="text-xs text-slate-400">
                            {date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-slate-800">{row.clientName}</p>
                          <p className="text-xs text-slate-500">{row.clientEmail}</p>
                        </td>
                        <td className="px-5 py-3">
                          {row.source === 'bundle' ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-violet-700 bg-violet-50 ring-1 ring-violet-100">Пакет</span>
                          ) : row.source === 'connector' ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-orange-700 bg-orange-50 ring-1 ring-orange-100">Коннектор</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-sky-700 bg-sky-50 ring-1 ring-sky-100">Курс</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {row.source === 'bundle' ? (
                            <span className="inline-flex items-center gap-1 text-violet-700 bg-violet-50 ring-1 ring-violet-100 px-2 py-0.5 rounded-full text-xs font-medium">
                              📦 {row.productLabel}
                            </span>
                          ) : row.source === 'connector' ? (
                            <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 ring-1 ring-orange-100 px-2 py-0.5 rounded-full text-xs font-medium">
                              🧩 {row.productLabel}
                            </span>
                          ) : (
                            row.productLabel
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-slate-800 tabular-nums">
                          {row.amount.toLocaleString()} ₴
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}>
                            {STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 font-mono">{row.orderReference}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterHeader({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== 'ALL' && !(label === 'Статус' && value === 'PAID');

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider hover:text-slate-700 transition-colors ${
          active ? 'text-indigo-700' : 'text-slate-500'
        }`}
      >
        <span>{label}</span>
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-md transition-colors ${
            active
              ? 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200'
              : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70 hover:text-slate-700 ring-1 ring-slate-300/60'
          }`}
        >
          <FaFilter className="text-[10px]" />
        </span>
        {active && (
          <span className="text-indigo-600">· {selectedLabel}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[180px] max-h-72 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs normal-case tracking-normal transition-colors ${
                opt.value === value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

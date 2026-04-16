'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaPlus, FaEye, FaEyeSlash, FaPause, FaGripVertical } from 'react-icons/fa';
import { HiOutlineBookOpen, HiOutlineGift } from 'react-icons/hi2';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import SuspendButton from './SuspendButton';
import DeleteBundleButton from './DeleteBundleButton';
import BundleModelsButton from './BundleModelsButton';

export type BundleType = 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE';

export type BundleCourseData = {
  id: string;
  courseSlug: string;
  title: string;
  isFree: boolean;
};

export type BundleRowData = {
  id: string;
  title: string;
  type: BundleType;
  price: number;
  fullPrice: number;
  difference: number;
  discountPct: number;
  isPublished: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
  displayMode: 'auto' | 'solo';
  courses: BundleCourseData[];
};

/** Обчислити "ширину" пакета: скільки курсів у найширшому ряду (2, 3 або 4). */
export function bundleWidth(paid: number, free: number): 2 | 3 | 4 {
  const max = Math.max(paid, free);
  if (max >= 4) return 4;
  if (max === 3) return 3;
  return 2;
}

const TYPE_META: Record<BundleType, { icon: string; label: string; dark: string; light: string }> = {
  DISCOUNT: {
    icon: '📉',
    label: 'Знижка на пакет',
    dark: 'text-violet-200 bg-violet-500/10 border-violet-400/25',
    light: 'text-violet-800 bg-violet-200/40 border-violet-500/30',
  },
  FIXED_FREE: {
    icon: '🎁',
    label: 'Безкоштовний\nСталий',
    dark: 'text-emerald-200 bg-emerald-500/10 border-emerald-400/25',
    light: 'text-emerald-800 bg-emerald-200/40 border-emerald-500/30',
  },
  CHOICE_FREE: {
    icon: '🎲',
    label: 'Безкоштовний\nна Вибір',
    dark: 'text-amber-200 bg-amber-500/10 border-amber-400/25',
    light: 'text-amber-800 bg-amber-200/40 border-amber-500/30',
  },
};

export default function BundlesView({
  bundles,
}: {
  bundles: BundleRowData[];
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const [order, setOrder] = useState(bundles);
  const [saving, setSaving] = useState(false);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [markers, setMarkers] = useState<Array<{ id: string; top: number; height: number }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rowTransforms, setRowTransforms] = useState<Record<string, string>>({});
  const rafRef = useRef<number | null>(null);

  // Вимірюємо позицію кожного рядка таблиці — щоб зовнішня смуга з маркерами справа від таблиці
  // точно вирівнювалась до кожного рядка.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const update = () => {
      const rows = Array.from(table.querySelectorAll('tbody tr[data-bundle-id]'));
      setMarkers(
        rows.map((row) => {
          const el = row as HTMLElement;
          return {
            id: el.dataset.bundleId || '',
            top: el.offsetTop,
            height: el.offsetHeight,
          };
        }),
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(table);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [order]);

  // Синхронізуємо локальний порядок з server props, коли оновлюється список пакетів
  useEffect(() => { setOrder(bundles); }, [bundles]);

  // Поки триває drag — читаємо style.transform кожного рядка і синхронізуємо маркери.
  // Це дозволяє маркерам рухатись разом з рядками (і для активного drag, і для цільових що посуваються).
  useEffect(() => {
    if (!activeId) return;
    const tick = () => {
      const table = tableRef.current;
      if (table) {
        const rows = table.querySelectorAll('tbody tr[data-bundle-id]');
        const next: Record<string, string> = {};
        rows.forEach((row) => {
          const el = row as HTMLElement;
          const id = el.dataset.bundleId || '';
          if (id) next[id] = el.style.transform || '';
        });
        setRowTransforms(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setRowTransforms({});
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex(b => b.id === active.id);
    const newIndex = order.findIndex(b => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    setSaving(true);
    try {
      await fetch('/api/admin/bundles/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map(b => b.id) }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Пакети"
      title="Пакети курсів"
      subtitle="Керуй пакетами: типи, ціни, публікація, призупинення."
      maxWidth="max-w-[1360px]"
      rightInset={140}
      rightSlotAfter={<BundleModelsButton theme={theme} />}
      rightSlot={
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/bundles/new"
            className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-300 overflow-hidden ${
              dark
                ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)] hover:bg-amber-300 hover:shadow-[0_0_28px_-2px_rgba(251,191,36,0.65)]'
                : 'bg-stone-900 text-amber-100 shadow-sm hover:bg-stone-800 hover:shadow-[0_6px_18px_-6px_rgba(41,37,36,0.35)]'
            }`}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
                dark ? 'bg-white/30' : 'bg-amber-200/30'
              }`}
            />
            <FaPlus className="relative text-[11px]" />
            <span className="relative">Створити пакет</span>
          </Link>
        </div>
      }
    >
      {order.length === 0 ? (
        <AdminPanel theme={theme} className="py-16 text-center">
          <HiOutlineBookOpen
            className={`text-5xl mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-stone-400'}`}
          />
          <p className={`mb-5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Пакетів ще немає</p>
          <Link
            href="/dashboard/admin/bundles/new"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              dark
                ? 'bg-amber-400/90 text-stone-900 shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)] hover:bg-amber-300'
                : 'bg-stone-900 text-amber-100 hover:bg-stone-800'
            }`}
          >
            <FaPlus /> Створити перший пакет
          </Link>
        </AdminPanel>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <div className="flex items-start gap-3">
        <AdminPanel theme={theme} padding="p-0" className="overflow-hidden flex-1 min-w-0">
          <div
            className={activeId ? 'overflow-hidden' : 'overflow-x-auto'}
            style={activeId ? { overflowY: 'hidden' } : undefined}
          >
            <table ref={tableRef} className="w-full">
              <thead
                className={`border-b ${
                  dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-stone-50/60 border-stone-300/50'
                }`}
              >
                <tr>
                  <Th theme={theme} minWidth={52} align="center">↕</Th>
                  <Th theme={theme} minWidth={220}>Пакет</Th>
                  <Th theme={theme} minWidth={120} align="center">Тип</Th>
                  <Th theme={theme} minWidth={140}>Курси</Th>
                  <Th theme={theme} align="center">Ціна</Th>
                  <Th theme={theme} align="center">Повна</Th>
                  <Th theme={theme} align="center">% знижки</Th>
                  <Th theme={theme} align="center">Різниця</Th>
                  <Th theme={theme} align="center">Статус</Th>
                  <Th theme={theme} align="center">Дії</Th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-stone-200/70'}`}>
                <SortableContext items={order.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {order.map((b, i) => (
                    <BundleRow key={b.id} bundle={b} index={i + 1} theme={theme} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </div>
        </AdminPanel>

        {/* Зовнішня смуга з римськими маркерами ширини пакетів — вирівняна до кожного рядка таблиці */}
        <div className="relative shrink-0" style={{ minWidth: 100, alignSelf: 'stretch' }}>
          {markers.map((m) => {
            const bundle = order.find((b) => b.id === m.id);
            if (!bundle) return null;
            const paid = bundle.courses.filter((c) => !c.isFree).length;
            const free = bundle.courses.filter((c) => c.isFree).length;
            const w = bundleWidth(paid, free);
            const roman = w === 2 ? 'II' : w === 3 ? 'III' : 'IV';
            const bgCls = dark
              ? 'bg-white/[0.04] text-slate-300 border-white/[0.06]'
              : 'bg-stone-900/[0.05] text-stone-700 border-stone-300/40';
            const isActive = activeId === m.id;
            const liveTransform = rowTransforms[m.id];
            const style: React.CSSProperties = {
              position: 'absolute',
              top: m.top,
              left: 0,
              right: 0,
              height: m.height,
              transform: liveTransform || undefined,
              transition: activeId ? 'none' : 'transform 200ms ease',
              ...(isActive ? { opacity: 0.4, zIndex: 30 } : {}),
            };
            return (
              <div
                key={m.id}
                style={style}
                className="flex items-center justify-center"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    title={`Ширина пакета: ${w} курс${w === 2 ? 'и' : 'и'}`}
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border font-serif text-[26px] font-bold tracking-wider leading-none select-none ${bgCls}`}
                  >
                    {roman}
                  </span>
                  <DisplayModeToggle
                    bundleId={bundle.id}
                    initialMode={bundle.displayMode}
                    theme={theme}
                  />
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </DndContext>
      )}
    </AdminShell>
  );
}

function BundleRow({ bundle, index, theme }: { bundle: BundleRowData; index: number; theme: Theme }) {
  const dark = theme === 'dark';
  const typeMeta = TYPE_META[bundle.type];
  const suspended = bundle.isSuspended;

  const titleParts = formatTitle(bundle.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bundle.id });
  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? (dark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.08)') : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      data-bundle-id={bundle.id}
      style={rowStyle}
      className={`transition-colors ${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/80'}`}
    >
      {/* Drag handle */}
      <td className="px-2 py-3 align-middle text-center">
        <button
          type="button"
          title="Перетягніть щоб змінити порядок"
          aria-label="Перетягнути для зміни порядку"
          {...attributes}
          {...listeners}
          className={`group inline-flex items-center justify-center w-8 h-9 rounded-md cursor-grab active:cursor-grabbing touch-none transition-all ${
            dark
              ? 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100/80'
          }`}
        >
          <FaGripVertical className="text-[14px]" />
        </button>
      </td>

      {/* # + title */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-[12px] font-bold tabular-nums border ${
              suspended
                ? dark
                  ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                  : 'bg-amber-200/60 text-amber-900 border-amber-500/40'
                : dark
                  ? 'bg-white/[0.06] text-amber-200 border-white/[0.08]'
                  : 'bg-stone-100/80 text-stone-800 border-stone-300/60'
            }`}
          >
            {index}
          </span>
          <p
            className={`text-[13px] font-medium leading-tight ${
              suspended
                ? dark ? 'text-slate-500' : 'text-stone-500'
                : dark ? 'text-slate-100' : 'text-stone-900'
            }`}
          >
            {titleParts.map((part, i) => (
              <span key={i}>{i > 0 && <br />}{part}</span>
            ))}
          </p>
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-3 align-middle text-center">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg border leading-tight ${
            dark ? typeMeta.dark : typeMeta.light
          }`}
        >
          <span className="text-[13px] leading-none flex-shrink-0">{typeMeta.icon}</span>
          <span className="whitespace-pre-line text-left">{typeMeta.label}</span>
        </span>
      </td>


      {/* Courses */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1">
          {bundle.courses.map(bc => (
            <span
              key={bc.id}
              title={bc.isFree ? 'Безкоштовно в пакеті' : 'Платний курс у пакеті'}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full w-fit border ${
                bc.isFree
                  ? dark
                    ? 'text-emerald-200 bg-emerald-500/10 border-emerald-400/25 pl-1'
                    : 'text-emerald-800 bg-emerald-200/40 border-emerald-500/30 pl-1'
                  : dark
                    ? 'text-slate-200 bg-white/[0.04] border-white/[0.08]'
                    : 'text-stone-700 bg-stone-100/70 border-stone-300/50'
              }`}
            >
              {bc.isFree && (
                <span
                  className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full flex-shrink-0 ${
                    dark
                      ? 'bg-emerald-400/90 text-stone-900 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                      : 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(5,150,105,0.3)]'
                  }`}
                >
                  <HiOutlineGift className="text-[10px]" strokeWidth={2.5} />
                </span>
              )}
              {bc.title}
            </span>
          ))}
        </div>
      </td>

      {/* Bundle price */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            dark
              ? 'text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_8px_rgba(180,83,9,0.2)]'
          }`}
        >
          {bundle.price.toLocaleString()} ₴
        </span>
      </td>

      {/* Full price */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        <span className={`text-[13px] tabular-nums ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {bundle.fullPrice.toLocaleString()} ₴
        </span>
      </td>

      {/* Discount pct */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        {bundle.discountPct > 0 ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              dark
                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25'
                : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30'
            }`}
          >
            −{bundle.discountPct}%
          </span>
        ) : (
          <span className={`text-[12px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>0%</span>
        )}
      </td>

      {/* Difference */}
      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
        {bundle.difference > 0 ? (
          <span
            className={`text-[12px] font-medium tabular-nums ${
              dark ? 'text-emerald-300' : 'text-emerald-700'
            }`}
          >
            −{bundle.difference.toLocaleString()} ₴
          </span>
        ) : (
          <span className={`text-[12px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>0 ₴</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3 align-middle text-center">
        {suspended ? (
          <div className="flex flex-col items-center gap-1">
            <StatusPill theme={theme} tone="warning" icon={<FaPause className="text-[9px]" />}>
              Призупинено
            </StatusPill>
            {bundle.resumeAt && (
              <p className={`text-[10px] ${dark ? 'text-amber-300/70' : 'text-amber-700'}`}>
                Повернеться {new Date(bundle.resumeAt).toLocaleDateString('uk-UA')}
              </p>
            )}
          </div>
        ) : bundle.isPublished ? (
          <StatusPill theme={theme} tone="success" icon={<FaEye className="text-[9px]" />}>
            Опубліковано
          </StatusPill>
        ) : (
          <StatusPill theme={theme} tone="neutral" icon={<FaEyeSlash className="text-[9px]" />}>
            Чернетка
          </StatusPill>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1.5 items-stretch min-w-[120px]">
          <Link
            href={`/dashboard/admin/bundles/${bundle.id}`}
            className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              dark
                ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_14px_-4px_rgba(251,191,36,0.5)]'
                : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-sm'
            }`}
          >
            Редагувати
          </Link>
          <SuspendButton
            theme={theme}
            bundleId={bundle.id}
            suspendedAt={bundle.suspendedAt}
            resumeAt={bundle.resumeAt}
          />
          <DeleteBundleButton theme={theme} bundleId={bundle.id} bundleTitle={bundle.title} />
        </div>
      </td>
    </tr>
  );
}

function Th({
  theme,
  children,
  minWidth,
  align = 'left',
}: {
  theme: Theme;
  children: React.ReactNode;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  return (
    <th
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-3 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${dark ? 'text-slate-500' : 'text-stone-500'}`}
      style={minWidth ? { minWidth } : undefined}
    >
      {children}
    </th>
  );
}

function StatusPill({
  theme,
  tone,
  icon,
  children,
}: {
  theme: Theme;
  tone: 'success' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  const cls = {
    success: dark
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25'
      : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30',
    warning: dark
      ? 'bg-amber-500/10 text-amber-200 border-amber-400/25'
      : 'bg-amber-200/40 text-amber-900 border-amber-500/40',
    neutral: dark
      ? 'bg-white/[0.04] text-slate-300 border-white/[0.08]'
      : 'bg-stone-100/80 text-stone-700 border-stone-300/60',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border w-fit mx-auto ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

function DisplayModeToggle({
  bundleId,
  initialMode,
  theme,
}: {
  bundleId: string;
  initialMode: 'auto' | 'solo';
  theme: Theme;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'auto' | 'solo'>(initialMode);
  const [saving, setSaving] = useState(false);
  const dark = theme === 'dark';
  const grouping = mode === 'auto';

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const toggle = async () => {
    if (saving) return;
    const prev = mode;
    const next: 'auto' | 'solo' = grouping ? 'solo' : 'auto';
    setMode(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayMode: next }),
        credentials: 'include',
      });
      if (!res.ok) {
        setMode(prev);
        return;
      }
      router.refresh();
    } catch {
      setMode(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={grouping}
      aria-label="Групувати з пакетами тієї ж ширини"
      title={grouping ? 'Групується з пакетами тієї ж ширини' : 'Один в ряду (повна ширина)'}
      onClick={toggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-10 shrink-0 rounded-full transition-colors ${
        grouping
          ? dark
            ? 'bg-amber-400/80'
            : 'bg-amber-500'
          : dark
          ? 'bg-white/[0.08]'
          : 'bg-stone-300'
      } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          grouping ? 'translate-x-5 ml-0.5' : 'translate-x-0 ml-0.5'
        }`}
      />
    </button>
  );
}

function formatTitle(title: string): string[] {
  const tokens = title.split(/(\s*(?:,|\s+та\s+|\s+або\s+)\s*)/);
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const word = (tokens[i] ?? '').trim();
    if (!word) continue;
    const sep = (tokens[i + 1] ?? '').trim();
    parts.push(sep === ',' ? `${word},` : sep ? `${word} ${sep}` : word);
  }
  return parts;
}

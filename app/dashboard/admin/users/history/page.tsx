'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FaTrashRestore } from 'react-icons/fa';
import { HiOutlineUserPlus, HiOutlineTrash, HiOutlineArrowUturnLeft } from 'react-icons/hi2';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Адмін',
  MANAGER: 'Менеджер',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  MANAGER: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100',
};

type EventType = 'CREATED' | 'DELETED' | 'RESTORED';

interface AuditEvent {
  id: string;
  userId: string;
  eventType: EventType;
  targetName: string | null;
  targetEmail: string;
  targetRole: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
  user: { image: string | null; deletedAt: string | null } | null;
}

const EVENT_META: Record<EventType, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  CREATED:  { label: 'Додано',     cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100', Icon: HiOutlineUserPlus },
  DELETED:  { label: 'Видалено',   cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',          Icon: HiOutlineTrash },
  RESTORED: { label: 'Відновлено', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',       Icon: HiOutlineArrowUturnLeft },
};

export default function UserHistoryPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/history');
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const restore = async (userId: string) => {
    setRestoringId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, restore: true }),
      });
      if (res.ok) {
        setToast({ message: 'Користувача відновлено', type: 'success' });
        fetchEvents();
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося відновити', type: 'error' });
      }
    } catch {
      setToast({ message: 'Помилка запиту', type: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const formatDateTime = (s: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Історія змін</h1>
          <p className="text-sm text-slate-500 mt-1">Хто і кого додав, видалив чи відновив. Тільки ADMIN/MANAGER.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70">
          <span>Всього подій: <span className="font-semibold text-slate-700 tabular-nums">{events.length}</span></span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-400">Подій ще немає</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Користувач</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Роль</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Подія</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Хто</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => {
                  const meta = EVENT_META[ev.eventType] ?? EVENT_META.CREATED;
                  const Icon = meta.Icon;
                  const canRestore = ev.eventType === 'DELETED' && !!ev.user?.deletedAt;
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0">
                            {ev.user?.image ? (
                              <Image src={ev.user.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              (ev.targetName?.[0] || ev.targetEmail?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{ev.targetName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{ev.targetEmail}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[ev.targetRole] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_LABELS[ev.targetRole] || ev.targetRole}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
                          <Icon className="text-[12px]" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{formatDateTime(ev.createdAt)}</td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-slate-700">{ev.actorName || '—'}</p>
                        {ev.actorEmail && <p className="text-xs text-slate-400">{ev.actorEmail}</p>}
                      </td>
                      <td className="px-5 py-3">
                        {canRestore ? (
                          <button
                            onClick={() => restore(ev.userId)}
                            disabled={restoringId === ev.userId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            <FaTrashRestore className="text-xs" />
                            Відновити
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

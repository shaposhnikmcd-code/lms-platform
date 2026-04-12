'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FaTrashRestore } from 'react-icons/fa';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Адмін',
  MANAGER: 'Менеджер',
  TEACHER: 'Викладач',
  STUDENT: 'Студент',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  MANAGER: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100',
  TEACHER: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  STUDENT: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
};

interface DeletedUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  deletedAt: string | null;
  deletedById: string | null;
  deletedByName: string | null;
  deletedByEmail: string | null;
}

export default function DeletedUsersPage() {
  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users?deleted=1');
      const data = await res.json();
      setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeleted();
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
        setUsers(users.filter(u => u.id !== userId));
      }
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Видалені користувачі</h1>
          <p className="text-sm text-slate-500 mt-1">Архів акаунтів — можна відновити</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70">
          <span>Всього: <span className="font-semibold text-slate-700 tabular-nums">{users.length}</span></span>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-400">Архів порожній</p>
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
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Видалено</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Хто видалив</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0">
                          {u.image ? (
                            <Image src={u.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover grayscale" />
                          ) : (
                            (u.name?.[0] || u.email?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatDateTime(u.deletedAt)}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-slate-700">{u.deletedByName || '—'}</p>
                      {u.deletedByEmail && <p className="text-xs text-slate-400">{u.deletedByEmail}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => restore(u.id)}
                        disabled={restoringId === u.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        <FaTrashRestore className="text-xs" />
                        Відновити
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

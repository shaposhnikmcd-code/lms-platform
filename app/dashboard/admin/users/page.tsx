'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FaUsers, FaSearch, FaTrash, FaTrashRestore } from 'react-icons/fa';

const ROLE_ORDER: Record<string, number> = {
  ADMIN: 1,
  MANAGER: 2,
  TEACHER: 3,
  STUDENT: 4,
};

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

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { enrollments: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Помилка завантаження:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!confirm(`Видалити користувача "${name}"? Його буде перенесено в архів.`)) return;
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка видалення');
      }
    } catch {
      alert('Помилка запиту');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (error) {
      console.error('Помилка зміни ролі:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.toLowerCase();
    return users
      .filter(u =>
        (u.name?.toLowerCase().includes(q) || false) ||
        u.email.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] ?? 99;
        const roleB = ROLE_ORDER[b.role] ?? 99;
        if (roleA !== roleB) return roleA - roleB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [users, search]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Користувачі</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70">
            <FaUsers className="text-slate-400" />
            <span>Всього: <span className="font-semibold text-slate-700 tabular-nums">{users.length}</span></span>
          </div>
          <Link
            href="/dashboard/admin/users/deleted"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200/70 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FaTrashRestore className="text-slate-400" />
            Видалені користувачі
          </Link>
        </div>
      </div>

      <div className="mb-5 relative">
        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          type="text"
          placeholder="Пошук за ім'ям або email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/70 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 border-b border-slate-200/70">
              <tr>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Користувач</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Роль</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Курсів</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Реєстрація</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Останній логін</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Змінити роль</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSorted.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0 shadow-sm">
                        {user.image ? (
                          <img src={user.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          (user.name?.[0] || user.email?.[0] || '?').toUpperCase()
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{user.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{user.email}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600 tabular-nums">{user._count.enrollments}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString('uk-UA')}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {formatDateTime(user.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                      disabled={updatingId === user.id}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 disabled:opacity-50 transition-all"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => deleteUser(user.id, user.name || user.email)}
                      disabled={updatingId === user.id}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Видалити користувача"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                    Користувачів не знайдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FaUsers, FaSearch } from 'react-icons/fa';

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
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-blue-100 text-blue-700',
  STUDENT: 'bg-green-100 text-green-700',
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A017]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        {"← Назад до адмін-панелі"}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1C3A2E]">{"Користувачі"}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FaUsers />
          <span>{"Всього: "}{users.length}</span>
        </div>
      </div>

      <div className="mb-4 relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type="text"
          placeholder={"Пошук за ім'ям або email..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Користувач"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Email"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Роль"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Курсів"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Реєстрація"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Останній логін"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Змінити роль"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAndSorted.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#1C3A2E] rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden flex-shrink-0">
                        {user.image ? (
                          <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          (user.name?.[0] || user.email?.[0] || '?').toUpperCase()
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{user.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user._count.enrollments}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString('uk-UA')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(user.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                      disabled={updatingId === user.id}
                      className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#D4A017] disabled:opacity-50"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    {"Користувачів не знайдено"}
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
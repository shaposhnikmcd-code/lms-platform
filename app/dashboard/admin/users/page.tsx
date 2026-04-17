'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import {
  HiOutlineUsers,
  HiOutlineUserPlus,
  HiOutlineMagnifyingGlass,
  HiOutlineTrash,
  HiOutlineArchiveBoxXMark,
  HiOutlineXMark,
  HiOutlineShieldCheck,
  HiOutlineBriefcase,
  HiOutlineAcademicCap,
  HiOutlineUserCircle,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../_components/adminTheme';
import { AdminShell, AdminPanel } from '../_components/AdminShell';

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

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ADMIN: HiOutlineShieldCheck,
  MANAGER: HiOutlineBriefcase,
  TEACHER: HiOutlineAcademicCap,
  STUDENT: HiOutlineUserCircle,
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

export default function AdminUsersPage() {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'STUDENT' });
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { fetchUsers(); }, []);

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
        setToast({ message: `Користувача "${name}" перенесено в архів`, type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Помилка видалення', type: 'error' });
      }
    } catch {
      setToast({ message: 'Помилка запиту', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const createUser = async () => {
    if (!newUser.email.trim()) { setCreateError('Email обовʼязковий'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Помилка створення'); return; }
      setUsers(prev => [data.user, ...prev]);
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', role: 'STUDENT' });
    } catch {
      setCreateError('Помилка запиту');
    } finally {
      setCreating(false);
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
        setToast({ message: 'Роль оновлено', type: 'success' });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Не вдалося оновити роль', type: 'error' });
      }
    } catch {
      setToast({ message: 'Помилка запиту', type: 'error' });
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

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { ADMIN: 0, MANAGER: 0, TEACHER: 0, STUDENT: 0 };
    for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }, [users]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Користувачі"
      title="Користувачі"
      subtitle="Акаунти, ролі та доступи."
      maxWidth="max-w-7xl"
      rightSlot={
        <>
          <button
            onClick={() => { setShowCreateModal(true); setCreateError(''); }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-full transition-all border ${
              dark
                ? 'bg-amber-500/15 border-amber-500/25 text-amber-200 hover:bg-amber-500/25 hover:border-amber-500/40'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-900 hover:bg-amber-500/25 hover:border-amber-500/50'
            }`}
          >
            <HiOutlineUserPlus className="text-sm" />
            Додати
          </button>
          <Link
            href="/dashboard/admin/users/deleted"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-full transition-all border ${
              dark
                ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:border-stone-400/60'
            }`}
          >
            <HiOutlineArchiveBoxXMark className="text-sm" />
            Видалені
          </Link>
        </>
      }
    >
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-28 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium border backdrop-blur-md ${
            toast.type === 'success'
              ? dark
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900'
              : dark
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-900'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* KPI strip */}
      <div
        className={`mb-6 rounded-2xl grid grid-cols-2 lg:grid-cols-5 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineUsers} label="Всього" value={users.length.toLocaleString()} glow />
        <Kpi theme={theme} icon={HiOutlineShieldCheck} label="Адмінів" value={roleCounts.ADMIN.toLocaleString()} tone="danger" />
        <Kpi theme={theme} icon={HiOutlineBriefcase} label="Менеджерів" value={roleCounts.MANAGER.toLocaleString()} tone="indigo" />
        <Kpi theme={theme} icon={HiOutlineAcademicCap} label="Викладачів" value={roleCounts.TEACHER.toLocaleString()} tone="sky" />
        <Kpi theme={theme} icon={HiOutlineUserCircle} label="Студентів" value={roleCounts.STUDENT.toLocaleString()} tone="success" />
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <HiOutlineMagnifyingGlass className={`absolute left-4 top-1/2 -translate-y-1/2 text-[16px] ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <input
          type="text"
          placeholder="Пошук за імʼям або email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`w-full pl-11 pr-4 py-2.5 rounded-xl text-[13px] border backdrop-blur-sm transition-all outline-none ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:bg-white/[0.06] focus:border-amber-500/40'
              : 'bg-white/70 border-stone-300/50 text-stone-800 placeholder:text-stone-500 focus:bg-white focus:border-amber-500/50'
          }`}
        />
      </div>

      {/* Table */}
      <AdminPanel theme={theme} padding="p-0">
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className={`animate-spin rounded-full h-10 w-10 border-2 ${dark ? 'border-white/10 border-t-amber-400' : 'border-stone-300/60 border-t-amber-700'}`} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
                <tr>
                  <Th theme={theme}>Користувач</Th>
                  <Th theme={theme}>Email</Th>
                  <Th theme={theme}>Роль</Th>
                  <Th theme={theme}>Курсів</Th>
                  <Th theme={theme}>Реєстрація</Th>
                  <Th theme={theme}>Останній логін</Th>
                  <Th theme={theme}>Змінити</Th>
                  <Th theme={theme}>{''}</Th>
                </tr>
              </thead>
              <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
                {filteredAndSorted.map(user => (
                  <tr key={user.id} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0 ${
                            dark
                              ? 'bg-gradient-to-br from-amber-500/70 to-amber-700/70 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                              : 'bg-gradient-to-br from-amber-600 to-amber-800'
                          }`}
                        >
                          {user.image ? (
                            <Image src={user.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            (user.name?.[0] || user.email?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <span className={`text-[13px] font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                          {user.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{user.email}</td>
                    <td className="px-5 py-3">
                      <RolePill theme={theme} role={user.role} />
                    </td>
                    <td className={`px-5 py-3 text-[12px] tabular-nums ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                      {user._count.enrollments}
                    </td>
                    <td className={`px-5 py-3 text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {new Date(user.createdAt).toLocaleDateString('uk-UA')}
                    </td>
                    <td className={`px-5 py-3 text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {formatDateTime(user.lastLoginAt)}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={user.role}
                        onChange={e => changeRole(user.id, e.target.value)}
                        disabled={updatingId === user.id}
                        className={`px-2.5 py-1.5 rounded-lg text-[12px] border transition-all outline-none disabled:opacity-50 ${
                          dark
                            ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-500/40'
                            : 'bg-white/80 border-stone-300/60 text-stone-800 focus:border-amber-500/50'
                        }`}
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
                        title="Видалити користувача"
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          dark
                            ? 'text-slate-500 hover:text-rose-300 hover:bg-rose-500/10'
                            : 'text-stone-500 hover:text-rose-700 hover:bg-rose-500/10'
                        }`}
                      >
                        <HiOutlineTrash className="text-[15px]" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`px-5 py-12 text-center text-[13px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      Користувачів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className={`fixed inset-0 backdrop-blur-sm ${dark ? 'bg-black/60' : 'bg-stone-900/30'}`} onClick={() => setShowCreateModal(false)} />
          <div className="min-h-screen flex items-center justify-center p-4">
            <div
              onClick={e => e.stopPropagation()}
              className={`relative rounded-2xl w-full max-w-md p-6 border backdrop-blur-md ${
                dark
                  ? 'bg-[#12141b]/95 border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.5)]'
                  : 'bg-white/95 border-stone-300/60 shadow-[0_24px_64px_rgba(68,64,60,0.25)]'
              }`}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className={`absolute top-4 right-4 p-1 rounded-md transition-colors ${
                  dark ? 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/70'
                }`}
              >
                <HiOutlineXMark size={18} />
              </button>
              <h2 className={`text-[18px] font-semibold mb-5 tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                Новий користувач
              </h2>

              {createError && (
                <div className={`mb-4 p-3 rounded-lg border text-[12px] ${
                  dark ? 'bg-rose-500/15 border-rose-500/30 text-rose-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
                }`}>
                  {createError}
                </div>
              )}

              <div className="space-y-3.5">
                <ModalField label="Імʼя" theme={theme}>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Прізвище Імʼя"
                    className={modalInputCls(dark)}
                  />
                </ModalField>
                <ModalField label="Email" required theme={theme}>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@email.com"
                    className={modalInputCls(dark)}
                  />
                </ModalField>
                <ModalField label="Роль" theme={theme}>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className={modalInputCls(dark)}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </ModalField>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 px-4 py-2.5 text-[13px] font-medium rounded-lg border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-stone-100/70 border-stone-300/60 text-stone-800 hover:bg-stone-200/70'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className={`flex-1 px-4 py-2.5 text-[13px] font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/30'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-900 hover:bg-amber-500/30'
                  }`}
                >
                  {creating ? 'Створення…' : 'Створити'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  glow = false,
  theme,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'sky' | 'indigo';
  glow?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor: Record<string, string> = {
    neutral: dark ? 'text-white' : 'text-stone-900',
    success: dark ? 'text-emerald-300' : 'text-emerald-800',
    warning: dark ? 'text-amber-300' : 'text-amber-800',
    danger:  dark ? 'text-rose-300' : 'text-rose-700',
    sky:     dark ? 'text-sky-300' : 'text-sky-800',
    indigo:  dark ? 'text-indigo-300' : 'text-indigo-800',
  };
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <div className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {label}
        </div>
      </div>
      <div
        className={`text-[22px] font-semibold tabular-nums leading-none ${
          glow
            ? dark
              ? 'text-amber-200 drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_14px_rgba(180,83,9,0.2)]'
            : toneColor[tone]
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  const dark = theme === 'dark';
  return (
    <th className={`text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </th>
  );
}

function RolePill({ role, theme }: { role: string; theme: Theme }) {
  const dark = theme === 'dark';
  const Icon = ROLE_ICONS[role];
  const map: Record<string, { dark: string; light: string }> = {
    ADMIN:   { dark: 'bg-rose-500/15 text-rose-300 border-rose-500/20',          light: 'bg-rose-500/10 text-rose-800 border-rose-500/25' },
    MANAGER: { dark: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',    light: 'bg-indigo-500/10 text-indigo-800 border-indigo-500/25' },
    TEACHER: { dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',              light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
    STUDENT: { dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', light: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25' },
  };
  const m = map[role] ?? { dark: 'bg-slate-500/20 text-slate-400 border-slate-500/20', light: 'bg-stone-200/70 text-stone-600 border-stone-300/70' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${dark ? m.dark : m.light}`}>
      {Icon && <Icon className="text-[12px]" />}
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function ModalField({ label, required, children, theme }: { label: string; required?: boolean; children: React.ReactNode; theme: Theme }) {
  const dark = theme === 'dark';
  return (
    <div>
      <label className={`block text-[11px] font-medium mb-1 uppercase tracking-[0.12em] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        {label}
        {required && <span className={dark ? 'text-rose-400 ml-0.5' : 'text-rose-600 ml-0.5'}>*</span>}
      </label>
      {children}
    </div>
  );
}

function modalInputCls(dark: boolean): string {
  return `w-full px-3 py-2.5 rounded-lg text-[13px] border transition-all outline-none ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-amber-500/40'
      : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-500 focus:border-amber-500/50'
  }`;
}

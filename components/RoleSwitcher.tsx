'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Адмін',
  MANAGER: 'Менеджер',
};

const ROLE_REDIRECTS: Record<string, string> = {
  ADMIN: '/dashboard/admin',
  MANAGER: '/dashboard/manager',
};

const ROLE_HIERARCHY: Record<string, string[]> = {
  ADMIN: ['ADMIN', 'MANAGER'],
  MANAGER: ['MANAGER'],
};

/** Визначає активну роль із URL — source of truth для UI toggle. session.activeRole
 *  може лишатись «MANAGER» після browser-back на admin-сторінку, тоді toggle
 *  показував би неправильно. Робимо так, як у GitHub/Linear: URL вирішує, що
 *  «активно» зараз. */
function roleFromPathname(pathname: string | null): 'ADMIN' | 'MANAGER' | null {
  if (!pathname) return null;
  if (pathname.startsWith('/dashboard/manager')) return 'MANAGER';
  if (pathname.startsWith('/dashboard/admin')) return 'ADMIN';
  return null;
}

export default function RoleSwitcher() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  // Sync session.activeRole з фактичним URL — щоб server-guard теж бачив актуальну
  // роль після browser-back. Без infinite-loop: тригер лише коли реально mismatch.
  useEffect(() => {
    if (!session?.user) return;
    const urlRole = roleFromPathname(pathname);
    if (!urlRole) return;
    if (session.user.activeRole === urlRole) return;
    update({ activeRole: urlRole });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!session?.user) return null;

  const realRole = session.user.role;
  // UI-режим визначаємо за URL, fallback на session — для проміжного стану до useEffect.
  const activeRole = roleFromPathname(pathname) ?? session.user.activeRole;
  const allowedRoles = ROLE_HIERARCHY[realRole] ?? [];

  if (allowedRoles.length <= 1) return null;

  const handleSwitch = async (newRole: string) => {
    if (newRole === activeRole) return;
    setLoading(true);
    document.body.style.opacity = '0';
    document.body.style.transition = 'none';
    await update({ activeRole: newRole });
    window.location.href = ROLE_REDIRECTS[newRole];
  };

  return (
    <div className="flex items-center gap-0.5 bg-slate-800/80 ring-1 ring-slate-700/50 rounded-lg p-1">
      {allowedRoles.map((role) => (
        <button
          key={role}
          onClick={() => handleSwitch(role)}
          disabled={loading}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeRole === role
              ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
          }`}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </div>
  );
}

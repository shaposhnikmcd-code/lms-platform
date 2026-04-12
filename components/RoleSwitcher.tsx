'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Адмін',
  MANAGER: 'Менеджер',
  TEACHER: 'Викладач',
  STUDENT: 'Студент',
};

const ROLE_REDIRECTS: Record<string, string> = {
  ADMIN: '/dashboard/admin',
  MANAGER: '/dashboard/manager',
  TEACHER: '/dashboard/teacher',
  STUDENT: '/dashboard/student',
};

const ROLE_HIERARCHY: Record<string, string[]> = {
  ADMIN: ['ADMIN', 'MANAGER', 'TEACHER', 'STUDENT'],
  MANAGER: ['MANAGER', 'STUDENT'],
  TEACHER: ['TEACHER', 'STUDENT'],
  STUDENT: ['STUDENT'],
};

export default function RoleSwitcher() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);

  if (!session?.user) return null;

  const realRole = session.user.role;
  const activeRole = session.user.activeRole;
  const allowedRoles = ROLE_HIERARCHY[realRole] ?? ['STUDENT'];

  if (allowedRoles.length <= 1) return null;

  const handleSwitch = async (newRole: string) => {
    if (newRole === activeRole) return;
    setLoading(true);
    // Hide page content immediately via DOM to prevent flash of old dashboard
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
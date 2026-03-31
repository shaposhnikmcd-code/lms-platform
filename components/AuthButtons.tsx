'use client';

import { useSession, signOut } from "next-auth/react";
import { FaUser } from 'react-icons/fa';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function AuthButtons() {
  const { data: session, status } = useSession();
  const t = useTranslations('Auth');

  if (status === 'loading') {
    return <div className="w-8 h-8 bg-gray-200 animate-pulse rounded-full" />;
  }

  if (session?.user) {
    const nameParts = session.user?.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#E8F5E0] transition-colors">
          <div className="w-8 h-8 bg-[#D4A017] rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            {session.user.image ? (
              <img src={session.user.image} alt="Avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <FaUser className="text-white text-sm" />
            )}
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm text-[#1C3A2E]">{firstName}</span>
            <span className="text-sm text-[#1C3A2E]">{lastName || session.user?.email}</span>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="bg-[#D4A017] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#b88913] transition-all"
        >
          {t('logout')}
        </button>
      </div>
    );
  }

  return null;
}
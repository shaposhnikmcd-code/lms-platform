'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { FaUser } from 'react-icons/fa';
import { HiOutlineUserCircle, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { useTranslations } from 'next-intl';

export default function AuthButtons() {
  const { data: session, status } = useSession();
  const t = useTranslations('Auth');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // ignore clicks inside the wrapper (the avatar button)
      if (wrapperRef.current && wrapperRef.current.contains(target)) return;
      // ignore clicks inside the portal dropdown
      if (target instanceof Element && target.closest('[data-auth-dropdown]')) return;
      setOpen(false);
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

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const updatePos = () => {
      const r = btnRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  if (status === 'loading') {
    return null;
  }

  if (!session?.user) return null;

  const nameParts = session.user?.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#E8F5E0] transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-8 h-8 bg-[#D4A017] rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt="Avatar"
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <FaUser className="text-white text-sm" />
          )}
        </div>
        <div className="hidden md:flex flex-col leading-tight items-start">
          <span className="text-sm text-[#1C3A2E]">{firstName}</span>
          <span className="text-sm text-[#1C3A2E]">{lastName || session.user?.email}</span>
        </div>
      </button>

      {mounted && open && pos && createPortal(
        <div
          data-auth-dropdown
          role="menu"
          className="bg-white rounded-xl border border-stone-200 overflow-hidden"
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: 288,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 9999,
          }}
        >
          <div className="px-4 py-3 bg-[#FAF7F0] border-b border-stone-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt="Avatar"
                  width={40}
                  height={40}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <FaUser className="text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1C3A2E] truncate">
                {session.user?.name || '—'}
              </p>
              <p className="text-xs text-stone-500 truncate" title={session.user?.email ?? undefined}>
                {session.user?.email}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-[#1C3A2E] hover:bg-[#E8F5E0] transition-colors"
            role="menuitem"
          >
            <HiOutlineUserCircle className="text-lg" />
            <span>Кабінет</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: '/' });
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-stone-200"
            role="menuitem"
          >
            <HiOutlineArrowRightOnRectangle className="text-lg" />
            <span>{t('logout')}</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

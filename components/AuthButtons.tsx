'use client';

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { FaUser } from 'react-icons/fa';
import AuthModal from './_components/AuthModal';

export default function AuthButtons() {
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(false);

  if (status === 'loading') {
    return <div className="w-24 h-9 bg-gray-200 animate-pulse rounded-lg" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#D4A017] rounded-full flex items-center justify-center overflow-hidden">
            {session.user.image ? (
              <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <FaUser className="text-white text-sm" />
            )}
          </div>
          <span className="text-sm text-[#1C3A2E] hidden md:inline">
            {session.user?.name || session.user?.email || 'Користувач'}
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="bg-[#D4A017] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#b88913] transition-all"
        >
          {"Вийти"}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-[#1C3A2E] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2a4f3f] transition-all"
      >
        {"Увійти"}
      </button>
      <AuthModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
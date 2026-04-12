'use client';

import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { FaUser, FaEnvelope, FaSave } from 'react-icons/fa';

export default function ProfileTab() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const saveProfile = async () => {
    setStatus('saving');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      await update({ name });
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-[#1C3A2E] rounded-full flex items-center justify-center overflow-hidden">
          {session?.user?.image ? (
            <Image src={session.user.image} width={64} height={64} className="w-16 h-16 rounded-full object-cover" alt="avatar" />
          ) : (
            <FaUser className="text-white text-2xl" />
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-800">{session?.user?.name}</p>
          <p className="text-sm text-gray-500">{session?.user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{"Ім'я"}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaUser className="text-gray-400" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              placeholder="Ваше ім'я"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{"Email"}</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaEnvelope className="text-gray-400" />
            </div>
            <input
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{"Email змінити неможливо"}</p>
        </div>

        {status === 'success' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {"Профіль збережено"}
          </div>
        )}
        {status === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {"Помилка збереження"}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={status === 'saving'}
          className="w-full bg-[#D4A017] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FaSave />
          {status === 'saving' ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}
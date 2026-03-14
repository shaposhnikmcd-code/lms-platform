'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { FaUser, FaEnvelope, FaLock, FaSave } from 'react-icons/fa';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const [profileData, setProfileData] = useState({
    name: session?.user?.name || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');

  const saveProfile = async () => {
    setProfileStatus('saving');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileData.name }),
      });

      if (!res.ok) throw new Error();

      await update({ name: profileData.name });
      setProfileStatus('success');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } catch {
      setProfileStatus('error');
      setTimeout(() => setProfileStatus('idle'), 3000);
    }
  };

  const savePassword = async () => {
    setPasswordError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Паролі не співпадають');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Пароль має бути не менше 6 символів');
      return;
    }

    setPasswordStatus('saving');
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || 'Помилка');
        setPasswordStatus('error');
        setTimeout(() => setPasswordStatus('idle'), 3000);
        return;
      }

      setPasswordStatus('success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordStatus('idle'), 3000);
    } catch {
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Налаштування</h1>

      {/* Таби */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'bg-[#1C3A2E] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Профіль
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'password'
              ? 'bg-[#1C3A2E] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Пароль
        </button>
      </div>

      {/* Профіль */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-[#1C3A2E] rounded-full flex items-center justify-center">
              {session?.user?.image ? (
                <img src={session.user.image} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <FaUser className="text-white text-2xl" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{session?.user?.name}</p>
              <p className="text-sm text-gray-50
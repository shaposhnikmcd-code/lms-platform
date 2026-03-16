'use client';

import { useState } from 'react';
import { FaLock } from 'react-icons/fa';

export default function PasswordTab() {
  const [data, setData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const savePassword = async () => {
    setError('');
    if (data.newPassword !== data.confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }
    if (data.newPassword.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }
    setStatus('saving');
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Помилка');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
        return;
      }
      setStatus('success');
      setData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const fields = [
    { key: 'currentPassword' as const, label: 'Поточний пароль', placeholder: 'Поточний пароль' },
    { key: 'newPassword' as const, label: 'Новий пароль', placeholder: 'Мінімум 6 символів' },
    { key: 'confirmPassword' as const, label: 'Підтвердження паролю', placeholder: 'Повторіть новий пароль' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="text-gray-400" />
              </div>
              <input
                type="password"
                value={data[field.key]}
                onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
                placeholder={field.placeholder}
              />
            </div>
          </div>
        ))}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {status === 'success' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {"Пароль змінено успішно"}
          </div>
        )}

        <button
          onClick={savePassword}
          disabled={status === 'saving'}
          className="w-full bg-[#D4A017] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FaLock />
          {status === 'saving' ? 'Збереження...' : 'Змінити пароль'}
        </button>
      </div>
    </div>
  );
}
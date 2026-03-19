'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileTab from './ProfileTab';
import PasswordTab from './PasswordTab';

type Tab = 'profile' | 'password';

const tabs: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Профіль' },
  { key: 'password', label: 'Пароль' },
];

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard/student"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors"
      >
        {"← Назад до кабінету"}
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">{"Налаштування"}</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#1C3A2E] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'password' && <PasswordTab />}
    </div>
  );
}
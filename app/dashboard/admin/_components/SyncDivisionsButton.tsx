'use client';

import { useState } from 'react';
import { HiOutlineGlobeEuropeAfrica } from 'react-icons/hi2';

type Theme = 'dark' | 'light';

export default function SyncDivisionsButton({ theme = 'light' }: { theme?: Theme }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const dark = theme === 'dark';

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/sync-divisions', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult(`✓ Синхронізовано ${data.total} відділень`);
      } else {
        setResult(`✕ Помилка: ${data.message}`);
      }
    } catch {
      setResult('✕ Помилка запиту');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className={`group w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
          dark ? 'hover:bg-white/[0.04]' : 'hover:bg-stone-100/70'
        }`}
      >
        <HiOutlineGlobeEuropeAfrica
          className={`text-lg flex-shrink-0 transition-colors ${loading ? 'animate-spin' : ''} ${
            dark ? 'text-teal-300' : 'text-teal-700'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-medium leading-tight ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {loading ? 'Синхронізація…' : 'Nova Post EU'}
          </div>
          <div className={`text-[11px] truncate mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Оновити список відділень
          </div>
        </div>
      </button>
      {result && (
        <p className={`mt-2 px-2 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{result}</p>
      )}
    </div>
  );
}

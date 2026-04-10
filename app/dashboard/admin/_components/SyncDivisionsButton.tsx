'use client';

import { useState } from 'react';
import { HiOutlineGlobeEuropeAfrica } from 'react-icons/hi2';

export default function SyncDivisionsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

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
        className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
      >
        <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <HiOutlineGlobeEuropeAfrica className={`text-lg text-teal-600 ${loading ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
            {loading ? 'Синхронізація…' : 'Nova Post EU'}
          </div>
          <div className="text-xs text-slate-400 truncate">Оновити список відділень</div>
        </div>
      </button>
      {result && <p className="mt-2 px-3 text-xs text-slate-500">{result}</p>}
    </div>
  );
}

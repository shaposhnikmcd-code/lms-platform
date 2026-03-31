'use client';

import { useState } from 'react';

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
        setResult(`✅ Синхронізовано ${data.total} відділень`);
      } else {
        setResult(`❌ Помилка: ${data.message}`);
      }
    } catch (e) {
      setResult('❌ Помилка запиту');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="block w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left disabled:opacity-50"
      >
        {loading ? '🔄 Синхронізація...' : '🌍 Синхронізувати відділення Nova Post EU'}
      </button>
      {result && <p className="mt-2 text-sm text-gray-600">{result}</p>}
    </div>
  );
}
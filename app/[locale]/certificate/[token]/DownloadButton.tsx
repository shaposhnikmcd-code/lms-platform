'use client';

import { useState } from 'react';

/// Кнопка миттєвого завантаження PDF з візуальним фідбеком ("Завантажую…")
/// поки сервер генерує PDF (regeneratePdfBytes може зайняти 1-3 сек).
/// Тригер download через blob → браузер показує іконку завантаження одразу.
export function DownloadButton({
  pdfUrl,
  filename,
}: {
  pdfUrl: string;
  filename: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${pdfUrl}?download=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Невелика затримка щоб браузер встиг прочитати href.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          backgroundColor: '#1C3A2E',
          backgroundImage: 'linear-gradient(135deg, #2A5A45 0%, #1C3A2E 100%)',
        }}
        className="block w-full text-center px-4 py-3 rounded-xl text-white font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Завантажую…
          </span>
        ) : (
          'Скачати сертифікат'
        )}
      </button>
      {error && (
        <div className="text-[12px] text-red-700 text-center mt-1">{error}</div>
      )}
    </>
  );
}
